"""Natural Language Data Chat -- ask questions about your dataset in plain English."""

from __future__ import annotations

import json
from typing import Any

import pandas as pd

from app.services.llm_pipeline import get_llm_client, LLM_AVAILABLE, _extract_json
from app.services import session_store, stats_engine


CHAT_SYSTEM_PROMPT = """You are DataNova's AI Data Analyst. You can answer questions about a dataset using the provided context.

You have access to:
- Dataset shape and types
- Statistical summaries
- Missing value analysis
- Correlation data
- Quality scores
- The actual data sample

Rules:
- Be concise and specific
- Use numbers from the data
- If you can answer from the context, do so
- If the question requires computation you can't do, explain what analysis would be needed
- Output a JSON object with this structure:
{
  "answer": "Your answer in plain English (2-4 sentences)",
  "insights": ["insight1", "insight2"],
  "follow_up_questions": ["suggested follow-up 1", "suggested follow-up 2"],
  "data_references": ["column_name1", "column_name2"]
}

Output ONLY valid JSON, no markdown."""


async def chat_about_data(
    session_id: str,
    question: str,
    conversation_history: list[dict] | None = None,
) -> dict[str, Any]:
    """Answer a natural language question about the dataset."""
    df = session_store.get_session(session_id)
    if df is None:
        return {
            "answer": "I couldn't find the dataset. Please upload a file first.",
            "insights": [],
            "follow_up_questions": [],
            "data_references": [],
        }

    # Build context
    context = _build_data_context(df, session_id)

    if not LLM_AVAILABLE:
        return _rule_based_answer(question, df, context)

    # Build conversation
    messages = [{"role": "system", "content": CHAT_SYSTEM_PROMPT}]

    if conversation_history:
        for msg in conversation_history[-6:]:  # Last 6 messages for context
            messages.append({"role": "user" if msg.get("role") == "user" else "model", "content": msg.get("content", "")})

    user_prompt = f"Dataset context:\n{json.dumps(context, indent=2, default=str)}\n\nUser question: {question}"
    messages.append({"role": "user", "content": user_prompt})

    try:
        llm = get_llm_client()
        # Build prompt from messages
        full_prompt = "\n\n".join(
            f"{'System' if m['role'] == 'system' else 'User' if m['role'] == 'user' else 'Assistant'}: {m['content']}"
            for m in messages
        )
        response = await llm.generate(full_prompt)
        result = _extract_json(response)
        result["source"] = "gemini"
        return result
    except Exception:
        return _rule_based_answer(question, df, context)


async def generate_insights(session_id: str) -> dict[str, Any]:
    """Auto-generate key insights about the dataset."""
    df = session_store.get_session(session_id)
    if df is None:
        return {"insights": [], "summary": "No dataset found."}

    context = _build_data_context(df, session_id)

    if not LLM_AVAILABLE:
        return _rule_based_insights(df, context)

    prompt = f"""Analyze this dataset and generate 5-7 key insights.

Dataset context:
{json.dumps(context, indent=2, default=str)}

Output ONLY valid JSON:
{{
  "insights": [
    {{"type": "statistical", "text": "insight text", "importance": "high/medium/low"}},
    ...
  ],
  "summary": "2-3 sentence overall summary",
  "anomalies": ["anomaly1", "anomaly2"],
  "patterns": ["pattern1", "pattern2"]
}}"""

    try:
        llm = get_llm_client()
        response = await llm.generate(prompt)
        result = _extract_json(response)
        result["source"] = "gemini"
        return result
    except Exception:
        return _rule_based_insights(df, context)


def _build_data_context(df: pd.DataFrame, session_id: str) -> dict:
    """Build a comprehensive context dict about the dataset."""
    import numpy as np

    dtypes = df.dtypes.value_counts().to_dict()
    dtypes = {str(k): int(v) for k, v in dtypes.items()}

    stats = {}
    for col in df.columns:
        col_stats = {"dtype": str(df[col].dtype), "non_null": int(df[col].count())}
        if pd.api.types.is_numeric_dtype(df[col]):
            desc = df[col].describe()
            col_stats.update({
                "mean": round(float(desc.get("mean", 0)), 2),
                "std": round(float(desc.get("std", 0)), 2),
                "min": round(float(desc.get("min", 0)), 2),
                "max": round(float(desc.get("max", 0)), 2),
                "median": round(float(df[col].median()), 2),
            })
        elif df[col].nunique() < 20:
            col_stats["top_values"] = df[col].value_counts().head(5).to_dict()
        stats[col] = col_stats

    diagnosis = stats_engine.full_diagnosis(df)
    quality = diagnosis.get("quality", {})

    return {
        "shape": {"rows": len(df), "columns": len(df.columns)},
        "dtypes": dtypes,
        "column_stats": stats,
        "quality_score": quality.get("overall_score"),
        "quality_grade": quality.get("overall_grade"),
        "missing_columns": [m["column"] for m in diagnosis.get("missingness", []) if m.get("missing_pct", 0) > 0],
        "outlier_columns": [o["column"] for o in diagnosis.get("outliers", []) if o.get("outlier_count", 0) > 0],
        "sample_rows": df.head(3).to_dict(orient="records"),
    }


