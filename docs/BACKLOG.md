# Backlog

Prioritized work items for Pixery. Tags: `#bug`, `#tech-debt`, `#feature`, `#ux`

**How to use this document:**
- Items live in priority sections (Blocking → In Progress → Next Up → Later → Someday)
- When completed, remove from original section and add to Completed under the version shipped
- Keep descriptions concise

---

## Blocking

Critical issues that must be fixed before next release.

*None currently.*

---

## In Progress

Items currently being worked on.

*None currently.*

---

## Next Up

High priority items to tackle next.

- [ ] `#ux` Generation progress feedback system - show feedback when image generation is in progress; design as general API usable from multiple entry points (GUI regenerate button, CLI backend when Claude triggers generation); suggested: indicator in top banner showing count of pending generations, hoverable for details (time since request, model, prompt preview); should work for both GUI-initiated and CLI-initiated generations

- [ ] `#feature` CLI image preview for Claude - add command to output images at configurable resolutions (e.g. `pixery preview <id> --width 800`); helps Claude review generations without clogging context; need to find optimal resolution for detail vs token efficiency

- [ ] `#ux` Expandable sidebar rework - research better patterns, current implementation is tacky

- [ ] `#ux` Sidebar expansion behavior - hamburger icon must stay in place (don't move/remove buttons); click to pin expansion; only when pinned should gallery thumbs shift to make room; unpinned = overlay only

- [ ] `#ux` Details close button - make X button larger, follow best practices for dismiss targets

- [ ] `#ux` Shared close button component - create reusable X button for all closeable elements (cost dashboard, popups, detail column)

- [ ] `#feature` Settings dashboard - popup like cost dashboard with dropdowns/toggles; settings button (cog icon) appears next to cost (coin icon) in header

- [ ] `#feature` Hidden tags setting - option in settings to hide specific tags; when enabled, hides images with those tags from gallery and search, hides tags from sidebar; requires "hidden_tags" infra (stored preference + filter logic)

- [ ] `#ux` Cost dashboard icon - replace text link with coin icon and smaller text, consistent with other header actions

- [ ] `#ux` Move filtering/search to header bar - relocate all filter controls from sidebar to header; keep sidebar free for future functionality

- [ ] `#feature` Model duration estimation for progress indicators - analyze generations per model to estimate response times; use estimates for model-specific progress bars in header showing in-progress generations; after first N generations for a model with insufficient data, store duration estimate in DB

- [ ] `#ux` Toggleable details panel size - allow small/medium/large panel widths

---

## Later

Items to address when bandwidth allows.

- [ ] `#feature` Compare view - multi-select for side-by-side comparison (UI scaffolding exists, selection logic TODO)

- [ ] `#feature` Regenerate with parent_id - track lineage when regenerating (DB schema ready, not wired up)

- [ ] `#feature` Reference image UI - drag-drop in generate form (backend supports it)

- [ ] `#feature` Notifications - alert when background generation completes (plugin configured, not implemented)

- [ ] `#feature` Enhanced cost dashboard - make interactive with filtering by date range, models, and tags; drill-down views for cost analysis


---

## Someday

Ideas and features for future consideration.

- [ ] `#feature` Batch generation - generate multiple variations with one command
- [ ] `#feature` Image editing/inpainting support
- [ ] `#feature` Cost tracking and reporting
- [ ] `#feature` Tag management UI in sidebar
- [ ] `#feature` Export/import database for backup
- [ ] `#feature` Model info page - dedicated view explaining each model's strengths, weaknesses, costs, output sizes, and optimal use cases
- [ ] `#feature` Semantic tagging/RAG system - auto-generate tags from prompts, titles, and existing tags using embedding-based search; future exploration

---

## Completed

Items shipped, organized by version.

### Unreleased
- [x] Gallery auto-refreshes on new generations (FSEvents watcher fixed)
- [x] Regenerate includes original reference images
- [x] Edit & regenerate flow via Remix modal (modify prompt, refs, model before regenerating)
- [x] Reference images shown in details panel as thumbnails
- [x] Progressive disclosure in details - prompt/metadata collapsed by default
- [x] Image ID prominently displayed for easy human-AI communication
- [x] References bundled into Generation response (no loading delay)
- [x] Fix blank screen when running release binary - was using `cargo build` instead of `npm run tauri build`
- [x] Markdown rendering for prompts in details panel
- [x] Single-click opens details (was double-click)
- [x] Unified column headers (consistent height across sidebar, gallery, details)

### v0.1.0
- [x] Initial project structure
- [x] CLI generation with Gemini, fal.ai, OpenAI providers
- [x] GUI gallery with thumbnail grid
- [x] SQLite metadata storage
- [x] Keyboard navigation
- [x] Starred/favorite system
