# docvyn — Project Context & Architecture

**Last Verified:** 2026-10-25  
**Product Name:** `docvyn` (conversational neural document intelligence and grounded RAG platform)

---

## 1. Verified Technology Stack

- **Frontend**: React 18, Vite 5, Tailwind CSS, Lucide React icons, Vitest. Neutral dark theme (`#141414`).
- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2.0 (async via `aiosqlite` for local dev; PostgreSQL compatible for prod), Alembic, Pydantic v2.
- **Background Worker**: Celery with Redis broker (`redis://127.0.0.1:6380/0`).
- **LLM Provider**: **Groq Cloud** (`LLM_PROVIDER=groq`) running model **`openai/gpt-oss-120b`** (configured via `.env`).
- **Embedding Provider**: **Local FastEmbed** (`BAAI/bge-small-en-v1.5`, 384-dimensional dense vectors).
- **OCR Engine**: **Local RapidOCR** (`rapidocr-onnxruntime`), CPU-optimized ONNX model with zero external API calls and zero system tesseract dependency.
- **Physical Storage**: Local disk storage provider (`backend/uploads/users/{user_id}/docs/`). Preserves exact original uploaded files, sizes, filenames, and MIME types.

---

## 2. RAG & Document Pipeline

1. **Upload & Ingestion**:
   - `POST /api/v1/documents/upload` validates file type (PDF, DOCX, PNG, JPEG, TIFF) and size (<=25MB).
   - Generates SHA-256 hash, writes original file to disk, creates `Document` entity with `uploaded` status, and dispatches Celery background task `process_document_task`.
2. **Extraction & Hybrid OCR**:
   - **PDF**: PyMuPDF (`pymupdf`) extracts digital text; if page density is low or scanned, falls back to local RapidOCR at 200 DPI.
   - **Images (PNG, JPEG, TIFF)**: Standalone image extraction using RapidOCR with character counts and confidence scores.
   - **DOCX**: Extracts heading hierarchy (`#`, `##`, `###`), headers/footers, and renders tables as structured Markdown tables.
3. **Chunking, Embedding & Progress Tracking**:
   - Celery worker updates `metadata_json` with real progress (`progress`: 10 -> 25 -> 50 -> 65 -> 85 -> 100) and stage progression (`queued` -> `extracting` -> `ocr` -> `chunking` -> `embedding` -> `completed`).
   - Chunks are vectorized using FastEmbed (`BAAI/bge-small-en-v1.5`).
   - Vectors and metadata are stored in `document_chunks` table.
4. **Retrieval & Answer Generation**:
   - RAG query embeds the user question, queries vector cosine similarity across authorized documents (top 5 chunks), and injects retrieved snippets into the Groq prompt.
   - **Prompt Injection Defense**: Explicit security system rules instruct the LLM to treat document excerpts strictly as untrusted source material and ignore any instructions or overrides within documents.
   - Response includes answer and grounded `citations` (`document_id`, `document_title`, `page_number`, `snippet`, `score`).

---

## 3. Persistence & Data Models

- **Database**: SQLite `test_docrag.db` in workspace root.
- **Key Tables**:
  - `users`: User identity, hashed passwords, auth provider, role, timestamps.
  - `refresh_tokens`: Revocable refresh token storage.
  - `documents`: Document records, original filenames, paths, hash, page/chunk counts, processing status (`uploaded`, `processing`, `completed`, `failed`), and `metadata_json` (progress, stage, extraction_method, ocr_confidence).
  - `document_chunks`: Extracted text, page numbers, 384-dim vector embeddings, JSON metadata.
  - `conversations`: Chat sessions with `is_pinned` and `is_archived` status flags.
  - `messages`: Conversation turns (`user` or `assistant`), content, `citations_json`, tokens used.
  - `conversation_shares`: Unguessable read-only share records (`share_token`), optional selected message IDs, and `is_revoked` status flag.

---

## 4. Key Source Files & Responsibilities

### Backend (`backend/app/`)
- [`core/config.py`](./backend/app/core/config.py): Allowed extensions (`.pdf`, `.docx`, `.png`, `.jpg`, `.jpeg`, `.tiff`), models, paths.
- [`services/extraction_service.py`](./backend/app/services/extraction_service.py): Magic bytes validation, RapidOCR image extraction, hybrid PDF extraction, DOCX table formatting.
- [`workers/tasks.py`](./backend/app/workers/tasks.py): Celery document ingestion pipeline with stage & progress tracking in `metadata_json`.
- [`services/rag_service.py`](./backend/app/services/rag_service.py): Vector similarity retrieval, prompt injection defense, Groq LLM inference.
- [`services/document_service.py`](./backend/app/services/document_service.py): File storage operations, hashing, retry, delete, and ingestion dispatch.
- [`api/v1/endpoints/documents.py`](./backend/app/api/v1/endpoints/documents.py): Document upload, status, deletion, retry, preview, and original file downloads.

### Frontend (`frontend/src/`)
- [`pages/ChatPage.jsx`](./frontend/src/pages/ChatPage.jsx): Central conversation view, Plus (+) multi-file picker with drag-and-drop & removable progress chips, dedicated Document Scope Selector, speech-to-text, find in chat, citations.
- [`pages/DocumentsPage.jsx`](./frontend/src/pages/DocumentsPage.jsx): Document management, type badges, extraction method badges (with OCR confidence), real-time progress bars, image & PDF preview.
- [`components/layout/AppLayout.jsx`](./frontend/src/components/layout/AppLayout.jsx): Full-height layout without top navbar.
- [`components/layout/Sidebar.jsx`](./frontend/src/components/layout/Sidebar.jsx): Canonical single location for unified primary navigation (Playground, Documents, Dashboard, Archived Chats), New Chat (Ctrl+K), debounced chat search, Pinned and Recent chats, and Kimi-style bottom user bar (avatar, name, settings icon, and logout button).

---

## 5. Existing Working Features

1. Grounded RAG chat with verified citations.
2. Multi-format document ingestion: PDF, DOCX, PNG, JPEG, TIFF.
3. Hybrid local OCR for scanned PDFs and standalone images.
4. Structured DOCX table extraction (Markdown tables) and headings hierarchy.
5. Real-time document ingestion stage progression and progress bars.
6. Decoupled chat composer with native file picker, multi-file drag & drop, and removable chips.
7. Dedicated indexed document scope selector.
8. Prompt injection defense against malicious document payloads.
9. Pinning, archiving, restoring, and debounced searching of conversations.
10. Find within current conversation (`Ctrl+F`) with match highlighting and navigation.
11. Browser-native speech-to-text voice input.
12. Direct download of original uploaded files from chat citation cards.
13. Secure read-only conversation sharing with token revocation.
14. Multi-page vector PDF export for complete conversation history.

---

## 6. Execution & Build Commands

- **Start All Services**: `./start_services.sh` (launches Redis 6380, Celery worker, FastAPI on 8000, Vite on 3000)
- **Run Backend Tests**: `PYTHONPATH=backend .venv/bin/pytest backend/tests`
- **Run Frontend Tests**: `npm test --prefix frontend -- --run`
- **Run Frontend Build**: `npm run build --prefix frontend`
