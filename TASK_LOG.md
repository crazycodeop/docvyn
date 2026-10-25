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
- **Task**: Fix Accidental Logouts, Google Sign-in Button Sizing, and Chat Document Selection
  - **Accidental Logout Prevention**:
    - Previously, if the backend was restarting (returning 502/503 or transient network errors), `AuthContext.initAuth()` and `client.js` caught any error and wiped `docrag_access_token`, logging the user out.
    - Updated `AuthContext.jsx` and `client.js` to only clear authentication credentials when the backend explicitly responds with `401 Unauthorized`.
  - **Google Login Button Sizing**:
    - Google Identity Services (GSI) rejected `width="100%"` as an invalid numeric width, causing the button to shrink to its minimum 200px size.
    - Updated `width="368"` and added `[&_iframe]:!w-full` in `LoginPage.jsx` and `RegisterPage.jsx` to render the button at full card width.
  - **Chat Document Selection & Live Polling**:
    - In `ChatPage.jsx`, `fetchDocuments()` was strictly querying `{ status: 'completed' }`, which omitted newly uploaded documents from `availableDocs` while they were being indexed.
    - Removed the status filter so uploaded documents immediately populate the dropdown with an active `(Processing...)` badge.
    - Added an automatic 2.5-second status poller that refreshes documents while any document is in `queued` or `processing`.
    - Added user-friendly guidance in `handleSendMessage` if a question is submitted before indexing completes.
  - **Verification**:
    - Backend Pytest: 22/22 passed.
    - Frontend Vitest: 25/25 passed.
    - Frontend Production Build: Clean.

### Verification Results
- **Backend Tests**: 22/22 passed.
- **Frontend Tests**: 25/25 passed.
- **Frontend Build**: Built cleanly with zero errors.

### Next Step
- Commit and push to GitHub `main` for automatic Vercel deployment.
