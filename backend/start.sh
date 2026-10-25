#!/bin/bash
set -e

PORT="${PORT:-8000}"

# If RUN_WORKER_IN_PROCESS is not false (default), background tasks run in a daemon thread inside FastAPI
# to stay within Render Free Tier's 512MB RAM limit without duplicate process overhead.
if [ "${RUN_WORKER_IN_PROCESS:-true}" != "true" ]; then
    echo "Starting Celery background worker (solo pool)..."
    celery -A app.workers.celery_app.celery_app worker --pool=solo --loglevel=info &
fi

echo "Starting FastAPI uvicorn server on port ${PORT}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT}"
