from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import pytest

from app.models.enums import SemanticType

# Re-import after the module may have been loaded once; accessing internals for tests
import app.services.semantic_classifier as sc


@pytest.mark.skipif(
    not (Path(__file__).resolve().parent.parent / "app/models/semantic_classifier.joblib").exists(),
    reason="trained model artifacts not present",
)
def test_classify_column_local_shape(sample_df):
    for col in list(sample_df.columns)[:5]:
        result = sc.classify_column_local(sample_df[col], col)
        assert result["semantic_type"] in {t.value for t in SemanticType}
        assert 0.0 <= result["raw_confidence"] <= 1.0
        assert 0.0 <= result["reported_confidence"] <= 1.0
        assert result["source"] == "local_model"
        assert isinstance(result["escalated"], bool)


def test_confidence_threshold_loaded_from_json():
    file_path = Path(__file__).resolve().parent.parent / "app/models/confidence_threshold.json"
    with open(file_path, encoding="utf-8") as f:
        data = json.load(f)
    assert data["confidence_threshold"] == pytest.approx(sc._confidence_threshold)


def test_needs_escalation_respects_flag():
    assert sc.needs_escalation({"escalated": True}) is True
    assert sc.needs_escalation({"escalated": False}) is False
    assert sc.needs_escalation({}) is False


def test_rules_classify_every_column(sample_df, monkeypatch):
    """Even without the trained model, every column must get a semantic type."""
    from app.services.fallback_engine import fallback_semantic_types_for_columns

    types = fallback_semantic_types_for_columns(sample_df, list(sample_df.columns))
    assert len(types) == len(sample_df.columns)
    for t in types:
        assert t["semantic_type"] in {s.value for s in SemanticType}
