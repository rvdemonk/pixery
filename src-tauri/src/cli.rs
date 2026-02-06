use anyhow::{Context, Result};
use chrono::Local;
use clap::Subcommand;
use std::path::{Path, PathBuf};

use crate::archive;
use crate::db::Database;
use crate::models::{self, Generation, JobSource, ListFilter, ModelInfo, PromptingGuide};
use crate::workflow;

#[derive(Subcommand, Clone)]
pub enum Commands {
    /// Generate an image
    #[command(alias = "gen", long_about = "Generate an image from a text prompt.\n\n\
        Supports all providers (Gemini, fal.ai, OpenAI, self-hosted). Reference images \
        enable image-to-image generation on supported models.\n\n\
        Aspect ratios use SDXL-native resolutions (~1MP):\n  \
        square (1024x1024), portrait/2:3 (832x1216), landscape/3:2 (1216x832),\n  \
        wide/16:9 (1344x768), tall/9:16 (768x1344), 4:3 (1152x896), 3:4 (896x1152)\n\n\
        Examples:\n  \
        pixery generate -p \"a mountain lake at sunset\" -m gemini-flash\n  \
        pixery gen -p \"anime girl\" -m animagine --negative \"lowres, bad anatomy\"\n  \
        pixery gen -p \"portrait photo\" --ratio portrait -m gpt-image-1\n  \
        pixery gen -f prompt.txt -m gemini-pro --ref reference.png -t character,fantasy")]
    Generate {
        /// Prompt text
        #[arg(short, long)]
        prompt: Option<String>,

        /// Read prompt from file
        #[arg(short = 'f', long)]
        file: Option<PathBuf>,

        /// Model to use
        #[arg(short, long, default_value = "gemini-flash")]
        model: String,

        /// Tags (comma-separated)
        #[arg(short, long)]
        tags: Option<String>,

        /// Reference image(s)
        #[arg(short, long = "ref")]
        reference: Vec<PathBuf>,

        /// Copy result to path
        #[arg(long)]
        copy_to: Option<PathBuf>,

        /// Negative prompt
        #[arg(long)]
        negative: Option<String>,

        /// Aspect ratio (e.g., square, portrait, 16:9, 2:3)
        #[arg(long)]
        ratio: Option<String>,
    },

    /// List recent generations
    #[command(long_about = "List recent generations with filters.\n\n\
        Output columns: ID (with * if starred), DATE, MODEL, PROMPT (truncated)\n\n\
        Examples:\n  \
        pixery list                       # Last 20 generations\n  \
        pixery list -n 50                 # Last 50 generations\n  \
        pixery list --tag character       # Filter by tag\n  \
        pixery list --model gemini-flash  # Filter by model\n  \
        pixery list --starred             # Only starred images")]
    List {
        /// Number of results
        #[arg(short = 'n', long, default_value = "20")]
        limit: i64,

        /// Filter by tag
        #[arg(short, long)]
        tag: Option<String>,

        /// Filter by model
        #[arg(short, long)]
        model: Option<String>,

        /// Show only starred
        #[arg(short, long)]
        starred: bool,
    },

    /// Search generations by prompt
    Search {
        /// Search query
        query: String,

        /// Number of results
        #[arg(short = 'n', long, default_value = "20")]
        limit: i64,
    },

    /// Show generation metadata (prompt, model, tags, cost, references)
    #[command(long_about = "Show generation metadata as text output.\n\n\
        Displays: ID, slug, model, date, path, generation time, cost, seed, \
        dimensions, starred status, tags, references, and full prompt.\n\n\
        Use 'view' to output the image path for viewing the actual image.")]
    Show {
        /// Generation ID
        id: i64,
    },

    /// Output image path for viewing (supports --width resize)
    #[command(long_about = "Output image paths for agent viewing.\n\n\
        Without resize options, prints original file paths.\n\
        With --width and/or --height, resizes images (preserving aspect ratio) \
        and writes to /tmp/pixery-preview/, printing the output paths.\n\n\
        RECOMMENDED: --width 600 for context-efficient viewing without losing detail.\n\
        This balances image clarity with context window usage.\n\n\
        Designed for Claude to view generations: pipe IDs from 'pixery list' or 'pixery search', \
        then read the output paths.\n\n\
        Examples:\n  \
        pixery view 140                    # Original path (large)\n  \
        pixery view 140 -w 600             # Recommended: 600px wide\n  \
        pixery view 140 141 142 -w 600     # Multiple images")]
    View {
        /// Generation IDs to view
        ids: Vec<i64>,

        /// Resize width in pixels (preserves aspect ratio)
        #[arg(short, long)]
        width: Option<u32>,

        /// Resize height in pixels (preserves aspect ratio)
        #[arg(short = 'H', long)]
        height: Option<u32>,
    },

    /// Add tags to a generation
    Tag {
        /// Generation ID
        id: i64,

        /// Tags (comma-separated)
        tags: String,
    },

    /// Remove a tag from a generation
    Untag {
        /// Generation ID
        id: i64,

        /// Tag to remove
        tag: String,
    },

    /// Toggle starred status
    Star {
        /// Generation ID
        id: i64,
    },

    /// Delete a generation
    Delete {
        /// Generation ID
        id: i64,
    },

    /// Update a generation's metadata
    Update {
        /// Generation ID
        id: i64,

        /// New title
        #[arg(long)]
        title: Option<String>,

        /// New prompt text
        #[arg(short, long)]
        prompt: Option<String>,

        /// Read new prompt from file
        #[arg(long = "prompt-file")]
        prompt_file: Option<PathBuf>,

        /// Update model
        #[arg(short, long)]
        model: Option<String>,

        /// Add reference image(s)
        #[arg(short, long = "ref")]
        reference: Vec<PathBuf>,

        /// Add tags (comma-separated)
        #[arg(short, long)]
        tags: Option<String>,
    },

    /// List available models or show prompting guide
    #[command(long_about = "List available models or show prompting guide for a specific model.\n\n\
        Without arguments, lists all models with provider, cost, and reference support.\n\n\
        With MODEL --guide, shows the prompting guide for that model including:\n\
        - Style (prose/tags/hybrid)\n\
        - Required prefix (if any)\n\
        - Structure and tips\n\
        - Negative prompt template\n\
        - Recommended settings\n\
        - Concrete example\n\n\
        Examples:\n  \
        pixery models                    # List all models\n  \
        pixery models gemini-pro --guide # Gemini prompting guide\n  \
        pixery models animagine --guide  # Booru tag format guide\n  \
        pixery models pony --guide       # Pony score prefix guide")]
    Models {
        /// Model to get info about (optional)
        model: Option<String>,

        /// Show prompting guide for the model
        #[arg(short, long)]
        guide: bool,
    },

    /// List all tags with counts
    Tags,

    /// Show cost summary
    Cost {
        /// Time period (e.g., "7d", "30d", "all")
        #[arg(long, default_value = "all")]
        since: String,
    },

    /// Show recent failed generations
    Failures {
        /// Number of failures to show
        #[arg(short = 'n', long, default_value = "10")]
        limit: i64,
    },

    /// Import an existing image into the archive
    Import {
        /// Path to existing image file
        #[arg(short, long)]
        file: PathBuf,

        /// Prompt text
        #[arg(short, long)]
        prompt: Option<String>,

        /// Read prompt from file
        #[arg(long = "prompt-file")]
        prompt_file: Option<PathBuf>,

        /// Model that generated this image
        #[arg(short, long, default_value = "unknown")]
        model: String,

        /// Tags (comma-separated)
        #[arg(short, long)]
        tags: Option<String>,

        /// Reference image(s) used for this generation
        #[arg(short, long = "ref")]
        reference: Vec<PathBuf>,

        /// Override date (YYYY-MM-DD), otherwise extracted from filename or uses today
        #[arg(long)]
        date: Option<String>,

        /// Override timestamp (HH:MM:SS), otherwise extracted from filename or uses now
        #[arg(long)]
        time: Option<String>,
    },

    /// Regenerate all thumbnails at current size (400px)
    RegenThumbs {
        /// Only process thumbnails smaller than this size (default: regenerate all)
        #[arg(long)]
        if_smaller: Option<u32>,

        /// Dry run - show what would be regenerated without doing it
        #[arg(long)]
        dry_run: bool,
    },

    /// Generate multiple images from the same prompt
    #[command(long_about = "Generate multiple images from the same prompt sequentially.\n\n\
        Useful for exploring variations — same prompt/model produces different results each run. \
        Reports per-image success/failure and a summary at the end.\n\n\
        Examples:\n  \
        pixery batch -p \"fantasy landscape\" -n 6\n  \
        pixery batch -p \"character portrait\" -m animagine -n 4 --ratio portrait\n  \
        pixery batch -p \"concept art\" -m gemini-pro --ref mood.png -t exploration")]
    Batch {
        /// Prompt text
        #[arg(short, long)]
        prompt: String,

        /// Model to use
        #[arg(short, long, default_value = "gemini-flash")]
        model: String,

        /// Number of images to generate
        #[arg(short = 'n', long, default_value = "4")]
        count: u32,

        /// Tags (comma-separated)
        #[arg(short, long)]
        tags: Option<String>,

        /// Reference image(s)
        #[arg(short, long = "ref")]
        reference: Vec<PathBuf>,

        /// Negative prompt
        #[arg(long)]
        negative: Option<String>,

        /// Aspect ratio (e.g., square, portrait, 16:9, 2:3)
        #[arg(long)]
        ratio: Option<String>,
    },

    /// Export generations to a directory
    #[command(long_about = "Copy generation images to an output directory.\n\n\
        Select generations by ID, by tag, or both. With --with-metadata, writes a \
        JSON sidecar file alongside each image containing prompt, model, tags, cost, etc.\n\n\
        Examples:\n  \
        pixery export --ids 100 101 102 -o ./export/\n  \
        pixery export --tag character -o ./characters/ --with-metadata\n  \
        pixery export --ids 50 --tag landscape -o ./portfolio/")]
    Export {
        /// Generation IDs to export
        #[arg(short, long)]
        ids: Vec<i64>,

        /// Export all generations with this tag
        #[arg(short, long)]
        tag: Option<String>,

        /// Output directory
        #[arg(short, long)]
        output: PathBuf,

        /// Write metadata.json sidecar files
        #[arg(long)]
        with_metadata: bool,
    },

    /// Manage collections (project folders)
    #[command(long_about = "Manage collections — lightweight project folders for organizing generations.\n\n\
        Collections group generations by project or theme, independent of tags. \
        A generation can belong to multiple collections.\n\n\
        Subcommands:\n  \
        create  Create a new collection\n  \
        list    List all collections\n  \
        add     Add generation(s) to a collection\n  \
        remove  Remove generation(s) from a collection\n  \
        delete  Delete a collection (does not delete generations)\n\n\
        Examples:\n  \
        pixery collection create \"rpg-portraits\" -d \"Character art for the RPG project\"\n  \
        pixery collection add 100 101 102 -c rpg-portraits\n  \
        pixery collection list")]
    Collection {
        #[command(subcommand)]
        action: CollectionAction,
    },

    /// Show recent prompt history
    #[command(long_about = "Show recent prompts with generation IDs.\n\n\
        Output columns: ID, DATE, PROMPT (truncated). Useful for re-using or iterating \
        on previous prompts — copy the ID to 'pixery show' or 'pixery view' for details.\n\n\
        Examples:\n  \
        pixery history              # Last 20 prompts\n  \
        pixery history -n 50        # Last 50 prompts")]
    History {
        /// Number of entries to show
        #[arg(short = 'n', long, default_value = "20")]
        limit: i64,
    },
}

