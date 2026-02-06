"""
SDXL Inference Server

FastAPI server for image generation with IP-Adapter support.
Supports multiple SDXL fine-tunes: Animagine, Pony, NoobAI.
Designed for pixery integration.
"""

import asyncio
import io
import os
import base64
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, Field
import torch
from diffusers import StableDiffusionXLPipeline, EulerAncestralDiscreteScheduler
from PIL import Image

# Paths
MODEL_DIR = Path("/workspace/models")
IP_ADAPTER_DIR = MODEL_DIR / "ip-adapter"
LORA_DIR = MODEL_DIR / "loras"
IP_ADAPTER_MODEL = IP_ADAPTER_DIR / "sdxl_models" / "ip-adapter-plus_sdxl_vit-h.safetensors"

# Auto-shutdown: idle timeout in minutes (0 = disabled)
IDLE_TIMEOUT_MINUTES = int(os.environ.get("IDLE_TIMEOUT_MINUTES", "60"))

# Available models - add more as needed
# Each model has its own default negative prompt tuned for its training data
AVAILABLE_MODELS = {
    "animagine": {
        "file": "animagine-xl-4.0.safetensors",
        "default_cfg": 5.0,
        "default_steps": 28,
        "description": "Anime-focused, clean aesthetic",
        "default_negative": "lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry",
    },
    "pony": {
        "file": "ponyDiffusionV6XL_v6StartWithThisOne.safetensors",
        "default_cfg": 7.0,
        "default_steps": 25,
        "description": "Flexible, score-tag system, broader training",
        "default_negative": "score_4, score_3, score_2, score_1, source_pony, source_furry, ugly, low quality, worst quality, blurry, bad anatomy, bad hands, deformed, mutated",
    },
    "noobai": {
        "file": "noobaiXLNAIXL_epsilonPred10.safetensors",
        "default_cfg": 5.5,
        "default_steps": 28,
        "description": "Illustrious fork, permissive, good anatomy",
        "default_negative": "lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, jpeg artifacts, signature, watermark, blurry",
    },
}

DEFAULT_MODEL = "animagine"

