from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.schemas import ActionRequest, ActionResponse, ResetRequest, ResetResponse
from app.services import session_store, stats_engine
from app.services.executor import execute_action

router = APIRouter(tags=["Actions"])


@router.post("/apply-action", response_model=ActionResponse)
async def apply_action(request: ActionRequest):
    df = session_store.get_session(request.session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")

    if request.action.value != "drop_column" and request.column not in df.columns:
        raise HTTPException(
            status_code=400,
            detail=f"Column '{request.column}' not found in dataset",
        )
    if request.action.value == "drop_column" and request.column not in df.columns:
        raise HTTPException(
            status_code=400,
            detail=f"Column '{request.column}' not found in dataset",
        )

    # Validate that numeric actions are only applied to numeric columns
    numeric_actions = ["impute_median", "clip_outliers", "log_transform"]
    if request.action.value in numeric_actions:
        import pandas as pd
        if not pd.api.types.is_numeric_dtype(df[request.column]):
            raise HTTPException(
                status_code=400,
                detail=f"Action '{request.action.value}' cannot be applied to non-numeric column '{request.column}'."
            )

    modified_df, before_stats, after_stats = execute_action(
        df, request.column, request.action
    )
    session_store.update_session(request.session_id, modified_df)
    
    session_store.log_action(
        session_id=request.session_id,
        column=request.column,
        action=request.action.value,
        justification=request.justification,
        before=before_stats,
        after=after_stats
    )

    from app.services import stats_engine
    full_diagnosis = stats_engine.full_diagnosis(modified_df)

    return ActionResponse(
        success=True,
        column=request.column,
        action=request.action.value,
        before=before_stats,
        after=after_stats,
        full_diagnosis=full_diagnosis,
    )

@router.post("/reset-session", response_model=ResetResponse)
async def reset_session(request: ResetRequest):
    if not session_store.reset_session(request.session_id):
        raise HTTPException(status_code=404, detail="Session not found or no raw data available")
    
    df = session_store.get_session(request.session_id)
    from app.services import stats_engine
    full_diagnosis = stats_engine.full_diagnosis(df)

    return ResetResponse(
        success=True,
        full_diagnosis=full_diagnosis
    )


@router.get("/session/{session_id}/recovery-data")
async def get_recovery_data(session_id: str):
    """Compare raw (before) vs current (after) data for the recovery dashboard."""
    raw_df = session_store.get_raw_session(session_id)
    current_df = session_store.get_session(session_id)
    if raw_df is None or current_df is None:
        raise HTTPException(status_code=404, detail="Session not found")

    raw_diag = stats_engine.full_diagnosis(raw_df)
    current_diag = stats_engine.full_diagnosis(current_df)

    raw_quality = raw_diag.get("quality", {})
    current_quality = current_diag.get("quality", {})

    def count_issues(diag):
        missing = len([m for m in diag.get("missingness", []) if m.get("missing_pct", 0) > 0])
        outliers = len([o for o in diag.get("outliers", []) if o.get("outlier_count", 0) > 0])
        dup_rows = diag.get("duplicate_rows", {}).get("duplicate_row_count", 0)
        return {
            "quality_score": raw_quality.get("overall_score", 0) if diag is raw_diag else current_quality.get("overall_score", 0),
            "quality_grade": raw_quality.get("overall_grade", "F") if diag is raw_diag else current_quality.get("overall_grade", "F"),
            "missing_columns": missing,
            "outlier_columns": outliers,
            "duplicate_rows": dup_rows,
            "total_issues": missing + outliers + (1 if dup_rows > 0 else 0),
        }

    return {
        "before": count_issues(raw_diag),
        "after": count_issues(current_diag),
        "actions_applied": len(session_store.get_summary(session_id).get("actions_applied", [])),
        "session_id": session_id,
    }