#[derive(Subcommand, Clone)]
pub enum CollectionAction {
    /// Create a new collection
    Create {
        /// Collection name
        name: String,

        /// Description
        #[arg(short, long)]
        description: Option<String>,
    },

    /// List all collections
    List,

    /// Add generations to a collection
    Add {
        /// Generation IDs
        ids: Vec<i64>,

        /// Collection name
        #[arg(short, long)]
        collection: String,
    },

    /// Remove generations from a collection
    Remove {
        /// Generation IDs
        ids: Vec<i64>,

        /// Collection name
        #[arg(short, long)]
        collection: String,
    },

    /// Delete a collection
    Delete {
        /// Collection name
        name: String,
    },
}

pub fn run(cmd: Commands) -> Result<()> {
    // Ensure directories exist
    archive::ensure_dirs()?;

    // Open database
    let db = Database::open(&archive::db_path())?;

    match cmd {
        Commands::Generate {
            prompt,
            file,
            model,
            tags,
            reference,
            copy_to,
            negative,
            ratio,
        } => {
            let prompt_text = if let Some(p) = prompt {
                p
            } else if let Some(f) = file {
                std::fs::read_to_string(&f).context("Failed to read prompt file")?
            } else {
                anyhow::bail!("Either --prompt or --file is required");
            };

            let tag_list: Vec<String> = tags
                .map(|t| t.split(',').map(|s| s.trim().to_string()).collect())
                .unwrap_or_default();

            let ref_paths: Vec<String> = reference
                .iter()
                .map(|p| p.to_string_lossy().to_string())
                .collect();

            let (width, height) = resolve_ratio(ratio.as_deref())?;

            // Run async generation
            let rt = tokio::runtime::Runtime::new()?;
            rt.block_on(async {
                generate_image(&db, &prompt_text, &model, &tag_list, &ref_paths, copy_to.as_ref(), negative.as_deref(), width, height)
                    .await
            })?;
        }

        Commands::List {
            limit,
            tag,
            model,
            starred,
        } => {
            let filter = ListFilter {
                limit: Some(limit),
                tags: tag.map(|t| vec![t]),
                model,
                starred_only: starred,
                ..Default::default()
            };

            let generations = db.list_generations(&filter)?;
            print_generations(&generations);
        }

        Commands::Search { query, limit } => {
            let generations = db.search_generations(&query, limit)?;
            print_generations(&generations);
        }

        Commands::Show { id } => {
            let gen = db
                .get_generation(id)?
                .ok_or_else(|| anyhow::anyhow!("Generation {} not found", id))?;

            println!("ID: {}", gen.id);
            println!("Slug: {}", gen.slug);
            println!("Model: {} ({})", gen.model, gen.provider);
            println!("Date: {}", gen.date);
            println!("Time: {}", gen.timestamp);
            println!("Path: {}", gen.image_path);
            if let Some(t) = gen.generation_time_seconds {
                println!("Generation time: {:.1}s", t);
            }
            if let Some(c) = gen.cost_estimate_usd {
                println!("Cost: ${:.3}", c);
            }
            if let Some(s) = &gen.seed {
                println!("Seed: {}", s);
            }
            if let (Some(w), Some(h)) = (gen.width, gen.height) {
                println!("Dimensions: {}x{}", w, h);
            }
            if gen.starred {
                println!("Starred: yes");
            }
            if !gen.tags.is_empty() {
                println!("Tags: {}", gen.tags.join(", "));
            }

            // Show reference images
            let refs = db.get_references_for_generation(id)?;
            if !refs.is_empty() {
                println!("References ({}):", refs.len());
                for r in &refs {
                    println!("  - {}", r.path);
                }
            }

            println!("\nPrompt:\n{}", gen.prompt);
        }

        Commands::View { ids, width, height } => {
            view_images(&db, &ids, width, height)?;
        }

        Commands::Tag { id, tags } => {
            let tag_list: Vec<String> = tags.split(',').map(|s| s.trim().to_string()).collect();
            db.add_tags(id, &tag_list)?;
            println!("Added tags to generation {}", id);
        }

        Commands::Untag { id, tag } => {
            db.remove_tag(id, &tag)?;
            println!("Removed tag '{}' from generation {}", tag, id);
        }

        Commands::Star { id } => {
            let starred = db.toggle_starred(id)?;
            if starred {
                println!("Starred generation {}", id);
            } else {
                println!("Unstarred generation {}", id);
            }
        }

        Commands::Delete { id } => {
            if let Some(path) = db.permanently_delete_generation(id)? {
                archive::delete_image(std::path::Path::new(&path))?;
                println!("Deleted generation {}", id);
            } else {
                println!("Generation {} not found", id);
            }
        }

        Commands::Update {
            id,
            title,
            prompt,
            prompt_file,
            model,
            reference,
            tags,
        } => {
            // Verify generation exists
            db.get_generation(id)?
                .ok_or_else(|| anyhow::anyhow!("Generation {} not found", id))?;

            let mut updates = vec![];

            // Update title
            if let Some(t) = title {
                db.update_title(id, Some(&t))?;
                updates.push("title");
            }

            // Update prompt
            if let Some(p) = prompt {
                db.update_prompt(id, &p)?;
                updates.push("prompt");
            } else if let Some(f) = prompt_file {
                let p = std::fs::read_to_string(&f).context("Failed to read prompt file")?;
                db.update_prompt(id, &p)?;
                updates.push("prompt");
            }

            // Update model
            if let Some(m) = model {
                let model_info = ModelInfo::find(&m);
                let provider = model_info
                    .as_ref()
                    .map(|mi| mi.provider.to_string())
                    .unwrap_or_else(|| "unknown".to_string());
                db.update_model(id, &m, &provider)?;
                updates.push("model");
            }

            // Add tags
            if let Some(t) = tags {
                let tag_list: Vec<String> = t.split(',').map(|s| s.trim().to_string()).collect();
                db.add_tags(id, &tag_list)?;
                updates.push("tags");
            }

            // Add reference images
            if !reference.is_empty() {
                for ref_path in &reference {
                    let (hash, stored_path) = archive::store_reference(ref_path)?;
                    let ref_id = db.get_or_create_reference(&hash, stored_path.to_str().unwrap())?;
                    db.link_reference(id, ref_id)?;
                }
                updates.push("references");
            }

            if updates.is_empty() {
                println!("No updates specified for generation {}", id);
            } else {
                println!("Updated generation {}: {}", id, updates.join(", "));
            }
        }

        Commands::Models { model, guide } => {
            match (model, guide) {
                // pixery models MODEL --guide
                (Some(m), true) => {
                    if let Some(g) = PromptingGuide::for_model(&m) {
                        println!("{}", g.format());
                    } else {
                        // No guide available, but model might exist
                        if ModelInfo::find(&m).is_some() {
                            println!("No prompting guide available for '{}'. This model uses standard prompting.", m);
                        } else {
                            eprintln!("Unknown model: {}", m);
                            eprintln!("\nAvailable models:");
                            for info in ModelInfo::all() {
                                eprintln!("  {}", info.id);
                            }
                            std::process::exit(1);
                        }
                    }
                }
                // pixery models MODEL (no --guide)
                (Some(m), false) => {
                    if let Some(info) = ModelInfo::find(&m) {
                        println!("Model: {}", info.id);
                        println!("Display name: {}", info.display_name);
                        println!("Provider: {}", info.provider);
                        println!("Cost: ${:.3}/image", info.cost_per_image);
                        println!("Max references: {}", if info.max_refs == 0 { "none (text-to-image only)".to_string() } else { info.max_refs.to_string() });

                        if PromptingGuide::for_model(&m).is_some() {
                            println!("\nTip: Use --guide for prompting instructions");
                        }
                    } else {
                        eprintln!("Unknown model: {}", m);
                        eprintln!("\nAvailable models:");
                        for info in ModelInfo::all() {
                            eprintln!("  {}", info.id);
                        }
                        std::process::exit(1);
                    }
                }
                // pixery models --guide (no model specified)
                (None, true) => {
                    println!("Available prompting guides:");
                    println!();
                    for g in PromptingGuide::all() {
                        println!("  {} ({})", g.model_pattern, g.style);
                    }
                    println!();
                    println!("Usage: pixery models MODEL --guide");
                }
                // pixery models (list all)
                (None, false) => {
                    let models = ModelInfo::all();
                    println!("{:<30} {:<10} {:>8} {:>8}", "MODEL ID", "PROVIDER", "COST", "REFS");
                    println!("{}", "-".repeat(60));
                    for m in models {
                        let refs_str = if m.max_refs == 0 {
                            "-".to_string()
                        } else {
                            format!("{}", m.max_refs)
                        };
                        println!(
                            "{:<30} {:<10} ${:>6.3} {:>8}",
                            m.id, m.provider, m.cost_per_image, refs_str
                        );
                    }
                }
            }
        }

        Commands::Tags => {
            let tags = db.list_tags()?;
            if tags.is_empty() {
                println!("No tags yet");
            } else {
                println!("{:<30} {:>8}", "TAG", "COUNT");
                println!("{}", "-".repeat(40));
                for t in tags {
                    println!("{:<30} {:>8}", t.name, t.count);
                }
            }
        }

        Commands::Cost { since } => {
            let since_date = models::parse_since(&since).map_err(|e| anyhow::anyhow!(e))?;
            let summary = db.get_cost_summary(since_date.as_deref())?;

            println!("Cost Summary");
            println!("============");
            println!("Total: ${:.2}", summary.total_usd);
            println!("Generations: {}", summary.count);
            println!();

            if !summary.by_model.is_empty() {
                println!("By Model:");
                for (model, cost) in &summary.by_model {
                    println!("  {:<30} ${:.2}", model, cost);
                }
                println!();
            }

            if !summary.by_day.is_empty() {
                println!("By Day (last 10):");
                for (day, cost) in summary.by_day.iter().take(10) {
                    println!("  {} ${:.2}", day, cost);
                }
            }
        }

        Commands::Failures { limit } => {
            let failures = db.list_recent_failed_jobs(limit)?;
            if failures.is_empty() {
                println!("No recent failures (last 24 hours)");
            } else {
                println!("Recent Failures");
                println!("===============");
                for job in failures {
                    println!();
                    println!("ID: {} | Model: {} | {}", job.id, job.model, job.completed_at.unwrap_or_default());
                    println!("Prompt: \"{}\"", truncate_string(&job.prompt, 60));
                    if let Some(error) = &job.error {
                        println!("Error: {}", error);
                    }
                }
            }
        }

        Commands::Import {
            file,
            prompt,
            prompt_file,
            model,
            tags,
            reference,
            date,
            time,
        } => {
            let prompt_text = if let Some(p) = prompt {
                p
            } else if let Some(f) = prompt_file {
                std::fs::read_to_string(&f).context("Failed to read prompt file")?
            } else {
                // Use filename as prompt if none provided
                file.file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("imported")
                    .to_string()
            };

            let tag_list: Vec<String> = tags
                .map(|t| t.split(',').map(|s| s.trim().to_string()).collect())
                .unwrap_or_default();

            let ref_paths: Vec<String> = reference
                .iter()
                .map(|p| p.to_string_lossy().to_string())
                .collect();

            import_image(&db, &file, &prompt_text, &model, &tag_list, &ref_paths, date.as_deref(), time.as_deref())?;
        }

        Commands::RegenThumbs { if_smaller, dry_run } => {
            regenerate_thumbnails(&db, if_smaller, dry_run)?;
        }

        Commands::Batch {
            prompt,
            model,
            count,
            tags,
            reference,
            negative,
            ratio,
        } => {
            let tag_list: Vec<String> = tags
                .map(|t| t.split(',').map(|s| s.trim().to_string()).collect())
                .unwrap_or_default();

            let ref_paths: Vec<String> = reference
                .iter()
                .map(|p| p.to_string_lossy().to_string())
                .collect();

            let (width, height) = resolve_ratio(ratio.as_deref())?;

            println!("Generating {} images with {}...", count, model);

            let rt = tokio::runtime::Runtime::new()?;
            let mut successes = 0u32;
            let mut failures = 0u32;

            for i in 1..=count {
                print!("[{}/{}] ", i, count);
                match rt.block_on(async {
                    workflow::perform_generation(
                        &db,
                        &prompt,
                        &model,
                        &tag_list,
                        &ref_paths,
                        JobSource::Cli,
                        negative.as_deref(),
                        width,
                        height,
                    )
                    .await
                }) {
                    Ok((gen_id, generation)) => {
                        println!("ID {} -> {}", gen_id, generation.image_path);
                        successes += 1;
                    }
                    Err(e) => {
                        println!("Error: {}", e);
                        failures += 1;
                    }
                }
            }

            println!("\nBatch complete: {} succeeded, {} failed", successes, failures);
        }

        Commands::Export {
            ids,
            tag,
            output,
            with_metadata,
        } => {
            export_generations(&db, &ids, tag.as_deref(), &output, with_metadata)?;
        }

        Commands::Collection { action } => {
            match action {
                CollectionAction::Create { name, description } => {
                    let id = db.create_collection(&name, description.as_deref())?;
                    println!("Created collection '{}' (ID: {})", name, id);
                }
                CollectionAction::List => {
                    let collections = db.list_collections()?;
                    if collections.is_empty() {
                        println!("No collections");
                    } else {
                        println!("{:<6} {:<20} {:>5} {:<12} {}", "ID", "NAME", "COUNT", "CREATED", "DESCRIPTION");
                        println!("{}", "-".repeat(70));
                        for c in &collections {
                            let desc = c.description.as_deref().unwrap_or("");
                            println!("{:<6} {:<20} {:>5} {:<12} {}", c.id, c.name, c.count, &c.created_at[..10], desc);
                        }
                    }
                }
                CollectionAction::Add { ids, collection } => {
                    for id in &ids {
                        db.add_to_collection(*id, &collection)?;
                    }
                    println!("Added {} generation(s) to '{}'", ids.len(), collection);
                }
                CollectionAction::Remove { ids, collection } => {
                    for id in &ids {
                        db.remove_from_collection(*id, &collection)?;
                    }
                    println!("Removed {} generation(s) from '{}'", ids.len(), collection);
                }
                CollectionAction::Delete { name } => {
                    if db.delete_collection(&name)? {
                        println!("Deleted collection '{}'", name);
                    } else {
                        println!("Collection '{}' not found", name);
                    }
                }
            }
        }

        Commands::History { limit } => {
            let entries = db.prompt_history(limit)?;
            if entries.is_empty() {
                println!("No prompt history");
            } else {
                println!("{:>5} {:<12} {}", "ID", "DATE", "PROMPT");
                println!("{}", "-".repeat(70));
                for (id, prompt, timestamp) in &entries {
                    let date = &timestamp[..10];
                    let prompt_display = truncate_string(prompt, 50);
                    println!("{:>5} {:<12} {}", id, date, prompt_display);
                }
            }
        }
    }

    Ok(())
}

