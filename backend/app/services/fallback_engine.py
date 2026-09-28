"""Deterministic fallback engine.

Used in two situations:

1. **No Gemini API key configured** (or ``LOCAL_ONLY=true``) — the whole
   pipeline must still produce semantic types and recommendations so the demo
   never stalls or hard-fails without a key.
2. **Gemini request/validation failure** — escalated columns and the reasoning
   stage gracefully degrade to rule-based answers instead of empty results.

Everything here is pure pandas/NumPy logic — no I/O, no network, no models —
which makes it trivially unit-testable.
"""

from __future__ import annotations

import re
from typing import Any

import pandas as pd

from app.models.enums import SemanticType

# ---------------------------------------------------------------------------
# Rule-based semantic typing (mirrors the LLM classify prompt)
# ---------------------------------------------------------------------------

_EMAIL_RE = re.compile(r"^[a-zA-Z0-9_.+\-]+@[a-zA-Z0-9\-]+\.[a-zA-Z]{2,}$")
_PHONE_RE = re.compile(r"^\+?[\d\s\-().]{7,20}$")
_ZIP_RE = re.compile(r"^\d{5}(?:-\d{4})?$")
_CURRENCY_SYMBOL_RE = re.compile(r"[$€£¥₹₩₽]")
_ID_KEYWORDS = ("id", "key", "index", "uuid", "row", "code", "sku")
_NAME_KEYWORDS = ("name", "person", "customer", "user", "employee")


def _is_string_like(series: pd.Series) -> bool:
    return not pd.api.types.is_numeric_dtype(series)


def rule_based_semantic_type(series: pd.Series, column: str) -> str:
    """Return a SemanticType string guessed from cheap, structural rules."""
    name_lower = column.lower()
    non_null = series.dropna()

    if non_null.empty:
        return SemanticType.free_text.value

    # Boolean detection first (true/false, yes/no, 0/1)
    unique = non_null.unique()
    lowered = {str(v).strip().lower() for v in unique}
    if lowered <= {"true", "false", "yes", "no", "y", "n", "0", "1", "t", "f"} and len(lowered) <= 2:
        return SemanticType.boolean.value

    str_vals = non_null.astype(str).str.strip()
    sample = str_vals.head(200)

    # Date patterns
    if sample.str.match(
        r"^\d{1,4}[/\-.]\d{1,2}[/\-.]\d{1,4}$|^\d{1,4}[/\-.]\d{1,2}[/\-.]\d{2,4} \d{1,2}:\d{2}"
    ).any():
        return SemanticType.date.value

    if sample.str.match(_EMAIL_RE).mean() > 0.9:
        return SemanticType.email.value

    if _is_string_like(series) and sample.str.match(_ZIP_RE).mean() > 0.8:
        return SemanticType.zip_code.value

    # Numeric columns first (currency/percentage/zip/id/numeric_continuous)
    if pd.api.types.is_numeric_dtype(series):
        nums = pd.to_numeric(series, errors="coerce").dropna()

        # Currency: symbol present or money-like name
        if sample.str.contains(_CURRENCY_SYMBOL_RE).any():
            return SemanticType.currency.value
        if any(kw in name_lower for kw in ("price", "amount", "salary", "revenue", "cost", "income", "payment", "fee", "fare", "balance", "total")):
            return SemanticType.currency.value

        if not nums.empty and nums.nunique() > 1:
            is_integerish = bool((nums == nums.round()).all())
            # Zip-like numeric columns (5-digit codes aren't really continuous)
            if is_integerish and 10_000 <= float(nums.max() - nums.min()) <= 100_000 and float(nums.abs().max()) < 100_000:
                if str_vals.str.match(r"^\d{5}$").mean() > 0.8:
                    return SemanticType.zip_code.value
            # Integer identifiers (e.g. customer_id, user_id, uuid-like)
            if is_integerish and (
                name_lower.endswith("id") or "_id" in name_lower or "uuid" in name_lower
            ):
                return SemanticType.id.value
            # Fractional "rate" columns between 0 and 1 look like percentages
            if "pct" in name_lower or "percent" in name_lower or "rate" in name_lower or "score" in name_lower:
                return SemanticType.percentage.value
            if 0 <= float(nums.min()) and float(nums.max()) <= 1:
                return SemanticType.percentage.value
            return SemanticType.numeric_continuous.value

    # String columns from here on
    if sample.str.contains(_CURRENCY_SYMBOL_RE).any():
        return SemanticType.currency.value

    if sample.str.match(_EMAIL_RE).mean() > 0.9:
        return SemanticType.email.value

    if sample.str.match(_PHONE_RE).mean() > 0.85:
        return SemanticType.phone.value

    if "%" in name_lower or "pct" in name_lower or "percent" in name_lower or "rate" in name_lower:
        return SemanticType.percentage.value

    # Identifier detection via name + uniqueness
    n_unique = non_null.nunique()
    if n_unique == len(non_null) and len(non_null) >= 10 and any(
        kw in name_lower for kw in _ID_KEYWORDS
    ):
        return SemanticType.id.value

    # String columns: uniqueness determines cardinality bucket
    if n_unique == 0:
        return SemanticType.categorical_low_card.value
    ratio = n_unique / len(non_null)
    if ratio > 0.9:
        return SemanticType.categorical_high_card.value
    if n_unique <= 20:
        return SemanticType.categorical_low_card.value

    # Text-y columns (long average length, spaces, name-like)
    avg_len = float(str_vals.str.len().mean()) if len(str_vals) else 0.0
    if avg_len > 40 or any(kw in name_lower for kw in ("desc", "comment", "note", "text", "message", "review")):
        return SemanticType.free_text.value
    if any(kw in name_lower for kw in _NAME_KEYWORDS):
        return SemanticType.categorical_high_card.value
    return SemanticType.categorical_high_card.value


