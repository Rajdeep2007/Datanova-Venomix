import pandas as pd
from pathlib import Path

# Create cache directory
CACHE_DIR = Path(".cache/canvas")
CACHE_DIR.mkdir(parents=True, exist_ok=True)

def _get_df_path(node_output_id: str) -> Path:
    return CACHE_DIR / f"{node_output_id}.pkl"

def get_output(node_output_id: str) -> pd.DataFrame | None:
    p = _get_df_path(node_output_id)
    if p.exists():
        try:
            return pd.read_pickle(p)
        except Exception:
            return None
    return None

def set_output(node_output_id: str, df: pd.DataFrame) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    df.to_pickle(_get_df_path(node_output_id))

def delete_output(node_output_id: str) -> None:
    p = _get_df_path(node_output_id)
    if p.exists():
        p.unlink()
