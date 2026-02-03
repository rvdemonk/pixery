# Changelog

All notable changes to Pixery are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/). Version numbers follow [Semantic Versioning](https://semver.org/).

**Versioning:**
- **0.x.x** - Pre-release development
- **1.0.x** - Bug fixes, small tweaks, no new features
- **1.x.0** - New features, UX improvements
- **x.0.0** - Major milestones, redesigns

**Workflow:**
- All changes go into `[Unreleased]` as they're committed
- When releasing: move Unreleased items to a new `[x.x.x] - YYYY-MM-DD` section
- A version number with a date = released

---

## [Unreleased]

### Added
- Initial project setup with Rust + Tauri backend and React frontend
- CLI interface for image generation (`pixery generate`)
- GUI gallery for browsing generated images
- Multi-provider support: Gemini, fal.ai, OpenAI
- SQLite database for generation metadata, tags, lineage
- Thumbnail generation for gallery performance
- Reference image support with deduplication
- Starred/favorite system for images
- Keyboard navigation (vim-style j/k, arrow keys)

### Added
- CLI prompting guides: `pixery models MODEL --guide` outputs model-specific prompting instructions (style, required prefixes, structure, negative templates, examples)
- CLI help improvements: main help shows workflow/iteration patterns, `view` recommends 600px width, `list` documents output columns, `show`/`view` descriptions clarified
- Prompting guides available for: gemini (prose), animagine (booru tags), pony (score prefixes), noobai (hybrid)
- Markdown rendering for prompts in details panel (headers, lists, code, emphasis)
- `pixery regen-thumbs` CLI command to regenerate existing thumbnails
- Trash feature: images are soft-deleted instead of permanently removed
- Confirmation dialog before trashing (replaces browser confirm)
- Right-click context menu on gallery thumbnails (Star/Unstar, Trash)

### Changed
- Single-click on thumbnail now opens details panel (was double-click)
- Thumbnail size increased from 200px to 400px for Retina display sharpness
- Gallery grid now caps thumbnail display at 200px (was unbounded)
- Delete button renamed to "Trash" with modal confirmation
- Gallery thumbnails now centered (was left-aligned with gap on right)

### Fixed
- Unified column headers across sidebar, gallery, and details panel (consistent 56px height)
- Renamed leftover "imagen" branding to "pixery" in sidebar

---
