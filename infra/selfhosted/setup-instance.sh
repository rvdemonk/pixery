#!/bin/bash
# First-time setup for a new Vast.ai instance
# Run this once after creating a new instance
#
# Usage:
#   ./setup-instance.sh              # Download all models
#   ./setup-instance.sh animagine    # Download only animagine
#   ./setup-instance.sh pony         # Download only pony
#   ./setup-instance.sh noobai       # NoobAI requires manual download from CivitAI

set -e

MODELS_TO_DOWNLOAD="${1:-all}"

echo "=== SDXL Inference Server Setup ==="

# Create directories
mkdir -p /workspace/models
mkdir -p /workspace/models/loras
mkdir -p /workspace/models/ip-adapter
mkdir -p /workspace/inference

# Install Python dependencies
echo "Installing Python dependencies..."
pip install --upgrade pip
pip install -r /workspace/inference/requirements.txt

# Download Animagine XL 4.0
if [ "$MODELS_TO_DOWNLOAD" = "all" ] || [ "$MODELS_TO_DOWNLOAD" = "animagine" ]; then
    echo ""
    echo "Downloading Animagine XL 4.0 (~6.5 GB)..."
    if [ ! -f /workspace/models/animagine-xl-4.0.safetensors ]; then
        huggingface-cli download cagliostrolab/animagine-xl-4.0 \
            animagine-xl-4.0.safetensors \
            --local-dir /workspace/models \
            --local-dir-use-symlinks False
    else
        echo "  Already exists, skipping"
    fi
fi

# Download Pony Diffusion V6 XL
if [ "$MODELS_TO_DOWNLOAD" = "all" ] || [ "$MODELS_TO_DOWNLOAD" = "pony" ]; then
    echo ""
    echo "Downloading Pony Diffusion V6 XL (~6.5 GB)..."
    if [ ! -f /workspace/models/ponyDiffusionV6XL.safetensors ]; then
        huggingface-cli download LyliaEngine/Pony_Diffusion_V6_XL \
            ponyDiffusionV6XL.safetensors \
            --local-dir /workspace/models \
            --local-dir-use-symlinks False
    else
        echo "  Already exists, skipping"
    fi
fi

# NoobAI - Manual download required
if [ "$MODELS_TO_DOWNLOAD" = "noobai" ]; then
    echo ""
    echo "NoobAI requires manual download from CivitAI:"
    echo "  https://civitai.com/models/833294/noobai-xl-nai-xl"
    echo ""
    echo "Download the .safetensors file and upload to:"
    echo "  /workspace/models/noobaiXLNAIXL_epsilonPred10.safetensors"
    echo ""
fi

# Download IP-Adapter
echo ""
echo "Downloading IP-Adapter for SDXL (~1.5 GB)..."
if [ ! -f /workspace/models/ip-adapter/ip-adapter-plus_sdxl_vit-h.safetensors ]; then
    huggingface-cli download h94/IP-Adapter \
        sdxl_models/ip-adapter-plus_sdxl_vit-h.safetensors \
        --local-dir /workspace/models/ip-adapter \
        --local-dir-use-symlinks False
else
    echo "  Already exists, skipping"
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Downloaded models:"
ls -lh /workspace/models/*.safetensors 2>/dev/null || echo "  (none)"
echo ""
echo "To start the server:"
echo "  cd /workspace/inference && python server.py"
echo ""
echo "Or with auto-reload for development:"
echo "  cd /workspace/inference && uvicorn server:app --host 0.0.0.0 --port 8000 --reload"
echo ""
echo "Test with:"
echo "  curl http://localhost:8000/models"
echo ""