# Global state
loaded_models: dict[str, StableDiffusionXLPipeline] = {}
current_model: Optional[str] = None
ip_adapter_loaded = False
last_request_time: float = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: preload default model. Shutdown: cleanup."""
    # Startup
    default_checkpoint = MODEL_DIR / AVAILABLE_MODELS[DEFAULT_MODEL]["file"]
    if default_checkpoint.exists():
        load_model(DEFAULT_MODEL)
    else:
        print(f"Default model not found. Available models will load on first request.")
        print(f"Run setup-instance.sh to download models.")

    # Start idle watchdog if timeout is configured
    watchdog_task = None
    if IDLE_TIMEOUT_MINUTES > 0:
        watchdog_task = asyncio.create_task(_idle_watchdog())
        print(f"Idle watchdog enabled: auto-shutdown after {IDLE_TIMEOUT_MINUTES} minutes of inactivity")

    yield

    # Shutdown
    if watchdog_task:
        watchdog_task.cancel()


async def _idle_watchdog():
    """Background task: exit if no requests received within timeout."""
    timeout_seconds = IDLE_TIMEOUT_MINUTES * 60
    while True:
        await asyncio.sleep(60)
        idle_seconds = time.time() - last_request_time
        if idle_seconds >= timeout_seconds:
            idle_mins = int(idle_seconds // 60)
            print(f"Idle for {idle_mins} minutes (timeout: {IDLE_TIMEOUT_MINUTES}). Shutting down.")
            os._exit(0)


app = FastAPI(title="SDXL Inference Server", lifespan=lifespan)


@app.middleware("http")
async def track_request_time(request: Request, call_next):
    """Track last request time for idle watchdog."""
    global last_request_time
    last_request_time = time.time()
    return await call_next(request)


class GenerateRequest(BaseModel):
    prompt: str
    negative_prompt: Optional[str] = None  # If not provided, uses model-specific default
    width: int = Field(default=1024, ge=512, le=1536)
    height: int = Field(default=1024, ge=512, le=1536)
    steps: Optional[int] = Field(default=None, ge=1, le=50)
    cfg_scale: Optional[float] = Field(default=None, ge=1.0, le=20.0)
    seed: Optional[int] = None
    model: str = Field(default=DEFAULT_MODEL, description="Model to use: animagine, pony, noobai")
    # IP-Adapter
    reference_image: Optional[str] = None  # Base64 encoded
    ip_adapter_scale: float = Field(default=0.7, ge=0.0, le=1.0)
    # LoRA
    lora_name: Optional[str] = None
    lora_scale: float = Field(default=0.8, ge=0.0, le=1.5)


class GenerateResponse(BaseModel):
    image: str  # Base64 encoded PNG
    seed: int
    parameters: dict


class SwitchModelRequest(BaseModel):
    model: str = Field(description="Model to load: animagine, pony, noobai")


def load_model(model_name: str) -> StableDiffusionXLPipeline:
    """Load a model pipeline, with caching."""
    global loaded_models, current_model

    if model_name in loaded_models:
        current_model = model_name
        return loaded_models[model_name]

    if model_name not in AVAILABLE_MODELS:
        raise ValueError(f"Unknown model: {model_name}. Available: {list(AVAILABLE_MODELS.keys())}")

    model_info = AVAILABLE_MODELS[model_name]
    checkpoint_path = MODEL_DIR / model_info["file"]

    if not checkpoint_path.exists():
        raise FileNotFoundError(f"Model file not found: {checkpoint_path}. Run setup-instance.sh or download manually.")

    print(f"Loading {model_name} from {checkpoint_path}...")

    # Unload previous model to free VRAM (only keep one loaded at a time)
    if loaded_models:
        print("Unloading previous model to free VRAM...")
        for old_name in list(loaded_models.keys()):
            del loaded_models[old_name]
        torch.cuda.empty_cache()

    pipe = StableDiffusionXLPipeline.from_single_file(
        str(checkpoint_path),
        torch_dtype=torch.float16,
        use_safetensors=True,
    )
    pipe.scheduler = EulerAncestralDiscreteScheduler.from_config(pipe.scheduler.config)
    pipe.to("cuda")

    # Load IP-Adapter if available (must happen before enable_attention_slicing)
    if IP_ADAPTER_MODEL.exists():
        try:
            pipe.load_ip_adapter(
                str(IP_ADAPTER_DIR),
                subfolder="sdxl_models",
                weight_name="ip-adapter-plus_sdxl_vit-h.safetensors",
                local_files_only=True
            )
            print(f"IP-Adapter loaded for {model_name}")
            global ip_adapter_loaded
            ip_adapter_loaded = True
        except Exception as e:
            print(f"Warning: Could not load IP-Adapter: {e}")

    # attention_slicing is incompatible with IP-Adapter attention processors
    if not ip_adapter_loaded:
        pipe.enable_attention_slicing()

    loaded_models[model_name] = pipe
    current_model = model_name
    print(f"Model {model_name} loaded successfully")

    return pipe


@app.get("/health")
async def health():
    """Health check endpoint."""
    idle_seconds = time.time() - last_request_time
    return {
        "status": "healthy" if current_model else "no_model_loaded",
        "current_model": current_model,
        "available_models": list(AVAILABLE_MODELS.keys()),
        "ip_adapter_loaded": ip_adapter_loaded,
        "cuda_available": torch.cuda.is_available(),
        "gpu_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
        "vram_allocated_gb": round(torch.cuda.memory_allocated() / 1e9, 2) if torch.cuda.is_available() else None,
        "idle_seconds": round(idle_seconds, 1),
        "idle_timeout_minutes": IDLE_TIMEOUT_MINUTES,
    }


@app.get("/models")
async def list_models():
    """List available models and their status."""
    models = {}
    for name, info in AVAILABLE_MODELS.items():
        checkpoint_path = MODEL_DIR / info["file"]
        models[name] = {
            "description": info["description"],
            "downloaded": checkpoint_path.exists(),
            "loaded": name in loaded_models,
            "default_cfg": info["default_cfg"],
            "default_steps": info["default_steps"],
        }
    return {"models": models, "current": current_model}


@app.get("/loras")
async def list_loras():
    """List available LoRA files."""
    if not LORA_DIR.exists():
        return {"loras": []}
    loras = [f.stem for f in LORA_DIR.glob("*.safetensors")]
    return {"loras": loras}


@app.post("/switch-model")
async def switch_model(request: SwitchModelRequest):
    """Pre-load a model without generating an image."""
    try:
        load_model(request.model)
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {"status": "ok", "model": request.model}


@app.post("/generate", response_model=GenerateResponse)
async def generate(request: GenerateRequest):
    """Generate an image from a prompt."""
    # Load/switch model if needed
    try:
        pipe = load_model(request.model)
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    model_info = AVAILABLE_MODELS[request.model]

    # Use model defaults if not specified
    steps = request.steps or model_info["default_steps"]
    cfg_scale = request.cfg_scale or model_info["default_cfg"]
    negative_prompt = request.negative_prompt or model_info.get("default_negative", "")

    # Set seed
    if request.seed is None:
        seed = torch.randint(0, 2**32 - 1, (1,)).item()
    else:
        seed = request.seed
    generator = torch.Generator(device="cuda").manual_seed(seed)

    # IP-Adapter: process reference image if provided
    ip_adapter_image = None
    if request.reference_image and ip_adapter_loaded:
        try:
            ref_bytes = base64.b64decode(request.reference_image)
            ip_adapter_image = Image.open(io.BytesIO(ref_bytes)).convert("RGB")
            pipe.set_ip_adapter_scale(request.ip_adapter_scale)
            print(f"Using reference image with IP-Adapter scale {request.ip_adapter_scale}")
        except Exception as e:
            print(f"Warning: Could not process reference image: {e}")
            ip_adapter_image = None
    elif request.reference_image and not ip_adapter_loaded:
        print("Warning: Reference image provided but IP-Adapter not loaded")

    # When IP-Adapter is loaded but no reference provided, use a blank dummy at scale 0
    if ip_adapter_loaded and ip_adapter_image is None:
        pipe.set_ip_adapter_scale(0.0)
        ip_adapter_image = Image.new("RGB", (224, 224), (0, 0, 0))

    # LoRA loading
    if request.lora_name:
        lora_path = LORA_DIR / f"{request.lora_name}.safetensors"
        if not lora_path.exists():
            raise HTTPException(
                status_code=400,
                detail=f"LoRA not found: {request.lora_name}. Available: {[f.stem for f in LORA_DIR.glob('*.safetensors')]}"
            )
        pipe.load_lora_weights(str(lora_path))
        pipe.fuse_lora(lora_scale=request.lora_scale)
        print(f"LoRA '{request.lora_name}' loaded with scale {request.lora_scale}")

    # Generate
    gen_kwargs = {
        "prompt": request.prompt,
        "negative_prompt": negative_prompt,
        "width": request.width,
        "height": request.height,
        "num_inference_steps": steps,
        "guidance_scale": cfg_scale,
        "generator": generator,
    }
    if ip_adapter_image is not None:
        gen_kwargs["ip_adapter_image"] = ip_adapter_image

    image = pipe(**gen_kwargs).images[0]

    # Unfuse LoRA after generation to avoid affecting subsequent requests
    if request.lora_name:
        pipe.unfuse_lora()
        pipe.unload_lora_weights()

    # Encode to base64
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    image_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

    return GenerateResponse(
        image=image_base64,
        seed=seed,
        parameters={
            "prompt": request.prompt,
            "negative_prompt": negative_prompt,
            "width": request.width,
            "height": request.height,
            "steps": steps,
            "cfg_scale": cfg_scale,
            "model": request.model,
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
