from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import PreviewResponse
from app.services import session_store

router = APIRouter(tags=["Preview"])

MAX_ROWS = 500


@router.get("/preview/{session_id}", response_model=PreviewResponse)
async def preview_rows(
    session_id: str,
    limit: int = Query(200, ge=1, le=MAX_ROWS),
):
    """Return the first *limit* rows as JSON records (NaN serialized as null)."""
    df = session_store.get_session(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")

    total_rows = len(df)
    truncated = total_rows > limit
    head = df.head(limit)

    # JSON-safe: NaN/NaT -> null, numpy scalars -> python scalars.
    # Timestamps are handled by FastAPI's jsonable_encoder (serialized as ISO).
    records = head.where(head.notna(), None).astype(object).to_dict(orient="records")
    clean_records = []
    for record in records:
        row = {}
        for key, value in record.items():
            if hasattr(value, "item"):
                try:
                    value = value.item()
                except (ValueError, AttributeError):
                    pass
            row[str(key)] = value
        clean_records.append(row)

    return PreviewResponse(
        columns=list(df.columns),
        rows=clean_records,
        total_rows=total_rows,
        truncated=truncated,
    )
