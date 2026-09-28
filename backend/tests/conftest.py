"""Shared fixtures.

Tests never touch the real Gemini API: either no API key is configured (the
pipeline runs in local-only mode) or ``_call_gemini`` is monkeypatched with a
fake model. This keeps the suite fast, offline and deterministic.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pandas as pd
import pytest

# Ensure backend root is importable regardless of how pytest is invoked
BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# Tests must NEVER touch the live Gemini API — force deterministic local-only
# mode regardless of what backend/.env contains. Values are set before any
# ``app.*`` module is imported (config is read at import time).
os.environ["GOOGLE_API_KEY"] = ""
os.environ["LOCAL_ONLY"] = "true"

SAMPLE_CSV = BACKEND_ROOT / "sample_data" / "sample_messy_data.csv"


@pytest.fixture(scope="session")
def sample_df() -> pd.DataFrame:
    return pd.read_csv(SAMPLE_CSV)


@pytest.fixture(scope="session")
def sample_csv_bytes() -> bytes:
    return SAMPLE_CSV.read_bytes()
