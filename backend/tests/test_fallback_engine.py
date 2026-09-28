from __future__ import annotations

import pandas as pd
import pytest

from app.models.enums import SemanticType
from app.services.fallback_engine import (
    fallback_recommendations,
    rule_based_semantic_type,
)


def _series(values):
    return pd.Series(values)


@pytest.mark.parametrize(
    "values,name,expected",
    [
        (["true", "false", "true"], "active_flag", SemanticType.boolean.value),
        (["yes", "no", "yes"], "subscribed", SemanticType.boolean.value),
        ([1, 0, 1, 0], "is_enabled", SemanticType.boolean.value),
        (["a@b.com", "c@d.org", "a@b.com"], "email", SemanticType.email.value),
        (["+1 555 123 4567", "555-123-4567", "(555) 123-4567"], "phone", SemanticType.phone.value),
        (["90210", "10001", "94105"], "zip_code", SemanticType.zip_code.value),
        ([12345, 67890, 54321], "postal", SemanticType.zip_code.value),
        (["$12.50", "$9.99", "$100.00"], "price", SemanticType.currency.value),
        ([12.5, 9.99, 100.0], "annual_income", SemanticType.currency.value),
        (["2024-01-15", "2023-12-01", "2024-06-30"], "signup_date", SemanticType.date.value),
        ([0.5, 0.9, 1.0], "completion_pct", SemanticType.percentage.value),
        ([25, 40, 31, 29], "age", SemanticType.numeric_continuous.value),
        ([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], "customer_id", SemanticType.id.value),
        (["short text", "another"], "notes", SemanticType.categorical_high_card.value),
    ],
)
def test_rule_based_semantic_type(values, name, expected):
    assert rule_based_semantic_type(_series(values), name) == expected


def _minimal_diagnosis():
    return {
        "missingness": [
            {"column": "age", "missing_pct": 6.0},
            {"column": "fax", "missing_pct": 85.0},
        ],
        "outliers": [{"column": "revenue", "outlier_count": 8, "outlier_pct": 4.0}],
        "duplicate_rows": {"duplicate_row_count": 10, "duplicate_row_pct": 5.0},
        "duplicate_columns": {"duplicate_column_pairs": [{"col_a": "a", "col_b": "a_copy"}]},
        "constant_features": [{"column": "country", "fully_constant": True, "constant_value": "US"}],
        "infinite_values": [],
        "rare_categories": [],
        "cardinality": [],
        "correlated_pairs": [],
    }


def _semantic_types():
    return [
        {"column": "customer_id", "semantic_type": "id", "is_identifier": True},
        {"column": "age", "semantic_type": "numeric_continuous", "is_identifier": False},
        {"column": "fax", "semantic_type": "free_text", "is_identifier": False},
        {"column": "revenue", "semantic_type": "currency", "is_identifier": False},
        {"column": "a", "semantic_type": "numeric_continuous", "is_identifier": False},
        {"column": "a_copy", "semantic_type": "numeric_continuous", "is_identifier": False},
        {"column": "country", "semantic_type": "categorical_low_card", "is_identifier": False},
    ]


def test_fallback_recommendations_mapping():
    recs = fallback_recommendations(_minimal_diagnosis(), _semantic_types())
    by_col = {r["column"]: r for r in recs}

    # identifier columns never get cleanup actions
    assert "customer_id" not in by_col
    # >60% missing -> drop
    assert by_col["fax"]["recommended_action"] == "drop_column"
    # numeric missing -> impute_median
    assert by_col["age"]["recommended_action"] == "impute_median"
    # duplicate column -> drop the duplicate
    assert by_col["a_copy"]["recommended_action"] == "drop_column"
    # constant column -> drop
    assert by_col["country"]["recommended_action"] == "drop_column"
    # dataset-level duplicates -> __dataset__ record flagged for review
    assert by_col["__dataset__"]["recommended_action"] == "none"
    assert by_col["__dataset__"]["needs_review"] is True


def test_all_fallback_recs_validate_as_recommendations():
    from app.models.schemas import Recommendation

    recs = fallback_recommendations(_minimal_diagnosis(), _semantic_types())
    for rec in recs:
        model = Recommendation(**rec)  # must not raise
        assert 0.0 <= model.confidence <= 1.0
