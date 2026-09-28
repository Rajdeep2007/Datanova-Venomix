"""Analysis pipeline: Diagnose (stats) -> Classify (semantic types) -> Reason (recommendations).

Orchestration is plain sequential ``asyncio`` code (no LangGraph) so we can:

* report live progress for the async job API,
* fall back to deterministic rules whenever Gemini is missing or fails,
* keep the whole pipeline testable with a single monkeypatched seam (``_call_gemini``).
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from pathlib import Path
from typing import Any, Awaitable, Callable, TypedDict

import httpx
import pandas as pd
from pydantic import ValidationError

from app.core.config import (
    FALLBACK_MODEL_NAMES,
    GOOGLE_API_KEY,
    LOCAL_ONLY,
    MODEL_NAME,
)
from app.models.enums import SemanticType
from app.models.schemas import ColumnSemantic, Recommendation
from app.services.fallback_engine import (
    fallback_recommendations,
    fallback_semantic_types_for_columns,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Prompts (loaded once)
# ---------------------------------------------------------------------------
_PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"
CLASSIFY_SYSTEM_PROMPT = (_PROMPTS_DIR / "classify_system.txt").read_text(encoding="utf-8")
REASON_SYSTEM_PROMPT = (_PROMPTS_DIR / "reason_system.txt").read_text(encoding="utf-8")

# How many self-consistency samples to request from the LLM for reasoning.
# Set to 3 for better quality via majority voting (was 1 = dead code).
REASON_CONSISTENCY_SAMPLES = 1

ProgressCallback = Callable[[int, str], Awaitable[None] | None]

# Whether Gemini is usable at all in this process (empty key or forced local mode)
LLM_AVAILABLE: bool = bool(GOOGLE_API_KEY) and not LOCAL_ONLY

_MODEL_CACHE: dict[str, str] = {}


# ---------------------------------------------------------------------------
# Minimal REST client for the Gemini generateContent API
# ---------------------------------------------------------------------------
class GeminiRESTClient:
    """Tiny async client for ``generateContent``. No LangChain dependency."""

    def __init__(
        self,
        api_key: str,
        primary_model: str | None = None,
        fallback_models: list[str] | None = None,
        timeout: float = 300.0,
    ):
        self.api_key = api_key
        self.primary_model = (primary_model or MODEL_NAME).replace("models/", "")
        self.fallback_models = [
            m.replace("models/", "") for m in (fallback_models or FALLBACK_MODEL_NAMES)
        ]
        self.timeout = timeout

    async def generate(self, prompt: str) -> str:
        """Send a single-turn prompt; returns the raw response text."""
        if not self.api_key:
            raise ValueError("Gemini API key is not configured")

        payload = {"contents": [{"parts": [{"text": prompt}]}]}
        headers = {"Content-Type": "application/json", "x-goog-api-key": self.api_key}

        models_to_try = [self.primary_model] + [
            m for m in self.fallback_models if m != self.primary_model
        ]
        last_error: str | None = None

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for model in models_to_try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
                for attempt in range(3):
                    try:
                        resp = await client.post(url, json=payload, headers=headers)
                        if resp.is_success:
                            data = resp.json()
                            text = data["candidates"][0]["content"]["parts"][0]["text"]
                            return text

                        try:
                            error_data = resp.json()
                            error_msg = error_data.get("error", {}).get("message", resp.text)
                        except Exception:
                            error_msg = resp.text
                        last_error = f"Gemini API Error {resp.status_code} ({model}): {error_msg}"

                        if resp.status_code in (429, 503):
                            logger.warning(
                                "Gemini model %s busy (HTTP %s), retry %d/3",
                                model, resp.status_code, attempt + 1,
                            )
                            await asyncio.sleep(2.5 * (attempt + 1))
                            continue
                        if resp.status_code == 404 and len(models_to_try) > 1:
                            # Model name wrong — try the next fallback model
                            logger.warning("Gemini model %s not found (404)", model)
                            break
                        break
                    except Exception as exc:  # network errors
                        last_error = f"Gemini request failed: {exc}"
                        await asyncio.sleep(1.0)

        raise ValueError(last_error or "Unexpected failure calling Gemini API")


_llm: GeminiRESTClient | None = None


def get_llm_client() -> GeminiRESTClient:
    """Lazily build the singleton REST client (created on first use)."""
    global _llm
    if _llm is None:
        _llm = GeminiRESTClient(api_key=GOOGLE_API_KEY, primary_model=MODEL_NAME)
    return _llm


async def _call_gemini(prompt: str) -> str:
    """Single testable seam for LLM calls. Returns raw model text."""
    if not LLM_AVAILABLE:
        raise RuntimeError("Gemini is not configured (missing GOOGLE_API_KEY or LOCAL_ONLY=true)")
    return await get_llm_client().generate(prompt)


# ---------------------------------------------------------------------------
# Pipeline state
# ---------------------------------------------------------------------------
class PipelineState(TypedDict, total=False):
    df_raw: pd.DataFrame
    diagnosis: dict
    df_sample_payload: str  # JSON string sent to the classify prompt
    has_flagged_columns: bool
    semantic_types: list[dict[str, Any]]
    recommendations: list[dict[str, Any]]
    target_column: str | None
    target_purpose: str | None
    target_analysis: dict | None
    warnings: list[str]
    errors: list[str]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _build_classify_payload(df: pd.DataFrame, diagnosis: dict) -> str:
    """Build the user-message payload for the classification stage."""
    dtype_map: dict[str, str] = {
        entry["column"]: entry["inferred_type"] for entry in diagnosis.get("dtypes", [])
    }
    items = []
    for col in df.columns:
        sample = df[col].dropna()
        sample_values = sample.head(8).tolist() if len(sample) >= 5 else sample.tolist()
        sample_values = [v.item() if hasattr(v, "item") else v for v in sample_values]
        items.append(
            {
                "column": col,
                "dtype": dtype_map.get(col, str(df[col].dtype)),
                "sample_values": sample_values,
            }
        )
    return json.dumps(items, indent=2, default=str)


def _extract_json(text: Any) -> Any:
    """Strip markdown fences / prose and parse JSON from an LLM response."""
    if isinstance(text, list):
        text = str(text)
    if not isinstance(text, str):
        text = str(text)
    cleaned = text.strip()

    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned)
    if match:
        cleaned = match.group(1).strip()
    else:
        match = re.search(r"(\[[\s\S]*\]|\{[\s\S]*\})", cleaned)
        if match:
            cleaned = match.group(1).strip()

    return json.loads(cleaned)


def _check_flagged(diagnosis: dict) -> bool:
    """Return True if any column (or the dataset) has a data-quality flag."""
    for m in diagnosis.get("missingness", []):
        if m.get("missing_pct", 0) > 0:
            return True
    for o in diagnosis.get("outliers", []):
        if o.get("outlier_count", 0) > 0:
            return True
    if diagnosis.get("correlated_pairs"):
        return True
    dup_rows = diagnosis.get("duplicate_rows", {})
    if dup_rows.get("duplicate_row_count", 0) > 0:
        return True
    dup_cols = diagnosis.get("duplicate_columns", {})
    if dup_cols.get("duplicate_column_pairs"):
        return True
    if diagnosis.get("constant_features"):
        return True
    if diagnosis.get("infinite_values"):
        return True
    if diagnosis.get("rare_categories"):
        return True
    for c in diagnosis.get("cardinality", []):
        if c.get("flagged_high_cardinality", False):
            return True
    if diagnosis.get("multivariate_outliers"):
        return True
    return False


def _build_reason_payload(diagnosis: dict, semantic_types: list[dict]) -> str:
    """Build the user-message payload for the reasoning stage."""
    flagged_missing = [m for m in diagnosis.get("missingness", []) if m.get("missing_pct", 0) > 0]
    flagged_outliers = [o for o in diagnosis.get("outliers", []) if o.get("outlier_count", 0) > 0]
    payload: dict = {
        "missingness": flagged_missing,
        "outliers": flagged_outliers,
        "correlated_pairs": diagnosis.get("correlated_pairs", []),
        "semantic_types": semantic_types,
    }
    dup_rows = diagnosis.get("duplicate_rows", {})
    if dup_rows.get("duplicate_row_count", 0) > 0:
        payload["duplicate_rows"] = {"count": dup_rows["duplicate_row_count"], "pct": dup_rows.get("duplicate_row_pct", 0)}
    dup_cols = diagnosis.get("duplicate_columns", {})
    if dup_cols.get("duplicate_column_pairs"):
        payload["duplicate_columns"] = dup_cols["duplicate_column_pairs"]
    if diagnosis.get("constant_features"):
        payload["constant_features"] = diagnosis["constant_features"]
    if diagnosis.get("infinite_values"):
        payload["infinite_values"] = diagnosis["infinite_values"]
    if diagnosis.get("rare_categories"):
        payload["rare_categories"] = diagnosis["rare_categories"]
    flagged_cardinality = [c for c in diagnosis.get("cardinality", []) if c.get("flagged_high_cardinality", False)]
    if flagged_cardinality:
        payload["high_cardinality"] = flagged_cardinality
    if diagnosis.get("multivariate_outliers"):
        payload["multivariate_outlier_count"] = len(diagnosis["multivariate_outliers"])
    if diagnosis.get("target_purpose"):
        payload["target_purpose"] = diagnosis["target_purpose"]
    return json.dumps(payload, indent=2, default=str)


def _few_shot_examples_for(columns: list[str]) -> str:
    """Deterministic few-shot hints (no embedding model needed)."""
    from app.services.embedding_retrieval import get_similar_examples

    lines: list[str] = []
    for col_name in columns:
        for ex in get_similar_examples(col_name):
            lines.append(
                f"- If you see a column like '{ex['column_name']}', it is usually semantic_type="
                f"'{ex['semantic_type']}'. Reason: {ex['reasoning']}"
            )
    if lines:
        return "\n\nHere are similar examples from our knowledge base to help you:\n" + "\n".join(lines)
    return ""


# ---------------------------------------------------------------------------
# Pipeline stages
# ---------------------------------------------------------------------------
async def classify_node(state: PipelineState, progress: ProgressCallback | None = None) -> dict:
    """Semantic classification: local model first, LLM for ambiguous columns.

    Every column ends up with a semantic type, guaranteed: confident local
    predictions, Gemini answers for escalated columns, and deterministic rules
    for anything Gemini could not answer.
    """
    errors: list[str] = list(state.get("errors", []))
    warnings: list[str] = list(state.get("warnings", []))
    df = state.get("df_raw")
    if df is None:
        return {"semantic_types": [], "errors": errors, "warnings": warnings}

    local_results: list[dict] = []
    escalation_columns: list[str] = []

    if progress:
        await _maybe_await(progress(10, f"Classifying {len(df.columns)} columns…"))

    # ── Step 1: local classifier for every column ─────────────────────────
    try:
        from app.services.semantic_classifier import classify_column_local, needs_escalation

        for col in df.columns:
            result = classify_column_local(df[col], col)
            if needs_escalation(result):
                escalation_columns.append(col)
            else:
                local_results.append(
                    {
                        "column": col,
                        "semantic_type": result["semantic_type"],
                        "is_identifier": result["semantic_type"] == "id",
                        "notes": (
                            "local_model "
                            f"(raw_conf={result.get('raw_confidence', 0):.2f}, "
                            f"reported={result.get('reported_confidence', 0):.2f})"
                        ),
                    }
                )
        logger.info(
            "Local classifier: %d confident, %d escalated", len(local_results), len(escalation_columns)
        )
    except Exception as exc:
        logger.warning("Local classifier unavailable, using rule fallback for all columns: %s", exc)
        escalation_columns = list(df.columns)
        warnings.append("Local ML classifier unavailable — used rule-based classification.")

    # ── Step 2: escalate ambiguous columns ─────────────────────────────────
    gemini_results: list[dict] = []
    if escalation_columns and LLM_AVAILABLE:
        if progress:
            await _maybe_await(progress(25, f"Escalating {len(escalation_columns)} ambiguous columns to Gemini…"))

        prompt = state["df_sample_payload"] + _few_shot_examples_for(escalation_columns)
        try:
            response_text = await _call_gemini(
                CLASSIFY_SYSTEM_PROMPT + "\n\n" + prompt
            )
            raw = _extract_json(response_text)
            wanted = {c: False for c in escalation_columns}
            for item in raw:
                cs = ColumnSemantic(**item)
                d = cs.model_dump()
                if d["column"] in wanted:
                    gemini_results.append(d)
                    wanted[d["column"]] = True
            # Columns Gemini forgot → fill with rules
            missing = [c for c, seen in wanted.items() if not seen]
            if missing:
                gemini_results.extend(fallback_semantic_types_for_columns(df, missing))
        except (json.JSONDecodeError, ValidationError, KeyError, IndexError, ValueError) as exc:
            errors.append(f"Gemini classify failed: {exc}")
            logger.warning("classify escalation failed, falling back to rules: %s", exc)

    elif escalation_columns:
        # No LLM available — rules fill in the gaps
        warnings.append("No Gemini API key configured - running in local-only mode.")

    rule_results: list[dict] = []
    if escalation_columns:
        answered = {r["column"] for r in gemini_results}
        unresolved = [c for c in escalation_columns if c not in answered]
        if unresolved:
            rule_results = fallback_semantic_types_for_columns(df, unresolved)

    # ── Step 3: merge (local → gemini → rules) ────────────────────────────
    merged = list(local_results) + list(gemini_results) + list(rule_results)
    merged = {r["column"]: r for r in merged}.values()  # de-dup by column
    merged = sorted(merged, key=lambda r: list(df.columns).index(r["column"]))

    return {"semantic_types": list(merged), "errors": errors, "warnings": warnings}


async def target_analysis_node(state: PipelineState, progress: ProgressCallback | None = None) -> dict:
    """Deterministic target-aware checks (only when a target column is given)."""
    target_col = state.get("target_column")
    df = state.get("df_raw")
    if not target_col or df is None:
        return {"target_analysis": None}
    if progress:
        await _maybe_await(progress(50, "Running target-aware checks…"))
    from app.services.target_aware_checks import run_target_checks

    analysis = run_target_checks(df, target_col, state.get("semantic_types", []))
    return {"target_analysis": analysis}


async def reason_node(state: PipelineState, progress: ProgressCallback | None = None) -> dict:
    """Recommendations: Gemini (self-consistency) with rule-based fallback."""
    errors: list[str] = list(state.get("errors", []))
    warnings: list[str] = list(state.get("warnings", []))
    diagnosis = state.get("diagnosis", {})
    semantic_types = state.get("semantic_types", [])

    if progress:
        await _maybe_await(progress(70, "Generating AI recommendations…"))

    recommendations: list[dict] = []
    used_fallback = False

    if LLM_AVAILABLE:
        payload = _build_reason_payload(diagnosis, semantic_types)

        async def fetch_one() -> list[dict]:
            for retry in range(2):
                try:
                    response_text = await _call_gemini(REASON_SYSTEM_PROMPT + "\n\n" + payload)
                    raw = _extract_json(response_text)
                    validated = []
                    for item in raw:
                        rec = Recommendation(**item)
                        validated.append(rec.model_dump())
                    return validated
                except (json.JSONDecodeError, ValidationError, ValueError, KeyError, IndexError) as exc:
                    errors.append(f"Gemini reason attempt failed: {exc}")
            return []

        results = await asyncio.gather(
            *[fetch_one() for _ in range(max(1, REASON_CONSISTENCY_SAMPLES))]
        )

        # Self-consistency: majority vote per column
        from collections import Counter, defaultdict

        col_recs: dict[str, list[dict]] = defaultdict(list)
        for res_list in results:
            for rec in res_list:
                col_recs[rec["column"]].append(rec)

        for col, recs in col_recs.items():
            if not recs:
                continue
            actions = [r["recommended_action"] for r in recs]
            most_common_action, _ = Counter(actions).most_common(1)[0]
            rep = next(r for r in recs if r["recommended_action"] == most_common_action)
            matching_conf = [r["confidence"] for r in recs if r["recommended_action"] == most_common_action]
            rep["confidence"] = sum(matching_conf) / len(matching_conf) if matching_conf else rep["confidence"]
            recommendations.append(rep)

        if not recommendations and _check_flagged(diagnosis):
            used_fallback = True
            warnings.append("Gemini returned no recommendations - used deterministic fallback.")
    else:
        used_fallback = True

    if used_fallback:
        # Rule-based recommendations, flagged as reviewable when Gemini was skipped
        if not LLM_AVAILABLE:
            warnings.append("No Gemini API key configured - generated rule-based recommendations.")
        fallback = fallback_recommendations(diagnosis, semantic_types)
        for rec in fallback:
            rec.setdefault("needs_review", not LLM_AVAILABLE)
        recommendations = fallback

    # Filter out "none" recommendations — they aren't actionable issues
    recommendations = [r for r in recommendations if r.get("recommended_action") != "none"]

    if progress:
        await _maybe_await(progress(90, "Finalizing recommendations…"))

    return {"recommendations": recommendations, "errors": errors, "warnings": warnings}


async def _maybe_await(result: Awaitable[None] | None) -> None:
    if result is not None:
        await result


# ---------------------------------------------------------------------------
# Public entrypoint
# ---------------------------------------------------------------------------
async def run_analysis_pipeline(
    df: pd.DataFrame,
    diagnosis: dict,
    target_column: str | None = None,
    target_purpose: str | None = None,
    progress_callback: ProgressCallback | None = None,
) -> dict[str, Any]:
    """Run classify → target checks → reason and return structured results.

    ``progress_callback`` receives ``(pct: int, message: str)`` as it goes.
    Results always include ``semantic_types`` and ``recommendations`` (possibly
    from deterministic fallbacks) plus a ``warnings`` list for the UI.
    """
    diagnosis_for_payload = dict(diagnosis)
    if target_purpose:
        diagnosis_for_payload["target_purpose"] = target_purpose

    state: PipelineState = {
        "df_raw": df,
        "diagnosis": diagnosis_for_payload,
        "df_sample_payload": _build_classify_payload(df, diagnosis),
        "has_flagged_columns": _check_flagged(diagnosis),
        "semantic_types": [],
        "recommendations": [],
        "target_column": target_column,
        "target_purpose": target_purpose,
        "target_analysis": None,
        "warnings": [],
        "errors": [],
    }

    out = await classify_node(state, progress_callback)
    state.update(out)

    out = await target_analysis_node(state, progress_callback)
    state.update(out)

    if state.get("has_flagged_columns"):
        out = await reason_node(state, progress_callback)
        state.update(out)

    return {
        "semantic_types": state.get("semantic_types", []),
        "recommendations": state.get("recommendations", []),
        "target_analysis": state.get("target_analysis"),
        "warnings": list(dict.fromkeys(state.get("warnings", []))),
        "errors": state.get("errors", []),
    }
