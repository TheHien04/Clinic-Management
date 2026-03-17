#!/usr/bin/env bash
set -euo pipefail

FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173/}"
BACKEND_URL="${BACKEND_URL:-http://localhost:5055/api/health}"
MAX_RETRIES="${MAX_RETRIES:-25}"
RETRY_DELAY_SECONDS="${RETRY_DELAY_SECONDS:-1}"

check_url() {
  local url="$1"
  curl -fsS --max-time 2 "$url" >/dev/null
}

for ((i=1; i<=MAX_RETRIES; i++)); do
  frontend_ok=0
  backend_ok=0

  if check_url "$FRONTEND_URL"; then
    frontend_ok=1
  fi

  if check_url "$BACKEND_URL"; then
    backend_ok=1
  fi

  if [[ "$frontend_ok" -eq 1 && "$backend_ok" -eq 1 ]]; then
    echo "[health] OK frontend=${FRONTEND_URL} backend=${BACKEND_URL}"
    exit 0
  fi

  echo "[health] Waiting (${i}/${MAX_RETRIES}) frontend=${frontend_ok} backend=${backend_ok}"
  sleep "$RETRY_DELAY_SECONDS"
done

echo "[health] FAIL frontend=${FRONTEND_URL} backend=${BACKEND_URL}"
exit 1
