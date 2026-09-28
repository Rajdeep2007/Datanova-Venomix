import logging
from typing import Any
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest, RandomForestClassifier, RandomForestRegressor
from sklearn.preprocessing import LabelEncoder
from pandas.api.types import is_numeric_dtype

logger = logging.getLogger(__name__)

def detect_multivariate_outliers(df: pd.DataFrame) -> list[int]:
    """
    Detect multivariate outliers across all numeric columns using Isolation Forest.
    Returns the row indices of the anomalous rows.
    """
    try:
        # Select numeric columns
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        
        # If < 2 numeric columns or < 50 rows, return empty list
        if len(numeric_cols) < 2 or len(df) < 50:
            return []
            
        # Fill NaNs with median
        X = df[numeric_cols].copy()
        X = X.fillna(X.median())
        
        # Fit Isolation Forest (contamination=0.01 for top 1%)
        clf = IsolationForest(contamination=0.01, random_state=42)
        preds = clf.fit_predict(X)
        
        # IsolationForest returns -1 for anomalies, 1 for normal
        outlier_indices = np.where(preds == -1)[0].tolist()
        return outlier_indices
    except Exception as e:
        logger.warning(f"Failed to compute multivariate outliers: {e}")
        return []


def compute_feature_importance(df: pd.DataFrame, target_col: str) -> dict[str, float]:
    """
    Compute non-linear feature importance using Random Forest.
    Returns a dict mapping column names to their RF importance scores.
    """
    try:
        if target_col not in df.columns or len(df) < 10:
            return {}
            
        # Drop target from X
        X_raw = df.drop(columns=[target_col])
        y_raw = df[target_col]
        
        # Drop rows where target is missing
        valid_idx = y_raw.notna()
        X_raw = X_raw[valid_idx]
        y_raw = y_raw[valid_idx]
        
        if len(X_raw) == 0:
            return {}
            
        # Determine if classification or regression
        is_classification = not is_numeric_dtype(y_raw) or y_raw.nunique() <= 20
        
        # Select numeric and low-cardinality categorical columns
        selected_cols = []
        for col in X_raw.columns:
            if is_numeric_dtype(X_raw[col]):
                selected_cols.append(col)
            elif X_raw[col].nunique() <= 50: # Low cardinality
                selected_cols.append(col)
                
        if not selected_cols:
            return {}
            
        X = X_raw[selected_cols].copy()
        
        # Label encode categoricals and fill NaNs
        for col in X.columns:
            if not is_numeric_dtype(X[col]):
                X[col] = LabelEncoder().fit_transform(X[col].astype(str))
            X[col] = X[col].fillna(X[col].median() if not X[col].isna().all() else 0)
            
        # Fit Random Forest
        if is_classification:
            # Need to encode target if categorical
            if not is_numeric_dtype(y_raw):
                y = LabelEncoder().fit_transform(y_raw.astype(str))
            else:
                y = y_raw
            model = RandomForestClassifier(n_estimators=100, max_depth=5, random_state=42, n_jobs=-1)
        else:
            y = y_raw
            model = RandomForestRegressor(n_estimators=100, max_depth=5, random_state=42, n_jobs=-1)
            
        model.fit(X, y)
        
        # Extract importances
        importances = model.feature_importances_
        
        # Normalize just in case, though sklearn RF does it by default
        if importances.sum() > 0:
            importances = importances / importances.sum()
            
        result = {col: round(float(imp), 4) for col, imp in zip(X.columns, importances)}
        
        # Sort by importance descending
        return dict(sorted(result.items(), key=lambda item: item[1], reverse=True))
        
    except Exception as e:
        logger.warning(f"Failed to compute feature importance for {target_col}: {e}")
        return {}
