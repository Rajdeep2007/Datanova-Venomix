"""AI Data Storytelling -- Gemini generates narrative insights about the dataset."""

from __future__ import annotations

import json
from typing import Any

from app.services.llm_pipeline import GeminiRESTClient, get_llm_client, LLM_AVAILABLE, _extract_json


STORYTELLING_PROMPT = """You are DataNova's AI Data Storyteller. Analyze the provided dataset diagnostics and generate a compelling, insightful data story.

Output MUST be a valid JSON object with this exact structure:
{
  "title": "A catchy title for the dataset (max 10 words)",
  "summary": "A 2-3 sentence executive summary of what this dataset is about and its overall health",
  "persona": "Describe the dataset as if it were a person -- what is its personality? (1-2 sentences)",
  "strengths": ["strength1", "strength2", "strength3"],
  "weaknesses": ["weakness1", "weakness2"],
  "journey": "A 2-3 sentence narrative about the data's journey from raw to analysis-ready",
  "recommendation_priority": "The single most important thing to fix first and why (1-2 sentences)",
  "fun_fact": "An interesting or surprising fact about this dataset (1 sentence)",
  "grade_explanation": "Explain the quality grade in plain English (1-2 sentences)"
}

Rules:
- Be specific with numbers (e.g., "42% of rows have missing income values")
- Use analogies a non-technical person would understand
- Make the story engaging, not dry
- Focus on actionable insights
- The persona should be creative and memorable
- Output ONLY valid JSON, no markdown fences"""


async def generate_data_story(
    diagnosis: dict,
    semantic_types: list[dict],
    recommendations: list[dict],
    target_column: str | None = None,
) -> dict[str, Any]:
    """Generate a compelling data story using Gemini."""
    if not LLM_AVAILABLE:
        return _generate_fallback_story(diagnosis, semantic_types, recommendations)

    payload = {
        "shape": diagnosis.get("shape"),
        "quality": diagnosis.get("quality"),
        "missingness_summary": _summarize_missingness(diagnosis),
        "outlier_summary": _summarize_outliers(diagnosis),
        "correlation_count": len(diagnosis.get("correlated_pairs", [])),
        "duplicate_info": diagnosis.get("duplicate_rows", {}),
        "semantic_types": _summarize_types(semantic_types),
        "top_recommendations": [
            {"column": r["column"], "action": r["recommended_action"], "severity": r.get("severity", "medium")}
            for r in recommendations[:5]
        ],
        "target_column": target_column,
    }

    prompt = STORYTELLING_PROMPT + "\n\nDataset diagnostics:\n" + json.dumps(payload, indent=2, default=str)

    try:
        llm = get_llm_client()
        response = await llm.generate(prompt)
        story = _extract_json(response)
        story["source"] = "gemini"
        return story
    except Exception:
        return _generate_fallback_story(diagnosis, semantic_types, recommendations)


async def generate_column_narrative(
    column_name: str,
    column_data: dict,
    semantic_type: str,
) -> str:
    """Generate a brief narrative for a specific column."""
    if not LLM_AVAILABLE:
        return _fallback_column_narrative(column_name, column_data, semantic_type)

    prompt = f"""Write a 1-2 sentence data scientist's note about the column '{column_name}'.
Semantic type: {semantic_type}
Stats: {json.dumps(column_data, default=str)}

Be specific and actionable. Output ONLY the narrative text, no JSON."""

    try:
        llm = get_llm_client()
        return await llm.generate(prompt)
    except Exception:
        return _fallback_column_narrative(column_name, column_data, semantic_type)


async def generate_cleaning_plan(
    recommendations: list[dict],
    diagnosis: dict,
) -> dict[str, Any]:
    """Generate an ordered cleaning plan with dependency reasoning."""
    if not LLM_AVAILABLE:
        return _fallback_cleaning_plan(recommendations)

    payload = {
        "recommendations": [
            {
                "column": r["column"],
                "action": r["recommended_action"],
                "severity": r.get("severity", "medium"),
                "confidence": r.get("confidence", 0),
                "justification": r.get("justification", ""),
            }
            for r in recommendations
        ],
        "issues": {
            "duplicate_rows": diagnosis.get("duplicate_rows", {}).get("duplicate_row_count", 0),
            "correlated_pairs": len(diagnosis.get("correlated_pairs", [])),
            "constant_features": len(diagnosis.get("constant_features", [])),
        },
    }

    prompt = f"""You are a data cleaning strategist. Given these recommendations, create an optimized cleaning plan.

Output ONLY valid JSON with this structure:
{{
  "steps": [
    {{"order": 1, "action": "action_name", "column": "col", "reason": "why this comes first", "estimated_impact": "high/medium/low"}},
    ...
  ],
  "parallel_groups": [["col_a_action", "col_b_action"]],
  "estimated_quality_improvement": "X points",
  "total_steps": N
}}

Rules:
- Order by impact (highest first) and dependencies (e.g., deduplicate before impute)
- Group independent actions that can run in parallel
- Be specific about why ordering matters

Recommendations:
{json.dumps(payload, indent=2, default=str)}"""

    try:
        llm = get_llm_client()
        response = await llm.generate(prompt)
        plan = _extract_json(response)
        plan["source"] = "gemini"
        return plan
    except Exception:
        return _fallback_cleaning_plan(recommendations)


