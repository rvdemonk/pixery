# Pixery

A unified AI image-generation tool — every major provider plus self-hosted cloud GPUs — built equally for humans (GUI) and agents (CLI). It ships as a single Rust + Tauri binary backed by SQLite: run a subcommand and it's a CLI; run it with no arguments and it launches a desktop gallery.

Pixery is designed for **human–AI collaboration**: the CLI is optimized for an AI agent (Claude) to select models, craft prompts, and iterate, while the GUI is optimized for a human to browse, review, and curate. Both share one archive and one source of truth.

## Features

- **Multi-provider generation** — Gemini, fal.ai (FLUX, Recraft, Z-Image), OpenAI (DALL·E, GPT Image), and self-hosted SDXL models on rented GPUs
- **One binary, two interfaces** — a scriptable CLI and a desktop GUI from the same executable
- **Persistent archive** — every generation saved with a thumbnail, prompt, model, cost, tags, and lineage in SQLite
- **Reference images** — image-to-image and IP-Adapter support, with deduplicated reference storage
- **Browse and curate** — gallery with search, tags, collections, starring, and vim-style keyboard navigation
- **Cost tracking** — per-generation and summary cost reporting across providers

## Install

Requires Rust and Node.js.

```bash
git clone https://github.com/rvdemonk/pixery.git
cd pixery
npm install
npm run tauri build
```

The bundled binary lands in `src-tauri/target/release/pixery`. Symlink it onto your `PATH` if you want the CLI handy.

API keys are read from `~/.env`:

```
GEMINI_API_SECRET_KEY=...
OPENAI_API_SECRET_KEY=...
FAL_KEY=...
```

The CLI needs them sourced first: `source ~/.env && pixery generate ...`

## Usage

```bash
# Launch the GUI
pixery

# Generate, then review
pixery generate "a lighthouse at dusk, oil painting" --model gemini-pro
pixery list
pixery show 140
pixery view 140 --width 600

# Iterate with a reference
pixery generate "same scene, stormier sky" --ref 140

# Discover models and their prompting styles
pixery models
pixery models pony --guide
```

Run `pixery --help` (or `pixery <command> --help`) for the full command set — search, tag, collections, batch, export, cost, and more. The CLI's help text is the primary documentation and is kept current with every change.

## Archive layout

```
~/media/image-gen/
├── generations/YYYY-MM-DD/   # full images + thumbnails
├── references/               # deduplicated reference images (by SHA-256)
└── index.sqlite              # all metadata, tags, costs, lineage
```

## License

MIT — see [LICENSE](LICENSE).
