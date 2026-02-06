# Self-Hosted Inference Server Integration Report

> **Purpose:** Analysis and recommendations for integrating a custom self-hosted SDXL inference server into pixery.

**Created:** 2026-02-02
**Context:** See `~/code/rpg-project/infra/inference-server/` for the FastAPI server code.

---

## Executive Summary

Pixery's architecture is **designed for exactly this integration**. The provider system is cleanly abstracted — adding a self-hosted provider requires ~200 lines of Rust, an environment variable, and no changes to the UI. The hardest decision isn't technical, it's design: how much flexibility do we expose?

---

## Architecture Fit

### What Pixery Already Has

| Component | Status | Notes |
|-----------|--------|-------|
| Provider abstraction | Excellent | `providers/mod.rs` dispatches by enum |
| Model registry | Good | `ModelInfo::all()` in `models.rs` |
| Async HTTP client | Ready | `reqwest` already in dependencies |
| Base64 handling | Ready | Used by all existing providers |
| Reference image support | Ready | `image_to_base64()` helper exists |
| Archive/database | Ready | No changes needed |
| CLI integration | Ready | Will just work |
| GUI integration | Ready | Model appears in dropdown automatically |

### What We Need to Build

| Component | Effort | Notes |
|-----------|--------|-------|
| `selfhosted.rs` provider | ~150 lines | Core integration |
| Model registry entries | ~20 lines | Add animagine/pony/noobai |
| Environment variable | 1 line | `SELFHOSTED_API_URL` |
| API contract alignment | Design decision | Match server ↔ pixery expectations |

---

## The No-Brainers (Essential)

### 1. Add Provider Enum Variant

```rust
// src-tauri/src/models.rs
pub enum Provider {
    Gemini,
    Fal,
    OpenAI,
    SelfHosted,  // Add this
}
```

### 2. Create Provider Module

New file: `src-tauri/src/providers/selfhosted.rs`

This is the core work. It needs to:
- Read `SELFHOSTED_API_URL` from environment
- Build request matching our FastAPI schema
- Parse response, extract base64 image
- Return `GenerationResult`

### 3. Register in Dispatcher

```rust
// src-tauri/src/providers/mod.rs
Provider::SelfHosted => selfhosted::generate(model, prompt, reference_paths).await,
```

### 4. Register Models

```rust
// src-tauri/src/models.rs - in ModelInfo::all()
ModelInfo {
    id: "animagine".into(),
    provider: Provider::SelfHosted,
    display_name: "Animagine XL 4.0 (Local)".into(),
    cost_per_image: 0.0,
    max_refs: 1,  // IP-Adapter supports one reference
},
ModelInfo {
    id: "pony".into(),
    provider: Provider::SelfHosted,
    display_name: "Pony Diffusion V6 (Local)".into(),
    cost_per_image: 0.0,
    max_refs: 1,
},
ModelInfo {
    id: "noobai".into(),
    provider: Provider::SelfHosted,
    display_name: "NoobAI XL (Local)".into(),
    cost_per_image: 0.0,
    max_refs: 1,
},
```

---

## Open Decisions

### 1. API Contract: Reference Image Format

**Options:**

| Option | Server Change | Pixery Change | Notes |
|--------|---------------|---------------|-------|
| A: Bare base64 + mime | None (current) | Build request with separate fields | Matches current server.py |
| B: Data URI | Update server to accept | Use fal.ai's format | More standard |
| C: Multipart form | Significant server change | More complex client | Better for large files |

**Recommendation:** Option A (bare base64 + mime). Our server already expects this, and it matches how pixery handles references internally.

### 2. Model Selection: Static vs Dynamic

**Options:**

| Option | Complexity | UX | Notes |
|--------|------------|---|-------|
| A: Hardcode models in registry | Low | Fixed dropdown | Current pattern |
| B: Query server's `/models` endpoint | Medium | Dynamic | Server tells pixery what's available |
| C: Config file (`~/.pixery/models.toml`) | Medium | User-configurable | Most flexible |

**Recommendation:** Start with A (hardcode), consider B for v2. Querying the server at startup adds latency and failure modes. We know what models we're running.

### 3. Server URL: Single vs Per-Model

**Options:**

| Option | Env Vars | Flexibility |
|--------|----------|-------------|
| A: Single URL for all self-hosted | `SELFHOSTED_API_URL` | Simple |
| B: Per-model URLs | `ANIMAGINE_API_URL`, `PONY_API_URL`, etc. | Can run different servers |

**Recommendation:** Option A. Our server handles model switching via the `model` parameter. One URL is cleaner.

### 4. Advanced Parameters: Expose or Default?

The server supports: `steps`, `cfg_scale`, `seed`, `width`, `height`, `ip_adapter_scale`, `lora_name`

**Options:**

| Option | UI Change | Complexity |
|--------|-----------|------------|
| A: Use server defaults | None | Simplest |
| B: Expose in CLI only | Add CLI flags | Medium |
| C: Expose in GUI | New form fields | Most work |

