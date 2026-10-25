# docvyn — Agent Instructions & Operating Guidelines

These instructions are permanent. Every agent working in this repository must read and adhere to them before performing work.

---

## 1. Core Operating Principles

1. **Inspect Before Action**: Always check this file (`AGENTS.md`) when starting work.
2. **Context Files as Index**:
   - Read [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) to understand the current verified architecture, tech stack, and component structure.
   - Read [`TASK_LOG.md`](./TASK_LOG.md) to determine the last completed task, test verification status, and current progress.
3. **Verify Against Code**: Never make assumptions based on stale notes or training data. Always verify facts (endpoints, models, parameters, environment variables) directly in the source code before editing.
4. **Preserve Working Architecture**:
   - **Frontend**: React 18, JavaScript, Vite, Tailwind CSS (dark neutral `#141414` palette).
   - **Backend**: Python 3.12, FastAPI, SQLAlchemy 2.0 (async SQLite `test_docrag.db` in dev, PostgreSQL/pgvector compatible).
   - **AI Provider**: Groq Cloud (`openai/gpt-oss-120b`). Preserved entirely.
   - **Embeddings**: Local FastEmbed (`BAAI/bge-small-en-v1.5`, 384-dimension vectors).
   - **Core Workflows**: Grounded citations, document extraction, background Celery processing, PDF export, conversation pinning, archiving, searching, find in chat, speech-to-text, secure conversation sharing, and original file downloads.
5. **No AI Switching or Destructive Rewrites**: Never change the AI provider, replace working models, or rewrite working modules from scratch without explicit user approval.
6. **Minimal, Focused Changes**: Keep diffs minimal and purposeful. Avoid editing unrelated components or formatting unaffected files.
7. **Propose Before Editing**: Clearly state the files to change and provide a brief implementation plan before modifying code.
8. **Verify All Changes**:
   - Run backend tests: `PYTHONPATH=backend .venv/bin/pytest backend/tests`
   - Run frontend tests: `npm test --prefix frontend -- --run`
   - Run frontend production build: `npm run build --prefix frontend`
9. **Update Documentation Post-Task**: Keep [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) and [`TASK_LOG.md`](./TASK_LOG.md) updated with verified progress and changes after each milestone.
10. **Strict Documentation Hygiene**:
    - Keep documentation concise and structured.
    - Never dump full source code files or large CLI output into context.
    - **Zero Secrets**: Never print, record, or commit API keys, tokens, or credentials.
