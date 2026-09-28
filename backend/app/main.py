from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load environment variables early (side-effect import)
import app.core.config  # noqa: F401

from app.routers import actions, analyze, advanced, canvas, export, preview, recipes, upload, ws

app = FastAPI(title="DataNova AI", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001", "http://127.0.0.1:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router)
app.include_router(analyze.router)
app.include_router(actions.router)
app.include_router(export.router)
app.include_router(canvas.router)
app.include_router(preview.router)
app.include_router(recipes.router)
app.include_router(advanced.router)
app.include_router(ws.router)


@app.get("/")
def health_check():
    return {"status": "ok"}
