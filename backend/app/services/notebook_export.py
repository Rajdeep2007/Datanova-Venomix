"""Export cleaning pipeline as reproducible Python code / Jupyter notebook."""

from __future__ import annotations

import json
from typing import Any

from app.services import session_store


def export_as_python_script(
    session_id: str,
    actions: list[dict],
    diagnosis: dict | None = None,
) -> str:
    """Generate a standalone Python script that reproduces the cleaning pipeline."""
    summary = session_store.get_summary(session_id)
    shape = summary.get("original_shape", {})

    lines = [
        '"""',
        "DataNova - Reproducible Data Cleaning Pipeline",
        f"Generated from session: {session_id}",
        f"Original dataset: {shape.get('rows', '?')} rows x {shape.get('columns', '?')} columns",
        '"""',
        "",
        "import pandas as pd",
        "import numpy as np",
        "",
        "# ── Configuration ────────────────────────────────────────────────────────",
        'INPUT_FILE = "your_dataset.csv"  # Replace with your file path',
        'OUTPUT_FILE = "cleaned_dataset.csv"',
        "",
        "# ── Load Data ───────────────────────────────────────────────────────────",
        'print("Loading data...")',
        "df = pd.read_csv(INPUT_FILE)",
        'print(f"Loaded {len(df):,} rows x {len(df.columns)} columns")',
        "",
        "# ── Original Statistics ─────────────────────────────────────────────────",
        'print("\\n--- Original Data Stats ---")',
        'print(f"Missing values: {df.isna().sum().sum():,}")',
        'print(f"Duplicate rows: {df.duplicated().sum():,}")',
        "",
    ]

    # Group actions by type for cleaner code
    action_groups = {}
    for action in actions:
        action_type = action.get("action", "")
        if action_type not in action_groups:
            action_groups[action_type] = []
        action_groups[action_type].append(action.get("column", ""))

    lines.append("# ── Cleaning Pipeline ──────────────────────────────────────────────────")
    lines.append('print("\\nApplying cleaning steps...")')
    lines.append("")

    step = 1
    for action_type, columns in action_groups.items():
        lines.append(f"# Step {step}: {action_type.replace('_', ' ').title()}")
        lines.append(f'# Columns: {", ".join(columns)}')
        lines.append("")

        if action_type == "impute_median":
            for col in columns:
                lines.append(f'median_val = df["{col}"].median()')
                lines.append(f'df["{col}"].fillna(median_val, inplace=True)')
                lines.append(f'print(f"  Imputed {col} with median: {{median_val:.2f}}")')
                lines.append("")

        elif action_type == "impute_mode":
            for col in columns:
                lines.append(f'mode_val = df["{col}"].mode()[0]')
                lines.append(f'df["{col}"].fillna(mode_val, inplace=True)')
                lines.append(f'print(f"  Imputed {col} with mode: {{mode_val}}")')
                lines.append("")

        elif action_type == "drop_column":
            cols_str = json.dumps(columns)
            lines.append(f'df.drop(columns={cols_str}, inplace=True)')
            lines.append(f'print(f"  Dropped {len(columns)} columns: {", ".join(columns)}")')
            lines.append("")

        elif action_type == "clip_outliers":
            for col in columns:
                lines.append(f'q_low = df["{col}"].quantile(0.01)')
                lines.append(f'q_high = df["{col}"].quantile(0.99)')
                lines.append(f'df["{col}"] = df["{col}"].clip(q_low, q_high)')
                lines.append(f'print(f"  Clipped {col} outliers to [{{q_low:.2f}}, {{q_high:.2f}}]")')
                lines.append("")

        elif action_type == "merge_categories":
            for col in columns:
                lines.append(f'df["{col}"] = df["{col}"].str.lower().str.strip()')
                lines.append(f'vc = df["{col}"].value_counts(normalize=True)')
                lines.append(f'rare = vc[vc < 0.01].index')
                lines.append(f'df["{col}"] = df["{col}"].apply(lambda x: "other" if x in rare else x)')
                lines.append(f'print(f"  Merged rare categories in {col}")')
                lines.append("")

        elif action_type == "log_transform":
            for col in columns:
                lines.append(f'df["{col}"] = np.log1p(df["{col}"].clip(lower=0))')
                lines.append(f'print(f"  Applied log transform to {col}")')
                lines.append("")

        step += 1

    lines.extend([
        "# ── Cleaned Statistics ──────────────────────────────────────────────────",
        'print("\\n--- Cleaned Data Stats ---")',
        'print(f"Missing values: {df.isna().sum().sum():,}")',
        'print(f"Duplicate rows: {df.duplicated().sum():,}")',
        'print(f"Shape: {df.shape}")',
        "",
        "# ── Export ──────────────────────────────────────────────────────────────",
        "df.to_csv(OUTPUT_FILE, index=False)",
        'print(f"\\nCleaned data saved to {OUTPUT_FILE}")',
        "",
        "# ── DataNova Quality Score ──────────────────────────────────────────────",
        "# Run: pip install datanova (coming soon)",
        "# from datanova import quality_score",
        "# score = quality_score(df)",
        '# print(f"Quality Score: {score}/100")',
    ])

    return "\n".join(lines)