**Recommendation:** Start with A, add B if needed. The server has sensible defaults per model. Power users can curl directly for full control.

### 5. Availability Detection

What happens if the self-hosted server is down?

**Options:**

| Option | Behavior | UX |
|--------|----------|---|
| A: Fail on generate | Error message when you try | Simple, current pattern |
| B: Health check on startup | Hide models if server unreachable | Cleaner but adds latency |
| C: Health check in background | Show status indicator | Best UX, most complex |

**Recommendation:** Option A. Fail fast with a clear error. Users know if their server is running.

### 6. Seed Handling

Our server returns seeds. Pixery stores them. But should we allow **requesting** a specific seed for reproducibility?

**Options:**

| Option | Server Support | Pixery Change |
|--------|----------------|---------------|
| A: Return only | Already done | None |
| B: Accept seed parameter | Already done | Add to request schema |

**Recommendation:** Option B eventually, but not for v1. "Reproduce this exact image" is valuable but not essential.

---

## Considerations

### Reference Images: One vs Many

The server's IP-Adapter currently supports **one reference image**. Pixery's interface supports multiple refs (for providers like Gemini that can use several).

**Approach:** Set `max_refs: 1` in ModelInfo. If we later support multiple references (e.g., style + content), bump the limit.

### Timeout Handling

Image generation takes 10-30 seconds. Existing providers use 120-second timeouts. Our server might take longer for:
- First request (model loading)
- Model switching (~10 sec)
- High step counts

**Approach:** Use 300-second timeout for self-hosted. Better to wait than fail.

### Error Messages

The server returns JSON errors. Pixery should surface these clearly.

**Approach:** Parse error responses and include server's message in the pixery error. Don't just say "request failed."

### Cost Tracking

Pixery tracks `cost_per_image` for budgeting. Self-hosted is ~$0.01/image (compute time), not $0.00.

**Approach:** Set `cost_per_image: 0.01` as a rough estimate. Or leave at 0.0 since it's not a direct API cost.

### Offline Mode

If the Vast.ai server isn't running, self-hosted models shouldn't appear (or should show as unavailable).

**For v1:** Let them appear, fail with clear error if server is down.
**For v2:** Query `/health` on startup, mark models as unavailable.

---

## Implementation Plan

### Phase 1: Basic Integration (Essential)

1. Add `Provider::SelfHosted` enum variant
2. Create `selfhosted.rs` with generate function
3. Register three models (animagine, pony, noobai)
4. Wire up dispatcher
5. Test via CLI
6. Test via GUI

**Deliverable:** Can generate images from pixery using self-hosted server.

### Phase 2: Reference Image Support

1. Align API contract (server expects `reference_image` as base64)
2. Update `selfhosted.rs` to send reference
3. Test IP-Adapter workflow through pixery

**Deliverable:** Can use reference images for character consistency.

### Phase 3: Polish (Optional)

- Better error messages
- Seed request support
- CLI flags for advanced parameters
- Health check / availability indicator

---

## Server API Contract

For reference, here's what the pixery provider needs to send/receive:

### Request (POST to `SELFHOSTED_API_URL`)

```json
{
  "prompt": "a girl with purple hair, masterpiece",
  "model": "animagine",
  "width": 1024,
  "height": 1024,
  "reference_image": "<base64 string or null>",
  "ip_adapter_scale": 0.7
}
```

### Response

```json
{
  "image": "<base64 PNG>",
  "seed": 12345,
  "parameters": {
    "prompt": "...",
    "model": "animagine",
    "width": 1024,
    "height": 1024,
    "steps": 28,
    "cfg_scale": 5.0
  }
}
```

### Error Response

```json
{
  "detail": "Model not loaded: animagine"
}
```

---

## File Changes Summary

| File | Change |
|------|--------|
| `src-tauri/src/models.rs` | Add `SelfHosted` to Provider enum, add model entries |
| `src-tauri/src/providers/mod.rs` | Add dispatch case, add `pub mod selfhosted;` |
| `src-tauri/src/providers/selfhosted.rs` | **New file** — ~150 lines |
| `src-tauri/src/providers/CLAUDE.md` | Document provider quirks |
| `~/.env` | Add `SELFHOSTED_API_URL` |

No frontend changes needed for Phase 1.

---

## Decisions Made

1. **Model naming:** Keep actual model names (`animagine`, `pony`, `noobai`) with `(Local)` suffix in display name to indicate self-hosted origin.

2. **Cost display:** $0.00 for now. Can refine later once we have usage data.

3. **API contract:** Adapt pixery to match the server's existing contract (simpler, server is already working).

## Open Question

- **Dropdown order:** Should self-hosted models appear before or after cloud providers? (Currently determined by order in `ModelInfo::all()`.)

---

## Next Steps

When you open a pixery session:

1. Read this report
2. Decide on open questions above
3. Implement Phase 1 (I'll write the code)
4. Test with a running Vast.ai instance
5. Iterate

The server code at `~/code/rpg-project/infra/inference-server/` is ready. The integration is straightforward. Main work is writing `selfhosted.rs` — a focused task.
