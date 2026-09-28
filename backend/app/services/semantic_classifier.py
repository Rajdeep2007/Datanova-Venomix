"""Inference wrapper for the local semantic column-type classifier.

Loads the trained sklearn Pipeline once (module-level singleton) and exposes
a simple API for classifying a single pandas Series.

Zero runtime LLM dependency — all inference is local sklearn.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

from app.services.feature_extraction import extract_column_features

logger = logging.getLogger(__name__)

# ── Paths ───────────────────────────────────────────────────────────────────
_MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
_MODEL_PATH_RAW = _MODELS_DIR / "semantic_classifier.joblib"
_MODEL_PATH_CAL = _MODELS_DIR / "semantic_classifier_calibrated.joblib"
_FEATURES_PATH = _MODELS_DIR / "feature_columns.json"

# ── Confidence threshold ────────────────────────────────────────────────────
# Loaded from app/models/confidence_threshold.json (the single source of truth
# for routing decisions). Can be overridden via the CONFIDENCE_THRESHOLD env var.
_CONFIDENCE_FILE = _MODELS_DIR / "confidence_threshold.json"


def _load_confidence_threshold() -> float:
    env_override = None
    try:
        from app.core.config import CONFIDENCE_THRESHOLD_OVERRIDE

        env_override = CONFIDENCE_THRESHOLD_OVERRIDE
    except Exception:
        pass
    if env_override is not None:
        try:
            return float(env_override)
        except ValueError:
            logger.warning("Ignoring invalid CONFIDENCE_THRESHOLD env value: %s", env_override)
    if _CONFIDENCE_FILE.exists():
        try:
            with open(_CONFIDENCE_FILE, encoding="utf-8") as f:
                data = json.load(f)
                val = float(data.get("confidence_threshold", 0.85))
                logger.info("Loaded confidence threshold %.2f from %s", val, _CONFIDENCE_FILE.name)
                return val
        except Exception as exc:
            logger.warning("Failed to parse %s: %s", _CONFIDENCE_FILE.name, exc)
    return 0.85  # Raw model confidence threshold


_confidence_threshold = _load_confidence_threshold()

# ── Module-level singleton ──────────────────────────────────────────────────
_pipeline_raw = None
_pipeline_cal = None
_feature_columns: list[str] | None = None


class PreFitCV:
    """A custom CV iterator that returns the entire dataset as both train and test.
    Combined with FrozenEstimator, this forces CalibratedClassifierCV to skip
    cross-validation and simply train the calibrator on the exact data provided,
    simulating the deprecated cv='prefit' behavior in scikit-learn >= 1.6."""
    def split(self, X, y=None, groups=None):
        import numpy as np
        yield np.arange(len(X)), np.arange(len(X))
    def get_n_splits(self, X=None, y=None, groups=None):
        return 1


def load_classifier():
    """Load the trained model and feature column list. Cached as a singleton."""
    global _pipeline_raw, _pipeline_cal, _feature_columns

    if _pipeline_raw is not None and _pipeline_cal is not None:
        return  # already loaded

    if not _MODEL_PATH_RAW.exists() or not _MODEL_PATH_CAL.exists():
        raise FileNotFoundError(
            f"Trained models not found. "
            f"Run scripts/train_classifier.py first."
        )
    if not _FEATURES_PATH.exists():
        raise FileNotFoundError(
            f"Feature columns file not found at {_FEATURES_PATH}. "
            f"Run scripts/train_classifier.py first."
        )

    _pipeline_raw = joblib.load(_MODEL_PATH_RAW)
    _pipeline_cal = joblib.load(_MODEL_PATH_CAL)
    with open(_FEATURES_PATH) as f:
        _feature_columns = json.load(f)

    logger.info("Loaded semantic classifiers (raw and calibrated) (%d features)", len(_feature_columns))


def classify_column_local(series: pd.Series, column_name: str) -> dict[str, Any]:
    """Classify a single column's semantic type using the local model.

    Returns:
        {
            "semantic_type": str,      # predicted label
            "confidence": float,       # max class probability (0-1)
            "source": "local_model",   # so downstream code knows the origin
        }
    """
    load_classifier()  # ensure model is loaded

    # Extract features
    feats = extract_column_features(series, column_name)

    # Flatten (remove sample_values, expand nested dicts)
    flat: dict = {}
    for k, v in feats.items():
        if k == "sample_values":
            continue
        if isinstance(v, dict):
            flat.update(v)
        else:
            flat[k] = v

    # Build feature vector in the exact column order the model expects
    row = {}
    for col in _feature_columns:
        val = flat.get(col, 0)
        if isinstance(val, bool):
            val = int(val)
        row[col] = val

    X = pd.DataFrame([row])
    X = X.apply(pd.to_numeric, errors="coerce").fillna(0)

    # Predict with raw model for routing decision
    raw_proba = _pipeline_raw.predict_proba(X)[0]
    raw_classes = _pipeline_raw.classes_
    best_idx = int(np.argmax(raw_proba))
    semantic_type = str(raw_classes[best_idx])
    raw_confidence = round(float(raw_proba[best_idx]), 4)
    
    # Predict with calibrated model for honest reporting
    cal_proba = _pipeline_cal.predict_proba(X)[0]
    cal_classes = list(_pipeline_cal.classes_)
    
    # It's possible the calibrated model ordered classes differently, so we lookup by name
    if semantic_type in cal_classes:
        cal_idx = cal_classes.index(semantic_type)
        reported_confidence = round(float(cal_proba[cal_idx]), 4)
    else:
        # Fallback if somehow the class is missing in calibrated model
        reported_confidence = raw_confidence

    escalated = raw_confidence < _confidence_threshold

    return {
        "semantic_type": semantic_type,
        "raw_confidence": raw_confidence,
        "reported_confidence": reported_confidence,
        "source": "local_model",
        "escalated": escalated
    }


def needs_escalation(classification_result: dict) -> bool:
    """Return True if the local model's confidence is below threshold.

    When True, the column should be sent to Gemini for a higher-quality
    semantic classification.
    """
    return classification_result.get("escalated", False)
