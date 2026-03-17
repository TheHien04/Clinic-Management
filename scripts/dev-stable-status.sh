#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="${ROOT_DIR}/.dev-stable.pid"

print_port_status() {
  local port="$1"
  local listener
  listener="$(lsof -nP -iTCP:"${port}" -sTCP:LISTEN || true)"
  if [[ -n "${listener}" ]]; then
    echo "[status] Port ${port}: LISTEN"
  else
    echo "[status] Port ${port}: FREE"
  fi
}

if [[ -f "${PID_FILE}" ]]; then
  pid="$(cat "${PID_FILE}" 2>/dev/null || true)"
  if [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null; then
    echo "[status] dev:stable PID ${pid} is running."
  else
    echo "[status] PID file exists but process is not running."
  fi
else
  echo "[status] No PID file found."
fi

print_port_status 5173
print_port_status 5055

echo "[status] Run 'npm run dev:stable:health' for endpoint checks."
echo "[status] Run 'npm run dev:stable:logs:follow' to stream logs."
