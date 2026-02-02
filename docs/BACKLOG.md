# Backlog

Prioritized work items for Pixery. Tags: `#bug`, `#tech-debt`, `#feature`, `#ux`

**How to use this document:**
- Items live in priority sections (Blocking → In Progress → Next Up → Later → Someday)
- When completed, remove from original section and add to Completed under the version shipped
- Keep descriptions concise

---

## Blocking

Critical issues that must be fixed before next release.

- [ ] `#bug` Gallery not auto-refreshing on new generations - FSEvents watcher not triggering updates; still requires manual tag toggle workaround

- [ ] `#bug` Regenerate should include original reference images - when clicking regenerate in details, resend the same refs used in the original generation

---

## In Progress

Items currently being worked on.

*None currently.*

---

## Next Up

High priority items to tackle next.

- [ ] `#feature` CLI image preview for Claude - add command to output images at configurable resolutions (e.g. `pixery preview <id> --width 800`); helps Claude review generations without clogging context; need to find optimal resolution for detail vs token efficiency

- [ ] `#ux` Expandable sidebar rework - research better patterns, current implementation is tacky

- [ ] `#ux` Sidebar expansion behavior - hamburger icon must stay in place (don't move/remove buttons); click to pin expansion; only when pinned should gallery thumbs shift to make room; unpinned = overlay only

- [ ] `#ux` Details close button - make X button larger, follow best practices for dismiss targets

- [ ] `#ux` Shared close button component - create reusable X button for all closeable elements (cost dashboard, popups, detail column)

- [ ] `#ux` Collapsible prompt in details - full prompt should require expansion, not show automatically

- [ ] `#ux` Reference image lineage in details - show reference images as small clickable thumbnails next to prompts (data already in DB via references table)

- [ ] `#feature` Settings dashboard - popup like cost dashboard with dropdowns/toggles; settings button (cog icon) appears next to cost (coin icon) in header

- [ ] `#feature` Hidden tags setting - option in settings to hide specific tags; when enabled, hides images with those tags from gallery and search, hides tags from sidebar; requires "hidden_tags" infra (stored preference + filter logic)

---

## Later

Items to address when bandwidth allows.

- [ ] `#feature` Compare view - multi-select for side-by-side comparison (UI scaffolding exists, selection logic TODO)

- [ ] `#feature` Regenerate with parent_id - track lineage when regenerating (DB schema ready, not wired up)

- [ ] `#feature` Reference image UI - drag-drop in generate form (backend supports it)

- [ ] `#feature` Notifications - alert when background generation completes (plugin configured, not implemented)


---

## Someday

Ideas and features for future consideration.

- [ ] `#feature` Batch generation - generate multiple variations with one command
- [ ] `#feature` Image editing/inpainting support
- [ ] `#feature` Cost tracking and reporting
- [ ] `#feature` Tag management UI in sidebar
- [ ] `#feature` Export/import database for backup

---

## Completed

Items shipped, organized by version.

### Unreleased
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
