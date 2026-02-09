# Self-Hosted Inference Operations

> **Architecture Decision (2026-02-03):** Server code lives in pixery repo. Claude orchestrates infrastructure via vastai/ssh/scp. GUI stays simple — just a "Server URL" field. No Rust wrappers around shell commands.

## Setup (One-Time) ✓ DONE

```bash
pipx install vastai
source ~/.env && vastai set api-key "$VASTAI_KEY"
# Key stored at: ~/.config/vastai/vast_api_key
# SSH key added at account level on vast.ai
```

## Rent an Instance

```bash
# Search for GPUs (RTX 4090, 50GB+ disk, under $0.50/hr)
vastai search offers 'gpu_name=RTX_4090 disk_space>=50 dph<0.50' --order dph

# Create instance
vastai create instance <OFFER_ID> --image pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime --disk 50

# Wait ~1 min, then get connection details
vastai show instances
vastai ssh-url <INSTANCE_ID>
```

## Connect & Deploy

```bash
# From pixery/infra/selfhosted/
./connect.sh <IP> <PORT>

# First time on new instance — push code and setup (in separate terminal):
# IMPORTANT: target is /workspace/inference/ (NOT /workspace/) — setup-instance.sh expects this path
scp -P <PORT> server.py setup-instance.sh requirements.txt root@<IP>:/workspace/inference/

# On Vast instance:
cd /workspace/inference
chmod +x setup-instance.sh
./setup-instance.sh          # Downloads models (~13GB)
python server.py             # Start server
```

## Configure Pixery

In GUI Settings, set Self-Hosted URL to:
```
http://localhost:8000
```

Or via CLI, the selfhosted models route automatically when server is configured.

## Generate

```bash
pixery generate -p "1girl, solo, masterpiece, high score, absurdres" -m animagine
pixery generate -p "score_9, score_8_up, 1girl, solo" -m pony
```

## Update Server Code

After editing `server.py` locally:

```bash
./push-server.sh <IP> <PORT>
# Then restart server on Vast (Ctrl+C, python server.py)
```

## Shutdown (Stop Billing)

```bash
vastai show instances              # Find instance ID
vastai destroy instance <ID>       # Stops billing immediately
```

---

## Model Defaults

| Model | CFG | Steps | Prompt Style |
|-------|-----|-------|--------------|
| animagine | 5.0 | 28 | danbooru tags, `masterpiece, high score` |
| pony | 7.0 | 25 | score system, `score_9, score_8_up` |
| noobai | 5.5 | 28 | danbooru tags |

Each model has its own default negative prompt configured in `server.py`.

---

## Files

| File | Purpose |
|------|---------|
| `server.py` | FastAPI inference server |
| `requirements.txt` | Python dependencies |
| `setup-instance.sh` | Downloads models on Vast instance |
| `connect.sh` | SSH with port forwarding |
| `push-server.sh` | Push server.py updates to running instance |

---

## Background SSH Tunnel

For Claude-driven workflows, run the tunnel in background instead of interactive:

```bash
# Start tunnel (runs in background)
ssh -f -N -p <PORT> root@<HOST> -L 8000:localhost:8000

# Kill tunnel when done
pkill -f "ssh.*<PORT>.*8000"
```

---

## Troubleshooting

**Instance stuck on "loading"**: Some regions (Vietnam, others) can take 10+ minutes to pull the Docker image. If stuck, destroy and try a different machine — France/Norway/US tend to be faster.

**"Connection refused"**: Server not running, or SSH missing `-L 8000:localhost:8000`

**Model loading slow**: First load ~30s, model switches ~20s (unloads previous)

**Out of VRAM**: Only one model loaded at a time. Restart server if stuck.

**Pony looks bad**: Use score tags (`score_9, score_8_up`), not danbooru quality tags

---

## Future: Model Registry Pattern

When we have 10+ models, extract configs from `server.py` to individual files:

```
infra/selfhosted/
├── server.py
├── models/
│   ├── animagine.toml
│   ├── pony.toml
│   ├── noobai.toml
│   └── flux-dev.toml
└── ...
```

Each model file:

```toml
# animagine.toml
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
default = "lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry"

[prompt_guide]
quality_tags = ["masterpiece", "high score", "great score", "absurdres"]
style = "danbooru"
notes = "Use 1girl/1boy prefix, character name, series, then details"
```

Server reads `models/*.toml` at startup, builds `AVAILABLE_MODELS` dict dynamically.

**Benefits:**
- Adding a model = add a .toml file, no Python editing
- Prompt guides live with model configs
- Easy to share/import model configs
- Git diff shows exactly what changed per model

**Trigger:** Implement this when maintaining `AVAILABLE_MODELS` dict becomes annoying (probably 5-8 models).

---

## IP-Adapter & LoRA Support

Current status:
- **IP-Adapter:** Fully wired. `setup-instance.sh` downloads weights + CLIP ViT-H image encoder (~5.2GB total). Loaded automatically at model load time if files present.
- **LoRA:** Placeholder in server.py, not implemented.

When implementing:

1. LoRAs go in `/workspace/models/loras/` on Vast
2. Add `lora_name` and `lora_scale` to pixery CLI/GUI
3. Server already has the fields, just needs `pipe.load_lora_weights()` call

IP-Adapter is more useful for character consistency than LoRAs for our use case.
