#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_VENV="$BACKEND_DIR/venv"

if ! command -v python3 >/dev/null 2>&1; then
  echo "Error: python3 is required but not installed."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is required but not installed."
  exit 1
fi

echo "[1/4] Setting up backend virtual environment..."
if [ ! -d "$BACKEND_VENV" ]; then
  python3 -m venv "$BACKEND_VENV"
fi

"$BACKEND_VENV/bin/pip" install --upgrade pip
"$BACKEND_VENV/bin/pip" install -r "$BACKEND_DIR/requirements.txt"

echo "[2/4] Installing frontend dependencies..."
npm --prefix "$FRONTEND_DIR" install

echo "[3/4] Starting backend on http://127.0.0.1:8000"
"$BACKEND_VENV/bin/python" -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload --app-dir "$BACKEND_DIR" &
BACKEND_PID=$!

echo "[4/4] Starting frontend on http://127.0.0.1:5173"
npm --prefix "$FRONTEND_DIR" run dev -- --host 127.0.0.1 --port 5173 &
FRONTEND_PID=$!

cleanup() {
  echo
  echo "Stopping servers..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

echo "Both servers are running. Press Ctrl+C to stop."
wait "$BACKEND_PID" "$FRONTEND_PID"
