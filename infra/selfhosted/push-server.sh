#!/bin/bash
# Push server.py to a Vast instance
# Usage: ./push-server.sh <ip> <port>

IP="${1:?Usage: ./push-server.sh <ip> <port>}"
PORT="${2:?Usage: ./push-server.sh <ip> <port>}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Pushing server.py to $IP:$PORT..."
scp -P "$PORT" "$SCRIPT_DIR/server.py" "root@$IP:/workspace/inference/server.py"
echo "Done. Restart the server to apply changes."
