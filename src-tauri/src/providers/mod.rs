use anyhow::Result;
use std::path::Path;

use crate::models::{GenerationResult, ModelInfo, Provider};

pub mod fal;
pub mod gemini;
pub mod openai;

/// Generate an image using the appropriate provider for the model
pub async fn generate(
    model: &str,
    prompt: &str,
    reference_paths: &[String],
) -> Result<GenerationResult> {
    let provider = ModelInfo::provider_for_model(model)
        .ok_or_else(|| anyhow::anyhow!("Unknown model: {}", model))?;

    match provider {
        Provider::Gemini => gemini::generate(model, prompt, reference_paths).await,
        Provider::Fal => fal::generate(model, prompt, reference_paths).await,
        Provider::OpenAI => openai::generate(model, prompt, reference_paths).await,
    }
}

/// Load an image as base64 for API requests
pub fn image_to_base64(path: &Path) -> Result<String> {
    let data = std::fs::read(path)?;
    Ok(base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        &data,
    ))
}

/// Get MIME type from file path
pub fn mime_type(path: &Path) -> &'static str {
    match path.extension().and_then(|e| e.to_str()) {
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("webp") => "image/webp",
        Some("gif") => "image/gif",
        _ => "image/png",
    }
}
