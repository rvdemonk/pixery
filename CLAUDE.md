Pixery
==========

Unified image generation tool with CLI and GUI interfaces. Single Rust binary serves both modes - subcommands for CLI, no args launches GUI. SQLite as single source of truth.

**Location:** `~/tools/pixery/`
**Binary:** `~/.local/bin/pixery` → `~/tools/pixery/src-tauri/target/release/pixery`
**Archive:** `~/media/image-gen/`
**Skill:** `~/.claude/commands/pixery.md`
**Repo:** https://github.com/rvdemonk/pixery

See `docs/BACKLOG.md` for current priorities and `docs/CHANGELOG.md` for release history.

Origin
----------

Born from the rpg-project image generation experiments (January 2026). Started as Python scripts calling Gemini/fal/OpenAI APIs, evolved when the workflow proved useful beyond the RPG context. Rebuilt in Rust + Tauri for:

1. **Single binary** - no Python environment management, just works
2. **GUI for browsing** - Lewis needs visual review of generations, not just CLI output
3. **Proper archive** - thumbnails, tagging, cost tracking, lineage

The driving use case is **Claude-assisted creative work** - generating character art, sprites, concept images where Claude selects models, crafts prompts, and iterates based on visual feedback. The CLI is optimized for Claude; the GUI is optimized for Lewis.

Architecture
----------

```
~/tools/pixery/
├── docs/
│   ├── CHANGELOG.md         # What shipped, by version
│   └── BACKLOG.md           # Prioritized work items
├── src-tauri/
│   ├── src/
│   │   ├── main.rs              # Entry: CLI args → cli::run(), no args → lib::run()
│   │   ├── lib.rs               # Tauri app setup, command registration
│   │   ├── cli.rs               # clap subcommands, blocking runtime for async
│   │   ├── commands.rs          # Tauri GUI commands (async, return Results)
│   │   ├── providers/
│   │   │   ├── mod.rs           # generate() dispatches to provider by model
│   │   │   ├── gemini.rs        # Google Gemini API (image generation models)
│   │   │   ├── fal.rs           # fal.ai API (FLUX, Recraft, Z-Image)
│   │   │   └── openai.rs        # OpenAI API (DALL-E, GPT Image)
│   │   ├── db.rs                # SQLite: generations, tags, references
│   │   ├── archive.rs           # File ops: save images, thumbnails, dedup refs
│   │   └── models.rs            # Shared types, ModelInfo registry
│   └── Cargo.toml
├── src/                         # React frontend
│   ├── components/              # Gallery, Sidebar, Details, GenerateForm, etc.
│   ├── hooks/                   # useGenerations, useTags, useKeyboard, useGenerate
│   ├── lib/                     # api.ts (Tauri invoke wrappers), types.ts
│   └── styles/                  # CSS variables, dark theme
└── package.json
```

### Data Flow

1. **Generation**: Provider returns raw bytes → `archive::save_image()` writes file + thumbnail → `db::insert_generation()` records metadata
2. **Browsing**: `db::list_generations()` with filters → frontend fetches via Tauri commands → images loaded via `convertFileSrc()` (asset protocol)
3. **References**: Source images hashed (SHA-256), stored deduplicated in `references/`, linked to generations via junction table

### Archive Structure

```
~/media/image-gen/
├── generations/
│   └── YYYY-MM-DD/
│       ├── {slug}-{HHMMSS}.png       # Full image
│       └── {slug}-{HHMMSS}.thumb.jpg # 200px thumbnail
├── references/
│   └── {sha256}.{ext}                # Deduplicated reference images
└── index.sqlite                      # All metadata, tags, costs
```

API Keys
----------

Stored in `~/.env`:
```
GEMINI_API_SECRET_KEY=...
OPENAI_API_SECRET_KEY=...
FAL_KEY=...
```

**CLI must source these** before running: `source ~/.env && pixery generate ...`

The GUI inherits environment from however it's launched. For dev mode: export before `npm run tauri dev`.

Model ID Mapping
----------

User-facing model names differ from API model IDs. This is intentional for usability.

| User Model | API Model ID | Provider |
|------------|--------------|----------|
| `gemini-flash` | `gemini-2.5-flash-image` | Gemini |
| `gemini-pro` | `gemini-3-pro-image-preview` | Gemini |
| `fal-ai/flux/schnell` | (same) | fal.ai |
| `fal-ai/flux-pro/v1.1` | (same) | fal.ai |
| `dall-e-3` | (same) | OpenAI |
| `gpt-image-1` | (same) | OpenAI |

The mapping lives in each provider's `resolve_model()` function. When Gemini/OpenAI rename models (which happens), update there.

Non-Obvious Details
----------

### Tauri v2 Asset Protocol

Loading local images in the webview requires:
1. `protocol-asset` feature in Cargo.toml tauri dependency
2. `assetProtocol.scope` in tauri.conf.json allowing the paths
3. `convertFileSrc(path)` from `@tauri-apps/api/core` (NOT manual `asset://` URLs)

### CLI vs Library Crate

`main.rs` is a thin binary that either calls `cli::run()` or `pixery_lib::run()`. The CLI module lives in the library crate (`lib.rs` exposes `pub mod cli`) so it can access internal modules. Don't add `mod cli` to `main.rs` - it breaks the import paths.

### Gemini Image Generation

Gemini's image generation uses `generateContent` endpoint with `responseModalities: ["TEXT", "IMAGE"]`. The response contains base64 image data in `candidates[0].content.parts[].inlineData.data`. Reference images are passed as additional parts before the text prompt.

### fal.ai Queue API

fal.ai uses a queue-based API (`queue.fal.run`). For simple cases, POST returns the result directly. For longer generations, it returns a request ID for polling. Current implementation assumes direct response - may need queue polling for slower models.

### Thumbnail Generation

Thumbnails are 200x200 JPEG, generated via the `image` crate's `thumbnail()` method. Stored alongside the original with `.thumb.jpg` suffix.

Anti-Patterns
----------

**DO NOT** hardcode API model IDs in user-facing code - use the friendly names and let `resolve_model()` translate.

**DO NOT** construct asset URLs manually - always use `convertFileSrc()` from Tauri API.

**DO NOT** run async code in CLI handlers without a runtime - `cli.rs` creates a `tokio::runtime::Runtime` and uses `block_on()`.

**DO NOT** assume provider APIs are stable - Gemini in particular changes model IDs frequently. The Python backup at `~/tools/imagen-python-backup/` has working model IDs as of Jan 2026 if the Rust ones break.

**DO NOT** commit API keys - they live in `~/.env`, not in the repo.

GUI Keyboard Shortcuts
----------

| Key | Action |
|-----|--------|
| `?` | Show help cheatsheet |
| `j` / `↓` | Next image |
| `k` / `↑` | Previous image |
| `f` | Toggle starred |
| `g` | Open generate form |
| `/` | Focus search |
| `Enter` | Open details panel |
| `Esc` | Close panel / clear selection |
| `⌘/Ctrl + Del` | Delete selected |

Migration Notes
----------

The Python version is backed up at `~/tools/imagen-python-backup/`. The old SQLite database is at `~/media/image-gen/index.sqlite.python-backup` - schema differs (missing `seed`, `width`, `height`, `file_size`, `parent_id`, `starred` columns).

If migrating old data, either:
1. Write a migration script to ALTER TABLE and backfill
2. Re-import images by reading the old JSON metadata files (stored alongside images in Python version)

The Rust version starts fresh with a clean schema.
