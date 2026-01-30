use anyhow::{Context, Result};
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::Instant;

use crate::models::GenerationResult;

const API_BASE: &str = "https://queue.fal.run";

/// Model ID mapping for fal.ai models
///
/// # Z-Image Turbo
/// - Text-to-image: `fal-ai/z-image/turbo` ($0.005/MP)
/// - Image-to-image: `fal-ai/z-image/turbo/image-to-image` ($0.005/MP)
/// - With LoRA: `fal-ai/z-image/turbo/lora` ($0.0085/MP)
/// - Max 1 reference image for image-to-image
/// - Parameters: num_images (1-4), num_inference_steps (1-8, default 8)
/// - Image sizes: square, square_hd, portrait_4_3, portrait_16_9, landscape_4_3, landscape_16_9
/// - Note: Only Turbo variant is publicly available. "Z-Image base" is not deployed.
fn resolve_model(model: &str, has_reference: bool) -> &str {
    match model {
        "flux-schnell" => "fal-ai/flux/schnell",
        "flux-pro" | "fal-ai/flux-pro/v1.1" => "fal-ai/flux-pro/v1.1",
        "flux-ultra" | "fal-ai/flux-pro/v1.1-ultra" => "fal-ai/flux-pro/v1.1-ultra",
        "recraft" | "fal-ai/recraft-v3" => "fal-ai/recraft-v3",
        // Z-Image: route to image-to-image endpoint when reference provided
        "z-image" | "fal-ai/z-image/turbo" | "fal-ai/z-image/turbo/image-to-image" => {
            if has_reference {
                "fal-ai/z-image/turbo/image-to-image"
            } else {
                "fal-ai/z-image/turbo"
            }
        }
        _ => model,
    }
}

#[derive(Serialize)]
struct FalRequest {
    prompt: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    image_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    image_size: Option<String>,
    /// Strength for image-to-image (0.0-1.0, default 0.6)
    /// Higher = more influence from prompt, lower = more from reference
    #[serde(skip_serializing_if = "Option::is_none")]
    strength: Option<f64>,
}

#[derive(Deserialize)]
struct FalResponse {
    images: Option<Vec<FalImage>>,
    error: Option<String>,
}

#[derive(Deserialize)]
struct FalImage {
    url: String,
    #[serde(default)]
    seed: Option<u64>,
}

fn get_api_key() -> Result<String> {
    std::env::var("FAL_KEY").context("FAL_KEY environment variable not set")
}

pub async fn generate(
    model: &str,
    prompt: &str,
    reference_paths: &[String],
) -> Result<GenerationResult> {
    let api_key = get_api_key()?;
    let has_reference = !reference_paths.is_empty();
    let model_id = resolve_model(model, has_reference);

    // Build image_url from reference if provided (max 1 for Z-Image)
    let image_url = if let Some(ref_path) = reference_paths.first() {
        let path = Path::new(ref_path);
        let data = std::fs::read(path).context("Failed to read reference image")?;
        let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
        let mime = super::mime_type(path);
        Some(format!("data:{};base64,{}", mime, b64))
    } else {
        None
    };

    // Set strength for image-to-image models (0.6 default balances prompt vs reference)
    let strength = if has_reference && model_id.contains("image-to-image") {
        Some(0.6)
    } else {
        None
    };

    let request = FalRequest {
        prompt: prompt.to_string(),
        image_url,
        image_size: Some("square_hd".to_string()),
        strength,
    };

    let url = format!("{}/{}", API_BASE, model_id);
    let client = reqwest::Client::new();

    let start = Instant::now();
    let response = client
        .post(&url)
        .header("Authorization", format!("Key {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request)
        .timeout(std::time::Duration::from_secs(120))
        .send()
        .await
        .context("Failed to send request to fal.ai API")?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        anyhow::bail!("fal.ai API error {}: {}", status, text);
    }

    let data: FalResponse = response.json().await.context("Failed to parse fal.ai response")?;

    if let Some(error) = data.error {
        anyhow::bail!("fal.ai API error: {}", error);
    }

    // Get image URL from response
    let image_info = data
        .images
        .and_then(|images| images.into_iter().next())
        .ok_or_else(|| anyhow::anyhow!("No images in fal.ai response"))?;

    // Fetch the actual image
    let image_response = client
        .get(&image_info.url)
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
        .context("Failed to fetch image from fal.ai")?;

    let elapsed = start.elapsed().as_secs_f64();

    if !image_response.status().is_success() {
        anyhow::bail!("Failed to fetch image: {}", image_response.status());
    }

    let image_data = image_response
        .bytes()
        .await
        .context("Failed to read image bytes")?
        .to_vec();

    Ok(GenerationResult {
        image_data,
        seed: image_info.seed.map(|s| s.to_string()),
        generation_time_seconds: elapsed,
    })
}