async fn generate_image(
    db: &Database,
    prompt: &str,
    model: &str,
    tags: &[String],
    reference_paths: &[String],
    copy_to: Option<&PathBuf>,
    negative_prompt: Option<&str>,
    width: Option<i32>,
    height: Option<i32>,
) -> Result<()> {
    println!("Generating with {}...", model);

    let (gen_id, generation) =
        workflow::perform_generation(db, prompt, model, tags, reference_paths, JobSource::Cli, negative_prompt, width, height)
            .await?;

    // Copy to destination if requested
    if let Some(dest) = copy_to {
        archive::copy_to(std::path::Path::new(&generation.image_path), dest)?;
        println!("Copied to: {}", dest.display());
    }

    println!("Generated: {} (ID: {})", generation.image_path, gen_id);
    if let Some(c) = generation.cost_estimate_usd {
        println!("Cost: ${:.4}", c);
    }

    Ok(())
}

/// Resolve --ratio flag to (width, height), or (None, None) if not specified.
fn resolve_ratio(ratio: Option<&str>) -> Result<(Option<i32>, Option<i32>)> {
    match ratio {
        None => Ok((None, None)),
        Some(r) => {
            let (w, h) = models::resolve_aspect_ratio(r)
                .ok_or_else(|| anyhow::anyhow!(
                    "Invalid aspect ratio '{}'. Valid: square, portrait, landscape, wide, tall, 1:1, 2:3, 3:2, 4:3, 3:4, 16:9, 9:16",
                    r
                ))?;
            Ok((Some(w), Some(h)))
        }
    }
}

