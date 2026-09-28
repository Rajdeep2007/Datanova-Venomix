"""WebSocket endpoint for real-time analysis progress streaming."""

from __future__ import annotations

import asyncio
import json
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services import session_store, stats_engine
from app.services.job_store import create_job, update_job, report_progress
from app.services.llm_pipeline import run_analysis_pipeline

router = APIRouter()


class ConnectionManager:
    """Manages active WebSocket connections."""

    def __init__(self):
        self.active: dict[str, WebSocket] = {}

    async def connect(self, session_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active[session_id] = websocket

    def disconnect(self, session_id: str):
        self.active.pop(session_id, None)

    async def send_progress(self, session_id: str, data: dict):
        ws = self.active.get(session_id)
        if ws:
            try:
                await ws.send_json(data)
            except Exception:
                self.disconnect(session_id)


manager = ConnectionManager()


@router.websocket("/ws/analyze/{session_id}")
async def websocket_analyze(websocket: WebSocket, session_id: str):
    """Stream real-time analysis progress over WebSocket."""
    await manager.connect(session_id, websocket)

    try:
        # Wait for the start message
        data = await websocket.receive_json()
        target_column = data.get("target_column")
        target_purpose = data.get("target_purpose")

        df = session_store.get_session(session_id)
        if df is None:
            await websocket.send_json({"type": "error", "message": "Session not found"})
            return

        # Create a job for tracking
        job_id = create_job(session_id, target_column, target_purpose)

        async def progress_callback(pct: int, message: str):
            report_progress(job_id, pct, message)
            await manager.send_progress(session_id, {
                "type": "progress",
                "progress_pct": pct,
                "message": message,
                "job_id": job_id,
            })

        # Run the pipeline
        await manager.send_progress(session_id, {
            "type": "started",
            "job_id": job_id,
            "message": "Analysis started...",
        })

        diagnosis = stats_engine.full_diagnosis(df)

        result = await run_analysis_pipeline(
            df, diagnosis,
            target_column=target_column,
            target_purpose=target_purpose,
            progress_callback=progress_callback,
        )

        # Send final result
        response_data = {
            "semantic_types": result.get("semantic_types", []),
            "recommendations": result.get("recommendations", []),
            "target_analysis": result.get("target_analysis"),
            "warnings": result.get("warnings", []),
        }

        update_job(job_id, status="completed", progress_pct=100, message="Complete!", result=response_data)

        await manager.send_progress(session_id, {
            "type": "completed",
            "job_id": job_id,
            "progress_pct": 100,
            "message": "Analysis complete!",
            "result": response_data,
        })

    except WebSocketDisconnect:
        manager.disconnect(session_id)
    except Exception as e:
        await manager.send_progress(session_id, {
            "type": "error",
            "message": str(e),
        })
        manager.disconnect(session_id)
