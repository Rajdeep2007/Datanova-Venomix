"""Async job management router."""
from __future__ import annotations

import asyncio

from fastapi import APIRouter, HTTPException

from app.models.schemas import AnalyzeRequest
from app.services import session_store, stats_engine
from app.services.job_store import create_job, get_job, update_job
from app.services.llm_pipeline import run_analysis_pipeline

router = APIRouter(tags=["Jobs"])


def _get_job_by_session(session_id: str) -> dict | None:
    """Find the most recent job for a session (brute scan since jobs are in-memory)."""
    from app.services.job_store import _jobs
    for job in reversed(list(_jobs.values())):
        if job.get("session_id") == session_id:
            return dict(job)
    return None


async def _run_job_background(job_id: str, session_id: str, target_column: str | None, target_purpose: str | None):
    """Background task that runs the full analysis pipeline with progress updates."""
    try:
        update_job(job_id, status="processing", progress_pct=10, message="Loading dataset...")
        df = session_store.get_session(session_id)
        if df is None:
            update_job(job_id, status="failed", error="Session not found")
            return

        update_job(job_id, progress_pct=20, message="Running diagnostics...")
        await asyncio.sleep(0.1)
        diagnosis = stats_engine.full_diagnosis(df)

        update_job(job_id, progress_pct=40, message="Classifying columns...")
        await asyncio.sleep(0.1)

        update_job(job_id, progress_pct=60, message="Escalating ambiguous columns to Gemini...")
        await asyncio.sleep(0.1)

        update_job(job_id, progress_pct=80, message="Generating AI recommendations...")
        result = await run_analysis_pipeline(
            df, diagnosis,
            target_column=target_column,
            target_purpose=target_purpose,
        )

        update_job(job_id, progress_pct=95, message="Finalizing results...")
        await asyncio.sleep(0.1)

        errors = result.get("errors", [])
        from app.services.llm_pipeline import _check_flagged
        has_flagged = _check_flagged(diagnosis)

        if errors and ((has_flagged and not result.get("recommendations")) or not result.get("semantic_types")):
            error_msg = errors[-1]
            if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
                update_job(job_id, status="failed", error="Gemini API rate limit exceeded. Please wait and retry.")
            else:
                update_job(job_id, status="failed", error=f"AI Analysis failed: {error_msg}")
            return

        response_data = {
            "semantic_types": result.get("semantic_types", []),
            "recommendations": result.get("recommendations", []),
            "target_analysis": result.get("target_analysis"),
        }
        update_job(job_id, status="completed", progress_pct=100, message="Analysis complete!", result=response_data)

    except Exception as exc:
        update_job(job_id, status="failed", error=str(exc))


@router.post("/jobs")
async def start_analysis_job(request: AnalyzeRequest):
    """Start an async analysis job. Returns immediately with a job_id."""
    df = session_store.get_session(request.session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")

    job_id = create_job(
        session_id=request.session_id,
        target_column=request.target_column,
        target_purpose=request.target_purpose,
    )

    asyncio.create_task(
        _run_job_background(
            job_id,
            request.session_id,
            request.target_column,
            request.target_purpose,
        )
    )

    return {"job_id": job_id, "status": "processing"}


@router.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
    """Poll job status and get results when complete."""
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/jobs/session/{session_id}")
async def get_job_by_session(session_id: str):
    """Get the latest job for a session."""
    job = _get_job_by_session(session_id)
    if job is None:
        raise HTTPException(status_code=404, detail="No job found for this session")
    return job
