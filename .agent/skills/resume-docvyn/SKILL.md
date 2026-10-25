---
name: resume-docvyn
description: Resumes work on the docvyn codebase by reading AGENTS.md, TASK_LOG.md, and PROJECT_CONTEXT.md, checking recent changes, and verifying target files without rediscovering unrelated parts of the repository.
---

# Resume docvyn Workflow

Use this skill whenever resuming work on the `docvyn` project or starting a new session. Follow these exact steps in sequence:

## Execution Steps

1. **Read Core Operating Instructions**:
   - Read [`AGENTS.md`](file:///home/vakildesk/Documents/docrag/AGENTS.md) at the repository root to load operational rules, constraints, and verification requirements.

2. **Check Recent Progress & Status**:
   - Read [`TASK_LOG.md`](file:///home/vakildesk/Documents/docrag/TASK_LOG.md) to inspect the last completed task, test status, and the recommended next action.

3. **Inspect Architecture & Context**:
   - Read [`PROJECT_CONTEXT.md`](file:///home/vakildesk/Documents/docrag/PROJECT_CONTEXT.md) to verify technology stack facts, database models, endpoints, and file responsibilities.

4. **Inspect Repository Working Tree**:
   - Check file status and recent modifications:
     ```bash
     ls -la
     find . -maxdepth 2 -type f -newer TASK_LOG.md 2>/dev/null
     ```

5. **Targeted File Verification**:
   - Identify only the specific files directly relevant to the user's requested task.
   - Read and inspect those specific files directly. Do not scan or dump the entire repository.

6. **Concise Context Summary**:
   - Provide the user with a compact, focused status summary highlighting only what is necessary to proceed with the immediate task.

7. **Proceed Decisively**:
   - If the next action is clear from the user's request and the task log, proceed directly with the implementation without asking trivial questions.
