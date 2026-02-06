use anyhow::Result;
use std::path::Path;

use crate::archive;
use crate::db::Database;
use crate::models::{Generation, GenerationResult, JobSource, ModelInfo};
use crate::providers;

/// Pre-generation: create job, resolve model info. Returns (job_id, estimated_cost, provider).
pub fn prepare_generation(
    db: &Database,
    model: &str,
    prompt: &str,
    tags: &[String],
    source: JobSource,
    ref_count: usize,
) -> Result<(i64, Option<f64>, String)> {
    let model_info = ModelInfo::find(model);
    let estimated_cost = model_info.as_ref().map(|m| m.cost_per_image);
    let provider = model_info
        .as_ref()
        .map(|m| m.provider.to_string())
        .unwrap_or_else(|| "unknown".to_string());

    let tags_opt = if tags.is_empty() { None } else { Some(tags) };
    let job_id = db.create_job(model, prompt, tags_opt, source, ref_count as i32)?;
    db.update_job_started(job_id)?;

    Ok((job_id, estimated_cost, provider))
}

/// Post-generation: save image, insert into DB, add tags, link refs, complete job.
/// Returns (generation_id, Generation).
pub fn complete_generation(
    db: &Database,
    job_id: i64,
    prompt: &str,
    model: &str,
    provider: &str,
    tags: &[String],
    reference_paths: &[String],
    result: &GenerationResult,
    estimated_cost: Option<f64>,
    negative_prompt: Option<&str>,
) -> Result<(i64, Generation)> {
    let now = chrono::Local::now();
    let date = now.format("%Y-%m-%d").to_string();
    let timestamp = now.format("%Y-%m-%dT%H:%M:%S").to_string();
    let slug = archive::slugify_prompt(prompt);

    let (image_path, thumb_path, width, height, file_size) =
        archive::save_image(&result.image_data, &date, &slug, &timestamp)?;

    let cost = result.cost_usd.or(estimated_cost);

    let gen_id = db.insert_generation(
        &slug,
        prompt,
        model,
        provider,
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
        negative_prompt,
    )?;

    if !tags.is_empty() {
        db.add_tags(gen_id, tags)?;
    }

    for ref_path in reference_paths {
        let (hash, stored_path) = archive::store_reference(Path::new(ref_path))?;
        let ref_id = db.get_or_create_reference(&hash, stored_path.to_str().unwrap())?;
        db.link_reference(gen_id, ref_id)?;
    }

    db.update_job_completed(job_id, gen_id)?;

    let generation = db
        .get_generation(gen_id)?
        .ok_or_else(|| anyhow::anyhow!("Failed to retrieve generation after insert"))?;

    Ok((gen_id, generation))
}

/// Full generation workflow (CLI convenience -- no Send requirement).
pub async fn perform_generation(
    db: &Database,
    prompt: &str,
    model: &str,
    tags: &[String],
    reference_paths: &[String],
    source: JobSource,
    negative_prompt: Option<&str>,
    width: Option<i32>,
    height: Option<i32>,
) -> Result<(i64, Generation)> {
    let (job_id, estimated_cost, provider) =
        prepare_generation(db, model, prompt, tags, source, reference_paths.len())?;

    let result = match providers::generate(model, prompt, reference_paths, negative_prompt, width, height).await {
        Ok(r) => r,
        Err(e) => {
            db.update_job_failed(job_id, &e.to_string())?;
            return Err(e);
        }
    };

    complete_generation(
        db,
        job_id,
        prompt,
        model,
        &provider,
        tags,
        reference_paths,
        &result,
        estimated_cost,
        negative_prompt,
    )
}
