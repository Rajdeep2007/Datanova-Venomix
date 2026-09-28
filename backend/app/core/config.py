from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from the backend root (two levels up from this file)
_env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(dotenv_path=_env_path)

# ── Gemini API ────────────────────────────────────────────────────────────────
# GOOGLE_API_KEY is optional. When empty, the pipeline runs entirely in local
# mode (deterministic classifier + heuristic recommendations) so the demo never
# hard-fails without a key.
GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "").strip()

# Single source of truth for the primary model name. All other references
# (REST client, prompts, docs) derive from these constants.
DEFAULT_MODEL_NAME = "gemini-3.6-flash"
MODEL_NAME: str = (os.getenv("MODEL_NAME", "") or DEFAULT_MODEL_NAME).strip()

# Optional comma-separated fallback models, e.g. "gemini-2.5-pro,gemini-2.0-flash"
_raw_fallbacks = os.getenv("FALLBACK_MODEL_NAMES", "")
FALLBACK_MODEL_NAMES: list[str] = [
    m.strip() for m in _raw_fallbacks.split(",") if m.strip()
]

# ── Confidence threshold override (optional; default comes from JSON file) ──
CONFIDENCE_THRESHOLD_OVERRIDE: str | None = os.getenv("CONFIDENCE_THRESHOLD", "") or None

# ── Feature flag: force local-only mode (no LLM calls) even with a key ──────
LOCAL_ONLY: bool = os.getenv("LOCAL_ONLY", "").strip().lower() in ("1", "true", "yes", "on")
