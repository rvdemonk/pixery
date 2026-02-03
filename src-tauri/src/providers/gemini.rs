use anyhow::{Context, Result};
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::Instant;

use crate::models::GenerationResult;

const API_BASE: &str = "https://generativelanguage.googleapis.com/v1beta/models";

/// Model ID mapping - converts user-friendly names to API model IDs
fn resolve_model(model: &str) -> &str {
    match model {
        "gemini-flash" | "flash" => "gemini-2.5-flash-image",
        "gemini-pro" | "pro" => "gemini-3-pro-image-preview",
        _ => model,
    }
}

#[derive(Serialize)]
struct GeminiRequest {
    contents: Vec<Content>,
    #[serde(rename = "generationConfig")]
    generation_config: GenerationConfig,
}

#[derive(Serialize)]
struct Content {
    parts: Vec<Part>,
}

#[derive(Serialize)]
#[serde(untagged)]
enum Part {
    Text { text: String },
    Image { #[serde(rename = "inlineData")] inline_data: InlineData },
}

#[derive(Serialize)]
struct InlineData {
    #[serde(rename = "mimeType")]
    mime_type: String,
    data: String,
}

#[derive(Serialize)]
struct GenerationConfig {
    #[serde(rename = "responseModalities")]
    response_modalities: Vec<String>,
}

#[derive(Deserialize)]
struct GeminiResponse {
    candidates: Option<Vec<Candidate>>,
    error: Option<GeminiError>,
    #[serde(rename = "usageMetadata")]
    usage_metadata: Option<UsageMetadata>,
}

#[derive(Deserialize, Debug)]
struct UsageMetadata {
    #[serde(rename = "promptTokenCount")]
    prompt_token_count: Option<i64>,
    #[serde(rename = "candidatesTokenCount")]
    candidates_token_count: Option<i64>,
}

#[derive(Deserialize)]
struct GeminiError {
    message: String,
}

#[derive(Deserialize)]
struct Candidate {
    content: Option<CandidateContent>,
}

#[derive(Deserialize)]
struct CandidateContent {
    parts: Vec<ResponsePart>,
}

#[derive(Deserialize)]
struct ResponsePart {
    #[serde(rename = "inlineData")]
    inline_data: Option<ResponseInlineData>,
}

#[derive(Deserialize)]
struct ResponseInlineData {
    data: String,
}

fn get_api_key() -> Result<String> {
    std::env::var("GEMINI_API_SECRET_KEY")
        .or_else(|_| std::env::var("GEMINI_API_KEY"))
        .context("GEMINI_API_SECRET_KEY or GEMINI_API_KEY environment variable not set")
}

/// Calculate cost based on token usage
/// Pricing (as of Jan 2026):
/// - gemini-2.5-flash-image:
///   - Input: $0.15/1M tokens (text), images are 560 tokens each
///   - Output text: $0.60/1M tokens
///   - Output image (standard ≤1024x1024): $30/1M tokens (1290 tokens = $0.039)
///   - Output image (high-res 1K-2K): $120/1M tokens (1120 tokens = $0.134)
/// - gemini-3-pro-image-preview: Higher tier pricing
///   - Input: $1.25/1M tokens
///   - Output text: $5.00/1M tokens
///   - Output image: $120/1M tokens
fn calculate_cost(model: &str, usage: &UsageMetadata) -> Option<f64> {
    let prompt_tokens = usage.prompt_token_count.unwrap_or(0) as f64;
    let output_tokens = usage.candidates_token_count.unwrap_or(0) as f64;

    // Pricing per million tokens
    let (input_rate, output_rate) = match model {
        "gemini-2.5-flash-image" => {
            // Flash: $0.15/1M input, blend of text ($0.60/1M) and image ($30-120/1M) output
            // Since we always generate an image, use image output rate
            // Standard resolution (1290 tokens = $0.039) → ~$30/1M
            (0.15, 30.0)
        }
        "gemini-3-pro-image-preview" => {
            // Pro: $1.25/1M input, $120/1M output for images
            (1.25, 120.0)
        }
        _ => return None,
    };

    let input_cost = prompt_tokens * input_rate / 1_000_000.0;
    let output_cost = output_tokens * output_rate / 1_000_000.0;

    Some(input_cost + output_cost)
}

pub async fn generate(
    model: &str,
    prompt: &str,
    reference_paths: &[String],
) -> Result<GenerationResult> {
    let api_key = get_api_key()?;
    let model_id = resolve_model(model);

    // Build parts
    let mut parts: Vec<Part> = vec![];

    // Add reference images
    for ref_path in reference_paths {
        let path = Path::new(ref_path);
        let data = std::fs::read(path).context("Failed to read reference image")?;
        let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
        let mime = super::mime_type(path).to_string();

        parts.push(Part::Image {
            inline_data: InlineData {
                mime_type: mime,
                data: b64,
            },
        });
    }

    // Add prompt
    parts.push(Part::Text {
        text: prompt.to_string(),
    });

    let request = GeminiRequest {
        contents: vec![Content { parts }],
        generation_config: GenerationConfig {
            response_modalities: vec!["TEXT".into(), "IMAGE".into()],
        },
    };

    let url = format!("{}/{}:generateContent", API_BASE, model_id);
    let client = reqwest::Client::new();

    let start = Instant::now();
    let response = client
        .post(&url)
        .header("x-goog-api-key", &api_key)
        .header("Content-Type", "application/json")
        .json(&request)
        .timeout(std::time::Duration::from_secs(300)) // 5 minutes - Pro models are slow
        .send()
        .await
        .context("Failed to send request to Gemini API")?;

    let elapsed = start.elapsed().as_secs_f64();

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        anyhow::bail!("Gemini API error {}: {}", status, text);
    }

    let data: GeminiResponse = response.json().await.context("Failed to parse Gemini response")?;

    if let Some(error) = data.error {
        anyhow::bail!("Gemini API error: {}", error.message);
    }

    // Calculate actual cost from token usage
    let cost_usd = data
        .usage_metadata
        .as_ref()
        .and_then(|usage| calculate_cost(model_id, usage));

    // Extract image data
    let image_data = data
        .candidates
        .and_then(|candidates| candidates.into_iter().next())
        .and_then(|c| c.content)
        .and_then(|content| {
            content
                .parts
                .into_iter()
                .find_map(|p| p.inline_data.map(|d| d.data))
        })
        .ok_or_else(|| anyhow::anyhow!("No image data in Gemini response"))?;

    let image_bytes = base64::engine::general_purpose::STANDARD
        .decode(&image_data)
        .context("Failed to decode base64 image data")?;

    Ok(GenerationResult {
        image_data: image_bytes,
        seed: None,
        generation_time_seconds: elapsed,
        cost_usd,
    })
}
