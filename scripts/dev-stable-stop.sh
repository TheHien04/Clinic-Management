#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="${ROOT_DIR}/.dev-stable.pid"

cd "${ROOT_DIR}"

if [[ ! -f "${PID_FILE}" ]]; then
  echo "[stop] No PID file found."
  exit 0
fi

pid="$(cat "${PID_FILE}" 2>/dev/null || true)"

if [[ -z "${pid}" ]]; then
  echo "[stop] PID file is empty, cleaning up."
  rm -f "${PID_FILE}"
  exit 0
fi

if kill -0 "${pid}" 2>/dev/null; then
  kill "${pid}" || true
  sleep 1
  if kill -0 "${pid}" 2>/dev/null; then
    kill -9 "${pid}" || true
  fi
  echo "[stop] Stopped dev:stable PID ${pid}."
else
  echo "[stop] Process ${pid} not running."
fi

rm -f "${PID_FILE}"
