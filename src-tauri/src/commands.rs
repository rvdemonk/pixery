use std::sync::Mutex;
use tauri::State;

use crate::archive;
use crate::db::Database;
use crate::models::{CostSummary, Generation, GenerateParams, ListFilter, ModelInfo, Reference, TagCount};
use crate::providers;

pub struct AppState {
    pub db: Mutex<Database>,
}

#[tauri::command]
pub async fn generate_image(
    state: State<'_, AppState>,
    params: GenerateParams,
) -> Result<Generation, String> {
    let model = &params.model;
    let prompt = &params.prompt;
    let reference_paths = &params.reference_paths;

    // Get model info
    let model_info = ModelInfo::find(model);
    let cost = model_info.as_ref().map(|m| m.cost_per_image);
    let provider = model_info
        .as_ref()
        .map(|m| m.provider.to_string())
        .unwrap_or_else(|| "unknown".to_string());

    // Generate image
    let result = providers::generate(model, prompt, reference_paths)
        .await
        .map_err(|e| e.to_string())?;

    // Save to archive
    let now = chrono::Local::now();
    let date = now.format("%Y-%m-%d").to_string();
    let timestamp = now.format("%Y-%m-%dT%H:%M:%S").to_string();
    let slug = archive::slugify_prompt(prompt);

    let (image_path, thumb_path, width, height, file_size) =
        archive::save_image(&result.image_data, &date, &slug, &timestamp)
            .map_err(|e| e.to_string())?;

    // Insert into database
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let gen_id = db
        .insert_generation(
            &slug,
            prompt,
            model,
            &provider,
            &timestamp,
            &date,
            image_path.to_str().unwrap(),
            thumb_path.as_ref().and_then(|p| p.to_str()),
            Some(result.generation_time_seconds),
            cost,
            result.seed.as_deref(),
            Some(width),
            Some(height),
            Some(file_size),
            None, // parent_id
        )
        .map_err(|e| e.to_string())?;

    // Add tags
    if !params.tags.is_empty() {
        db.add_tags(gen_id, &params.tags).map_err(|e| e.to_string())?;
    }

    // Store and link reference images
    for ref_path in reference_paths {
        let (hash, stored_path) = archive::store_reference(std::path::Path::new(ref_path))
            .map_err(|e| e.to_string())?;
        let ref_id = db
            .get_or_create_reference(&hash, stored_path.to_str().unwrap())
            .map_err(|e| e.to_string())?;
        db.link_reference(gen_id, ref_id).map_err(|e| e.to_string())?;
    }

    // Copy to destination if requested
    if let Some(ref dest) = params.copy_to {
        archive::copy_to(&image_path, std::path::Path::new(dest))
            .map_err(|e| e.to_string())?;
    }

    // Get the created generation
    db.get_generation(gen_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Failed to retrieve generation".to_string())
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
    db.get_cost_summary(since.as_deref()).map_err(|e| e.to_string())
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
