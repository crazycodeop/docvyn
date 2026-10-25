# docvyn — Task Log

## Current Status: CI/CD Verified & Production Ready

---

### Recent Task Completed
- **Task**: Google OAuth 2.0 Integration, Supabase Cloud Database Provisioning, and GitHub Actions CI/CD Pipeline
  - **Google OAuth Integration**:
    - Integrated `@react-oauth/google` and wrapped application in `<GoogleOAuthProvider>`.
    - Added Google sign-in buttons to `LoginPage.jsx` and `RegisterPage.jsx` with dark theme styling.
    - Verified backend `POST /api/v1/auth/google` with Google public tokeninfo endpoint and audience claim validation.
  - **Supabase PostgreSQL & Upstash Redis**:
    - Verified connectivity to Supabase through IPv4 Session Pooler (`aws-0-ap-northeast-2.pooler.supabase.com:5432`).
    - Enabled `pgvector` extension on Supabase database.
    - Successfully created all 7 core tables (`users`, `refresh_tokens`, `documents`, `conversations`, `document_chunks`, `messages`, `conversation_shares`) in Supabase.
    - Verified Upstash Redis ping connectivity over TLS (`rediss://`).
  - **Git & CI/CD Pipeline**:
    - Initialized git repository on branch `main` and pushed to `crazycodeop/docvyn`.
    - Configured strict `.gitignore` preventing secrets, local DBs, `.env`, and Google credential files from being tracked.
    - Built and verified GitHub Actions CI workflow (`.github/workflows/ci-cd.yml`).
    - Fixed missing test dependencies (`aiosqlite`, `greenlet`, `pypdf`, `Pillow`, `email-validator`, `rapidocr-onnxruntime`).
    - Configured `frontend/vercel.json` for SPA client-side routing on Vercel (`docvyn.vercel.app`).
- **Verification**:
  - **GitHub Actions Run ID 40173112904**: **All jobs passed (Conclusion: SUCCESS)**
    - `Backend Tests` (Python 3.12, Pytest suite): **PASSED** ✅
    - `Frontend Tests & Build` (Node 20, Vitest + Vite production build): **PASSED** ✅
  - Local tests: 22/22 backend passed, 25/25 frontend passed.
  - Localhost Google login verified by user.

### Recent Task Completed
- **Task**: Fix Container OOM Crash on Render Free Tier & Add Detailed Processing Logs
  - **Root Cause of Silent Container Restart**:
    - Measuring real memory usage revealed FastEmbed with default `batch_size=256` and multi-threading spiked memory to **848 MB** during chunk embedding.
    - Combined with two concurrent Python processes (Uvicorn + Celery worker), container memory exceeded Render's 512 MB limit. The Linux kernel sent `SIGKILL` (137) to the container at 09:03:44 without logging a Python stack trace.
  - **Optimization & Fix**:
    - **FastEmbed Low-Memory Encoding**: Restricted ONNX session to `threads=1` and `batch_size=8` with manual garbage collection. Peak memory during embedding dropped from +580 MB to **+2.4 MB**.
    - **In-Process Background Worker**: Executed Celery task in a background daemon thread within FastAPI when `RUN_WORKER_IN_PROCESS=true` (default), eliminating the secondary Python process and sharing ONNX model memory. Total container memory is now **~265 MB** (well below the 512 MB limit).
    - **Comprehensive Logging**: Added detailed logs at every step in `tasks.py` (`Extracted X pages`, `Chunked into Y chunks`, `Starting embedding generation`, `Successfully persisted Z chunks`).
  - **Verification**:
    - Backend Pytest: 22/22 passed.
    - Frontend Vitest: 25/25 passed.
    - Frontend Production Build: Clean.

### Verification Results
- **Backend Tests**: 22/22 passed.
- **Frontend Tests**: 25/25 passed.
- **Frontend Build**: Built cleanly with zero errors.

### Next Step
- Push changes to GitHub `main`, trigger Render deployment, and verify complete document processing in Render logs.
