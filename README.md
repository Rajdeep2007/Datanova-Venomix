# DataNova AI

**AI-powered data diagnostics, cleaning, and machine learning platform with a visual developer canvas.**

FastAPI · Next.js 16 · Python · MIT License · Hybrid AI + ML

📁 **Project Assets & Demo Video:** [Google Drive Resources](https://drive.google.com/drive/u/0/folders/1Nr_pRQrUWN6ily2lMvIovH858D9DczW4)

**Quick Start:** Upload your messy dataset, let AI diagnose the issues, preview the recommended fixes, train ML models on your cleaned data, and export the results — all from a visual node-based pipeline editor.

---

## Table of Contents

- [The Problem](#the-problem)
- [Features](#features)
- [Architecture](#architecture)
- [Why This Isn't Just Rule-Based ETL](#why-this-isnt-just-rule-based-etl)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [How It Works — Step by Step](#how-it-works--step-by-step)
- [Developer Canvas — 20+ Tools](#developer-canvas--20-tools)
- [ML Model Training](#ml-model-training)
- [API Reference](#api-reference)
- [Known Limitations](#known-limitations)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [FAQ](#faq)
- [License](#license)
- [Acknowledgements](#acknowledgements)

---

## The Problem

Traditional data cleaning tools rely on fixed rules (e.g., "if missing > 50%, drop column"). However, context matters: a 50% missing rate on an optional `middle_name` column is normal, but a 10% missing rate on `order_id` is a critical error. DataNova AI solves this by introducing a **semantic reasoning layer** that understands the context of your data to provide accurate, grounded remediation recommendations — and then lets you train ML models on the cleaned result to see the real-world impact.

---

## Features

- **Semantic Type Classification:** Identifies what your data actually represents (currency, zip_code, email, percentage, etc.), not just its underlying system data type.
- **Hybrid AI/ML Architecture:** Uses a lightning-fast local Gradient Boosting classifier for obvious columns and selectively escalates ambiguous columns to an LLM (Gemini 2.5 Flash).
- **Context-Aware Recommendations:** Suggests appropriate fixes (impute_median, merge_categories, log_transform, etc.) based on semantic type, correlation, and statistical distribution.
- **Quiz Gamification:** Guess the right fix before the AI reveals it — earn points, build streaks, and test your data intuition.
- **Developer Canvas:** A visual node-based pipeline editor with 20+ tools for transforms, filters, encoding, scaling, and ML training.
- **ML Model Training:** Train and compare 8 ML models (Random Forest, Gradient Boosting, SVM, KNN, etc.) directly on your data with accuracy scores, confusion matrices, and feature importance charts.
- **Natural Language Chat:** Ask questions about your dataset in plain English — "Which columns have outliers?", "What's the data quality score?"
- **What-If Simulator:** Preview the impact of cleaning actions before applying them.
- **Data Storytelling:** AI-generated narratives about your data's health with persona, strengths, weaknesses, and fun facts.
- **Export as Code:** Download cleaning pipelines as Python scripts, Jupyter notebooks, or SQL migrations.
- **Recovery Dashboard:** Animated before/after donut charts showing your data quality improvement.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js 16)                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │ Learner  │ │Developer │ │   Chat   │ │  Quiz / Story /  │   │
│  │  Mode    │ │  Canvas  │ │  Engine  │ │  Simulator / ML  │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────────┬─────────┘   │
│       └─────────────┼───────────┼─────────────────┘              │
│                     │  React Flow + Recharts                     │
└─────────────────────┼───────────────────────────────────────────┘
                      │ HTTP REST API
┌─────────────────────┼───────────────────────────────────────────┐
│               Backend (FastAPI)                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │Diagnose  │ │ Classify │ │  Reason  │ │  Execute Actions │   │
│  │ (stats)  │ │ (types)  │ │  (recs)  │ │  (pandas ops)    │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────────┬─────────┘   │
│       │             │            │                 │              │
│  ┌────▼─────┐ ┌─────▼────┐ ┌────▼──────┐  ┌──────▼──────────┐  │
│  │ scikit-  │ │ Local    │ │  Gemini   │  │  Canvas Store   │  │
│  │  learn   │ │ Gradient │ │  2.5 Flash│  │  (pickle cache) │  │
│  │  stats   │ │ Boosting │ │  + Rules  │  │                 │  │
│  └──────────┘ └──────────┘ └───────────┘  └─────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  ML Training: LogisticRegression, RandomForest,          │   │
│  │  GradientBoosting, SVM, KNN, DecisionTree, Ridge, Lasso │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 3-Stage Pipeline

| Stage | What It Does | Engine |
|-------|-------------|--------|
| **Diagnose** | Computes missing %, cardinality, correlations, outliers, duplicate rows/columns | scikit-learn + pandas |
| **Classify** | Predicts semantic type for each column (12 types: currency, date, id, email, etc.) | Local Gradient Boosting → escalates to Gemini for ambiguous columns |
| **Reason** | Generates tailored cleaning recommendations with justification and confidence | Gemini 2.5 Flash (self-consistency voting) with rule-based fallback |

---

## Why This Isn't Just Rule-Based ETL

In typical ETL workflows, data cleaning is driven by hardcoded thresholds. DataNova AI replaces this rigidity with **schema-constrained, LLM-powered reasoning**. Instead of applying a single fixed rule to every column (like filling all missing numerics with the median), DataNova uses a combination of offline ML and self-consistency voting to understand a column's semantic type.

For example:
- `age` (numeric_continuous) → **impute_median** (robust to outliers)
- `email` (email type) → **drop_column** (85% missing, can't fabricate emails)
- `customer_id` (id type) → **none** (never modify identifiers)
- `city` (categorical with 300+ rare categories) → **merge_categories** (group into "Other")

The system also performs **multivariate outlier detection** using Isolation Forest to catch unusual combinations of values that look normal individually.

---

## Tech Stack

| Component | Technology | Use Case |
|-----------|-----------|----------|
| **Frontend** | Next.js 16, React, TypeScript, Tailwind CSS | Interactive UI with step-by-step flows |
| **Canvas** | React Flow, Recharts | Visual node-based pipeline editor with charts |
| **Backend** | FastAPI (Python) | High-performance REST API, fully stateless session store |
| **Orchestration** | Custom async pipeline | 3-stage pipeline (Diagnose → Classify → Reason) |
| **AI / LLM** | Gemini 2.5 Flash | Semantic classification and reasoning layer |
| **ML Profiling** | scikit-learn, pandas, numpy, scipy | Dtype inference, outlier detection, local classification |
| **ML Training** | scikit-learn | 8 model types for supervised learning with cross-validation |
| **Embeddings** | sentence-transformers | Few-shot dynamic retrieval (all-MiniLM-L6-v2) |

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Python 3.11+
- A Google Gemini API key

### Installation

**Clone the repository**

```bash
git clone https://github.com/animeshadk10-ops/DataShakti.git
cd DataShakti
```

**Set up the Backend**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

**Configure Environment Variables**

Create a `.env` file in the `backend/` directory:

```env
GOOGLE_API_KEY=your_gemini_api_key
MODEL_NAME=gemini-2.5-flash
```

**Run the Backend (Port 8000)**

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Set up and Run the Frontend (Port 3000)**

Open a new terminal window:

```bash
cd frontend
npm install
npm run dev
```

Access the app at **http://localhost:3000**.

### Docker

```bash
docker-compose up --build
```

---

## How It Works — Step by Step

1. **Upload:** You upload a messy tabular dataset (.csv, .xlsx, .json). The backend assigns it a unique session ID.
2. **Diagnose:** The system calculates basic stats (missing %, cardinality, correlations, duplicate rows, constant features, infinite values, rare categories).
3. **Classify:** A local GradientBoosting classifier rapidly predicts the semantic type of each column. Low-confidence columns are escalated to Gemini with few-shot examples.
4. **Recommend:** Gemini generates specific fixes tied to a strictly constrained enum of operations (impute_median, clip_outliers, merge_categories, drop_column, log_transform, none).
5. **Quiz Mode:** Before revealing the AI's choice, you're prompted to guess the right fix — earn +10 points per correct guess, with streak bonuses.
6. **Apply:** You review the recommendations in the UI, check the before/after stats diff, and click "Apply". The backend executes the Pandas operations in memory.
7. **Developer Canvas:** For power users — build custom pipelines with 20+ node types including filters, encoding, scaling, ML training, and model comparison.
8. **Export:** Download your cleaned data as CSV, or export the cleaning pipeline as Python/Jupyter/SQL code.

---

## Developer Canvas — 20+ Tools

### Data Nodes
| Tool | Description |
|------|-------------|
| 📄 File / Session | Entry point for your uploaded dataset |
| 📊 Data Preview | View rows and columns as a resizable table |
| 📋 Dataset Stats | Comprehensive column statistics with types and missingness |

### Transform Nodes
| Tool | Description |
|------|-------------|
| 💉 Impute | Fill missing values (median/mode) |
| 🗑️ Drop Column | Remove a column entirely |
| ✂️ Clip Outliers | Cap extreme values at 1st/99th percentile |
| 🔗 Merge Categories | Group rare categories (< 1%) into "Other" |
| 📈 Log Transform | Apply log(1+x) to reduce skew |
| 🔍 Filter Rows | Keep rows matching a condition (equals, contains, >, <, etc.) |
| ↕️ Sort Rows | Sort by column ascending/descending |
| ✏️ Rename Column | Rename any column |
| 🔄 Type Cast | Change column type (numeric, string, datetime, boolean, category) |
| 🔢 Encode Categories | Label encoding or one-hot encoding |
| 📐 Scale / Normalize | Standard (z-score), Min-Max (0-1), or Robust (IQR) scaling |
| 🎲 Sample Rows | Random, head, or tail sampling |

### Visualize Nodes
| Tool | Description |
|------|-------------|
| 📈 Scatter Plot | Plot relationships between two numeric columns with optional color grouping |
| 📊 Box Plot | View distributions and outliers with optional group-by |
| 🔥 Heat Map | Correlation matrix visualization |

### Machine Learning Nodes
| Tool | Description |
|------|-------------|
| 🤖 ML Model Trainer | Train multiple ML models, select target + features, get accuracy scores |
| 📊 Model Comparison | Bar charts, confusion matrices, feature importance, predicted vs actual |

---

## ML Model Training

DataNova includes a built-in ML training pipeline that runs directly on your cleaned data:

### Supported Models

**Classification:**
| Model | Use Case |
|-------|----------|
| Logistic Regression | Linear baseline |
| Random Forest | Ensemble tree-based |
| Gradient Boosting | Sequential boosting |
| SVM (Support Vector Machine) | High-dimensional data |
| KNN (K-Nearest Neighbors) | Instance-based |
| Decision Tree | Interpretable baseline |

**Regression:**
| Model | Use Case |
|-------|----------|
| Linear Regression | Linear baseline |
| Ridge | Regularized linear |
| Lasso | Sparse linear with feature selection |
| Random Forest | Ensemble tree-based |
| Gradient Boosting | Sequential boosting |
| SVR | Support Vector Regression |

### Metrics Returned

| Task | Metrics |
|------|---------|
| Classification | Accuracy, Precision, Recall, F1, Confusion Matrix, ROC Curve (binary) |
| Regression | R², RMSE, MAE, MSE, Predicted vs Actual scatter |

### Feature Importance

Every trained model returns feature importance rankings, displayed as horizontal bar charts in the canvas.

---

## API Reference

### POST /upload
Uploads a CSV file and initializes an in-memory session.

```json
Response: {
  "session_id": "abc-123",
  "diagnosis": { ... }
}
```

### POST /analyze
Triggers the 3-stage pipeline to classify and generate recommendations.

```json
Request: { "session_id": "abc-123", "target_column": "revenue" }
Response: {
  "semantic_types": [ ... ],
  "recommendations": [ ... ],
  "target_analysis": null
}
```

### POST /apply-action
Executes a cleaning action and returns updated statistics.

```json
Request: { "session_id": "abc-123", "column": "age", "action": "impute_median" }
Response: {
  "success": true,
  "before": { "missing_pct": 5.2 },
  "after": { "missing_pct": 0.0 },
  "full_diagnosis": { ... }
}
```

### POST /execute-node
Execute any transform node on the developer canvas.

```json
Request: {
  "session_id": "abc-123",
  "node_type": "FilterRowsNode",
  "config": { "column": "age", "operator": "greater_than", "value": "18" },
  "upstream_node_output_id": "abc-123_node_123",
  "node_id": "node_456"
}
```

### GET /dataset-stats/{session_id}
Get comprehensive dataset statistics for any point in the pipeline.

### GET /scatter-data, /boxplot-data, /heatmap-data
Visualization data endpoints for canvas chart nodes.

### POST /chat
Natural language questions about your dataset.

### POST /story
AI-generated data storytelling with persona, strengths, weaknesses.

### POST /simulate
What-if simulation of cleaning actions before applying.

### GET /export/{session_id}
Download cleaned dataset as CSV.

---

## Known Limitations

- **Single-file upload only** — multi-file concatenation requires the developer canvas.
- **In-memory sessions** — data is lost on server restart (not persisted to disk by default).
- **LLM latency** — Gemini API calls add 2-5 seconds per analysis (mitigated by local fallback).
- **Hackathon-scale metrics** — performance numbers are on small demo datasets, not production-scale validation.
- **No authentication** — the tool is designed for local/hackathon use, not multi-tenant deployment.

---

## Roadmap

> Note: These are ideas for future exploration, not firm commitments.

- [ ] PostgreSQL persistent storage for sessions and cleaning recipes
- [ ] Multi-file upload with automatic schema matching
- [ ] Custom cleaning rule engine (user-defined thresholds)
- [ ] LLM-generated Python code snippets for advanced transformations
- [ ] Canvas save/load (serialize node graphs to JSON)
- [ ] WebSocket real-time progress streaming
- [ ] Parquet and Excel file format support
- [ ] Batch processing mode for multiple datasets

---

## Contributing

Contributions are welcome! Please open an issue first to discuss what you would like to change.

```bash
# Run backend tests
cd backend
python -m pytest tests/ -v

# Run frontend build check
cd frontend
npx next build
```

---

## FAQ

**Why use a hybrid model instead of sending everything to the LLM?**
The local Gradient Boosting classifier handles 60-70% of columns in <100ms with zero API cost. Only ambiguous columns (low confidence) are escalated to Gemini, reducing latency and cost while maintaining accuracy.

**Is my data stored permanently?**
No. All data is stored in-memory during your session and persisted to local pickle files that are cleaned up automatically. No data leaves your machine except Gemini API calls for ambiguous columns.

**What happens if I don't select a target column?**
The analysis still works — you'll get all recommendations based on the column's semantic type and statistical properties. Target-aware features (leakage detection, feature importance) are simply skipped.

**Can I add custom cleaning rules?**
Not yet — this is on the roadmap. Currently, the system uses the 7 predefined actions in the enum.

**What ML models are available?**
6 classification models (Logistic Regression, Random Forest, Gradient Boosting, SVM, KNN, Decision Tree) and 4 regression models (Linear, Ridge, Lasso, Random Forest, Gradient Boosting, SVR).

---

## License

Distributed under the MIT License. See `LICENSE` for more information.

---

## Acknowledgements

- **Google Gemini 2.5 Flash** for the reasoning and semantic inference layer
- **scikit-learn** for the local classifiers and ML training pipeline
- **React Flow** for the visual canvas node editor
- **Recharts** for chart components
- **Next.js 16** for the frontend framework
- **FastAPI** for the high-performance backend
- **sentence-transformers** for semantic similarity and few-shot retrieval
