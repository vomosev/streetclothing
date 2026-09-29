#!/usr/bin/env bash
#
# START.sh — boot the STREET/PLATINUM API (Express + MySQL + payments module)
#
# Usage:
#   ./START.sh
#
# Behaviour:
#   * moves to the repository root (the directory holding this script)
#   * loads environment variables from .env when that file exists
#   * installs production dependencies if node_modules is missing
#   * starts server/index.js detached with nohup, logging to logs/api.log
#   * prints the PID and the health-check URL
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

APP_NAME="streetclothing"
ENTRY="server/index.js"
LOG_DIR="logs"
LOG_FILE="$LOG_DIR/api.log"
PID_FILE="$LOG_DIR/api.pid"

echo "==> $APP_NAME :: starting from $SCRIPT_DIR"

# ---------------------------------------------------------------------------
# 1. Environment
# ---------------------------------------------------------------------------
if [ -f ".env" ]; then
  echo "==> Loading environment from .env"
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
else
  echo "==> No .env file found (using the current environment / defaults)"
fi

export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-4117}"

# ---------------------------------------------------------------------------
# 2. Sanity checks
# ---------------------------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node is not installed or not on PATH." >&2
  exit 1
fi

if [ ! -f "$ENTRY" ]; then
  echo "ERROR: $ENTRY not found — run this script from the repository root." >&2
  exit 1
fi

echo "==> node $(node -v)"

# ---------------------------------------------------------------------------
# 3. Dependencies
# ---------------------------------------------------------------------------
if [ ! -d "node_modules" ]; then
  if ! command -v npm >/dev/null 2>&1; then
    echo "ERROR: node_modules is missing and npm is not available to install it." >&2
    exit 1
  fi
  echo "==> node_modules missing — running npm install --omit=dev"
  npm install --omit=dev
else
  echo "==> Dependencies already installed"
fi

# ---------------------------------------------------------------------------
# 4. Launch
# ---------------------------------------------------------------------------
mkdir -p "$LOG_DIR"

if [ -f "$PID_FILE" ]; then
  OLD_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [ -n "${OLD_PID:-}" ] && kill -0 "$OLD_PID" >/dev/null 2>&1; then
    echo "==> Stopping previous instance (PID $OLD_PID)"
    kill "$OLD_PID" >/dev/null 2>&1 || true
    sleep 2
    if kill -0 "$OLD_PID" >/dev/null 2>&1; then
      kill -9 "$OLD_PID" >/dev/null 2>&1 || true
    fi
  fi
  rm -f "$PID_FILE"
fi

echo "==> Launching: nohup node $ENTRY > $LOG_FILE 2>&1 &"
nohup node "$ENTRY" > "$LOG_FILE" 2>&1 &
API_PID=$!
echo "$API_PID" > "$PID_FILE"

# Give the process a moment to fail fast on bad config.
sleep 2

if ! kill -0 "$API_PID" >/dev/null 2>&1; then
  echo "ERROR: the API exited immediately. Last 40 log lines:" >&2
  tail -n 40 "$LOG_FILE" >&2 || true
  rm -f "$PID_FILE"
  exit 1
fi

echo ""
echo "==> $APP_NAME API is running"
echo "    PID      : $API_PID"
echo "    Port     : $PORT"
echo "    Logs     : $SCRIPT_DIR/$LOG_FILE"
echo "    PID file : $SCRIPT_DIR/$PID_FILE"
echo "    Health   : https://streetclothing-api.arx-app.com:4117/health"
echo ""
echo "    Tail logs with : tail -f $LOG_FILE"
echo "    Stop with      : kill $API_PID"
echo ""