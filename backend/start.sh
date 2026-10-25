#!/bin/bash
set -e

PORT="${PORT:-8000}"

echo "Starting Celery background worker (solo pool for minimal memory footprint)..."
celery -A app.workers.celery_app.celery_app worker --pool=solo --loglevel=info &

echo "Starting FastAPI uvicorn server on port ${PORT}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT}"
