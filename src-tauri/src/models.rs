use serde::{Deserialize, Serialize};

/// Supported image generation providers
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Provider {
    Gemini,
    Fal,
    OpenAI,
    SelfHosted,
}

impl std::fmt::Display for Provider {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Provider::Gemini => write!(f, "gemini"),
            Provider::Fal => write!(f, "fal"),
            Provider::OpenAI => write!(f, "openai"),
            Provider::SelfHosted => write!(f, "selfhosted"),
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
            "selfhosted" => Ok(Provider::SelfHosted),
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

/// Prompting guide for a model or model family
#[derive(Debug, Clone)]
pub struct PromptingGuide {
    pub model_pattern: &'static str,
    pub style: &'static str,
    pub required_prefix: Option<&'static str>,
    pub structure: &'static str,
    pub tips: &'static str,
    pub avoid: Option<&'static str>,
    pub negative_template: Option<&'static str>,
    pub settings: Option<&'static str>,
    pub example: &'static str,
}

impl PromptingGuide {
    pub fn all() -> Vec<PromptingGuide> {
        vec![
            // Gemini models - prose-based
            PromptingGuide {
                model_pattern: "gemini",
                style: "prose",
                required_prefix: None,
                structure: "Character description → Setting/atmosphere → Art style cues → Technical specs (optional)",
                tips: r#"- Long prose, poetic, allusive descriptions work well
- Full paragraphs welcome - more context = better results
- Era cues: "Dreamcast era", "pre-shader", "Jet Set Radio", "Space Channel 5"
- Style cues: "faceted geometry", "flat cel shading", "Frutiger Aero palette"
- Emotional tone: "optimistic melancholy", "gently futuristic""#,
                avoid: Some("anime, screenshot, visual novel, cute"),
                negative_template: None,
                settings: None,
                example: r#"A young woman with short silver hair and distant eyes, as if hiding something beneath her cheerful exterior. She has the aesthetic of a Sega Dreamcast era 3D character - faceted geometry, flat cel shading, that pre-shader optimism. Her outfit suggests a near-future that never quite arrived: holographic accents on practical clothing. The background is a rain-slicked plaza at twilight, neon signs reflecting in puddles. Frutiger Aero color palette - teals, warm oranges, translucent whites."#,
            },
            // Animagine - strict booru tags
            PromptingGuide {
                model_pattern: "animagine",
                style: "tags",
                required_prefix: None,
                structure: "[count], [character], [appearance], [outfit], [pose], [expression], [setting], [quality tags]",
                tips: r#"- STRICT booru tag format - natural language WILL FAIL
- Comma-separated tags only, no sentences
- Quality tags at end: masterpiece, high score, great score, absurdres
- Use underscores for multi-word tags: long_hair, blue_eyes"#,
                avoid: Some("natural language, sentences, prose descriptions"),
                negative_template: Some("lowres, bad anatomy, bad hands, text, error, missing finger, extra digits, fewer digits, cropped, worst quality, low quality, low score, bad score, average score, signature, watermark, username, blurry"),
                settings: Some("CFG: 5, Steps: 28, Sampler: Euler a"),
                example: "1girl, solo, long silver hair, blue eyes, black hoodie, standing, smile, city background, night, masterpiece, high score, great score, absurdres",
            },
            // Pony - hybrid natural + tags
            PromptingGuide {
                model_pattern: "pony",
                style: "hybrid",
                required_prefix: Some("score_9, score_8_up, score_7_up, score_6_up, score_5_up, score_4_up"),
                structure: "[score tags], [source tag], [description or tags]",
                tips: r#"- CRITICAL: CLIP Skip MUST be 2 or output is garbage
- Always start with full score tag chain
- Source tags: source_anime, source_cartoon, source_furry, source_pony
- Can mix natural language with tags after the prefix
- For anime style, add source_anime to positive"#,
                avoid: None,
                negative_template: Some("source_cartoon, source_furry, source_pony, lowres, bad anatomy, bad hands"),
                settings: Some("CFG: 7, Steps: 25+, Sampler: Euler a, CLIP Skip: 2 (CRITICAL)"),
                example: "score_9, score_8_up, score_7_up, score_6_up, score_5_up, score_4_up, source_anime, 1girl, silver hair, blue eyes, standing in rain, city night, neon lights reflecting on wet pavement",
            },
            // NoobAI - similar to Pony but different quality tags
            PromptingGuide {
                model_pattern: "noobai",
                style: "hybrid",
                required_prefix: Some("masterpiece, best quality"),
                structure: "[quality tags], [character], [appearance], [setting], [style]",
                tips: r#"- Based on NAI/Pony lineage, uses quality prefix
- Handles both tags and natural language
- More forgiving than Animagine, less strict than Pony"#,
                avoid: Some("worst quality, low quality, bad anatomy"),
                negative_template: Some("worst quality, low quality, bad anatomy, bad hands, text, error, watermark, signature"),
                settings: Some("CFG: 7, Steps: 28, Sampler: Euler a"),
                example: "masterpiece, best quality, 1girl, silver hair, blue eyes, black jacket, standing on rooftop, city skyline, sunset, dramatic lighting",
            },
        ]
    }

