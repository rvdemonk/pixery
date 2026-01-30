use serde::{Deserialize, Serialize};

/// Supported image generation providers
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Provider {
    Gemini,
    Fal,
    OpenAI,
}

impl std::fmt::Display for Provider {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Provider::Gemini => write!(f, "gemini"),
            Provider::Fal => write!(f, "fal"),
            Provider::OpenAI => write!(f, "openai"),
        }
    }
}

impl std::str::FromStr for Provider {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "gemini" => Ok(Provider::Gemini),
            "fal" => Ok(Provider::Fal),
            "openai" => Ok(Provider::OpenAI),
            _ => Err(format!("Unknown provider: {}", s)),
        }
    }
}

/// Available models per provider
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub provider: Provider,
    pub display_name: String,
    pub cost_per_image: f64,
    /// Max reference images supported (0 = text-to-image only)
    pub max_refs: u32,
}

impl ModelInfo {
    pub fn all() -> Vec<ModelInfo> {
        vec![
            // Gemini models - support multiple reference images
            ModelInfo {
                id: "gemini-flash".into(),
                provider: Provider::Gemini,
                display_name: "Gemini 2.5 Flash".into(),
                cost_per_image: 0.039,
                max_refs: 10,
            },
            ModelInfo {
                id: "gemini-pro".into(),
                provider: Provider::Gemini,
                display_name: "Gemini 3 Pro".into(),
                cost_per_image: 0.134,
                max_refs: 10,
            },
            // fal.ai models - text-to-image only (no ref support)
            ModelInfo {
                id: "fal-ai/flux/schnell".into(),
                provider: Provider::Fal,
                display_name: "FLUX Schnell".into(),
                cost_per_image: 0.003,
                max_refs: 0,
            },
            ModelInfo {
                id: "fal-ai/flux-pro/v1.1".into(),
                provider: Provider::Fal,
                display_name: "FLUX Pro 1.1".into(),
                cost_per_image: 0.05,
                max_refs: 0,
            },
            ModelInfo {
                id: "fal-ai/flux-pro/v1.1-ultra".into(),
                provider: Provider::Fal,
                display_name: "FLUX Pro 1.1 Ultra".into(),
                cost_per_image: 0.06,
                max_refs: 0,
            },
            ModelInfo {
                id: "fal-ai/recraft-v3".into(),
                provider: Provider::Fal,
                display_name: "Recraft V3".into(),
                cost_per_image: 0.04,
                max_refs: 0,
            },
            // Z-Image Turbo: $0.005/MP. Routes to image-to-image endpoint when ref provided.
            // Max 1 reference image.
            ModelInfo {
                id: "fal-ai/z-image/turbo".into(),
                provider: Provider::Fal,
                display_name: "Z-Image Turbo".into(),
                cost_per_image: 0.005,
                max_refs: 1,
            },
            // OpenAI models - text-to-image only
            ModelInfo {
                id: "dall-e-3".into(),
                provider: Provider::OpenAI,
                display_name: "DALL-E 3".into(),
                cost_per_image: 0.04,
                max_refs: 0,
            },
            ModelInfo {
                id: "gpt-image-1".into(),
                provider: Provider::OpenAI,
                display_name: "GPT Image 1".into(),
                cost_per_image: 0.02,
                max_refs: 0,
            },
        ]
    }

    pub fn find(model_id: &str) -> Option<ModelInfo> {
        Self::all().into_iter().find(|m| m.id == model_id)
    }

    pub fn provider_for_model(model_id: &str) -> Option<Provider> {
        Self::find(model_id).map(|m| m.provider)
    }
}

/// A single image generation record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Generation {
    pub id: i64,
    pub slug: String,
    pub prompt: String,
    pub model: String,
    pub provider: String,
    pub timestamp: String,
    pub date: String,
    pub image_path: String,
    pub thumb_path: Option<String>,
    pub generation_time_seconds: Option<f64>,
    pub cost_estimate_usd: Option<f64>,
    pub seed: Option<String>,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub file_size: Option<i64>,
    pub parent_id: Option<i64>,
    pub starred: bool,
    pub created_at: String,
    pub trashed_at: Option<String>,
    pub title: Option<String>,
    pub tags: Vec<String>,
}

/// Parameters for generating a new image
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateParams {
    pub prompt: String,
    pub model: String,
    pub tags: Vec<String>,
    pub reference_paths: Vec<String>,
    pub copy_to: Option<String>,
}

/// Reference image (deduplicated by hash)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Reference {
    pub id: i64,
    pub hash: String,
    pub path: String,
    pub created_at: String,
}

/// Tag with usage count
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagCount {
    pub name: String,
    pub count: i64,
}

/// Cost summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostSummary {
    pub total_usd: f64,
    pub by_model: Vec<(String, f64)>,
    pub by_day: Vec<(String, f64)>,
    pub count: i64,
}

/// Query filters for listing generations
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ListFilter {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub tag: Option<String>,
    pub model: Option<String>,
    pub starred_only: bool,
    pub search: Option<String>,
    pub since: Option<String>,
}

/// Result of image generation from a provider
#[derive(Debug)]
pub struct GenerationResult {
    pub image_data: Vec<u8>,
    pub seed: Option<String>,
    pub generation_time_seconds: f64,
}
