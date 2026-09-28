"""Storytelling, Chat, Simulator, and Export routers -- the killer features."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services import session_store, stats_engine
from app.services.storytelling import generate_data_story, generate_column_narrative, generate_cleaning_plan
from app.services.chat_engine import chat_about_data, generate_insights
from app.services.simulator import simulate_strategy, simulate_single_action, generate_strategy_suggestions
from app.services.notebook_export import export_as_python_script, export_as_jupyter_notebook, export_as_sql

router = APIRouter(tags=["Advanced Features"])


# ── Request/Response Models ─────────────────────────────────────────────────
class StoryRequest(BaseModel):
    session_id: str
    target_column: str | None = None


class ChatRequest(BaseModel):
    session_id: str
    question: str
    conversation_history: list[dict] | None = None


class ColumnNarrativeRequest(BaseModel):
    session_id: str
    column: str


class SimulateRequest(BaseModel):
    session_id: str
    actions: list[dict[str, str]]


class SimulateSingleRequest(BaseModel):
    session_id: str
    column: str
    action: str


class ExportRequest(BaseModel):
    session_id: str
    actions: list[dict[str, str]]
    format: str = "python"  # python, notebook, sql


class CleaningPlanRequest(BaseModel):
    session_id: str
    recommendations: list[dict]


# ── Storytelling ────────────────────────────────────────────────────────────
@router.post("/story")
async def get_data_story(request: StoryRequest):
    """Generate an AI data story about the dataset."""
    df = session_store.get_session(request.session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")

    diagnosis = stats_engine.full_diagnosis(df)
    # Use cached analysis if available
    story = await generate_data_story(
        diagnosis,
        semantic_types=[],
        recommendations=[],
        target_column=request.target_column,
    )
    return story


@router.post("/column-narrative")
async def get_column_narrative(request: ColumnNarrativeRequest):
    """Generate a narrative for a specific column."""
    df = session_store.get_session(request.session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if request.column not in df.columns:
        raise HTTPException(status_code=400, detail=f"Column '{request.column}' not found")

    col_data = df[request.column]
    column_stats = {
        "dtype": str(col_data.dtype),
        "missing_pct": round(float(col_data.isna().mean() * 100), 1),
        "unique_count": int(col_data.nunique()),
    }
    if hasattr(col_data, "describe"):
        desc = col_data.describe()
        column_stats["mean"] = round(float(desc.get("mean", 0)), 2)
        column_stats["std"] = round(float(desc.get("std", 0)), 2)

    narrative = await generate_column_narrative(
        request.column, column_stats, "unknown"
    )
    return {"column": request.column, "narrative": narrative}


@router.post("/cleaning-plan")
async def get_cleaning_plan(request: CleaningPlanRequest):
    """Generate an ordered cleaning plan."""
    df = session_store.get_session(request.session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")

    diagnosis = stats_engine.full_diagnosis(df)
    plan = await generate_cleaning_plan(request.recommendations, diagnosis)
    return plan


# ── Chat ────────────────────────────────────────────────────────────────────
@router.post("/chat")
async def chat_with_data(request: ChatRequest):
    """Ask a natural language question about the dataset."""
    result = await chat_about_data(
        request.session_id,
        request.question,
        request.conversation_history,
    )
    return result


@router.get("/insights/{session_id}")
async def get_auto_insights(session_id: str):
    """Auto-generate key insights about the dataset."""
    result = await generate_insights(session_id)
    return result


# ── Simulator ───────────────────────────────────────────────────────────────
@router.post("/simulate")
async def simulate_cleaning(request: SimulateRequest):
    """Simulate multiple cleaning actions and preview the result."""
    result = simulate_strategy(request.session_id, request.actions)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/simulate-single")
async def simulate_single(request: SimulateSingleRequest):
    """Simulate a single cleaning action with distribution preview."""
    result = simulate_single_action(request.session_id, request.column, request.action)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/strategy-suggestions/{session_id}")
async def get_strategy_suggestions(session_id: str):
    """Auto-generate cleaning strategy suggestions."""
    df = session_store.get_session(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")

    diagnosis = stats_engine.full_diagnosis(df)
    suggestions = generate_strategy_suggestions(session_id, diagnosis, [])
    return {"suggestions": suggestions}


# ── Export ──────────────────────────────────────────────────────────────────
@router.post("/export/code")
async def export_cleaning_code(request: ExportRequest):
    """Export the cleaning pipeline as code."""
    if request.format == "python":
        code = export_as_python_script(request.session_id, request.actions)
        return {"code": code, "format": "python", "filename": "cleaning_pipeline.py"}
    elif request.format == "notebook":
        notebook = export_as_jupyter_notebook(request.session_id, request.actions)
        return {"notebook": notebook, "format": "notebook", "filename": "cleaning_pipeline.ipynb"}
    elif request.format == "sql":
        sql = export_as_sql(request.session_id, request.actions)
        return {"code": sql, "format": "sql", "filename": "cleaning_pipeline.sql"}
    else:
        raise HTTPException(status_code=400, detail=f"Unknown format: {request.format}")
