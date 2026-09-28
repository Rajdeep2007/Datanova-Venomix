from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, HTTPException

from app.models.schemas import AnalyzeRequest, JobResponse
from app.services import job_store, session_store, stats_engine
from app.services.llm_pipeline import run_analysis_pipeline

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Analyze"])


async def _run_analysis_job(job_id: str, session_id: str, target_column: str | None, target_purpose: str | None) -> None:
    """Background worker: diagnose -> classify -> reason, updating the job store."""
    try:
        job_store.update_job(job_id, status="processing", progress_pct=5, message="Loading dataset…")
        df = session_store.get_session(session_id)
        if df is None:
            job_store.update_job(job_id, status="failed", error="Session not found or expired.")
            return

        job_store.update_job(job_id, progress_pct=8, message="Running data diagnosis…")
        diagnosis = stats_engine.full_diagnosis(df)

        def progress(pct: int, message: str) -> None:
            job_store.report_progress(job_id, pct, message)

        result = await run_analysis_pipeline(
            df,
            diagnosis,
            target_column=target_column,
            target_purpose=target_purpose,
            progress_callback=progress,
        )

        job_store.update_job(
            job_id,
            status="succeeded",
            progress_pct=100,
            message="Analysis complete.",
            result=result,
        )
    except Exception as exc:  # defensive — never leave a job hanging
        logger.exception("Analysis job %s failed", job_id)
        job_store.update_job(job_id, status="failed", error=str(exc))


@router.post("/analyze", response_model=JobResponse, status_code=202)
async def start_analysis(request: AnalyzeRequest):
    """Start analysis as a background job. Poll ``GET /jobs/{job_id}`` for progress."""
    df = session_store.get_session(request.session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")

    job_id = job_store.create_job(request.session_id, request.target_column, request.target_purpose)
    asyncio.get_running_loop().create_task(
        _run_analysis_job(job_id, request.session_id, request.target_column, request.target_purpose)
    )
    job = job_store.get_job(job_id)
    return JobResponse(**job)


@router.get("/jobs/{job_id}", response_model=JobResponse)
async def get_job(job_id: str):
    job = job_store.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobResponse(**job)
