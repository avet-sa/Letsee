#!/bin/sh
set -e

export UV_PROJECT_ENVIRONMENT=/opt/venv
export VIRTUAL_ENV=/opt/venv
export PATH="/opt/venv/bin:$PATH"

if [ ! -x /opt/venv/bin/uvicorn ]; then
  echo "Bootstrapping /opt/venv (first run or empty volume)..."
  cd /app
  uv sync --frozen
fi

exec "$@"
