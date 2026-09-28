"""ONE-TIME offline script: generate weak labels for the semantic classifier.

Usage:
    cd backend
    .venv\\Scripts\\python scripts\\generate_weak_labels.py [--data-dir sample_data/]

For each column in every CSV under --data-dir:
  1. Extract deterministic features via feature_extraction.py
  2. Batch columns and send (column_name + sample_values) to Gemini
     for semantic_type labeling
  3. Flatten features + Gemini label into a training row
  4. Write all rows to scripts/weak_labels.csv
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from pathlib import Path

import pandas as pd

# Ensure backend root is on sys.path so `app.` imports work
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_BACKEND_ROOT))

from app.services.feature_extraction import extract_column_features
from app.core.config import GOOGLE_API_KEY

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

VALID_LABELS = {
    "currency", "zip_code", "id", "free_text",
    "categorical_low_card", "categorical_high_card",
    "numeric_continuous", "date", "email", "phone", "percentage",
}

BATCH_SIZE = 8  # columns per single Gemini API call


def _build_batch_prompt(batch: list[dict]) -> str:
    """Build a numbered-list prompt for a batch of columns."""
    lines = [
        "Classify each column below into exactly one of these semantic types:\n"
        "[currency, zip_code, id, free_text, categorical_low_card, "
        "categorical_high_card, numeric_continuous, date, email, phone, percentage]\n\n"
        "Reply with a JSON array. Each element MUST be:\n"
        '{"index": <int>, "semantic_type": "<one of the labels above>"}\n'
        "Return ONLY the JSON array, nothing else.\n"
    ]
    for i, item in enumerate(batch):
        lines.append(
            f"{i+1}. column_name={item['column_name']!r}  "
            f"sample_values={item['sample_values']!r}"
        )
    return "\n".join(lines)


def _call_gemini_batch(batch: list[dict]) -> list[str]:
    """Send a batch to Gemini (raw REST) and return semantic_type labels."""
    import httpx

    from app.core.config import MODEL_NAME

    prompt = _build_batch_prompt(batch)
    resp = httpx.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL_NAME}:generateContent",
        json={"contents": [{"parts": [{"text": prompt}]}]},
        headers={"Content-Type": "application/json", "x-goog-api-key": GOOGLE_API_KEY},
        timeout=120.0,
    )
    resp.raise_for_status()
    data = resp.json()
    text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines).strip()

    results = json.loads(text)
    labels = [""] * len(batch)
    for item in results:
        idx = item.get("index", 0) - 1  # 1-indexed in prompt
        label = item.get("semantic_type", "")
        if 0 <= idx < len(batch) and label in VALID_LABELS:
            labels[idx] = label
    return labels


def _flatten_features(feat: dict) -> dict:
    """Remove non-model keys and flatten nested dicts."""
    flat = {}
    for k, v in feat.items():
        if k == "sample_values":
            continue  # not a model feature
        if isinstance(v, dict):
            flat.update(v)
        else:
            flat[k] = v
    return flat


def main():
    parser = argparse.ArgumentParser(description="Generate weak labels with Gemini")
    parser.add_argument(
        "--data-dir",
        type=str,
        default=str(_BACKEND_ROOT / "sample_data"),
        help="Folder containing CSV files to label",
    )
    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    csv_files = sorted(data_dir.glob("*.csv"))
    if not csv_files:
        logger.error("No CSV files found in %s", data_dir)
        sys.exit(1)

    logger.info("Found %d CSV(s) in %s", len(csv_files), data_dir)

    all_rows: list[dict] = []
    batch_buffer: list[dict] = []      # items pending Gemini labeling
    feature_buffer: list[dict] = []    # matching flattened features

    for csv_path in csv_files:
        logger.info("Processing %s ...", csv_path.name)
        try:
            df = pd.read_csv(csv_path, nrows=500)
        except Exception as e:
            logger.warning("Skipping %s: %s", csv_path.name, e)
            continue

        for col in df.columns:
            feats = extract_column_features(df[col], col)
            flat = _flatten_features(feats)

            batch_buffer.append({
                "column_name": col,
                "sample_values": feats["sample_values"],
            })
            feature_buffer.append(flat)

            if len(batch_buffer) >= BATCH_SIZE:
                labels = _call_gemini_batch(batch_buffer)
                for feat_row, label in zip(feature_buffer, labels):
                    if label:
                        feat_row["semantic_type"] = label
                        all_rows.append(feat_row)
                    else:
                        logger.warning("Empty label for a column, skipping row")
                batch_buffer.clear()
                feature_buffer.clear()

    # Flush remaining
    if batch_buffer:
        labels = _call_gemini_batch(batch_buffer)
        for feat_row, label in zip(feature_buffer, labels):
            if label:
                feat_row["semantic_type"] = label
                all_rows.append(feat_row)

    if not all_rows:
        logger.error("No rows labeled — check Gemini API key and data.")
        sys.exit(1)

    out_path = Path(__file__).resolve().parent / "weak_labels.csv"
    out_df = pd.DataFrame(all_rows)
    out_df.to_csv(out_path, index=False)
    logger.info(
        "Wrote %d labeled rows (%d features + label) → %s",
        len(out_df), len(out_df.columns) - 1, out_path,
    )
    logger.info("Label distribution:\n%s", out_df["semantic_type"].value_counts().to_string())


if __name__ == "__main__":
    main()
