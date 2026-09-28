from __future__ import annotations

import numpy as np
import pandas as pd
from typing import Any
from sklearn.feature_selection import mutual_info_classif, mutual_info_regression
from app.services.dataset_models import compute_feature_importance


def _get_semantic_type(col: str, semantic_types: list[dict]) -> str | None:
    for st in semantic_types:
        if st["column"] == col:
            return st["semantic_type"]
    return None


def _is_identifier(col: str, semantic_types: list[dict]) -> bool:
    for st in semantic_types:
        if st["column"] == col:
            return st.get("is_identifier", False) or st["semantic_type"] in ("id", "zip_code")
    return False


def _safe_mutual_info(X: pd.DataFrame, y: pd.Series, is_classification: bool, discrete_features: list[bool]) -> np.ndarray:
    """Computes mutual info safely by filling NaNs and handling non-numeric data."""
    # MI doesn't support NaNs. We fill them temporarily just for this calculation.
    # Numeric features get median, categorical get a generic string.
    X_filled = X.copy()
    for col, is_discrete in zip(X.columns, discrete_features):
        if is_discrete:
            X_filled[col] = X_filled[col].fillna("Missing_MI").astype(str)
            # sklearn MI needs numeric codes for categorical data
            X_filled[col] = pd.factorize(X_filled[col])[0]
        else:
            med = X_filled[col].median()
            med = med if not pd.isna(med) else 0.0
            X_filled[col] = pd.to_numeric(X_filled[col], errors='coerce').fillna(med)

    y_filled = y.copy()
    if is_classification:
        y_filled = y_filled.fillna("Missing_MI").astype(str)
        y_filled = pd.factorize(y_filled)[0]
    else:
        med = y_filled.median()
        med = med if not pd.isna(med) else 0.0
        y_filled = pd.to_numeric(y_filled, errors='coerce').fillna(med)

    # Ensure everything is numeric arrays
    X_arr = np.asarray(X_filled)
    y_arr = np.asarray(y_filled)
    
    if is_classification:
        return mutual_info_classif(X_arr, y_arr, discrete_features=discrete_features, random_state=42)
    else:
        return mutual_info_regression(X_arr, y_arr, discrete_features=discrete_features, random_state=42)


def run_target_checks(df: pd.DataFrame, target_column: str, semantic_types: list[dict]) -> dict[str, Any]:
    if target_column not in df.columns:
        return {}

    target_series = df[target_column]
    target_st = _get_semantic_type(target_column, semantic_types)
    
    # 2a. Determine problem type
    # Use semantic_type, treating numeric_continuous + >20 uniques as regression
    is_numeric_semantic = target_st in ("numeric_continuous", "currency")
    unique_count = target_series.nunique(dropna=True)
    
    if is_numeric_semantic and unique_count > 20:
        problem_type = "regression"
    else:
        problem_type = "classification"

    class_balance = None
    # 2c. Class Imbalance (Classification only)
    if problem_type == "classification":
        counts = target_series.value_counts(normalize=True, dropna=True)
        if len(counts) > 0:
            min_class = counts.idxmin()
            min_pct = float(counts.min() * 100)
            class_balance = {
                "class_counts_pct": {str(k): round(float(v * 100), 2) for k, v in counts.items()},
                "is_imbalanced": min_pct < 10.0,
                "minority_class": str(min_class)
            }

    # Prepare features for 2b and 2d
    features = [c for c in df.columns if c != target_column and not _is_identifier(c, semantic_types)]
    if not features:
        return {
            "problem_type": problem_type,
            "target_column": target_column,
            "leakage_flags": [],
            "class_balance": class_balance,
            "feature_relevance": []
        }

    # Determine discrete vs continuous for all features
    discrete_mask = []
    for f in features:
        st = _get_semantic_type(f, semantic_types)
        # Anything not strictly continuous is treated as discrete for MI
        is_discrete = st not in ("numeric_continuous", "currency")
        discrete_mask.append(is_discrete)

    # 2b & 2d. Compute correlations / Mutual Information / RF Importance
    leakage_flags = []
    feature_relevance = []
    
    mi_scores = _safe_mutual_info(df[features], df[target_column], problem_type == "classification", discrete_mask)
    rf_importances = compute_feature_importance(df, target_column)
    
    # Sort features by MI to find top 5% threshold for leakage
    sorted_mi = sorted(mi_scores, reverse=True)
    top_5_idx = max(0, int(len(sorted_mi) * 0.05) - 1)
    mi_threshold = sorted_mi[top_5_idx] if sorted_mi else float('inf')
    
    for i, col in enumerate(features):
        st = _get_semantic_type(col, semantic_types) or "unknown"
        mi_score = float(mi_scores[i])
        
        # Relevance entry
        feature_relevance.append({
            "column": col,
            "score": round(mi_score, 4),
            "rf_importance": rf_importances.get(col, 0.0),
            "semantic_type": st
        })
        
        # Leakage check
        is_discrete = discrete_mask[i]
        leakage_reason = None
        
        if not is_discrete and problem_type == "regression":
            # Both numeric -> check Pearson
            s1 = pd.to_numeric(df[col], errors='coerce')
            s2 = pd.to_numeric(df[target_column], errors='coerce')
            mask = s1.notna() & s2.notna()
            if mask.sum() > 2:
                r = np.corrcoef(s1[mask], s2[mask])[0, 1]
                if abs(r) > 0.95:
                    leakage_reason = f"Highly correlated with target (r = {r:.3f})"
        
        # If not flagged by Pearson, check top 5% MI
        if not leakage_reason and mi_score >= mi_threshold and mi_score > 0.1: # base threshold
            leakage_reason = f"Very high mutual information score ({mi_score:.3f})"
            
        if leakage_reason:
            leakage_flags.append({
                "column": col,
                "score": round(mi_score, 4),
                "reason": leakage_reason
            })

    # Sort relevance descending
    feature_relevance.sort(key=lambda x: x["score"], reverse=True)

    return {
        "problem_type": problem_type,
        "target_column": target_column,
        "leakage_flags": leakage_flags,
        "class_balance": class_balance,
        "feature_relevance": feature_relevance
    }