fn export_generations(
    db: &Database,
    ids: &[i64],
    tag: Option<&str>,
    output: &Path,
    with_metadata: bool,
) -> Result<()> {
    // Collect generations to export
    let mut generations: Vec<Generation> = Vec::new();

    for id in ids {
        match db.get_generation(*id)? {
            Some(g) => generations.push(g),
            None => eprintln!("Generation {} not found, skipping", id),
        }
    }

    if let Some(tag_filter) = tag {
        let filter = ListFilter {
            limit: None,
            tags: Some(vec![tag_filter.to_string()]),
            ..Default::default()
        };
        let tagged = db.list_generations(&filter)?;
        for g in tagged {
            if !generations.iter().any(|existing| existing.id == g.id) {
                generations.push(g);
            }
        }
    }

    if generations.is_empty() {
        println!("No generations to export");
        return Ok(());
    }

    std::fs::create_dir_all(output).context("Failed to create output directory")?;

    let mut exported = 0;
    for gen in &generations {
        let src = Path::new(&gen.image_path);
        if !src.exists() {
            eprintln!("Image file missing for ID {}, skipping", gen.id);
            continue;
        }

        let filename = src
            .file_name()
            .ok_or_else(|| anyhow::anyhow!("Invalid image path for ID {}", gen.id))?;
        let dest = output.join(filename);
        std::fs::copy(src, &dest)
            .with_context(|| format!("Failed to copy ID {} to {}", gen.id, dest.display()))?;

        if with_metadata {
            let meta_path = dest.with_extension("json");
            let meta = serde_json::json!({
                "id": gen.id,
                "prompt": gen.prompt,
                "model": gen.model,
                "provider": gen.provider,
                "date": gen.date,
                "timestamp": gen.timestamp,
                "cost_estimate_usd": gen.cost_estimate_usd,
                "seed": gen.seed,
                "width": gen.width,
                "height": gen.height,
                "tags": gen.tags,
                "negative_prompt": gen.negative_prompt,
                "starred": gen.starred,
            });
            std::fs::write(&meta_path, serde_json::to_string_pretty(&meta)?)
                .with_context(|| format!("Failed to write metadata for ID {}", gen.id))?;
        }

        exported += 1;
    }

    println!("Exported {} image(s) to {}", exported, output.display());
    Ok(())
}

