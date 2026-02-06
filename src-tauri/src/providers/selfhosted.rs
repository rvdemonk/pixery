use anyhow::{Context, Result};
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::Instant;

use crate::models::GenerationResult;

const REQUEST_TIMEOUT_SECS: u64 = 300; // 5 minutes - model loading can be slow

#[derive(Serialize)]
struct SelfHostedRequest {
    prompt: String,
    model: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    negative_prompt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    width: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    height: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    reference_image: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    ip_adapter_scale: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    lora_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    lora_scale: Option<f64>,
}

#[derive(Deserialize, Debug)]
struct SelfHostedResponse {
    image: String,
    seed: Option<u64>,
    #[serde(default)]
    parameters: Option<serde_json::Value>,
}

#[derive(Deserialize, Debug)]
struct SelfHostedError {
    detail: String,
}

/// Health check response from the self-hosted server
#[derive(Deserialize, Debug, Clone, Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub current_model: Option<String>,
    pub available_models: Vec<String>,
    pub ip_adapter_loaded: Option<bool>,
    pub cuda_available: Option<bool>,
    pub gpu_name: Option<String>,
    pub vram_allocated_gb: Option<f64>,
}

/// Get the self-hosted server URL from settings file
pub fn get_server_url() -> Option<String> {
    let settings_path = crate::archive::archive_root().join("selfhosted.json");
    if let Ok(contents) = std::fs::read_to_string(&settings_path) {
        if let Ok(settings) = serde_json::from_str::<serde_json::Value>(&contents) {
            if let Some(url) = settings.get("url").and_then(|v| v.as_str()) {
                if !url.is_empty() {
                    return Some(url.to_string());
                }
            }
        }
    }
    // Fallback to environment variable
    std::env::var("SELFHOSTED_API_URL").ok()
}

/// Set the self-hosted server URL in settings file
pub fn set_server_url(url: Option<&str>) -> Result<()> {
    let settings_path = crate::archive::archive_root().join("selfhosted.json");
    let settings = serde_json::json!({
        "url": url.unwrap_or("")
    });
    std::fs::write(&settings_path, serde_json::to_string_pretty(&settings)?)
        .context("Failed to write selfhosted settings")?;
    Ok(())
}

/// Check if the self-hosted server is healthy
pub async fn check_health(url: &str) -> Result<HealthResponse> {
    let health_url = format!("{}/health", url.trim_end_matches('/'));
    let client = super::client();

    let response = client
        .get(&health_url)
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
        .context("Failed to connect to self-hosted server")?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        anyhow::bail!("Health check failed ({}): {}", status, text);
    }

    response
        .json()
        .await
        .context("Failed to parse health response")
}

/// Generate an image using the self-hosted inference server
pub async fn generate(
    model: &str,
    prompt: &str,
    reference_paths: &[String],
    negative_prompt: Option<&str>,
    width: Option<i32>,
    height: Option<i32>,
) -> Result<GenerationResult> {
    let base_url = get_server_url()
        .ok_or_else(|| anyhow::anyhow!("Self-hosted server URL not configured"))?;

    // Build reference image as base64 (server expects bare base64, not data URI)
    let reference_image = if let Some(ref_path) = reference_paths.first() {
        let path = Path::new(ref_path);
        let data = std::fs::read(path).context("Failed to read reference image")?;
        Some(base64::engine::general_purpose::STANDARD.encode(&data))
    } else {
        None
    };

    // Set IP adapter scale only when reference is provided
    let ip_adapter_scale = if reference_image.is_some() {
        Some(0.7)
    } else {
        None
    };

    let request = SelfHostedRequest {
        prompt: prompt.to_string(),
        model: model.to_string(),
        negative_prompt: negative_prompt.map(|s| s.to_string()),
        width: Some(width.unwrap_or(1024)),
        height: Some(height.unwrap_or(1024)),
        reference_image,
        ip_adapter_scale,
        lora_name: None,
        lora_scale: None,
    };

    let url = format!("{}/generate", base_url.trim_end_matches('/'));
    let client = super::client();

    let start = Instant::now();
    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&request)
        .timeout(std::time::Duration::from_secs(REQUEST_TIMEOUT_SECS))
        .send()
        .await
        .context("Failed to send request to self-hosted server")?;

    let status = response.status();
    if !status.is_success() {
        let text = response.text().await.unwrap_or_default();
        // Try to parse as JSON error
        if let Ok(error) = serde_json::from_str::<SelfHostedError>(&text) {
            anyhow::bail!("Self-hosted server error: {}", error.detail);
        }
        anyhow::bail!("Self-hosted server error ({}): {}", status, text);
    }

    let data: SelfHostedResponse = response
        .json()
        .await
        .context("Failed to parse self-hosted server response")?;

    let elapsed = start.elapsed().as_secs_f64();

    // Decode base64 image
    let image_data = base64::engine::general_purpose::STANDARD
        .decode(&data.image)
        .context("Failed to decode base64 image from server")?;

    Ok(GenerationResult {
        image_data,
        seed: data.seed.map(|s| s.to_string()),
        generation_time_seconds: elapsed,
        cost_usd: None, // Self-hosted has no direct API cost
    })
}