def export_as_jupyter_notebook(
    session_id: str,
    actions: list[dict],
    diagnosis: dict | None = None,
) -> dict[str, Any]:
    """Generate a Jupyter notebook JSON structure."""
    cells = []

    # Title cell
    cells.append({
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "# DataNova - Data Cleaning Pipeline\n",
            f"**Session:** `{session_id}`  \n",
            "**Auto-generated by DataNova AI**",
        ],
    })

    # Setup cell
    cells.append({
        "cell_type": "code",
        "metadata": {},
        "source": [
            "import pandas as pd\n",
            "import numpy as np\n",
            "import matplotlib.pyplot as plt\n",
            "import seaborn as sns\n",
            "\n",
            '%matplotlib inline\n',
            'plt.style.use("seaborn-v0_8-whitegrid")',
        ],
        "execution_count": None,
        "outputs": [],
    })

    # Load data cell
    cells.append({
        "cell_type": "code",
        "metadata": {},
        "source": [
            'df = pd.read_csv("your_dataset.csv")\n',
            'print(f"Shape: {df.shape}")\n',
            "df.head()",
        ],
        "execution_count": None,
        "outputs": [],
    })

    # Before stats cell
    cells.append({
        "cell_type": "markdown",
        "metadata": {},
        "source": ["## Original Data Statistics"],
    })

    cells.append({
        "cell_type": "code",
        "metadata": {},
        "source": [
            'print("Missing values:")\n',
            "print(df.isna().sum()[df.isna().sum() > 0])\n",
            'print(f"\\nTotal missing: {df.isna().sum().sum()}")\n',
            'print(f"Duplicate rows: {df.duplicated().sum()}")',
        ],
        "execution_count": None,
        "outputs": [],
    })

    # Cleaning steps
    action_groups = {}
    for action in actions:
        action_type = action.get("action", "")
        if action_type not in action_groups:
            action_groups[action_type] = []
        action_groups[action_type].append(action.get("column", ""))

    for action_type, columns in action_groups.items():
        title = action_type.replace("_", " ").title()
        cells.append({
            "cell_type": "markdown",
            "metadata": {},
            "source": [f"## Cleaning: {title}\n", f"**Columns:** {', '.join(columns)}"],
        })

        code_lines = []
        if action_type == "impute_median":
            for col in columns:
                code_lines.extend([
                    f'median_val = df["{col}"].median()\n',
                    f'df["{col}"].fillna(median_val, inplace=True)\n',
                    f'print(f"Imputed {col} with median: {{median_val:.2f}}")\n',
                ])
        elif action_type == "drop_column":
            code_lines.append(f'df.drop(columns={json.dumps(columns)}, inplace=True)\n')
        elif action_type == "clip_outliers":
            for col in columns:
                code_lines.extend([
                    f'q_low, q_high = df["{col}"].quantile([0.01, 0.99])\n',
                    f'df["{col}"] = df["{col}"].clip(q_low, q_high)\n',
                ])
        elif action_type == "impute_mode":
            for col in columns:
                code_lines.extend([
                    f'mode_val = df["{col}"].mode()[0]\n',
                    f'df["{col}"].fillna(mode_val, inplace=True)\n',
                ])

        cells.append({
            "cell_type": "code",
            "metadata": {},
            "source": code_lines,
            "execution_count": None,
            "outputs": [],
        })

    # After stats cell
    cells.append({
        "cell_type": "markdown",
        "metadata": {},
        "source": ["## Cleaned Data Statistics"],
    })

    cells.append({
        "cell_type": "code",
        "metadata": {},
        "source": [
            'print("Missing values after cleaning:")\n',
            "print(df.isna().sum()[df.isna().sum() > 0])\n",
            'print(f"\\nTotal missing: {df.isna().sum().sum()}")\n',
            'print(f"Duplicate rows: {df.duplicated().sum()}")\n',
            "df.head()",
        ],
        "execution_count": None,
        "outputs": [],
    })

    # Export cell
    cells.append({
        "cell_type": "code",
        "metadata": {},
        "source": [
            'df.to_csv("cleaned_dataset.csv", index=False)\n',
            'print("Cleaned data saved to cleaned_dataset.csv")',
        ],
        "execution_count": None,
        "outputs": [],
    })

    notebook = {
        "nbformat": 4,
        "nbformat_minor": 5,
        "metadata": {
            "kernelspec": {
                "display_name": "Python 3",
                "language": "python",
                "name": "python3",
            },
            "language_info": {
                "name": "python",
                "version": "3.11.0",
            },
        },
        "cells": cells,
    }

    return notebook


def export_as_sql(
    session_id: str,
    actions: list[dict],
    table_name: str = "cleaned_data",
) -> str:
    """Generate SQL migration script for the cleaning steps."""
    lines = [
        f"-- DataNova SQL Cleaning Pipeline",
        f"-- Session: {session_id}",
        f"-- Table: {table_name}",
        "",
        f"CREATE TABLE {table_name}_cleaned AS",
        f"SELECT * FROM {table_name};",
        "",
    ]

    for i, action in enumerate(actions):
        action_type = action.get("action", "")
        col = action.get("column", "")

        if action_type == "impute_median":
            lines.append(
                f"-- Step {i+1}: Impute {col} with median\n"
                f"UPDATE {table_name}_cleaned\n"
                f"SET {col} = (SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY {col}) FROM {table_name}_cleaned)\n"
                f"WHERE {col} IS NULL;\n"
            )
        elif action_type == "impute_mode":
            lines.append(
                f"-- Step {i+1}: Impute {col} with mode\n"
                f"UPDATE {table_name}_cleaned\n"
                f"SET {col} = (SELECT {col} FROM {table_name}_cleaned WHERE {col} IS NOT NULL GROUP BY {col} ORDER BY COUNT(*) DESC LIMIT 1)\n"
                f"WHERE {col} IS NULL;\n"
            )
        elif action_type == "drop_column":
            lines.append(
                f"-- Step {i+1}: Drop column {col}\n"
                f"ALTER TABLE {table_name}_cleaned DROP COLUMN {col};\n"
            )

    lines.append(f"-- Done! Cleaned table: {table_name}_cleaned")
    return "\n".join(lines)
