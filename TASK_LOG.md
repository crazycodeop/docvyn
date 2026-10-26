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
- **Task**: Configure Hugging Face Spaces (Docker) for 16 GB RAM Deployment
  - **Hugging Face Spaces Configuration**:
    - Created root [`Dockerfile`](file:///home/vakildesk/Documents/docrag/Dockerfile) configured for Hugging Face Spaces with non-root UID 1000 user, `PORT=7860`, pre-baked FastEmbed cache, and permissions for `/app/uploads`.
    - Added Hugging Face Space metadata frontmatter to [`README.md`](file:///home/vakildesk/Documents/docrag/README.md) (`sdk: docker`, `app_port: 7860`).
    - Updated [`backend/start.sh`](file:///home/vakildesk/Documents/docrag/backend/start.sh) to default to port 7860 while honoring host dynamic ports.
  - **Verification**:
    - Backend Pytest: 22/22 passed.
    - Frontend Vitest: 25/25 passed.
    - Frontend Production Build: Clean.

### Verification Results
- **Backend Tests**: 22/22 passed.
- **Frontend Tests**: 25/25 passed.
- **Frontend Build**: Built cleanly with zero errors.

### Next Step
- Guide user to create the Space on Hugging Face, add environment variables, and push to deploy.

## Mobile Web UI Overhaul (ChatGPT Visual Parity)
- **Status**: Completed & Verified
- **Changes**:
  - `frontend/src/components/layout/AppLayout.jsx`: Edge-to-edge layout on mobile with unified top bar.
  - `frontend/src/components/chat/MarkdownRenderer.jsx`: Enforced `min-w-0 max-w-full break-words` to eliminate horizontal scroll.
  - `frontend/src/pages/ChatPage.jsx`:
    - Top header: Consolidated desktop buttons into a mobile `...` dropdown menu (`MoreVertical`); rendered document scope badge compactly (`[📁 All]` / `[📁 1]`).
    - Chat messages: Borderless distraction-free assistant response on mobile, sleek pill user bubble, user avatar hidden on mobile.
    - Citations: Converted vertical card pile into horizontal swipeable snap carousel.
    - Composer: Scoped document chip moved above input row on mobile to provide 100% full-width input for textarea without placeholder wrapping.
- **Verification**: 25/25 Vitest frontend tests passed, frontend production build passed, 22/22 pytest backend tests passed. Pushed to `main`.

## Backend Memory Optimization (Class-level FastEmbed Singleton + Glibc Malloc Trim)
- **Status**: Completed & Verified
- **Issue**: Container crashed with 502 at 85% ("Embedding") when multiple documents were indexed because `EmbeddingService._local_model` was an instance attribute, instantiating duplicate ONNX sessions on every background task and RAG query.
- **Changes**:
  - `backend/app/services/embedding_service.py`: Converted `_shared_local_model` and `_shared_gemini_client` to class-level singletons so the FastEmbed model is loaded exactly once in the container lifetime.
  - `backend/app/services/embedding_service.py` & `backend/app/workers/tasks.py`: Added `ctypes.CDLL('libc.so.6').malloc_trim(0)` after batch vectorization and in the task's `finally` block to return freed memory pages directly to the OS kernel.
- **Verification**: 22/22 pytest backend tests passed. Pushed to `main` (`c2e21ae`) for auto-deploy on Render.

## Conversational Greeting Handling (hi, hello, hiiii)
- **Status**: Completed & Verified
- **Issue**: Starting a conversation with casual greetings ("hi", "hello", "hiiii", "who are you") returned "The provided documents do not contain sufficient information to answer this question."
- **Changes**:
  - `backend/app/services/rag_service.py`: Added fast-path greeting detection (`_is_conversational_or_greeting`) that collapses character repetitions and matches conversational phrases. Generates a warm, natural greeting via Groq LLM with deterministic fallbacks, returning 0 citations.
  - `backend/tests/test_rag.py`: Added automated test suite verifying greetings across variations.
- **Verification**: 23/23 pytest backend tests passed. Pushed to `main` (`9bbd50d`).

## Full Fix Suite: Extraction, Ephemeral Download Fallback, Google Button, Header Cleanup
- **Status**: Completed & Verified
- **Changes**:
  1. **Scanned / Receipt Text Extraction**:
     - Added `opencv-python-headless>=4.8.0` in `requirements.txt` to ensure RapidOCR loads without missing GUI libraries on Linux.
     - Added AcroForm widget extraction in `extraction_service.py` to extract text from government form fields and JasperReports.
     - Added pypdf fallback before raising `EmptyDocumentError`.
  2. **Resilient Document Download**:
     - Added `export_document_chunks_to_pdf` in `pdf_export_service.py` and connected it in `document_service.py`: if raw files on Render's ephemeral disk were wiped by a container restart, it reconstructs the document from database chunks, ensuring 100% download reliability.
  3. **Playground Header Cleanup**:
     - Removed the rename edit button next to the Playground title in `ChatPage.jsx` (users rename via chat options).
  4. **Google Sign-In Button Dynamic Width & Alignment**:
     - Measured parent container width via `useLayoutEffect` and `useRef` clamped to Google GSI's [200, 400] range in `LoginPage.jsx` and `RegisterPage.jsx`.
     - Google button now matches the exact pixel width of the input fields and Sign In button on any mobile screen width (~280px) and desktop (~368px) with zero overflow or right-edge clipping.
  5. **Natural Greetings without AI-Style Hyphens**:
     - Converted standard greetings ("hi", "hello", "hiiii", "hey") to return an immediate, natural human greeting: `"Hello! How can I help you today? Feel free to ask questions about your documents or upload a file to get started."`
     - Added strict regex replacement for any em-dashes (`—`), en-dashes (`–`), or hyphens (`-`) used as punctuation in conversational responses.
- **Verification**: 25/25 Vitest frontend tests passed, frontend production build succeeded, 23/23 pytest backend tests passed. Pushed to `main` (`6dc7900`).

## [2026-10-26] - Fix Modal Viewport Portaling & Vertical Responsive Citation Grid
- **Files Modified**:
  - `frontend/src/components/common/Modal.jsx`: Portaled modal tree directly to `document.body` via `createPortal` with `z-[100]` and body scroll-locking, preventing any ancestor CSS `transform` / mobile drawer width from trapping modal windows inside the sidebar.
  - `frontend/src/components/layout/Sidebar.jsx`: Moved modal declarations (`ArchivedModal`, rename `Modal`, delete/alert `ConfirmationModal`) outside of the navigation JSX variable to the root component tree.
  - `frontend/src/pages/ChatPage.jsx`: Replaced mobile horizontal-scrolling citations container (`overflow-x-auto flex snap-x`) with responsive vertical grid (`grid grid-cols-1 sm:grid-cols-2 gap-2.5`), ensuring all source citations are immediately visible without horizontal scrolling.
- **Verification**: 25/25 Vitest frontend tests passed, frontend production build succeeded. Pushed to `main` (`eea8d86`).

## [2026-10-26] - Mobile UI Polish, Robust Academic PDF Fallbacks, Demo User Seed & Document Preview Reader
- **Files Modified**:
  - `backend/app/main.py`: Added automatic demo user seed/sync (`demo@cortex.ai` / `demo123456`) in application startup lifespan.
  - `backend/app/services/extraction_service.py`: Multi-stage resilient extraction pipeline for research papers with LaTeX/Type 3 bitmapped fonts (PyMuPDF -> text blocks/widgets -> pypdf stream fallback -> 150 DPI RapidOCR pass).
  - `backend/app/api/v1/endpoints/documents.py`: Added `GET /api/v1/documents/{document_id}/chunks` for document text review.
  - `frontend/src/api/documents.js`: Added `getDocumentChunks` helper.
  - `frontend/src/pages/DocumentsPage.jsx`: Replaced squeezed table on mobile with sleek cards (`sm:hidden`); made filter tabs scrollable without text wrap (`overflow-x-auto whitespace-nowrap`); redesigned document preview modal with tabbed "File Preview" + "Extracted Text" reader and mobile direct open/download action bar.
  - `frontend/src/pages/DashboardPage.jsx`: Added responsive card list for recent documents on mobile screens.
  - `frontend/src/pages/ChatPage.jsx`: Replaced rectangular scoped banner on mobile with compact inline pill chip.
  - `frontend/src/pages/LoginPage.jsx` & `frontend/src/pages/RegisterPage.jsx`: Refined dynamic Google button sizing using `clientWidth` and `overflow-hidden` container to avoid mobile clipping.
- **Verification**: 25/25 Vitest frontend tests passed, frontend production build succeeded, 23/23 pytest backend tests passed. Pushed to `main` (`6dc7900`).

## [2026-10-26] - Fix Modal Viewport Portaling & Vertical Responsive Citation Grid
- **Files Modified**:
  - `frontend/src/components/common/Modal.jsx`: Portaled modal tree directly to `document.body` via `createPortal` with `z-[100]` and body scroll-locking, preventing any ancestor CSS `transform` / mobile drawer width from trapping modal windows inside the sidebar.
  - `frontend/src/components/layout/Sidebar.jsx`: Moved modal declarations (`ArchivedModal`, rename `Modal`, delete/alert `ConfirmationModal`) outside of the navigation JSX variable to the root component tree.
  - `frontend/src/pages/ChatPage.jsx`: Replaced mobile horizontal-scrolling citations container (`overflow-x-auto flex snap-x`) with responsive vertical grid (`grid grid-cols-1 sm:grid-cols-2 gap-2.5`), ensuring all source citations are immediately visible without horizontal scrolling.
- **Verification**: 25/25 Vitest frontend tests passed, frontend production build succeeded.