def rule_based_is_identifier(series: pd.Series, column: str) -> bool:
    """Cheap identifier check mirroring the LLM classify prompt rules."""
    if rule_based_semantic_type(series, column) == SemanticType.id.value:
        return True
    name_lower = column.lower()
    if any(kw in name_lower for kw in ("uuid", "primary", "row_id", "_id")):
        non_null = series.dropna()
        if len(non_null) > 0 and non_null.nunique() == len(non_null):
            return True
    return False


def fallback_semantic_types_for_columns(
    df: pd.DataFrame, columns: list[str]
) -> list[dict[str, Any]]:
    """Produce full semantic-type dicts for *columns* using pure rules."""
    out: list[dict[str, Any]] = []
    for col in columns:
        st = rule_based_semantic_type(df[col], col)
        out.append(
            {
                "column": col,
                "semantic_type": st,
                "is_identifier": rule_based_is_identifier(df[col], col),
                "notes": "fallback_rule",
            }
        )
    return out


# ---------------------------------------------------------------------------
# Rule-based recommendations (mirrors the LLM reason prompt)
# ---------------------------------------------------------------------------

def _get_type(col: str, semantic_types: list[dict]) -> str | None:
    for st in semantic_types:
        if st["column"] == col:
            return st.get("semantic_type")
    return None


def _is_id(col: str, semantic_types: list[dict]) -> bool:
    for st in semantic_types:
        if st["column"] == col:
            return bool(st.get("is_identifier", False)) or st.get("semantic_type") == SemanticType.id.value
    return False


def _missing_pct(diagnosis: dict, col: str) -> float:
    for m in diagnosis.get("missingness", []):
        if m.get("column") == col:
            return float(m.get("missing_pct", 0.0))
    return 0.0


def _severity_for_missing(pct: float) -> str:
    if pct >= 40:
        return "high"
    if pct >= 10:
        return "medium"
    return "low"


