"""Feature extraction for the local semantic column-type classifier.

Extracts cheap, deterministic, structural/statistical features from a single
pandas Series (one column of a DataFrame).  These features are used:
  1. As model inputs during inference (semantic_classifier.py)
  2. As training features paired with Gemini-generated weak labels
     (scripts/generate_weak_labels.py)

No LLM calls happen here.
"""

from __future__ import annotations

import re
from typing import Any

import numpy as np
import pandas as pd


# ── Regex patterns compiled once ────────────────────────────────────────────
_CURRENCY_RE = re.compile(r"[$€£¥₹₩₽]")
_DATE_RE = re.compile(
    r"\b\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4}\b"       # dd/mm/yyyy, mm-dd-yy, …
    r"|\b\d{4}[/\-\.]\d{1,2}[/\-\.]\d{1,2}\b"          # yyyy-mm-dd
    r"|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s*\d{2,4}\b",
    re.IGNORECASE,
)
_ZIP_RE = re.compile(r"^\d{5}(?:-\d{4})?$")
_EMAIL_RE = re.compile(r"^[a-zA-Z0-9_.+\-]+@[a-zA-Z0-9\-]+\.[a-zA-Z]{2,}$")
_PHONE_RE = re.compile(
    r"^[\+]?[\d\s\-\(\)\.]{7,20}$"
)

_NAME_KEYWORDS = [
    "id", "date", "amount", "price", "zip", "code",
    "name", "email", "phone", "pct", "percent", "total",
    "count", "num", "qty", "cost", "fee", "rate",
]


def extract_column_features(series: pd.Series, column_name: str) -> dict[str, Any]:
    """Return a flat dict of structural/statistical features for *series*.

    The returned dict always has the same top-level keys regardless of column
    content, making it safe to feed directly into a DataFrame row.

    ``sample_values`` is included **only** so the weak-labeling script can
    forward them to Gemini.  They must **not** be used as model input features.
    """
    non_null = series.dropna()
    n_total = len(series)
    n_nonnull = len(non_null)

    # String representations (for regex checks)
    str_vals = non_null.astype(str)

    # ── Basic stats ─────────────────────────────────────────────────────────
    pct_missing = 1.0 - (n_nonnull / n_total) if n_total > 0 else 0.0
    unique_ratio = non_null.nunique() / n_nonnull if n_nonnull > 0 else 0.0

    # ── Numeric / alpha fractions ───────────────────────────────────────────
    if n_nonnull > 0:
        numeric_mask = pd.to_numeric(str_vals, errors="coerce").notna()
        pct_numeric = float(numeric_mask.mean())
        pct_alpha = float(str_vals.str.match(r"^[A-Za-z]+$").mean())
    else:
        pct_numeric = 0.0
        pct_alpha = 0.0

    # ── String-length stats ─────────────────────────────────────────────────
    str_lengths = str_vals.str.len()
    avg_string_length = float(str_lengths.mean()) if n_nonnull > 0 else 0.0
    std_string_length = float(str_lengths.std()) if n_nonnull > 1 else 0.0

    # ── Digit counts ────────────────────────────────────────────────────────
    digit_counts = str_vals.str.count(r"\d")
    avg_digit_count = float(digit_counts.mean()) if n_nonnull > 0 else 0.0

    # ── Regex flags (run against a sample for speed) ────────────────────────
    sample_size = min(200, n_nonnull)
    sample_str = str_vals.head(sample_size)

    has_currency_symbol = bool(sample_str.str.contains(_CURRENCY_RE).any())
    has_date_pattern = bool(sample_str.str.contains(_DATE_RE).any())
    has_zip_pattern = bool(sample_str.str.match(_ZIP_RE).any()) if n_nonnull > 0 else False
    has_email_pattern = bool(sample_str.str.match(_EMAIL_RE).any()) if n_nonnull > 0 else False
    has_phone_pattern = bool(sample_str.str.match(_PHONE_RE).any()) if n_nonnull > 0 else False

    # ── Column-name keywords ────────────────────────────────────────────────
    name_lower = column_name.lower()
    name_contains_keyword = {
        f"name_has_{kw}": bool(kw in name_lower) for kw in _NAME_KEYWORDS
    }

    # ── Sample values (for Gemini labeling ONLY) ────────────────────────────
    sample_values = str_vals.head(5).tolist()

    return {
        "column_name_length": len(column_name),
        "pct_numeric": round(pct_numeric, 4),
        "pct_alpha": round(pct_alpha, 4),
        "avg_string_length": round(avg_string_length, 2),
        "std_string_length": round(std_string_length, 2),
        "unique_ratio": round(unique_ratio, 4),
        "pct_missing": round(pct_missing, 4),
        "has_currency_symbol": has_currency_symbol,
        "has_date_pattern": has_date_pattern,
        "has_zip_pattern": has_zip_pattern,
        "has_email_pattern": has_email_pattern,
        "has_phone_pattern": has_phone_pattern,
        "avg_digit_count": round(avg_digit_count, 2),
        **name_contains_keyword,
        # ── NOT a model feature — labeling helper only ──────────────────────
        "sample_values": sample_values,
    }
