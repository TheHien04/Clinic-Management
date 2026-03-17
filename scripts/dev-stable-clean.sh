#!/usr/bin/env bash
set -euo pipefail

FRONTEND_PORT="${FRONTEND_PORT:-5173}"
BACKEND_PORT="${BACKEND_PORT:-5055}"

kill_port_if_busy() {
  local port="$1"
  local pids

  pids="$(lsof -tiTCP:"${port}" -sTCP:LISTEN || true)"

  if [[ -z "${pids}" ]]; then
    echo "[clean] Port ${port} is free."
    return 0
  fi

  echo "[clean] Releasing port ${port} (PID: ${pids//$'\n'/, })."
  # shellcheck disable=SC2086
  kill ${pids} || true
  sleep 0.5

  pids="$(lsof -tiTCP:"${port}" -sTCP:LISTEN || true)"
  if [[ -n "${pids}" ]]; then
    echo "[clean] Force killing remaining PID(s) on ${port}: ${pids//$'\n'/, }."
    # shellcheck disable=SC2086
    kill -9 ${pids} || true
  fi
}

kill_port_if_busy "${FRONTEND_PORT}"
kill_port_if_busy "${BACKEND_PORT}"

echo "[clean] Ports ready: frontend=${FRONTEND_PORT}, backend=${BACKEND_PORT}."
