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

- [ ] `#ux` **Tidy up GUI layout** - banner in sidebar looks off, gallery and details columns have uneven heights. Clean up visual balance.

- [ ] `#ux` **Single-click image selection** - change image selection to open detail view on single click instead of double click. More intuitive.

- [ ] `#feature` **Markdown renderer for prompts** - add markdown rendering to prompt display in detail view. Prompts often have structure that would benefit from formatting.

---

## Later

Items to address when bandwidth allows.

- [ ] `#feature` Compare view - multi-select for side-by-side comparison (UI scaffolding exists, selection logic TODO)

- [ ] `#feature` Regenerate with parent_id - track lineage when regenerating (DB schema ready, not wired up)

- [ ] `#feature` Reference image UI - drag-drop in generate form (backend supports it)

- [ ] `#feature` Notifications - alert when background generation completes (plugin configured, not implemented)

- [ ] `#tech-debt` Build for release - currently dev mode only; needs `npm run tauri build` testing

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

### v0.1.0
- [x] Initial project structure
- [x] CLI generation with Gemini, fal.ai, OpenAI providers
- [x] GUI gallery with thumbnail grid
- [x] SQLite metadata storage
- [x] Keyboard navigation
- [x] Starred/favorite system
