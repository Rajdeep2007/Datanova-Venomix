# Setup & Troubleshooting Guide

## Setup

### 1. Backend (port 8000)

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS / Linux:
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env            # optional: add GOOGLE_API_KEY
uvicorn app.main:app --port 8000 --reload
```

### 2. Frontend (port 3000)

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

### 3. Running without a Gemini API key

The app works in **local-only mode** without a key: diagnoses, semantic types
and recommendations are produced by the local classifier + deterministic rule
engine. Set `GOOGLE_API_KEY` in `backend/.env` to unlock Gemini reasoning.

> Test suite: `cd backend && python -m pytest -q`
> Lint + build: `cd frontend && npm run lint && npm run build`

## Troubleshooting

### "Session not found" errors
Sessions are cached to `.cache/sessions/`. If the backend restarts from a
different working directory (or `.cache/` was deleted), sessions disappear.
Re-upload your file to start a new session.

### CORS errors
The frontend calls `http://localhost:8000`; the backend allows origins
`http://localhost:3000` / `http://localhost:3001`. Run the backend on port
8000 and the frontend on 3000 (or 3001) and you're fine.

### Gemini API errors / slow analysis
Analysis now runs as a **background job** with live progress, so a slow Gemini
never blocks the UI. If the API is down or you hit a free-tier rate limit
(`429 RESOURCE_EXHAUSTED`), the pipeline automatically falls back to the
deterministic rule engine — the UI shows a "Running in local fallback mode"
banner and recommendations are marked *needs review*.

The primary model is `gemini-3.6-flash`; configure via `MODEL_NAME` and
`FALLBACK_MODEL_NAMES` in `backend/.env`.

### joblib / sklearn loading failures
The committed classifier artifacts were trained with a specific scikit-learn
version. If loading fails, reinstall the pinned environment from
`requirements.txt`, or retrain:
`python scripts/train_classifier.py` (see `scripts/generate_weak_labels.py`
for weak-label generation with Gemini).

### .cache is not tracked by git
`.cache/` holds runtime artifacts (sessions, recipes, canvas outputs) and is
gitignored. Deleting it is safe — it just clears active sessions/recipes.
