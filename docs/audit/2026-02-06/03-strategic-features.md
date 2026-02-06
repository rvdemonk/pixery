# Strategic Features

> Audit 2026-02-06 | Part 3 of 4

Features targeted at specific use cases: RPG/visual novel character assets, SaaS branding/marketing, and general image generation workflows.

---

## For RPG / Visual Novel Character Assets

### A. Character Sheets -- Multi-View Generation

A "character sheet" mode that generates multiple views of the same character from a single description.

**Workflow:**
1. User describes character once
2. Pixery generates N images with appended view modifiers
3. All linked as a group via `parent_id` or a new `sheet_id`
4. GUI displays them as a strip/grid in the details panel

**View modifiers (for animagine/pony/noobai):**

```
base: "1girl, silver hair, blue eyes, black jacket"
views:
  - "from front, standing, full body"
  - "from side, profile, upper body"
  - "three-quarter view, upper body"
  - "from behind, full body"
  - "close-up, face, portrait"
  - "chibi, full body, simple background"
```

**CLI:**

```bash
pixery sheet -p "1girl, silver hair, blue eyes, black jacket" \
  -m animagine \
  --views "front,side,3/4,back,portrait,chibi" \
  --tags character,protagonist
```

**Implementation:** Builds on `batch` (Part 2). Each view is a separate generation with a shared `sheet_id`. The prompt template system appends view-specific tags. Store view name in a new `view` column or in tags.

**GUI:** When a generation has `sheet_id`, the details panel shows all siblings as a horizontal strip. Click any sibling to navigate.

**Effort:** ~100 lines backend (view template system + sheet grouping), ~80 lines frontend (sheet strip in details).

---

### B. Pinned References for Character Consistency

The natural workflow for iterative character design:
1. Generate a "hero" image that nails the look
2. Pin it as the default reference
3. All subsequent generations automatically include it

**CLI:**

```bash
pixery pin 140                                    # Pin generation #140
pixery generate -p "same character, angry" -m animagine  # Auto-includes #140 as ref
pixery pin --clear                                # Clear pin
pixery pin --list                                 # Show pinned refs
```

**Implementation:** Store pinned IDs in `selfhosted.json` (or a new `session.json`). When `generate` is called without explicit `--ref` args, check for pinned references and inject them. The `--no-pin` flag overrides.

**GUI:** A "pin" icon on the details panel. Pinned images appear as a persistent strip above the generate modal's reference area. Yellow border or pin icon overlay on thumbnails.

**Effort:** ~40 lines backend (pin storage + auto-inject in generate), ~60 lines frontend (pin indicator + persistent strip).

---

### C. Sprite Sheet Export

For game engine integration. Composites multiple generations into a single spritesheet.

```bash
pixery export-spritesheet \
  --collection hero-sprites \
  --grid 4x2 \
  --cell-size 256x256 \
  --output ./assets/hero-sheet.png
```

**Implementation:** The `image` crate already handles compositing. Load each generation, resize to cell size, paste into grid positions on a blank canvas.

```rust
let mut sheet = image::RgbaImage::new(cols * cell_w, rows * cell_h);
for (i, gen) in generations.iter().enumerate() {
    let img = image::open(&gen.image_path)?.resize_exact(cell_w, cell_h, FilterType::Lanczos3);
    let x = (i % cols as usize) as u32 * cell_w;
    let y = (i / cols as usize) as u32 * cell_h;
    image::imageops::overlay(&mut sheet, &img, x.into(), y.into());
}
sheet.save(output)?;
```

Optionally output a companion JSON with cell coordinates (for engines that use atlas metadata).

**Effort:** ~100 lines.

---

### D. Prompt Templates / Presets

Store named prompt templates for reuse across sessions.

**Schema:**

```sql
CREATE TABLE presets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    prompt_template TEXT NOT NULL,
    model TEXT,
    tags TEXT,  -- JSON array
    negative_prompt TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

Templates support `{variable}` substitution:

```bash
pixery preset save "anime-char" \
  --prompt "1girl, {hair}, {eyes}, {outfit}, masterpiece, high score" \
  --model animagine \
  --tags character

