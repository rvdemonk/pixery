# Self-Hosted Infrastructure Improvements

> Audit 2026-02-06 | Part 4 of 4

Improvements to the Vast.ai self-hosted inference setup: `server.py`, deployment scripts, and integration with the pixery CLI/GUI.

---

## 1. `pixery server` CLI Subcommand

Currently Claude must juggle `vastai`, `ssh`, `scp`, and shell scripts manually. A single CLI subcommand orchestrates the full lifecycle:

```bash
pixery server start     # Search offers, create instance, wait, deploy, tunnel
pixery server status    # Health check + cost-so-far + uptime
pixery server stop      # Destroy instance, kill tunnel
pixery server ssh       # Open interactive SSH to instance
pixery server push      # Push updated server.py to running instance
```

**Implementation:** Shell out to `vastai` CLI and `ssh` from Rust. Store instance ID and connection details in `~/.config/pixery/server-state.json`.

```rust
Commands::Server { action } => match action {
    ServerAction::Start => {
        // 1. vastai search offers 'gpu_name=RTX_4090 disk_space>=50 dph<0.50' --order dph
        // 2. vastai create instance <best_offer_id> --image pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime --disk 50
        // 3. Poll vastai show instances until status=running
        // 4. scp server.py setup-instance.sh requirements.txt to instance
        // 5. ssh: run setup-instance.sh && python server.py &
        // 6. Start SSH tunnel: ssh -f -N -L 8000:localhost:8000
        // 7. Save state to server-state.json
        // 8. Set selfhosted URL to http://localhost:8000
    }
    ServerAction::Stop => {
        // 1. Read instance ID from server-state.json
        // 2. vastai destroy instance <id>
        // 3. pkill -f "ssh.*8000"
        // 4. Clear selfhosted URL
        // 5. Remove server-state.json
    }
    ServerAction::Status => {
        // 1. Check server-state.json exists
        // 2. Health check http://localhost:8000/health
        // 3. vastai show instances (for cost/uptime)
        // 4. Print: model loaded, GPU, VRAM, uptime, cost-so-far
    }
}
```

**Architecture note:** Per CLAUDE.md philosophy, this stays in Rust CLI shelling out to `vastai`/`ssh` -- no Rust wrappers around the Vast.ai API. The CLI is the orchestration layer.

**Effort:** ~200 lines. Significant but high value -- transforms a 6-step manual process into one command.

---

## 2. Auto-Shutdown Timer

The biggest operational risk is forgetting to destroy the instance ($0.30/hr). Two approaches:

### Option A: Server-Side Watchdog (Recommended)

Add to `server.py`:

```python
import asyncio
import time

IDLE_TIMEOUT_MINUTES = 60  # Configurable
last_request_time = time.time()

@app.middleware("http")
async def track_activity(request, call_next):
    global last_request_time
    last_request_time = time.time()
    return await call_next(request)

@app.on_event("startup")  # or lifespan
async def start_watchdog():
    asyncio.create_task(idle_watchdog())

async def idle_watchdog():
    while True:
        await asyncio.sleep(60)
        idle_minutes = (time.time() - last_request_time) / 60
        if idle_minutes > IDLE_TIMEOUT_MINUTES:
            print(f"Server idle for {idle_minutes:.0f} minutes. Shutting down.")
            os._exit(0)  # Instance stays running but server stops
            # Or: os.system("shutdown -h now")  # Stops billing
```

### Option B: Client-Side Warning

If `pixery server status` detects the server has been idle for >30 minutes, print a warning:

```
WARNING: Self-hosted server idle for 47 minutes.
  Estimated cost since last generation: $0.24
  Run 'pixery server stop' to destroy instance.
```

And `pixery generate` with a self-hosted model prints elapsed cost at the end:

```
Generated: ... (ID: 205)
Server uptime: 2h 15m | Session cost: ~$0.68
```

**Effort:** Option A: ~20 lines Python. Option B: ~30 lines Rust.

---

## 3. Model Hot-Swap / Pre-Warming

The server already loads models lazily and unloads previous ones. But model switches happen implicitly on the next `/generate` call, adding ~30 seconds to first generation.

**Add `/switch-model` endpoint:**

```python
@app.post("/switch-model")
async def switch_model(model: str):
    """Pre-load a model without generating."""
    try:
        load_model(model)
        return {"status": "loaded", "model": model}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
```

**CLI integration:**

```bash
pixery server warmup animagine   # POST /switch-model
```

Or automatically: before `pixery generate -m pony`, check if server's current model matches. If not, issue a warmup first so the progress bar reflects model loading vs generation separately.

**Effort:** ~15 lines Python, ~10 lines Rust.

---

