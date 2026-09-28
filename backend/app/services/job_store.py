"""Thread-safe in-memory job store for async analysis runs.

Jobs live only for the lifetime of the backend process (like canvas/session
caches). A job carries progress percentages + human-readable stage messages so
the frontend can render a live progress bar while Gemini works.
"""

from __future__ import annotations

import time
import uuid
from typing import Any

# Single-process asyncio app: all mutations happen on the one event loop, and
# each dict read/write is atomic, so no explicit locking is required.
_jobs: dict[str, dict[str, Any]] = {}


def create_job(session_id: str, target_column: str | None, target_purpose: str | None) -> str:
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {
        "job_id": job_id,
        "session_id": session_id,
        "target_column": target_column,
        "target_purpose": target_purpose,
        "status": "queued",
        "progress_pct": 0,
        "message": "Queued…",
        "result": None,
        "error": None,
        "created_at": time.time(),
        "updated_at": time.time(),
    }
    return job_id


def update_job(job_id: str, **changes: Any) -> None:
    job = _jobs.get(job_id)
    if job is None:
        return
    job.update(changes)
    job["updated_at"] = time.time()


def get_job(job_id: str) -> dict[str, Any] | None:
    job = _jobs.get(job_id)
    if job is None:
        return None
    return dict(job)


def report_progress(job_id: str, pct: int, message: str) -> None:
    """Plain (non-async) callback suitable for pipeline progress reporting."""
    pct = max(0, min(100, int(pct)))
    update_job(job_id, status="processing", progress_pct=pct, message=message)
