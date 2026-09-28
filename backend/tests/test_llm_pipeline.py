from __future__ import annotations

import asyncio
import json
import re

import pytest

import app.services.llm_pipeline as pipeline
from app.services.stats_engine import full_diagnosis


def _run(coro):
    return asyncio.run(coro)


def test_pipeline_local_only_without_key(sample_df):
    """With no API key the pipeline must still return types + recommendations."""
    assert pipeline.LLM_AVAILABLE is False
    diag = full_diagnosis(sample_df)
    result = _run(pipeline.run_analysis_pipeline(sample_df, diag))

    assert result["semantic_types"], "semantic types must never be empty"
    assert {t["column"] for t in result["semantic_types"]} == set(sample_df.columns)
    assert result["recommendations"], "flagged dataset should get recommendations"
    assert result["warnings"], "local-only mode must be announced"
    assert any(r.get("needs_review") for r in result["recommendations"])
    # All types are valid enum values
    from app.models.enums import SemanticType

    allowed = {t.value for t in SemanticType}
    for st in result["semantic_types"]:
        assert st["semantic_type"] in allowed


@pytest.mark.parametrize(
    "raw_text",
    [
        '[{"column": "age", "semantic_type": "numeric_continuous", "is_identifier": false, "notes": "ok"}]',
        '```json\n[{"column": "age", "semantic_type": "numeric_continuous", "is_identifier": false, "notes": "ok"}]\n```',
        'Here you go:\n\n[{"column": "age", "semantic_type": "numeric_continuous", "is_identifier": false, "notes": "ok"}]\n\nHope that helps!',
    ],
)
def test_extract_json_tolerates_fences_and_prose(raw_text):
    parsed = pipeline._extract_json(raw_text)
    assert parsed[0]["column"] == "age"


def test_pipeline_uses_gemini_when_available(sample_df, monkeypatch):
    """A healthy Gemini path must consume mocked responses, no warnings."""
    monkeypatch.setattr(pipeline, "LLM_AVAILABLE", True)

    calls = []

    async def fake_call_gemini(prompt: str) -> str:
        calls.append(prompt)
        if "sample_values" in prompt:
            # classify payload: echo a valid semantic type for every column
            columns = re.findall(r'"column":\s*"([^"]+)"', prompt)
            return json.dumps(
                [
                    {
                        "column": col,
                        "semantic_type": "categorical_low_card",
                        "is_identifier": False,
                        "notes": "mock answer",
                    }
                    for col in columns
                ]
            )
        # reason payload
        return json.dumps(
            [
                {
                    "column": "age",
                    "issue": "6.0% missing values",
                    "severity": "medium",
                    "recommended_action": "impute_median",
                    "justification": "Age is numeric; median imputation is safe.",
                    "confidence": 0.91,
                }
            ]
        )

    monkeypatch.setattr(pipeline, "_call_gemini", fake_call_gemini)

    diag = full_diagnosis(sample_df)
    result = _run(pipeline.run_analysis_pipeline(sample_df, diag))
    assert calls, "Gemini must have been called"
    assert result["semantic_types"]
    assert result["recommendations"]
    assert result["warnings"] == []
    assert all(not r.get("needs_review") for r in result["recommendations"])


def test_pipeline_degrades_when_gemini_fails(sample_df, monkeypatch):
    monkeypatch.setattr(pipeline, "LLM_AVAILABLE", True)

    async def broken_gemini(prompt: str) -> str:
        raise ValueError("API key invalid (403)")

    monkeypatch.setattr(pipeline, "_call_gemini", broken_gemini)

    diag = full_diagnosis(sample_df)
    result = _run(pipeline.run_analysis_pipeline(sample_df, diag))
    assert result["semantic_types"], "types must survive an LLM outage"
    assert len({t["column"] for t in result["semantic_types"]}) == len(sample_df.columns)
    assert result["recommendations"], "fallback recommendations must appear"
    assert result["errors"]


def test_progress_callback_reports_stages(sample_df, monkeypatch):
    monkeypatch.setattr(pipeline, "LLM_AVAILABLE", False)  # fast local path
    diag = full_diagnosis(sample_df)
    stages: list[tuple[int, str]] = []

    def progress(pct: int, message: str):
        stages.append((pct, message))

    _run(pipeline.run_analysis_pipeline(sample_df, diag, progress_callback=progress))
    assert stages, "progress callback must fire"
    pcts = [p for p, _ in stages]
    assert pcts == sorted(pcts), "progress must be monotonic"
    assert any("Classifying" in msg for _, msg in stages)
    assert any("recommendations" in msg.lower() for _, msg in stages)


def test_reason_skipped_when_data_is_clean(monkeypatch):
    """A genuinely clean dataset must produce types but zero recommendations."""
    monkeypatch.setattr(pipeline, "LLM_AVAILABLE", False)
    import numpy as np
    import pandas as pd

    rng = np.random.default_rng(7)
    # Uniform draws keep every value inside IQR fences: no outliers, no missing.
    clean = pd.DataFrame(
        {
            "amount": np.round(rng.uniform(20, 80, 120), 2),
            "score": np.round(rng.uniform(0, 100, 120), 2),
            "label": [f"group{i % 4}" for i in range(120)],
        }
    )
    diag = full_diagnosis(clean)
    result = _run(pipeline.run_analysis_pipeline(clean, diag))
    assert len(result["semantic_types"]) == 3
    assert result["recommendations"] == []

