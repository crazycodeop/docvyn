#!/bin/bash
set -e

PORT="${PORT:-8000}"

echo "Starting Celery background worker..."
celery -A app.workers.celery_app.celery_app worker --loglevel=info --concurrency=1 &

echo "Starting FastAPI uvicorn server on port ${PORT}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT}"