fn import_image(
    db: &Database,
    source_path: &PathBuf,
    prompt: &str,
    model: &str,
    tags: &[String],
    reference_paths: &[String],
    date_override: Option<&str>,
    time_override: Option<&str>,
) -> Result<()> {
    // Read the source image
    let data = std::fs::read(source_path).context("Failed to read source image")?;

    // Try to extract date/time from filename pattern: name-YYYYMMDD-HHMMSS.ext
    let filename = source_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("");

    let (extracted_date, extracted_time) = extract_datetime_from_filename(filename);

    // Use override > extracted > current time
    let now = Local::now();
    let date = date_override
        .map(|s| s.to_string())
        .or(extracted_date)
        .unwrap_or_else(|| now.format("%Y-%m-%d").to_string());

    let time_str = time_override
        .map(|s| s.replace(':', ""))
        .or(extracted_time)
        .unwrap_or_else(|| now.format("%H%M%S").to_string());

    // Pad to 6 chars to prevent slice panics on short input
    let time_str = format!("{:0<6}", time_str);

    // Build full timestamp
    let timestamp = format!(
        "{}T{}:{}:{}",
        date,
        &time_str[0..2],
        &time_str[2..4],
        &time_str[4..6]
    );

    // Get model info for provider
    let model_info = ModelInfo::find(model);
    let provider = model_info
        .as_ref()
        .map(|m| m.provider.to_string())
        .unwrap_or_else(|| "unknown".to_string());

    // Save to archive (copies the file)
    let slug = archive::slugify_prompt(prompt);
    let (image_path, thumb_path, width, height, file_size) =
        archive::save_image(&data, &date, &slug, &timestamp)?;

    // Insert into database
    let gen_id = db.insert_generation(
        &slug,
        prompt,
        model,
        &provider,
        &timestamp,
        &date,
        image_path.to_str().unwrap(),
        thumb_path.as_ref().and_then(|p| p.to_str()),
        None, // generation_time_seconds - unknown for imports
        None, // cost - unknown for imports
        None, // seed
        Some(width),
        Some(height),
        Some(file_size),
        None, // parent_id
        None, // negative_prompt
    )?;

    // Add tags
    if !tags.is_empty() {
        db.add_tags(gen_id, tags)?;
    }

    // Store and link reference images
    for ref_path in reference_paths {
        let (hash, stored_path) = archive::store_reference(std::path::Path::new(ref_path))?;
        let ref_id = db.get_or_create_reference(&hash, stored_path.to_str().unwrap())?;
        db.link_reference(gen_id, ref_id)?;
    }

    println!("Imported: {} (ID: {})", image_path.display(), gen_id);
    println!("  Source: {}", source_path.display());
    println!("  Date: {} Time: {}", date, time_str);
    if !reference_paths.is_empty() {
        println!("  References: {}", reference_paths.len());
    }

    Ok(())
}

