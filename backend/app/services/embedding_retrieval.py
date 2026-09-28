"""Deterministic few-shot example retrieval.

Replaces the previous sentence-transformers embedder with a lightweight
token/affinity scorer. Column names in this domain (``customer_id``,
``annual_income``, ``zip_code`` …) share obvious tokens, so lexical scoring
retrieves the same quality of examples with zero model downloads, no torch
dependency, instant import, and fully deterministic tests.
"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_SPECIAL_TOKEN_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"email|e[-_ ]?mail|@"), "email"),
    (re.compile(r"phone|mobile|tel|fax"), "phone"),
    (re.compile(r"zip|postal|postcode|pincode"), "zip_code"),
    (re.compile(r"price|amount|salary|revenue|income|cost|fee|balance|payment|total|amount|fare"), "currency"),
    (re.compile(r"percent|pct|rate|ratio|score|index"), "percentage"),
    (re.compile(r"date|time|day|month|year|timestamp|dob|birth"), "date"),
    (re.compile(r"id$|_id|uuid|key$|identifier"), "id"),
    (re.compile(r"city|state|country|region|address|street"), "categorical_high_card"),
    (re.compile(r"name|person|employee|customer|user"), "categorical_high_card"),
    (re.compile(r"gender|sex|category|group|type|status|color|product"), "categorical_low_card"),
    (re.compile(r"boolean|flag|active|enabled|is_|has_"), "boolean"),
    (re.compile(r"desc|comment|note|text|message|review|feedback"), "free_text"),
    (re.compile(r"quantity|qty|count|number|age|weight|height|temp|distance|size"), "numeric_continuous"),
]


class ExampleRetriever:
    """Retrieves few-shot examples using lightweight name-affinity scoring."""

    _instance: "ExampleRetriever | None" = None

    def __new__(cls) -> "ExampleRetriever":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        if self._initialized:
            return
        bank_path = Path(__file__).resolve().parent.parent / "models" / "few_shot_examples.json"
        try:
            with open(bank_path, encoding="utf-8") as f:
                self.examples = json.load(f)
        except Exception as exc:  # pragma: no cover - defensive
            logger.error("Failed to load few-shot examples from %s: %s", bank_path, exc)
            self.examples = []
        self._initialized = True
        logger.info("Initialized ExampleRetriever with %d examples.", len(self.examples))

    # ------------------------------------------------------------------
    def _tokens(self, name: str) -> set[str]:
        return set(re.split(r"[^a-z0-9]+", name.lower())) - {""}

    def _affinity(self, query: str, example_name: str) -> float:
        q = query.lower()
        ex = example_name.lower()
        score = 0.0

        q_tokens, ex_tokens = self._tokens(q), self._tokens(ex)
        overlap = q_tokens & ex_tokens
        if overlap:
            # token overlap is the strongest generic signal
            score += 1.0 * len(overlap) / max(len(q_tokens), 1)

        for pattern, semantic in _SPECIAL_TOKEN_PATTERNS:
            q_hit = pattern.search(q)
            ex_hit = pattern.search(ex)
            if q_hit and ex_hit:
                score += 2.0
            elif q_hit and not ex_hit:
                score -= 0.4
        return score

    def get_similar_examples(self, column_name: str, k: int = 3) -> list[dict[str, Any]]:
        """Top-k examples ranked by affinity to *column_name*."""
        if not self.examples:
            return []
        scored = [(self._affinity(column_name, ex.get("column_name", "")), ex) for ex in self.examples]
        scored.sort(key=lambda pair: pair[0], reverse=True)
        results = []
        for score, ex in scored[:k]:
            if score <= 0:
                continue
            copy = dict(ex)
            copy["similarity"] = round(float(score), 4)
            results.append(copy)
        return results


_retriever: ExampleRetriever | None = None


def get_similar_examples(column_name: str, k: int = 3) -> list[dict[str, Any]]:
    global _retriever
    if _retriever is None:
        _retriever = ExampleRetriever()
    return _retriever.get_similar_examples(column_name, k)
