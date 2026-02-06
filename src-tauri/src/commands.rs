use std::sync::Mutex;
use tauri::State;

use crate::archive;
use crate::db::Database;
use crate::models::{self, CostSummary, Generation, GenerateParams, Job, JobSource, ListFilter, ModelInfo, Reference, TagCount};
use crate::workflow;

pub struct AppState {
    pub db: Mutex<Database>,
}

#[tauri::command]
pub async fn generate_image(
    state: State<'_, AppState>,
    params: GenerateParams,
) -> Result<Generation, String> {
    // Phase 1: create job (lock, then drop before await)
    let (job_id, estimated_cost, provider) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        workflow::prepare_generation(
            &db,
            &params.model,
            &params.prompt,
            &params.tags,
            JobSource::Gui,
            params.reference_paths.len(),
        )
        .map_err(|e| e.to_string())?
    };

    // Phase 2: async generation (no db lock held)
    let result = match crate::providers::generate(
        &params.model,
        &params.prompt,
        &params.reference_paths,
        params.negative_prompt.as_deref(),
        params.width,
        params.height,
    ).await {
        Ok(r) => r,
        Err(e) => {
            let db = state.db.lock().map_err(|e| e.to_string())?;
            let _ = db.update_job_failed(job_id, &e.to_string());
            return Err(e.to_string());
        }
    };

    // Phase 3: save results (lock again)
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let (_gen_id, generation) = workflow::complete_generation(
        &db,
        job_id,
        &params.prompt,
        &params.model,
        &provider,
        &params.tags,
        &params.reference_paths,
        &result,
        estimated_cost,
        params.negative_prompt.as_deref(),
    )
    .map_err(|e| e.to_string())?;

    // Copy to destination if requested
    if let Some(ref dest) = params.copy_to {
        archive::copy_to(
            std::path::Path::new(&generation.image_path),
            std::path::Path::new(dest),
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(generation)
}

#[tauri::command]
pub fn list_generations(
    state: State<'_, AppState>,
    filter: ListFilter,
) -> Result<Vec<Generation>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.list_generations(&filter).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn search_generations(
    state: State<'_, AppState>,
    query: String,
    limit: i64,
) -> Result<Vec<Generation>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.search_generations(&query, limit).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_generation(state: State<'_, AppState>, id: i64) -> Result<Option<Generation>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_generation(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_starred(state: State<'_, AppState>, id: i64) -> Result<bool, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.toggle_starred(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn trash_generation(state: State<'_, AppState>, id: i64) -> Result<bool, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.trash_generation(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn trash_generations(state: State<'_, AppState>, ids: Vec<i64>) -> Result<usize, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.trash_generations(&ids).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn restore_generation(state: State<'_, AppState>, id: i64) -> Result<bool, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.restore_generation(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn permanently_delete_generation(state: State<'_, AppState>, id: i64) -> Result<bool, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    if let Some(path) = db.permanently_delete_generation(id).map_err(|e| e.to_string())? {
        archive::delete_image(std::path::Path::new(&path)).map_err(|e| e.to_string())?;
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub fn update_prompt(state: State<'_, AppState>, id: i64, prompt: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.update_prompt(id, &prompt).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_title(state: State<'_, AppState>, id: i64, title: Option<String>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.update_title(id, title.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_tags(state: State<'_, AppState>, id: i64, tags: Vec<String>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.add_tags(id, &tags).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_tag(state: State<'_, AppState>, id: i64, tag: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.remove_tag(id, &tag).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_tags(state: State<'_, AppState>) -> Result<Vec<TagCount>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.list_tags().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_models() -> Vec<ModelInfo> {
    ModelInfo::all()
}

#[tauri::command]
pub fn get_cost_summary(
    state: State<'_, AppState>,
    since: Option<String>,
) -> Result<CostSummary, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let since_date = match since.as_deref() {
        Some(s) => models::parse_since(s)?,
        None => None,
    };
    db.get_cost_summary(since_date.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_image_path(path: String) -> String {
    // Convert file path to a format Tauri can serve
    // Using asset protocol
    format!("asset://localhost/{}", path)
}

#[tauri::command]
pub fn get_references(state: State<'_, AppState>, id: i64) -> Result<Vec<Reference>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_references_for_generation(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_jobs(state: State<'_, AppState>) -> Result<Vec<Job>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.list_active_jobs().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_failed_jobs(state: State<'_, AppState>, limit: Option<i64>) -> Result<Vec<Job>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.list_recent_failed_jobs(limit.unwrap_or(10)).map_err(|e| e.to_string())
}

// Collection commands

#[tauri::command]
pub fn list_collections(state: State<'_, AppState>) -> Result<Vec<models::Collection>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.list_collections().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_collection(
    state: State<'_, AppState>,
    name: String,
    description: Option<String>,
) -> Result<i64, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.create_collection(&name, description.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_to_collection(
    state: State<'_, AppState>,
    generation_id: i64,
    collection_name: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.add_to_collection(generation_id, &collection_name).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_from_collection(
    state: State<'_, AppState>,
    generation_id: i64,
    collection_name: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.remove_from_collection(generation_id, &collection_name).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_collection(
    state: State<'_, AppState>,
    name: String,
) -> Result<bool, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.delete_collection(&name).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn prompt_history(
    state: State<'_, AppState>,
    limit: i64,
) -> Result<Vec<(i64, String, String)>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.prompt_history(limit).map_err(|e| e.to_string())
}

// Self-hosted server settings and health check commands

#[tauri::command]
pub fn get_selfhosted_url() -> Option<String> {
    crate::providers::selfhosted::get_server_url()
}

#[tauri::command]
pub fn set_selfhosted_url(url: Option<String>) -> Result<(), String> {
    crate::providers::selfhosted::set_server_url(url.as_deref())
        .map_err(|e| e.to_string())
}

/// Health check response for the frontend
#[derive(serde::Serialize)]
pub struct SelfHostedStatus {
    pub connected: bool,
    pub url: Option<String>,
    pub current_model: Option<String>,
    pub available_models: Vec<String>,
    pub gpu_name: Option<String>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn check_selfhosted_health() -> SelfHostedStatus {
    let url = crate::providers::selfhosted::get_server_url();

    if let Some(ref server_url) = url {
        match crate::providers::selfhosted::check_health(server_url).await {
            Ok(health) => SelfHostedStatus {
                connected: health.status == "healthy",
                url: url.clone(),
                current_model: health.current_model,
                available_models: health.available_models,
                gpu_name: health.gpu_name,
                error: None,
            },
            Err(e) => SelfHostedStatus {
                connected: false,
                url,
                current_model: None,
                available_models: vec![],
                gpu_name: None,
                error: Some(e.to_string()),
            },
        }
    } else {
        SelfHostedStatus {
            connected: false,
            url: None,
            current_model: None,
            available_models: vec![],
            gpu_name: None,
            error: None,
        }
    }
}
