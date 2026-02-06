# No-Brainer Features

> Audit 2026-02-06 | Part 2 of 4

Features that require minimal effort and directly serve existing workflows. Each builds on current architecture without requiring redesign.

---

## 1. `pixery batch` -- Parallel Variations

Generate N images from the same prompt concurrently.

```bash
pixery batch -p "1girl, silver hair, blue eyes, masterpiece" -m animagine -n 4 --tags character
```

**Why:** Essential for both character design (exploring variations) and branding (comparing options). Currently Claude must issue N sequential `pixery generate` calls.

**Implementation:** Spawn N `providers::generate()` futures via `tokio::join_all()`. Each result goes through the standard save/tag/reference pipeline (which should be shared per Part 1). The job system already tracks individual generations -- create one job per image in the batch, plus a parent batch record if desired.

```rust
// cli.rs
Commands::Batch { prompt, model, count, tags, reference } => {
    let futures = (0..count).map(|_| {
        perform_generation(&db, &prompt, &model, &tags, &refs, JobSource::Cli)
    });
    let results = futures::future::join_all(futures).await;
    // Report successes and failures
}
```

**Effort:** ~50 lines of new code (depends on shared workflow from Part 1).

---

## 2. Aspect Ratio Presets

Currently self-hosted models hardcode 1024x1024 (`selfhosted.rs:129-130`), and cloud models use provider defaults.

```bash
pixery generate -p "..." -m animagine --ratio 2:3
pixery generate -p "..." -m gemini-flash --ratio 16:9
```

**Preset mapping (SDXL native resolutions, ~1M pixels):**

| Name | Ratio | Resolution | Use Case |
|------|-------|------------|----------|
| `square` | 1:1 | 1024x1024 | Icons, avatars |
| `portrait` / `2:3` | 2:3 | 832x1216 | Character art, cards |
| `landscape` / `3:2` | 3:2 | 1216x832 | Scene art, headers |
| `wide` / `16:9` | 16:9 | 1344x768 | Social banners, cinematic |
| `tall` / `9:16` | 9:16 | 768x1344 | Stories, mobile |
| `4:3` | 4:3 | 1152x896 | Presentation slides |

**Implementation:**

Add to `models.rs`:
```rust
pub fn resolve_aspect_ratio(ratio: &str) -> Option<(i32, i32)> {
    match ratio {
        "square" | "1:1" => Some((1024, 1024)),
        "portrait" | "2:3" => Some((832, 1216)),
        // ...
    }
}
```

Pass `(width, height)` through `GenerateParams` -> providers. Each provider maps to its format (fal uses string names like `portrait_4_3`, Gemini uses pixels, self-hosted uses pixels directly).

**Effort:** ~30 lines in `models.rs`, ~10 lines per provider, ~15 lines CLI/GUI.

---

## 3. Wire Up Compare View

`Compare.tsx` (118 lines) exists but isn't connected to any UI trigger. The batch action bar already exists.

**Action:** When exactly 2 images are marked (Cmd+click), show a "Compare" button in the BatchActionBar. Clicking it sets `compareIds` and switches to compare view.

**Changes:**
- `BatchActionBar.tsx`: Add "Compare" button visible when `count === 2`
- `App.tsx`: Wire `handleCompare` to set compareIds from markedIds

**Effort:** ~30 lines to connect existing components.

---

## 4. `pixery export`

```bash
pixery export --tag character --output ./character-pack/
pixery export 140 141 142 --output ./assets/ --with-metadata
pixery export --collection rpg-heroes --format zip --output ./delivery.zip
```

Copies selected images to a directory or zip. Optionally includes a `metadata.json` sidecar with prompts, models, tags, and settings used.

**Why:** Essential for feeding assets into game engines, design tools, or client deliverables. Currently users must manually find files in `~/media/image-gen/generations/YYYY-MM-DD/`.

**Implementation:**

```rust
Commands::Export { ids, tag, output, with_metadata, format } => {
    let generations = if !ids.is_empty() {
        ids.iter().filter_map(|id| db.get_generation(*id).ok().flatten()).collect()
    } else if let Some(tag) = tag {
        db.list_generations(&ListFilter { tags: Some(vec![tag]), ..Default::default() })?
    } else { bail!("Specify IDs or --tag") };

    for gen in &generations {
        fs::copy(&gen.image_path, output.join(gen.slug + ".png"))?;
    }
    if with_metadata {
        fs::write(output.join("metadata.json"), serde_json::to_string_pretty(&generations)?)?;
    }
}
```

**Effort:** ~80 lines.

---

## 5. Collections / Project Folders

Lightweight grouping above tags. Tags are attributes ("character", "landscape"); collections are projects ("rpg-heroes", "brand-v2").

**Schema:**

```sql
CREATE TABLE collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE generation_collections (
    generation_id INTEGER REFERENCES generations(id) ON DELETE CASCADE,
    collection_id INTEGER REFERENCES collections(id) ON DELETE CASCADE,
    PRIMARY KEY (generation_id, collection_id)
);
CREATE INDEX idx_gc_collection ON generation_collections(collection_id);
```

**CLI:**

```bash
pixery collection create "rpg-heroes"
pixery collection add 140 141 142 rpg-heroes
pixery collection list
pixery list --collection rpg-heroes
```

**GUI:** Sidebar section above tags showing collections. Click to filter gallery.

**Effort:** ~120 lines Rust (schema + db methods + CLI commands), ~80 lines React (sidebar section + filter integration).

---

## 6. Prompt History / Autocomplete

When opening the generate modal, show recent prompts as suggestions.

```sql
SELECT DISTINCT prompt FROM generations
ORDER BY timestamp DESC LIMIT 20
```

In the GUI: as user types in the prompt textarea, show matching previous prompts as dropdown suggestions. Simple substring match is sufficient.

In the CLI: `pixery history` shows recent prompts with IDs. `pixery generate --from 140` reuses generation #140's prompt.

**Effort:** ~40 lines backend (one new db method + CLI command), ~50 lines frontend (autocomplete in GenerateModal).

---

## 7. Negative Prompt Support

Currently the database, CLI, and GUI have no concept of negative prompts despite the self-hosted models and prompting guides relying on them heavily. The server.py defaults fill in, but users can't override.

```bash
pixery generate -p "1girl, silver hair" -m animagine --negative "lowres, bad anatomy, bad hands"
```

**Changes needed:**

- Add `negative_prompt TEXT` column to `generations` table (migration in `db.rs`)
- Add `negative_prompt: Option<String>` to `GenerationResult`, `GenerateParams`, `Generation` structs
- Add `--negative` flag to CLI generate command
- Pass through to each provider's `generate()` function
- Add textarea to GUI generate modal
- Self-hosted provider: pass to `negative_prompt` field in request body
- Cloud providers: append to prompt where applicable (Gemini doesn't use negatives; fal/OpenAI ignore)

**Effort:** ~40 lines backend, ~30 lines frontend.
