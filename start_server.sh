#!/bin/bash
# Start script for Content Blur Guard Moderation API Server

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$SCRIPT_DIR/api-server"

echo "=================================================="
echo "🛡️  Starting Content Blur Guard API Server..."
echo "=================================================="

# Check for python with uvicorn and fastapi
PYTHON_CMD="python3"
if command -v /usr/local/bin/python3 &> /dev/null; then
    PYTHON_CMD="/usr/local/bin/python3"
fi

cd "$API_DIR" || exit 1
echo "Serving from: $API_DIR"
echo "Listening on: http://127.0.0.1:8000"
echo "Health check: http://127.0.0.1:8000/health"
echo "--------------------------------------------------"

$PYTHON_CMD -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
