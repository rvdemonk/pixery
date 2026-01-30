use anyhow::{Context, Result};
use image::GenericImageView;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};

/// Root directory for all image generation data
pub fn archive_root() -> PathBuf {
    dirs::home_dir()
        .expect("Could not find home directory")
        .join("media")
        .join("image-gen")
}

/// Directory for generated images
pub fn generations_dir() -> PathBuf {
    archive_root().join("generations")
}

/// Directory for reference images (deduplicated)
pub fn references_dir() -> PathBuf {
    archive_root().join("references")
}

/// Path to the SQLite database
pub fn db_path() -> PathBuf {
    archive_root().join("index.sqlite")
}

/// Ensure all archive directories exist
pub fn ensure_dirs() -> Result<()> {
    fs::create_dir_all(generations_dir()).context("Failed to create generations directory")?;
    fs::create_dir_all(references_dir()).context("Failed to create references directory")?;
    Ok(())
}

/// Get the directory for a specific date (YYYY-MM-DD)
pub fn date_dir(date: &str) -> PathBuf {
    generations_dir().join(date)
}

/// Generate a slug from a prompt (first few words, cleaned)
pub fn slugify_prompt(prompt: &str) -> String {
    let words: Vec<&str> = prompt
        .split_whitespace()
        .take(5)
        .collect();

    let slug = slug::slugify(words.join(" "));

    // Limit length
    if slug.len() > 40 {
        slug[..40].to_string()
    } else if slug.is_empty() {
        "image".to_string()
    } else {
        slug
    }
}

/// Generate a unique filename for a new generation
/// Format: {slug}-{HHMMSS}.{ext}
pub fn generate_filename(slug: &str, timestamp: &str, extension: &str) -> String {
    // Extract HHMMSS from ISO timestamp
    let time_part = timestamp
        .split('T')
        .nth(1)
        .unwrap_or("000000")
        .replace(':', "")
        .chars()
        .take(6)
        .collect::<String>();

    format!("{}-{}.{}", slug, time_part, extension)
}

/// Save image data to the archive
pub fn save_image(
    data: &[u8],
    date: &str,
    slug: &str,
    timestamp: &str,
) -> Result<(PathBuf, Option<PathBuf>, i32, i32, i64)> {
    let dir = date_dir(date);
    fs::create_dir_all(&dir).context("Failed to create date directory")?;

    // Detect format and extension
    let format = image::guess_format(data).unwrap_or(image::ImageFormat::Png);
    let extension = match format {
        image::ImageFormat::Jpeg => "jpg",
        image::ImageFormat::WebP => "webp",
        _ => "png",
    };

    let base_filename = generate_filename(slug, timestamp, extension);
    let mut image_path = dir.join(&base_filename);

    // Handle filename collisions by appending a counter
    if image_path.exists() {
        let stem = format!("{}-{}", slug, timestamp.split('T').nth(1).unwrap_or("000000").replace(':', "").chars().take(6).collect::<String>());
        let mut counter = 1;
        loop {
            let filename = format!("{}-{}.{}", stem, counter, extension);
            image_path = dir.join(&filename);
            if !image_path.exists() {
                break;
            }
            counter += 1;
        }
    }

    fs::write(&image_path, data).context("Failed to write image file")?;

    // Get dimensions
    let img = image::load_from_memory(data).context("Failed to decode image")?;
    let (width, height) = img.dimensions();
    let file_size = data.len() as i64;

    // Generate thumbnail
    let thumb_path = generate_thumbnail(&image_path, &img)?;

    Ok((image_path, thumb_path, width as i32, height as i32, file_size))
}

/// Thumbnail size in pixels (400px for Retina display support)
pub const THUMBNAIL_SIZE: u32 = 400;

/// Generate a thumbnail for an image
fn generate_thumbnail(image_path: &Path, img: &image::DynamicImage) -> Result<Option<PathBuf>> {
    let thumb = img.thumbnail(THUMBNAIL_SIZE, THUMBNAIL_SIZE);

    let stem = image_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("image");

    let thumb_filename = format!("{}.thumb.jpg", stem);
    let thumb_path = image_path.with_file_name(thumb_filename);

    thumb.save(&thumb_path).context("Failed to save thumbnail")?;

    Ok(Some(thumb_path))
}

/// Compute SHA-256 hash of file contents
pub fn hash_file(path: &Path) -> Result<String> {
    let data = fs::read(path).context("Failed to read file for hashing")?;
    hash_bytes(&data)
}

/// Compute SHA-256 hash of bytes
pub fn hash_bytes(data: &[u8]) -> Result<String> {
    let mut hasher = Sha256::new();
    hasher.update(data);
    let result = hasher.finalize();
    Ok(format!("{:x}", result))
}

/// Store a reference image (deduplicates by hash)
/// Returns (hash, path) - path may be existing if duplicate
pub fn store_reference(source_path: &Path) -> Result<(String, PathBuf)> {
    let data = fs::read(source_path).context("Failed to read reference image")?;
    let hash = hash_bytes(&data)?;

    // Determine extension from source
    let extension = source_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png");

    let dest_path = references_dir().join(format!("{}.{}", hash, extension));

    if !dest_path.exists() {
        fs::create_dir_all(references_dir()).context("Failed to create references directory")?;
        fs::copy(source_path, &dest_path).context("Failed to copy reference image")?;
    }

    Ok((hash, dest_path))
}

/// Copy an image to a destination path
pub fn copy_to(source: &Path, dest: &Path) -> Result<()> {
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).context("Failed to create destination directory")?;
    }
    fs::copy(source, dest).context("Failed to copy image")?;
    Ok(())
}

/// Delete an image and its thumbnail
pub fn delete_image(image_path: &Path) -> Result<()> {
    // Delete main image
    if image_path.exists() {
        fs::remove_file(image_path).context("Failed to delete image")?;
    }

    // Delete thumbnail if it exists
    if let Some(stem) = image_path.file_stem().and_then(|s| s.to_str()) {
        let thumb_path = image_path.with_file_name(format!("{}.thumb.jpg", stem));
        if thumb_path.exists() {
            let _ = fs::remove_file(thumb_path);
        }
    }

    Ok(())
}

/// Load an image file as base64
pub fn load_as_base64(path: &Path) -> Result<String> {
    let data = fs::read(path).context("Failed to read image file")?;
    Ok(base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &data))
}

/// Get the MIME type for an image path
pub fn mime_type(path: &Path) -> &'static str {
    match path.extension().and_then(|e| e.to_str()) {
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("webp") => "image/webp",
        Some("gif") => "image/gif",
        _ => "image/png",
    }
}
