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
- **Task**: Render Production Deployment & FastEmbed Offline Model Baking
  - **FastEmbed Offline Baking**:
    - Pre-cached FastEmbed ONNX model (`BAAI/bge-small-en-v1.5`) into `/app/model_cache` during Docker build.
    - Updated `embedding_service.py` with `local_files_only=True` to eliminate runtime Hugging Face network downloads and prevent timeout/OOM restarts.
  - **Celery & Render Concurrency Optimization**:
    - Switched Celery worker pool to `--pool=solo` to eliminate duplicate prefork processes and preserve memory within Render's 512MB tier.
    - Added SSL certificate bypass (`ssl_cert_reqs=CERT_NONE`) for Upstash Redis TLS broker URLs.
    - Exposed `doc_service` singleton in `document_service.py` to support startup task re-dispatch for pending/stalled uploads.
  - **Verification**:
    - Local tests: 22/22 backend passed, 25/25 frontend passed.
    - Frontend build: Passed with zero errors.

### Verification Results
- **Backend Tests**: 22/22 passed.
- **Frontend Tests**: 25/25 passed.
- **Frontend Build**: Built cleanly with zero errors.

### Next Step
- Push changes to GitHub and trigger Render redeployment to verify end-to-end document processing and RAG chat in production.
