#!/bin/bash
# Connect to Vast instance with port forwarding for pixery
# Usage: ./connect.sh <ip> <port>
# Example: ./connect.sh 74.63.227.51 4970

IP="${1:?Usage: ./connect.sh <ip> <port>}"
PORT="${2:?Usage: ./connect.sh <ip> <port>}"

echo "Connecting to Vast instance at $IP:$PORT"
echo "Port forwarding: localhost:8000 -> instance:8000"
echo ""
echo "Once connected, run: cd /workspace/inference && python server.py"
echo ""

ssh -p "$PORT" "root@$IP" -L 8000:localhost:8000
