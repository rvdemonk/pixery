use anyhow::Result;
use std::path::Path;
use std::sync::OnceLock;

use crate::models::{GenerationResult, ModelInfo, Provider};

static HTTP_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

/// Shared HTTP client for all providers (enables connection pooling)
pub fn client() -> &'static reqwest::Client {
    HTTP_CLIENT.get_or_init(reqwest::Client::new)
}

pub mod fal;
pub mod gemini;
pub mod openai;
pub mod selfhosted;

/// Generate an image using the appropriate provider for the model
pub async fn generate(
    model: &str,
    prompt: &str,
    reference_paths: &[String],
    negative_prompt: Option<&str>,
    width: Option<i32>,
    height: Option<i32>,
    ip_scale: Option<f64>,
) -> Result<GenerationResult> {
    let provider = ModelInfo::provider_for_model(model)
        .or_else(|| {
            // Fallback: route unknown models to self-hosted server if configured
            if selfhosted::get_server_url().is_some() {
                Some(Provider::SelfHosted)
            } else {
                None
            }
        })
        .ok_or_else(|| anyhow::anyhow!("Unknown model: {}", model))?;

    match provider {
        Provider::Gemini => gemini::generate(model, prompt, reference_paths, negative_prompt, width, height).await,
        Provider::Fal => fal::generate(model, prompt, reference_paths, negative_prompt, width, height).await,
        Provider::OpenAI => openai::generate(model, prompt, reference_paths, negative_prompt, width, height).await,
        Provider::SelfHosted => selfhosted::generate(model, prompt, reference_paths, negative_prompt, width, height, ip_scale).await,
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