    /// Find guide for a model ID (matches by prefix)
    pub fn for_model(model_id: &str) -> Option<PromptingGuide> {
        Self::all()
            .into_iter()
            .find(|g| model_id.starts_with(g.model_pattern))
    }

    /// Format guide for CLI output
    pub fn format(&self) -> String {
        let mut out = String::new();

        out.push_str(&format!("PROMPTING GUIDE: {}\n", self.model_pattern.to_uppercase()));
        out.push_str(&format!("Style: {}\n\n", self.style));

        if let Some(prefix) = self.required_prefix {
            out.push_str(&format!("REQUIRED PREFIX:\n{}\n\n", prefix));
        }

        out.push_str(&format!("STRUCTURE:\n{}\n\n", self.structure));
        out.push_str(&format!("TIPS:\n{}\n\n", self.tips));

        if let Some(avoid) = self.avoid {
            out.push_str(&format!("AVOID:\n{}\n\n", avoid));
        }

        if let Some(neg) = self.negative_template {
            out.push_str(&format!("NEGATIVE PROMPT TEMPLATE:\n{}\n\n", neg));
        }

        if let Some(settings) = self.settings {
            out.push_str(&format!("RECOMMENDED SETTINGS:\n{}\n\n", settings));
        }

        out.push_str(&format!("EXAMPLE:\n{}\n", self.example));

        out
    }
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
            // Self-hosted models - requires SELFHOSTED_API_URL or GUI settings
            // IP-Adapter supports 1 reference image
            ModelInfo {
                id: "animagine".into(),
                provider: Provider::SelfHosted,
                display_name: "Animagine XL 4.0 (Local)".into(),
                cost_per_image: 0.0,
                max_refs: 1,
            },
            ModelInfo {
                id: "pony".into(),
                provider: Provider::SelfHosted,
                display_name: "Pony Diffusion V6 (Local)".into(),
                cost_per_image: 0.0,
                max_refs: 1,
            },
            ModelInfo {
                id: "noobai".into(),
                provider: Provider::SelfHosted,
                display_name: "NoobAI XL (Local)".into(),
                cost_per_image: 0.0,
                max_refs: 1,
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
    pub references: Vec<Reference>,
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
    pub tags: Option<Vec<String>>,
    pub exclude_tags: Option<Vec<String>>,
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
    /// Actual cost from API (token-based), if available. Takes precedence over estimate.
    pub cost_usd: Option<f64>,
}

/// Job status for generation tracking
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum JobStatus {
    Pending,
    Running,
    Completed,
    Failed,
}

impl std::fmt::Display for JobStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            JobStatus::Pending => write!(f, "pending"),
            JobStatus::Running => write!(f, "running"),
            JobStatus::Completed => write!(f, "completed"),
            JobStatus::Failed => write!(f, "failed"),
        }
    }
}

impl std::str::FromStr for JobStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "pending" => Ok(JobStatus::Pending),
            "running" => Ok(JobStatus::Running),
            "completed" => Ok(JobStatus::Completed),
            "failed" => Ok(JobStatus::Failed),
            _ => Err(format!("Unknown job status: {}", s)),
        }
    }
}

/// Source of a generation job
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum JobSource {
    Cli,
    Gui,
}

impl std::fmt::Display for JobSource {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            JobSource::Cli => write!(f, "cli"),
            JobSource::Gui => write!(f, "gui"),
        }
    }
}

impl std::str::FromStr for JobSource {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "cli" => Ok(JobSource::Cli),
            "gui" => Ok(JobSource::Gui),
            _ => Err(format!("Unknown job source: {}", s)),
        }
    }
}

/// A generation job record for tracking in-flight generations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Job {
    pub id: i64,
    pub status: JobStatus,
    pub model: String,
    pub prompt: String,
    pub tags: Option<Vec<String>>,
    pub source: JobSource,
    pub ref_count: i32,
    pub created_at: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub generation_id: Option<i64>,
    pub error: Option<String>,
}