def fallback_recommendations(
    diagnosis: dict, semantic_types: list[dict]
) -> list[dict[str, Any]]:
    """Deterministic recommendations produced from *diagnosis* + semantic types.

    Output shape mirrors a single LLM reasoning response (validated against
    the ``Recommendation`` pydantic model downstream).
    """
    recs: list[dict[str, Any]] = []

    # 0. Dataset-level: duplicate rows (single best-effort "awareness" rec)
    dup_rows = diagnosis.get("duplicate_rows", {})
    if dup_rows.get("duplicate_row_count", 0) > 0:
        count = dup_rows["duplicate_row_count"]
        pct = dup_rows.get("duplicate_row_pct", 0.0)
        recs.append(
            {
                "column": "__dataset__",
                "issue": f"{count} duplicate rows found ({pct}% of the data)",
                "severity": "high" if pct >= 20 else "medium",
                "recommended_action": "none",
                "justification": (
                    "Duplicated rows skew aggregates and leak between train/test splits. "
                    "No single-column action can fix this - deduplicate rows before modeling."
                ),
                "confidence": 0.9,
                "needs_review": True,
            }
        )

    # Column order preserved for determinism
    column_order = [c.get("column") for c in semantic_types]
    column_order += [c for c in _all_columns(diagnosis) if c not in column_order]

    dup_col_map: dict[str, str] = {}
    for pair in diagnosis.get("duplicate_columns", {}).get("duplicate_column_pairs", []):
        dup_col_map[pair["col_b"]] = pair["col_a"]

    # Drop-targets for highly correlated pairs: drop the member with more missingness
    corr_drop_targets: dict[str, str] = {}
    for pair in diagnosis.get("correlated_pairs", []):
        a, b = pair["col_a"], pair["col_b"]
        pa, pb = _missing_pct(diagnosis, a), _missing_pct(diagnosis, b)
        keep, drop = (a, b) if pa <= pb else (b, a)
        corr_drop_targets[drop] = (
            f"Highly correlated with '{keep}' (r = {pair.get('r', '')}). "
            f"Keeping both inflates feature space; '{drop}' has more missingness."
        )

    for col in column_order:
        if _is_id(col, semantic_types):
            continue  # never recommend modifying identifier columns

        st = _get_type(col, semantic_types) or "unknown"
        missing_pct = _missing_pct(diagnosis, col)
        rec: dict[str, Any] | None = None

        # Infinite values trump everything
        for inf in diagnosis.get("infinite_values", []):
            if inf.get("column") == col and inf.get("infinite_count", 0) > 0:
                rec = {
                    "column": col,
                    "issue": f"Contains {inf['infinite_count']} infinite values",
                    "severity": "high",
                    "recommended_action": "clip_outliers",
                    "justification": "Infinite values break most ML algorithms. Clipping replaces them with finite bounds.",
                    "confidence": 0.85,
                }
                break

        # Constant feature
        if rec is None:
            for cf in diagnosis.get("constant_features", []):
                if cf.get("column") == col and cf.get("fully_constant"):
                    rec = {
                        "column": col,
                        "issue": f"Column is constant ({cf.get('constant_value')!r})",
                        "severity": "medium",
                        "recommended_action": "drop_column",
                        "justification": "A constant column carries no information - dropping it is safe.",
                        "confidence": 0.95,
                    }
                    break

        # Exact duplicate of another column
        if rec is None and col in dup_col_map:
            rec = {
                "column": col,
                "issue": f"Exact duplicate of column '{dup_col_map[col]}'",
                "severity": "medium",
                "recommended_action": "drop_column",
                "justification": f"This column is an exact copy of '{dup_col_map[col]}' - keeping both adds no information.",
                "confidence": 0.92,
            }

        # Highly correlated pair member
        if rec is None and col in corr_drop_targets:
            rec = {
                "column": col,
                "issue": "Highly correlated with another column",
                "severity": "medium",
                "recommended_action": "drop_column",
                "justification": corr_drop_targets[col],
                "confidence": 0.7,
            }

        # Missing values
        if rec is None and missing_pct > 0:
            if missing_pct > 60:
                rec = {
                    "column": col,
                    "issue": f"{missing_pct}% missing values",
                    "severity": "high",
                    "recommended_action": "drop_column",
                    "justification": f"Over 60% of values are missing ({missing_pct}%) - the column carries too little information to keep.",
                    "confidence": 0.9,
                }
            elif st in (SemanticType.numeric_continuous.value, SemanticType.currency.value, SemanticType.percentage.value):
                rec = {
                    "column": col,
                    "issue": f"{missing_pct}% missing values",
                    "severity": _severity_for_missing(missing_pct),
                    "recommended_action": "impute_median",
                    "justification": f"{col} is numeric ({st}) with {missing_pct}% missing. Median imputation is robust to outliers.",
                    "confidence": 0.85,
                }
            elif st in (SemanticType.boolean.value, SemanticType.categorical_low_card.value, SemanticType.date.value):
                rec = {
                    "column": col,
                    "issue": f"{missing_pct}% missing values",
                    "severity": _severity_for_missing(missing_pct),
                    "recommended_action": "impute_mode",
                    "justification": f"{col} is {st} with {missing_pct}% missing. Mode imputation preserves the most common value.",
                    "confidence": 0.8,
                }
            else:
                rec = {
                    "column": col,
                    "issue": f"{missing_pct}% missing values",
                    "severity": _severity_for_missing(missing_pct),
                    "recommended_action": "none",
                    "justification": f"{col} is {st} with {missing_pct}% missing values. No safe automated imputation strategy exists — manual review recommended.",
                    "confidence": 0.6,
                    "needs_review": True,
                }

        # Outliers
        if rec is None:
            for o in diagnosis.get("outliers", []):
                if o.get("column") == col and o.get("outlier_count", 0) > 0:
                    pct = float(o.get("outlier_pct", 0.0))
                    rec = {
                        "column": col,
                        "issue": f"{o['outlier_count']} outliers detected ({pct}%)",
                        "severity": "high" if pct > 5 else "medium",
                        "recommended_action": "clip_outliers",
                        "justification": f"Outliers skew statistics for {col}. Clipping at the 1st/99th percentile contains extreme values.",
                        "confidence": 0.8,
                    }
                    break

        # Rare categories / high-cardinality categorical cleanup
        if rec is None and st == SemanticType.categorical_low_card.value:
            for rc in diagnosis.get("rare_categories", []):
                if rc.get("column") == col and rc.get("rare_category_count", 0) > 0:
                    rec = {
                        "column": col,
                        "issue": f"{rc['rare_category_count']} rare categories (<1% frequency)",
                        "severity": "low",
                        "recommended_action": "merge_categories",
                        "justification": "Merging rare categories into 'Other' reduces noise without losing the main signal.",
                        "confidence": 0.75,
                    }
                    break

        if rec is not None:
            recs.append(rec)

    return recs


def _all_columns(diagnosis: dict) -> list[str]:
    cols: list[str] = []
    for section in ("missingness", "cardinality", "constant_features", "infinite_values"):
        for entry in diagnosis.get(section, []):
            col = entry.get("column")
            if col and col not in cols:
                cols.append(col)
    for o in diagnosis.get("outliers", []):
        if o.get("column") and o["column"] not in cols:
            cols.append(o["column"])
    return cols