/// Extract date and time from filename patterns like:
/// - name-YYYYMMDD-HHMMSS.ext
/// - name-v1-YYYYMMDD-HHMMSS.ext
fn extract_datetime_from_filename(filename: &str) -> (Option<String>, Option<String>) {
    use std::sync::OnceLock;
    static DATE_RE: OnceLock<regex::Regex> = OnceLock::new();
    let re = DATE_RE.get_or_init(|| regex::Regex::new(r"(\d{4})(\d{2})(\d{2})-(\d{6})").unwrap());

    if let Some(caps) = re.captures(filename) {
        let date = format!("{}-{}-{}", &caps[1], &caps[2], &caps[3]);
        let time = caps[4].to_string();
        return (Some(date), Some(time));
    }

    (None, None)
}

fn print_generations(generations: &[crate::models::Generation]) {
    if generations.is_empty() {
        println!("No generations found");
        return;
    }

    println!(
        "{:>5} {:<12} {:<25} {:<40}",
        "ID", "DATE", "MODEL", "PROMPT"
    );
    println!("{}", "-".repeat(85));

    for gen in generations {
        let prompt_preview: String = gen.prompt.chars().take(38).collect();
        let prompt_display = if gen.prompt.len() > 38 {
            format!("{}...", prompt_preview)
        } else {
            prompt_preview
        };

        let star = if gen.starred { "*" } else { " " };

        println!(
            "{:>4}{} {:<12} {:<25} {:<40}",
            gen.id, star, gen.date, gen.model, prompt_display
        );
    }
}

