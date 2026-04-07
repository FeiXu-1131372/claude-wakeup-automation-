#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=3456

# Find node regardless of which shell profile is loaded
NODE=""
for candidate in "$(command -v node 2>/dev/null)" /usr/local/bin/node /opt/homebrew/bin/node "$HOME/.nvm/versions/node/"*/bin/node; do
  if [ -x "$candidate" ]; then
    NODE="$candidate"
    break
  fi
done

if [ -z "$NODE" ]; then
  echo "Error: Node.js not found. Install it from https://nodejs.org"
  read -rp "Press Enter to close..."
  exit 1
fi

# Stop any leftover server on the port
EXISTING=$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | awk 'NR>1{print $2}')
if [ -n "$EXISTING" ]; then
  echo "Stopping existing server on port $PORT..."
  echo "$EXISTING" | xargs kill 2>/dev/null || true
  sleep 0.4
fi

echo "Starting schedule UI at http://localhost:$PORT"
"$NODE" "$DIR/server.js" &
SERVER_PID=$!

trap 'kill "$SERVER_PID" 2>/dev/null' EXIT INT TERM

sleep 0.8
open "http://localhost:$PORT"
echo "Browser opened. Close this window to stop the server."

wait "$SERVER_PID"
