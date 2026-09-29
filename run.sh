#!/usr/bin/env bash
# CIRQO: run the whole app locally.
#   ./run.sh        install and start backend (:8000) and frontend (:3000)
#   ./run.sh test   run the backend tests
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PY="${PYTHON:-python3}"

setup_backend() {
  echo "==> Setting up backend"
  cd "$ROOT/backend"
  [ -d .venv ] || "$PY" -m venv .venv
  # shellcheck disable=SC1091
  source .venv/bin/activate
  pip install -q -r requirements.txt
}

if [ "${1:-}" = "test" ]; then
  setup_backend
  echo "==> Running backend tests"
  python -m pytest -q
  exit 0
fi

setup_backend
echo "==> Starting backend on http://localhost:8000 (MOCK_MODE=${MOCK_MODE:-true})"
MOCK_MODE="${MOCK_MODE:-true}" uvicorn main:app --port 8000 &
BACKEND_PID=$!
trap 'echo; echo "==> Stopping"; kill $BACKEND_PID 2>/dev/null || true' EXIT INT TERM

echo "==> Setting up frontend"
cd "$ROOT/frontend"
[ -d node_modules ] || npm install
echo "==> Starting frontend on http://localhost:3000"
NEXT_PUBLIC_API_URL=http://localhost:8000 NEXT_PUBLIC_USE_MOCK=false npm run dev