## 4. Migrate to FastAPI Lifespan

`@app.on_event("startup")` is deprecated in modern FastAPI. Replace with lifespan context manager:

```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    default_checkpoint = MODEL_DIR / AVAILABLE_MODELS[DEFAULT_MODEL]["file"]
    if default_checkpoint.exists():
        load_model(DEFAULT_MODEL)
    else:
        print("Default model not found. Will load on first request.")

    yield  # App runs

    # Shutdown
    print("Shutting down, freeing VRAM...")
    loaded_models.clear()
    torch.cuda.empty_cache()

app = FastAPI(title="SDXL Inference Server", lifespan=lifespan)
```

**Effort:** ~10 lines (restructure existing code).

---

## 5. Generation Progress Streaming

SDXL generation takes 10-30 seconds. Currently fire-and-wait. Adding step-by-step progress enables real progress bars.

**Server-Sent Events (SSE) approach:**

```python
from sse_starlette.sse import EventSourceResponse

@app.post("/generate-stream")
async def generate_stream(request: GenerateRequest):
    async def event_generator():
        pipe = load_model(request.model)
        total_steps = request.steps or AVAILABLE_MODELS[request.model]["default_steps"]

        def callback(pipe, step_index, timestep, callback_kwargs):
            # Can't yield from callback directly, use queue
            progress_queue.put({"step": step_index, "total": total_steps})
            return callback_kwargs

        # Run generation in thread with callback
        image = await run_in_executor(pipe, request, callback)

        # Final event with image
        yield {"event": "complete", "data": json.dumps({"image": b64, "seed": seed})}

    return EventSourceResponse(event_generator())
```

**Client integration:** The selfhosted provider can optionally use the streaming endpoint. For CLI, print a progress bar. For GUI, update the JobsIndicator with step progress.

**Effort:** ~60 lines Python, ~40 lines Rust (SSE client), ~30 lines React.

---

## 6. LoRA Support

The server.py already has scaffolding (commented out at lines 231-235). Implementation is straightforward:

```python
# In generate():
if request.lora_name:
    lora_path = LORA_DIR / f"{request.lora_name}.safetensors"
    if not lora_path.exists():
        raise HTTPException(status_code=400, detail=f"LoRA not found: {request.lora_name}")
    pipe.load_lora_weights(str(lora_path))
    pipe.fuse_lora(lora_scale=request.lora_scale)
```

**CLI integration:**

```bash
pixery generate -p "..." -m animagine --lora my-character --lora-scale 0.8
```

**Pixery-side changes:**
- Add `lora_name` and `lora_scale` to `SelfHostedRequest`
- Add `--lora` and `--lora-scale` CLI flags
- Store lora name in generations table (new column or in metadata JSON)
- GUI: LoRA dropdown in generate modal when self-hosted is connected

**LoRA management:**

```bash
pixery server loras             # List available LoRAs on server
pixery server upload-lora ./my-character.safetensors  # scp to instance
```

**Effort:** ~5 lines Python (uncomment + error handling), ~30 lines Rust, ~40 lines React.

---

## 7. Model Registry Pattern (Future)

Per OPERATIONS.md, when managing 5-8+ models, extract configs from server.py to TOML files:

```
infra/selfhosted/models/
  animagine.toml
  pony.toml
  noobai.toml
```

Each file:

```toml
id = "animagine"
display_name = "Animagine XL 4.0"
file = "animagine-xl-4.0.safetensors"
source = "huggingface:cagliostrolab/animagine-xl-4.0"
architecture = "sdxl"

[defaults]
cfg = 5.0
steps = 28
width = 832
height = 1216

[negative_prompt]
default = "lowres, bad anatomy, ..."
```

Server reads `models/*.toml` at startup, builds `AVAILABLE_MODELS` dynamically. Adding a model = adding a TOML file. No Python editing needed.

**Trigger:** Implement when maintaining the Python dict becomes annoying (the doc says ~5-8 models). Currently at 3, so not yet.

---

## Priority Ranking

| Item | Effort | Impact | When |
|------|--------|--------|------|
| Auto-shutdown timer | Small | High -- prevents cost overruns | Next time self-hosted is active |
| `pixery server` CLI | Large | High -- transforms workflow | Next time self-hosted is active |
| Model hot-swap endpoint | Small | Medium -- saves 30s per model switch | Next time self-hosted is active |
| FastAPI lifespan migration | Trivial | Low -- future-proofing | Next server.py touch |
| LoRA support | Small | High -- enables character consistency | When training a character LoRA |
| Progress streaming | Medium | Medium -- better UX | After core features stabilize |
| Model registry pattern | Medium | Medium -- maintainability | When model count reaches 5+ |
