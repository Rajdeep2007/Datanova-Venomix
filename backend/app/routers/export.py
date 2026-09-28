from __future__ import annotations

import io

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.services import session_store

from app.models.schemas import SummaryResponse

router = APIRouter(tags=["Export"])

@router.get("/session/{session_id}/summary", response_model=SummaryResponse)
async def get_summary(session_id: str):
    summary = session_store.get_summary(session_id)
    if not summary:
        raise HTTPException(status_code=404, detail="Session not found")
    return summary


@router.get("/export/{session_id}")
async def export_data(session_id: str):
    df = session_store.get_session(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")

    buffer = io.StringIO()
    df.to_csv(buffer, index=False)
    buffer.seek(0)

    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=cleaned_data.csv",
        },
    )