fn truncate_string(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        format!("{}...", &s[..max_len.saturating_sub(3)])
    }
}


fn regenerate_thumbnails(db: &Database, if_smaller: Option<u32>, dry_run: bool) -> Result<()> {
    use image::GenericImageView;

    let filter = ListFilter {
        limit: None,
        ..Default::default()
    };
    let generations = db.list_generations(&filter)?;

    let target_size = archive::THUMBNAIL_SIZE;
    let mut regenerated = 0;
    let mut skipped = 0;
    let mut errors = 0;

    println!(
        "Regenerating thumbnails at {}px{}",
        target_size,
        if dry_run { " (dry run)" } else { "" }
    );
    println!();

    for gen in &generations {
        let image_path = std::path::Path::new(&gen.image_path);

        // Check if source image exists
        if !image_path.exists() {
            println!("  [SKIP] ID {}: source image missing", gen.id);
            skipped += 1;
            continue;
        }

        // Determine thumb path
        let stem = image_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("image");
        let thumb_path = image_path.with_file_name(format!("{}.thumb.jpg", stem));

        // Check if we should regenerate based on --if-smaller
        if let Some(min_size) = if_smaller {
            if thumb_path.exists() {
                if let Ok(existing) = image::open(&thumb_path) {
                    let (w, h) = existing.dimensions();
                    if w >= min_size && h >= min_size {
                        skipped += 1;
                        continue;
                    }
                }
            }
        }

        if dry_run {
            println!("  [REGEN] ID {}: {}", gen.id, gen.slug);
            regenerated += 1;
            continue;
        }

        // Load source and generate new thumbnail
        match image::open(image_path) {
            Ok(img) => {
                let thumb = img.thumbnail(target_size, target_size);
                match thumb.save(&thumb_path) {
                    Ok(_) => {
                        println!("  [OK] ID {}: {}", gen.id, gen.slug);
                        regenerated += 1;

                        // Update database if thumb_path changed
                        if gen.thumb_path.as_deref() != Some(thumb_path.to_str().unwrap_or("")) {
                            let _ = db.update_thumb_path(gen.id, thumb_path.to_str().unwrap());
                        }
                    }
                    Err(e) => {
                        println!("  [ERR] ID {}: failed to save - {}", gen.id, e);
                        errors += 1;
                    }
                }
            }
            Err(e) => {
                println!("  [ERR] ID {}: failed to load - {}", gen.id, e);
                errors += 1;
            }
        }
    }

    println!();
    println!(
        "Done: {} regenerated, {} skipped, {} errors",
        regenerated, skipped, errors
    );

    Ok(())
}

