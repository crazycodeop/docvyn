#!/bin/bash
set -e

# Kill any existing stray processes on ports 8000, 3000, 6380
fuser -k 8000/tcp 2>/dev/null || true
fuser -k 3000/tcp 2>/dev/null || true
fuser -k 6380/tcp 2>/dev/null || true

# Start Redis on port 6380
redis-server --port 6380 --dir /tmp --daemonize yes
echo "Redis started on port 6380"

# Start Celery worker
PYTHONPATH=backend REDIS_URL=redis://127.0.0.1:6380/0 .venv/bin/celery -A app.workers.celery_app.celery_app worker --loglevel=info --concurrency=2 &

# Start FastAPI backend
PYTHONPATH=backend REDIS_URL=redis://127.0.0.1:6380/0 .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &

# Wait for backend to be ready
sleep 2

# Start Vite React frontend
exec npm run dev --prefix frontend -- --host 0.0.0.0 --port 3000
