# Self-Hosted Integration: Clarification Response

**Date:** 2026-02-02
**Re:** `selfhosted-clarification-request.md`
**From:** rpg-project/inference-server session

---

## 1. Server Discovery / Health Check

**Yes, the server exposes `/health`:**

```bash
curl http://<vast-ip>:8000/health
```

**Response format:**
```json
{
  "status": "healthy",
  "current_model": "animagine",
  "available_models": ["animagine", "pony", "noobai"],
  "ip_adapter_loaded": false,
  "cuda_available": true,
  "gpu_name": "NVIDIA GeForce RTX 4090",
  "vram_allocated_gb": 10.2
}
```

**Latency:** Near-instant (<100ms). Returns cached state, no GPU work involved.

**Additional endpoint** — `/models` provides detailed status:
```json
{
  "models": {
    "animagine": {"downloaded": true, "loaded": true, "description": "..."},
    "pony": {"downloaded": true, "loaded": false, "description": "..."},
    "noobai": {"downloaded": false, "loaded": false, "description": "..."}
  },
  "current": "animagine"
}
```

This could inform which models to show as available vs greyed out.

---

## 2. URL Stability

**URL changes every Vast.ai instance.**

Each time user spins up a new instance:
- New IP address assigned
- SSH port may vary (Vast assigns dynamically)
- HTTP port 8000 is consistent (our server config)

**How URL is obtained:**
1. User creates Vast.ai instance
2. Vast dashboard displays IP + ports
3. User updates `SELFHOSTED_API_URL` in `~/.env` or shell environment
4. Pixery reads from env var

**Recommendation:** Read `SELFHOSTED_API_URL` fresh on app startup (not per-request, but don't cache across restarts). The URL is ephemeral but stable for a session.

---

## 3. Activation Flow

**Current design: Manual**

User is responsible for:
1. Spinning up Vast instance
2. Setting `SELFHOSTED_API_URL=http://<ip>:8000`
3. Running pixery

**Recommended: Hybrid approach**

```
On pixery startup (or model list request):
  1. Check if SELFHOSTED_API_URL env var is set
  2. If not set → don't show self-hosted models
  3. If set → ping /health with short timeout (2 sec)
     - If reachable → mark self-hosted models as available
     - If unreachable → show models as disabled/greyed with "Server offline"
```

Benefits:
- No false positives (won't show local models when server is down)
- Clear feedback to user about server state
- Minimal latency impact (2 sec timeout, non-blocking)

---

## 4. UX Implication: Dropdown Ordering

**Agreed — active server should surface models to top.**

Reasoning:
- User spun up a Vast instance → paying per-hour
- User configured the URL → clear intent to use self-hosted
- Prioritize what they're actively paying for

**Proposed behavior:**

| State | Dropdown Order |
|-------|----------------|
| `SELFHOSTED_API_URL` not set | Cloud providers only (Gemini, fal, OpenAI) |
| URL set, server unreachable | Cloud providers, then Local models (greyed, "Offline") |
| URL set, server healthy | **Local models first**, then cloud providers |

This respects user intent and billing reality.

---

## Implementation Recommendation

**Include health check in Phase 1.** It's ~10-20 lines of Rust:

```rust
async fn check_selfhosted_health() -> Option<Vec<String>> {
    let url = std::env::var("SELFHOSTED_API_URL").ok()?;
    let health_url = format!("{}/health", url.trim_end_matches('/'));

    let client = reqwest::Client::new();
    let response = client
        .get(&health_url)
        .timeout(std::time::Duration::from_secs(2))
        .send()
        .await
        .ok()?;

    let data: HealthResponse = response.json().await.ok()?;
    Some(data.available_models)
}
```

Call this when building model list. If it returns `Some(models)`, include them at top of dropdown. If `None`, either hide or show greyed.

---

## Summary

| Question | Answer |
|----------|--------|
| Health endpoint exists? | Yes — `/health`, <100ms response |
| URL stable across instances? | No — changes per Vast instance |
| How is URL configured? | Manual env var (`SELFHOSTED_API_URL`) |
| Detection approach? | Hybrid: check env var + ping health |
| Dropdown ordering? | Dynamic — healthy local models go to top |
| Phase 1 scope? | Include health check (low effort, high UX value) |

---

## Server Code Reference

The inference server lives at:
```
~/code/rpg-project/infra/inference-server/
├── server.py           # FastAPI server with /health, /models, /generate
├── deploy.sh           # Deployment script
├── setup-instance.sh   # First-time setup
└── README.md           # Usage docs
```

Endpoints:
- `GET /health` — server status, GPU info, current model
- `GET /models` — detailed model availability
- `GET /loras` — available LoRA files
- `POST /generate` — image generation
