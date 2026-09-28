from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from app.services.stats_engine import (
    constant_feature_report,
    duplicate_column_report,
    duplicate_row_report,
    full_diagnosis,
    missingness,
    outlier_report,
    quality_score,
)


def test_full_diagnosis_sections(sample_df):
    diag = full_diagnosis(sample_df)
    for section in (
        "shape", "dtypes", "missingness", "cardinality", "correlated_pairs",
        "outliers", "duplicate_rows", "duplicate_columns", "constant_features",
        "infinite_values", "rare_categories", "chart_data", "quality",
    ):
        assert section in diag, f"missing diagnosis section: {section}"
    assert diag["shape"]["rows"] == len(sample_df)
    assert diag["shape"]["columns"] == len(sample_df.columns)


def test_quality_score_shape_and_bounds(sample_df):
    diag = full_diagnosis(sample_df)
    q = diag["quality"]
    assert 0 <= q["overall_score"] <= 100
    assert q["overall_grade"] in "ABCDF"
    cols = set(d["column"] for d in q["per_column"])
    assert cols == set(sample_df.columns)
    for entry in q["per_column"]:
        assert 0 <= entry["score"] <= 100
    assert isinstance(q["biggest_risks"], list)
    assert q["summary"]


def test_quality_drops_with_missing_and_outliers():
    clean = pd.DataFrame(
        {
            "id": range(100),
            "value": np.linspace(0, 50, 100).round(2),
            "label": ["x", "y"] * 50,
        }
    )
    messy = clean.copy()
    messy.loc[0:49, "value"] = np.nan  # 50% missing on half the columns
    messy.loc[90:99, "value"] = 1e9  # extreme outliers

    q_clean = quality_score(clean, full_diagnosis(clean))
    q_messy = quality_score(messy, full_diagnosis(messy))
    assert q_messy["overall_score"] < q_clean["overall_score"]


def test_missingness_flags_over_threshold():
    df = pd.DataFrame({"a": [1, 2, np.nan, np.nan, np.nan], "b": [1, 2, 3, 4, 5]})
    out = {m["column"]: m for m in missingness(df, threshold=40.0)}
    assert out["a"]["flagged"] is True
    assert out["b"]["flagged"] is False
    assert out["a"]["missing_pct"] == 60.0


def test_outlier_report_iqr():
    df = pd.DataFrame({"x": list(range(100)) + [5000]})
    report = outlier_report(df)
    row = report[0]
    assert row["outlier_count"] >= 1
    assert row["column"] == "x"


def test_duplicate_rows_and_columns():
    df = pd.DataFrame(
        {
            "a": [1, 1, 2, 3],
            "b": ["x", "x", "y", "z"],
            "c": [1, 1, 2, 3],  # exact duplicate of a
        }
    )
    dup_rows = duplicate_row_report(df)
    assert dup_rows["duplicate_row_count"] == 2
    pairs = duplicate_column_report(df)["duplicate_column_pairs"]
    assert {"col_a": "a", "col_b": "c"} in pairs


def test_constant_feature_report():
    df = pd.DataFrame({"const": ["only"] * 5, "varying": [1, 2, 3, 4, 5]})
    report = {r["column"]: r for r in constant_feature_report(df)}
    assert report["const"]["fully_constant"] is True
    assert "varying" not in report
