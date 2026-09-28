"""What-If Strategy Simulator -- preview cleaning results before applying."""

from __future__ import annotations

import copy
from typing import Any

import numpy as np
import pandas as pd

from app.services import session_store, stats_engine
from app.services.executor import execute_action
from app.models.enums import RecommendedAction


def simulate_strategy(
    session_id: str,
    actions: list[dict[str, str]],
) -> dict[str, Any]:
    """Simulate applying multiple cleaning actions and preview the result.

    Actions: [{"column": "col", "action": "impute_median"}, ...]
    Returns before/after comparison without modifying the actual session.
    """
    df = session_store.get_session(session_id)
    if df is None:
        return {"error": "Session not found"}

    # Work on a copy
    df_before = df.copy()
    df_after = df.copy()

    before_diagnosis = stats_engine.full_diagnosis(df_before)

    applied = []
    errors = []
    for action_spec in actions:
        col = action_spec.get("column", "")
        action_name = action_spec.get("action", "")

        if col not in df_after.columns:
            errors.append(f"Column '{col}' not found")
            continue

        try:
            action_enum = RecommendedAction(action_name)
            df_after, before_stats, after_stats = execute_action(df_after, col, action_enum)
            applied.append({
                "column": col,
                "action": action_name,
                "before": before_stats,
                "after": after_stats,
            })
        except (ValueError, KeyError) as e:
            errors.append(f"Failed to apply {action_name} to {col}: {e}")

    after_diagnosis = stats_engine.full_diagnosis(df_after)

    return {
        "applied": applied,
        "errors": errors,
        "before": _summarize_diagnosis(before_diagnosis),
        "after": _summarize_diagnosis(after_diagnosis),
        "quality_change": {
            "before": before_diagnosis.get("quality", {}).get("overall_score", 0),
            "after": after_diagnosis.get("quality", {}).get("overall_score", 0),
        },
        "shape_change": {
            "before": before_diagnosis.get("shape", {}),
            "after": after_diagnosis.get("shape", {}),
        },
        "missing_change": _compare_missingness(before_diagnosis, after_diagnosis),
        "outlier_change": _compare_outliers(before_diagnosis, after_diagnosis),
        "preview_rows": df_after.head(10).to_dict(orient="records"),
    }


def simulate_single_action(
    session_id: str,
    column: str,
    action: str,
) -> dict[str, Any]:
    """Simulate a single action and return detailed before/after."""
    df = session_store.get_session(session_id)
    if df is None:
        return {"error": "Session not found"}

    if column not in df.columns:
        return {"error": f"Column '{column}' not found"}

    df_sim = df.copy()
    try:
        action_enum = RecommendedAction(action)
        df_sim, before_stats, after_stats = execute_action(df_sim, column, action_enum)
    except (ValueError, KeyError) as e:
        return {"error": str(e)}

    # Generate distribution comparison for numeric columns
    distribution = None
    if pd.api.types.is_numeric_dtype(df[column]):
        distribution = {
            "before": _histogram_data(df[column].dropna()),
            "after": _histogram_data(df_sim[column].dropna()),
        }

    return {
        "column": column,
        "action": action,
        "before": before_stats,
        "after": after_stats,
        "distribution": distribution,
        "preview_before": df[[column]].head(20).to_dict(orient="records"),
        "preview_after": df_sim[[column]].head(20).to_dict(orient="records"),
    }


def generate_strategy_suggestions(
    session_id: str,
    diagnosis: dict,
    semantic_types: list[dict],
) -> list[dict[str, Any]]:
    """Auto-generate cleaning strategy suggestions based on diagnosis."""
    suggestions = []

    # Group recommendations by severity
    for rec in diagnosis.get("recommendations", []):
        severity = rec.get("severity", "medium")
        suggestions.append({
            "column": rec["column"],
            "action": rec["recommended_action"],
            "severity": severity,
            "justification": rec.get("justification", ""),
            "estimated_impact": _estimate_impact(severity),
            "auto_selectable": severity in ("high", "critical"),
        })

    # Add batch suggestions
    missing_cols = [m["column"] for m in diagnosis.get("missingness", []) if m.get("missing_pct", 0) > 20]
    if len(missing_cols) >= 3:
        suggestions.append({
            "column": "ALL_MISSING",
            "action": "batch_impute",
            "severity": "high",
            "justification": f"Batch impute {len(missing_cols)} columns with >20% missing data",
            "estimated_impact": "high",
            "auto_selectable": True,
            "affected_columns": missing_cols,
        })

    return sorted(suggestions, key=lambda s: {"critical": 0, "high": 1, "medium": 2, "low": 3}.get(s["severity"], 2))


def _summarize_diagnosis(diagnosis: dict) -> dict:
    quality = diagnosis.get("quality", {})
    return {
        "quality_score": quality.get("overall_score", 0),
        "quality_grade": quality.get("overall_grade", "F"),
        "missing_columns": len([m for m in diagnosis.get("missingness", []) if m.get("missing_pct", 0) > 0]),
        "outlier_columns": len([o for o in diagnosis.get("outliers", []) if o.get("outlier_count", 0) > 0]),
        "duplicate_rows": diagnosis.get("duplicate_rows", {}).get("duplicate_row_count", 0),
    }


def _compare_missingness(before: dict, after: dict) -> dict:
    b_missing = len([m for m in before.get("missingness", []) if m.get("missing_pct", 0) > 0])
    a_missing = len([m for m in after.get("missingness", []) if m.get("missing_pct", 0) > 0])
    return {"before": b_missing, "after": a_missing, "improved": a_missing < b_missing}


def _compare_outliers(before: dict, after: dict) -> dict:
    b_outliers = sum(o.get("outlier_count", 0) for o in before.get("outliers", []))
    a_outliers = sum(o.get("outlier_count", 0) for o in after.get("outliers", []))
    return {"before": b_outliers, "after": a_outliers, "improved": a_outliers < b_outliers}


def _estimate_impact(severity: str) -> str:
    return {"critical": "+15-20 pts", "high": "+8-15 pts", "medium": "+3-8 pts", "low": "+1-3 pts"}.get(severity, "+1-3 pts")


def _histogram_data(series: pd.Series, bins: int = 20) -> dict:
    """Generate histogram data for distribution comparison."""
    counts, edges = np.histogram(series, bins=bins)
    return {
        "counts": counts.tolist(),
        "edges": edges.tolist(),
        "mean": float(series.mean()),
        "median": float(series.median()),
    }
