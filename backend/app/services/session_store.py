import pandas as pd
import json
import os
from pathlib import Path

# Create cache directory
CACHE_DIR = Path(".cache/sessions")
CACHE_DIR.mkdir(parents=True, exist_ok=True)

def _get_df_path(session_id: str, suffix: str = "") -> Path:
    return CACHE_DIR / f"{session_id}{suffix}.pkl"

def _get_meta_path(session_id: str) -> Path:
    return CACHE_DIR / f"{session_id}_meta.json"

def _save_meta(session_id: str, history: list, shape: dict):
    _ensure_cache_dir()
    with open(_get_meta_path(session_id), "w") as f:
        json.dump({"action_history": history, "original_shape": shape}, f)

def _load_meta(session_id: str) -> tuple[list, dict]:
    meta_path = _get_meta_path(session_id)
    if meta_path.exists():
        try:
            with open(meta_path, "r") as f:
                data = json.load(f)
                return data.get("action_history", []), data.get("original_shape", {"rows": 0, "columns": 0})
        except Exception:
            pass
    return [], {"rows": 0, "columns": 0}


def _ensure_cache_dir() -> None:
    """Recreate the cache directory if it was deleted while the process ran."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)


def create_session(session_id: str, df: pd.DataFrame) -> None:
    _ensure_cache_dir()
    df.to_pickle(_get_df_path(session_id))
    df.to_pickle(_get_df_path(session_id, "_raw"))
    _save_meta(session_id, [], {"rows": len(df), "columns": len(df.columns)})

def get_session(session_id: str) -> pd.DataFrame | None:
    p = _get_df_path(session_id)
    if p.exists():
        try:
            return pd.read_pickle(p)
        except Exception:
            return None
    return None

def get_raw_session(session_id: str) -> pd.DataFrame | None:
    """Return the pristine (pre-cleaning) dataframe for a session, if cached."""
    p = _get_df_path(session_id, "_raw")
    if p.exists():
        try:
            return pd.read_pickle(p)
        except Exception:
            return None
    return None

def update_session(session_id: str, df: pd.DataFrame) -> None:
    _ensure_cache_dir()
    df.to_pickle(_get_df_path(session_id))

def delete_session(session_id: str) -> None:
    for p in [_get_df_path(session_id), _get_df_path(session_id, "_raw"), _get_meta_path(session_id)]:
        if p.exists():
            p.unlink()

def reset_session(session_id: str) -> bool:
    raw_path = _get_df_path(session_id, "_raw")
    if raw_path.exists():
        try:
            df = pd.read_pickle(raw_path)
            _ensure_cache_dir()
            df.to_pickle(_get_df_path(session_id))
            _, shape = _load_meta(session_id)
            _save_meta(session_id, [], shape)
            return True
        except Exception:
            pass
    return False

def log_action(session_id: str, column: str, action: str, justification: str, before: dict, after: dict) -> None:
    history, shape = _load_meta(session_id)
    history.append({
        "column": column,
        "action": action,
        "justification": justification,
        "before": before,
        "after": after
    })
    _save_meta(session_id, history, shape)

def get_summary(session_id: str) -> dict:
    df = get_session(session_id)
    if df is None:
        return {}
    
    history, shape = _load_meta(session_id)
    return {
        "original_shape": shape,
        "final_shape": {"rows": len(df), "columns": len(df.columns)},
        "actions_applied": history,
        "export_ready": True
    }