def _rule_based_answer(question: str, df: pd.DataFrame, context: dict) -> dict[str, Any]:
    """Answer common questions without Gemini."""
    q = question.lower()
    shape = context["shape"]
    quality = context.get("quality_score", 50)
    grade = context.get("quality_grade", "C")

    if any(w in q for w in ["how many", "rows", "size", "shape"]):
        answer = f"The dataset has {shape['rows']:,} rows and {shape['columns']} columns."
        refs = list(df.columns[:3])
    elif any(w in q for w in ["missing", "null", "empty", "nan"]):
        missing = context.get("missing_columns", [])
        if missing:
            answer = f"{len(missing)} columns have missing values: {', '.join(missing[:5])}."
        else:
            answer = "There are no missing values in this dataset."
        refs = missing[:3]
    elif any(w in q for w in ["outlier", "anomaly", "unusual"]):
        outliers = context.get("outlier_columns", [])
        if outliers:
            answer = f"{len(outliers)} columns contain outliers: {', '.join(outliers[:5])}."
        else:
            answer = "No statistical outliers were detected."
        refs = outliers[:3]
    elif any(w in q for w in ["quality", "health", "score", "grade"]):
        answer = f"The dataset has a quality score of {quality}/100 (Grade: {grade})."
        refs = []
    elif any(w in q for w in ["column", "columns", "feature", "features"]):
        answer = f"The dataset has {shape['columns']} columns: {', '.join(list(df.columns[:8]))}."
        refs = list(df.columns[:5])
    elif any(w in q for w in ["type", "dtype", "data type"]):
        dtypes = context.get("dtypes", {})
        answer = f"Column types: {', '.join(f'{k}: {v}' for k, v in dtypes.items())}."
        refs = []
    elif any(w in q for w in ["duplicate", "repeated"]):
        dup = context.get("duplicate_count", 0)
        answer = f"Found {dup} duplicate rows in the dataset." if dup else "No duplicate rows detected."
        refs = []
    else:
        answer = f"I can help with questions about this dataset's {shape['rows']:,} rows and {shape['columns']} columns. Try asking about missing values, outliers, data types, or quality."
        refs = []

    return {
        "answer": answer,
        "insights": [f"Quality score: {quality}/100 ({grade})"],
        "follow_up_questions": [
            "What columns have missing values?",
            "Are there any outliers?",
            "What is the data quality score?",
        ],
        "data_references": refs,
        "source": "rule_based",
    }


def _rule_based_insights(df: pd.DataFrame, context: dict) -> dict[str, Any]:
    """Generate insights without Gemini."""
    insights = []
    shape = context["shape"]
    quality = context.get("quality_score", 50)

    missing = context.get("missing_columns", [])
    if missing:
        insights.append({
            "type": "data_quality",
            "text": f"{len(missing)} out of {shape['columns']} columns have missing data",
            "importance": "high" if len(missing) > shape["columns"] * 0.3 else "medium",
        })

    outliers = context.get("outlier_columns", [])
    if outliers:
        insights.append({
            "type": "anomaly",
            "text": f"{len(outliers)} columns contain statistical outliers that may skew analysis",
            "importance": "medium",
        })

    numeric_cols = df.select_dtypes(include="number").columns.tolist()
    if len(numeric_cols) >= 2:
        insights.append({
            "type": "statistical",
            "text": f"{len(numeric_cols)} numeric columns available for statistical analysis",
            "importance": "low",
        })

    cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()
    if cat_cols:
        insights.append({
            "type": "structure",
            "text": f"{len(cat_cols)} categorical columns: {', '.join(cat_cols[:3])}",
            "importance": "low",
        })

    return {
        "insights": insights,
        "summary": f"Dataset with {shape['rows']:,} rows, {shape['columns']} columns, quality score {quality}/100.",
        "anomalies": [f"{o} has outliers" for o in outliers[:3]],
        "patterns": [f"{len(numeric_cols)} numeric features", f"{len(cat_cols)} categorical features"] if cat_cols else [],
        "source": "rule_based",
    }
