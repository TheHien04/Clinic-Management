#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="${ROOT_DIR}/.dev-stable.pid"
LOG_FILE="${ROOT_DIR}/.dev-stable.log"

cd "${ROOT_DIR}"

if [[ -f "${PID_FILE}" ]]; then
  old_pid="$(cat "${PID_FILE}" 2>/dev/null || true)"
  if [[ -n "${old_pid}" ]] && kill -0 "${old_pid}" 2>/dev/null; then
    echo "[keep] dev:stable is already running (PID ${old_pid})."
    echo "[keep] Log: ${LOG_FILE}"
    exit 0
  fi
  rm -f "${PID_FILE}"
fi

bash "${ROOT_DIR}/scripts/dev-stable-clean.sh"

nohup npm run dev:stable >"${LOG_FILE}" 2>&1 &
new_pid=$!
echo "${new_pid}" > "${PID_FILE}"

sleep 2

if kill -0 "${new_pid}" 2>/dev/null; then
  echo "[keep] Started dev:stable in background (PID ${new_pid})."
  echo "[keep] Log: ${LOG_FILE}"

  if bash "${ROOT_DIR}/scripts/dev-stable-health.sh"; then
    echo "[keep] Health check passed."
  else
    echo "[keep] Health check failed. Last log lines:"
    tail -n 80 "${LOG_FILE}" || true
    bash "${ROOT_DIR}/scripts/dev-stable-stop.sh" || true
    exit 1
  fi
else
  echo "[keep] Failed to keep dev:stable running. Check log: ${LOG_FILE}"
  rm -f "${PID_FILE}"
  exit 1
fi