def _summarize_missingness(diagnosis: dict) -> dict:
    missing = diagnosis.get("missingness", [])
    flagged = [m for m in missing if m.get("missing_pct", 0) > 0]
    return {
        "total_columns": len(missing),
        "columns_with_missing": len(flagged),
        "worst_column": max(flagged, key=lambda m: m.get("missing_pct", 0))["column"] if flagged else None,
        "worst_pct": max((m.get("missing_pct", 0) for m in flagged), default=0),
    }


def _summarize_outliers(diagnosis: dict) -> dict:
    outliers = diagnosis.get("outliers", [])
    return {
        "columns_with_outliers": len(outliers),
        "total_outlier_rows": sum(o.get("outlier_count", 0) for o in outliers),
    }


def _summarize_types(semantic_types: list[dict]) -> dict:
    from collections import Counter
    types = Counter(st.get("semantic_type", "unknown") for st in semantic_types)
    return dict(types.most_common(10))


def _generate_fallback_story(
    diagnosis: dict, semantic_types: list[dict], recommendations: list[dict]
) -> dict[str, Any]:
    """Deterministic story when Gemini is unavailable."""
    quality = diagnosis.get("quality", {})
    score = quality.get("overall_score", 50)
    grade = quality.get("overall_grade", "C")
    shape = diagnosis.get("shape", {})
    missing = _summarize_missingness(diagnosis)
    outliers = _summarize_outliers(diagnosis)

    if score >= 80:
        title = "A Healthy Dataset Ready for Action"
        persona = "This dataset is a well-maintained garden -- mostly tidy with just a few weeds to pull."
    elif score >= 60:
        title = "A Dataset With Potential"
        persona = "This dataset is like a rough diamond -- good bones but needs polishing."
    elif score >= 40:
        title = "A Dataset That Needs Attention"
        persona = "This dataset is a patient in the ER -- stable but needs immediate care."
    else:
        title = "A Dataset in Critical Condition"
        persona = "This dataset is a ship in a storm -- it needs urgent repairs before it can sail."

    strengths = []
    weaknesses = []
    if missing["columns_with_missing"] == 0:
        strengths.append("No missing values -- every cell is populated")
    if outliers["columns_with_outliers"] == 0:
        strengths.append("No statistical outliers detected")
    if diagnosis.get("duplicate_rows", {}).get("duplicate_row_count", 0) == 0:
        strengths.append("All rows are unique -- no duplicates")
    if not diagnosis.get("correlated_pairs"):
        strengths.append("No problematic correlations between columns")
    if not strengths:
        strengths.append("The dataset structure is intact and parseable")

    if missing["columns_with_missing"] > 0:
        weaknesses.append(f"{missing['columns_with_missing']} columns have missing data (worst: {missing['worst_column']} at {missing['worst_pct']:.0f}%)")
    if outliers["columns_with_outliers"] > 0:
        weaknesses.append(f"{outliers['columns_with_outliers']} columns contain statistical outliers")
    if diagnosis.get("duplicate_rows", {}).get("duplicate_row_count", 0) > 0:
        weaknesses.append(f"{diagnosis['duplicate_rows']['duplicate_row_count']} duplicate rows found")

    top_rec = recommendations[0] if recommendations else None

    return {
        "title": title,
        "summary": f"This dataset contains {shape.get('rows', 0)} rows and {shape.get('columns', 0)} columns with an overall quality score of {score}/100 (Grade: {grade}).",
        "persona": persona,
        "strengths": strengths[:3],
        "weaknesses": weaknesses[:2],
        "journey": f"From {shape.get('rows', 0)} raw records, the data has been analyzed across {shape.get('columns', 0)} dimensions. {missing['columns_with_missing']} columns need attention before analysis.",
        "recommendation_priority": f"Fix '{top_rec['column']}' first -- {top_rec.get('justification', 'it has the highest impact')}" if top_rec else "No critical issues found.",
        "fun_fact": f"Your data has a quality grade of {grade} -- that puts it in the {'top' if score >= 70 else 'bottom'} tier of datasets we've seen.",
        "grade_explanation": f"A grade of {grade} means {'excellent' if grade == 'A' else 'good' if grade == 'B' else 'needs work' if grade == 'C' else 'poor' if grade == 'D' else 'critical'} data quality.",
        "source": "deterministic",
    }


def _fallback_column_narrative(column_name: str, column_data: dict, semantic_type: str) -> str:
    missing_pct = column_data.get("missing_pct", 0)
    if missing_pct > 50:
        return f"The '{column_name}' column ({semantic_type}) is critically incomplete with {missing_pct:.0f}% missing values. Consider dropping or finding an alternative data source."
    elif missing_pct > 0:
        return f"The '{column_name}' column ({semantic_type}) has {missing_pct:.0f}% missing values that need imputation."
    return f"The '{column_name}' column ({semantic_type}) is complete and ready for analysis."


def _fallback_cleaning_plan(recommendations: list[dict]) -> dict[str, Any]:
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    sorted_recs = sorted(recommendations, key=lambda r: severity_order.get(r.get("severity", "medium"), 2))

    steps = []
    for i, rec in enumerate(sorted_recs):
        steps.append({
            "order": i + 1,
            "action": rec["recommended_action"],
            "column": rec["column"],
            "reason": rec.get("justification", "Recommended by analysis"),
            "estimated_impact": rec.get("severity", "medium"),
        })

    return {
        "steps": steps,
        "parallel_groups": [],
        "estimated_quality_improvement": f"~{min(len(steps) * 8, 40)} points",
        "total_steps": len(steps),
        "source": "deterministic",
    }
