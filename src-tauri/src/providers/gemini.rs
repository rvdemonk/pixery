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
        .timeout(std::time::Duration::from_secs(120))
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
    })
}