pixery generate --preset anime-char \
  --var hair="silver hair" \
  --var eyes="blue eyes" \
  --var outfit="school uniform"
```

**GUI:** Dropdown in generate modal showing saved presets. Selecting one fills in prompt/model/tags. Variables appear as input fields.

**Effort:** ~100 lines backend (schema + CRUD + variable substitution), ~80 lines frontend (preset selector + variable inputs).

---

## For SaaS Branding & Marketing

### E. Brand Profiles

A higher-level constraint system that locks generation parameters to a brand identity.

```bash
pixery brand create "noosa-juice" \
  --model recraft \
  --ratio 16:9 \
  --tags brand,noosa \
  --style-suffix "tropical colors, clean vector style, bright and optimistic"

pixery generate --brand noosa-juice -p "juice bar on the beach at sunset"
# Effective prompt: "juice bar on the beach at sunset, tropical colors, clean vector style, bright and optimistic"
# Model locked to recraft, ratio to 16:9, auto-tagged brand+noosa
```

**Schema:**

```sql
CREATE TABLE brands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    model TEXT,
    aspect_ratio TEXT,
    style_suffix TEXT,
    negative_prompt TEXT,
    auto_tags TEXT,  -- JSON array
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**Implementation:** When `--brand` is specified, merge brand constraints with generation params. Brand model overrides default, brand tags are appended, style suffix is appended to prompt.

**Effort:** ~80 lines backend, ~50 lines frontend (brand selector in generate modal).

---

### F. A/B Comparison (Wiring Existing Code)

For branding work, comparing 2-3 options side by side with a client. `Compare.tsx` exists but isn't connected.

**Minimal wiring:**
- Cmd+click exactly 2 thumbnails -> "Compare" button appears in BatchActionBar
- Click opens Compare view with both images side by side
- Already handles zoom, metadata display

**Extended version (later):**
- Support 3-4 images in a grid
- Add "Winner" button that stars the preferred image and trashes the others
- Export comparison as a single image (useful for sharing with clients)

**Effort:** ~30 lines to wire existing code. ~100 lines for extended features.

---

## For General Image Generation

### G. Model Benchmark

Run the same prompt across multiple models to compare output quality.

```bash
pixery benchmark -p "a red fox in a forest" \
  --models gemini-flash,flux-schnell,recraft,animagine \
  --tags benchmark
```

Generates one image per model, tags all with "benchmark", and outputs a summary:

```
Benchmark: "a red fox in a forest"
  gemini-flash    12.3s  $0.039  ID: 201
  flux-schnell     1.2s  $0.003  ID: 202
  recraft          8.7s  $0.040  ID: 203
  animagine        4.1s  $0.000  ID: 204

View: pixery view 201 202 203 204 -w 600
```

**Implementation:** Calls `batch` infrastructure with varying model parameter. All results share a `benchmark_id` or common tag for grouping.

**Effort:** ~60 lines CLI (reuses batch + shared workflow).

---

### H. Generation Chains / Lineage Tracking

The `parent_id` column exists in the schema but isn't wired up. Enable it to track iteration chains:

```bash
pixery generate -p "revised prompt" -m gemini-flash --parent 140
# or implicitly via remix:
pixery remix 140 -p "same but with red hair"
```

**GUI:** Details panel shows lineage as a horizontal chain: parent -> child -> grandchild. Click any node to navigate. The remix modal already exists -- just wire `parent_id` into the generation record.

**Implementation:**
- `generate` and `remix` accept `--parent` flag
- `insert_generation` already has `parent_id` parameter (currently always `None`)
- New query: `get_lineage(id)` returns ancestors + descendants
- Details panel: render lineage strip when `parent_id` is set

**Effort:** ~20 lines backend (pass parent_id through), ~60 lines frontend (lineage strip in details).
