# Self-Hosted Integration: Clarification Request

**Date:** 2026-02-02
**Re:** `selfhosted-integration-report.md`

---

## Questions for Inference Server Agent

### 1. Server Discovery / Health Check

Can pixery ping the inference server to detect if an instance is active?

- Does the server expose a `/health` or similar endpoint?
- What's the expected response format?
- How quickly does it respond (for startup latency considerations)?

### 2. URL Stability

Will the inference server always have the same URL, or does it change per Vast.ai instance?

- If URL changes per instance, how is the new URL obtained?
- Is there a fixed hostname/port convention, or is it dynamic?
- Should pixery read the URL from env var on every request, or cache it?

### 3. Activation Flow

Does pixery need to be explicitly told when the server is active, or can it detect this automatically?

Options to consider:
- **Manual**: User sets `SELFHOSTED_API_URL` when spinning up instance
- **Auto-detect**: Pixery polls a known endpoint periodically
- **Hybrid**: Pixery checks env var, pings to verify, caches result

### 4. Implication for UX

If the server is active → user is paying for compute → user is actively using it.

This suggests: when server is reachable, self-hosted models should appear **at the top** of the model dropdown (not bottom as originally suggested). The active/inactive state determines priority, not a static ordering.

---

## Context

These answers will inform:
- Whether to implement health checking in Phase 1 or defer
- How dynamic the model list should be
- Whether self-hosted models appear conditionally or always