/// Output images to temp directory for agent viewing
fn view_images(db: &Database, ids: &[i64], width: Option<u32>, height: Option<u32>) -> Result<()> {
    use image::GenericImageView;

    let output_dir = PathBuf::from("/tmp/pixery-preview");
    std::fs::create_dir_all(&output_dir).context("Failed to create preview directory")?;

    for id in ids {
        let gen = match db.get_generation(*id)? {
            Some(g) => g,
            None => {
                eprintln!("Generation {} not found", id);
                continue;
            }
        };

        let source_path = Path::new(&gen.image_path);
        if !source_path.exists() {
            eprintln!("Image file missing for generation {}", id);
            continue;
        }

        // Load the image
        let img = image::open(source_path)
            .with_context(|| format!("Failed to load image for generation {}", id))?;

        let (orig_w, orig_h) = img.dimensions();

        // Determine output dimensions
        let output_img = match (width, height) {
            (None, None) => {
                // No resize - just output the path to the original
                println!("{}", gen.image_path);
                continue;
            }
            (Some(w), None) => {
                // Scale by width, preserve aspect ratio
                let scale = w as f32 / orig_w as f32;
                let new_h = (orig_h as f32 * scale) as u32;
                img.resize(w, new_h, image::imageops::FilterType::Lanczos3)
            }
            (None, Some(h)) => {
                // Scale by height, preserve aspect ratio
                let scale = h as f32 / orig_h as f32;
                let new_w = (orig_w as f32 * scale) as u32;
                img.resize(new_w, h, image::imageops::FilterType::Lanczos3)
            }
            (Some(w), Some(h)) => {
                // Fit within bounds, preserve aspect ratio
                img.resize(w, h, image::imageops::FilterType::Lanczos3)
            }
        };

        // Save to temp directory as PNG
        let output_path = output_dir.join(format!("{}.png", id));
        output_img
            .save(&output_path)
            .with_context(|| format!("Failed to save preview for generation {}", id))?;

        println!("{}", output_path.display());
    }

    Ok(())
}
