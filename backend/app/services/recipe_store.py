"""JSON-file-backed cleaning-recipe store.

A recipe captures the ordered list of cleaning actions applied to a session so
it can be replayed on a new dataset. Recipes survive backend restarts (unlike
sessions) and live under ``.cache/recipes/``.
"""

from __future__ import annotations

import json
import time
import uuid
from pathlib import Path
from typing import Any

import pandas as pd

from app.services import session_store

CACHE_DIR = Path(".cache/recipes")
CACHE_DIR.mkdir(parents=True, exist_ok=True)


def _recipe_path(recipe_id: str) -> Path:
    return CACHE_DIR / f"{recipe_id}.json"


def save_recipe(session_id: str, name: str, description: str = "") -> dict[str, Any]:
    """Capture the current session's action history as a reusable recipe."""
    summary = session_store.get_summary(session_id)
    actions = summary.get("actions_applied", [])
    if not actions:
        raise ValueError("No cleaning actions have been applied to this session yet.")

    raw_df = session_store.get_raw_session(session_id)
    source_columns = list(raw_df.columns) if raw_df is not None else []
    source_shape = summary.get("original_shape", {"rows": 0, "columns": 0})

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    recipe_id = str(uuid.uuid4())
    recipe = {
        "id": recipe_id,
        "name": name.strip() or f"Recipe {time.strftime('%Y-%m-%d %H:%M')}",
        "description": description.strip(),
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "source_shape": source_shape,
        "source_columns": source_columns,
        "actions": [
            {
                "column": a["column"],
                "action": a["action"],
                "justification": a.get("justification", ""),
            }
            for a in actions
        ],
    }
    with open(_recipe_path(recipe_id), "w", encoding="utf-8") as f:
        json.dump(recipe, f, indent=2)
    return recipe


def list_recipes() -> list[dict[str, Any]]:
    recipes = []
    for path in sorted(CACHE_DIR.glob("*.json")):
        try:
            with open(path, encoding="utf-8") as f:
                recipe = json.load(f)
            recipes.append(recipe)
        except Exception:
            continue
    recipes.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    return recipes


def get_recipe(recipe_id: str) -> dict[str, Any] | None:
    path = _recipe_path(recipe_id)
    if not path.exists():
        return None
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def delete_recipe(recipe_id: str) -> bool:
    path = _recipe_path(recipe_id)
    if path.exists():
        path.unlink()
        return True
    return False
