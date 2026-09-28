"""Train the local semantic column-type classifier.

Loads ground-truth labels from synthetic_labels.csv (and optionally
weak_labels.csv from Gemini), extracts features, trains two models
(GradientBoosting and LogisticRegression), picks the winner, and saves
the trained sklearn Pipeline to backend/app/models/semantic_classifier.joblib.

Usage:
    cd backend
    .venv\\Scripts\\python scripts\\train_classifier.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

# Ensure backend root is on sys.path
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_BACKEND_ROOT))

from app.services.feature_extraction import extract_column_features

SCRIPTS_DIR = Path(__file__).resolve().parent
SYNTHETIC_LABELS_PATH = SCRIPTS_DIR / "synthetic_labels.csv"
WEAK_LABELS_PATH = SCRIPTS_DIR / "weak_labels.csv"
SYNTHETIC_DATA_DIR = _BACKEND_ROOT / "sample_data" / "synthetic"

MODEL_OUT_DIR = _BACKEND_ROOT / "app" / "models"
MODEL_OUT_PATH = MODEL_OUT_DIR / "semantic_classifier.joblib"
FEATURES_OUT_PATH = MODEL_OUT_DIR / "feature_columns.json"


import sys
# Add backend to path so we can import from app
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.semantic_classifier import PreFitCV


def _load_synthetic_features() -> pd.DataFrame:
    """Load synthetic CSVs, extract features, and attach ground-truth labels."""
    labels_df = pd.read_csv(SYNTHETIC_LABELS_PATH)
    print(f"Loaded {len(labels_df)} ground-truth labels from synthetic_labels.csv")

    rows: list[dict] = []
    for _, row in labels_df.iterrows():
        csv_path = SYNTHETIC_DATA_DIR / row["csv_filename"]
        if not csv_path.exists():
            print(f"  WARNING: {csv_path} not found, skipping")
            continue
        df = pd.read_csv(csv_path)
        col = row["column_name"]
        if col not in df.columns:
            print(f"  WARNING: column {col!r} not in {row['csv_filename']}, skipping")
            continue

        feats = extract_column_features(df[col], col)
        # Flatten: remove sample_values and nested dicts
        flat: dict = {}
        for k, v in feats.items():
            if k == "sample_values":
                continue
            if isinstance(v, dict):
                flat.update(v)
            else:
                flat[k] = v
        flat["semantic_type"] = row["semantic_type"]
        rows.append(flat)

    return pd.DataFrame(rows)


def _load_weak_labels() -> pd.DataFrame | None:
    """Load Gemini-labeled features if the file exists."""
    if not WEAK_LABELS_PATH.exists():
        print("No weak_labels.csv found (Gemini labeling not run yet). Using synthetic labels only.")
        return None
    df = pd.read_csv(WEAK_LABELS_PATH)
    if df.empty or "semantic_type" not in df.columns:
        print("weak_labels.csv is empty or malformed. Skipping.")
        return None
    print(f"Loaded {len(df)} Gemini weak labels from weak_labels.csv")
    return df


def main():
    # ── Load data ───────────────────────────────────────────────────────
    synth_df = _load_synthetic_features()
    weak_df = _load_weak_labels()

    if weak_df is not None:
        # Align columns: only keep columns that exist in both, plus semantic_type
        common_cols = list(set(synth_df.columns) & set(weak_df.columns))
        if "semantic_type" not in common_cols:
            common_cols.append("semantic_type")
        synth_df = synth_df[common_cols]
        weak_df = weak_df[common_cols]
        combined = pd.concat([synth_df, weak_df], ignore_index=True)
        print(f"Combined dataset: {len(combined)} rows")
    else:
        combined = synth_df

    print(f"\nTotal training examples: {len(combined)}")
    print(f"Label distribution:\n{combined['semantic_type'].value_counts().to_string()}\n")

    # ── Separate features and labels ────────────────────────────────────
    y = combined["semantic_type"]
    X = combined.drop(columns=["semantic_type"])

    # Convert booleans to int
    bool_cols = X.select_dtypes(include=["bool"]).columns
    X[bool_cols] = X[bool_cols].astype(int)

    # Fill any remaining NaNs with 0
    X = X.fillna(0)

    # Ensure all columns are numeric
    for col in X.columns:
        X[col] = pd.to_numeric(X[col], errors="coerce").fillna(0)

    feature_columns = list(X.columns)
    print(f"Feature columns ({len(feature_columns)}): {feature_columns}\n")

    # ── Train/calibration/test split (60/20/20) ─────────────────────────
    # Use stratified split; if any class has < 2 samples, fall back to non-stratified
    try:
        X_train, X_temp, y_train, y_temp = train_test_split(
            X, y, test_size=0.4, random_state=42, stratify=y
        )
        X_cal, X_test, y_cal, y_test = train_test_split(
            X_temp, y_temp, test_size=0.5, random_state=42, stratify=y_temp
        )
    except ValueError:
        print("WARNING: Some classes have too few samples for stratified split. Using random split.")
        X_train, X_temp, y_train, y_temp = train_test_split(
            X, y, test_size=0.4, random_state=42
        )
        X_cal, X_test, y_cal, y_test = train_test_split(
            X_temp, y_temp, test_size=0.5, random_state=42
        )

    print(f"Train: {len(X_train)} | Calibration: {len(X_cal)} | Test: {len(X_test)}\n")

    # ── Model 1: GradientBoosting ───────────────────────────────────────
    gb_pipe = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", GradientBoostingClassifier(
            n_estimators=200,
            max_depth=4,
            learning_rate=0.1,
            random_state=42,
        )),
    ])
    gb_pipe.fit(X_train, y_train)
    gb_preds = gb_pipe.predict(X_test)
    gb_acc = accuracy_score(y_test, gb_preds)

    print("=" * 60)
    print("GradientBoosting Classification Report (Uncalibrated)")
    print("=" * 60)
    print(classification_report(y_test, gb_preds, zero_division=0))
    print(f"Accuracy: {gb_acc:.4f}\n")

    # ── Model 2: LogisticRegression ─────────────────────────────────────
    lr_pipe = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", LogisticRegression(
            max_iter=1000,
            random_state=42,
            C=1.0,
        )),
    ])
    lr_pipe.fit(X_train, y_train)
    lr_preds = lr_pipe.predict(X_test)
    lr_acc = accuracy_score(y_test, lr_preds)

    print("=" * 60)
    print("LogisticRegression Classification Report (Uncalibrated)")
    print("=" * 60)
    print(classification_report(y_test, lr_preds, zero_division=0))
    print(f"Accuracy: {lr_acc:.4f}\n")

    # ── Pick the winner ─────────────────────────────────────────────────
    if gb_acc >= lr_acc:
        winner_name = "GradientBoosting"
        winner_pipe = gb_pipe
    else:
        winner_name = "LogisticRegression"
        winner_pipe = lr_pipe

    print(f">>> Winner: {winner_name} (accuracy {max(gb_acc, lr_acc):.4f})")
    
    # ── Calibrate the winner ────────────────────────────────────────────
    from sklearn.calibration import CalibratedClassifierCV
    
    # Using method="sigmoid" (Platt Scaling) because the dataset is very small (~93 rows).
    # Isotonic regression would likely overfit on such a small calibration set.
    from sklearn.frozen import FrozenEstimator
    
    calibrated_model = CalibratedClassifierCV(
        FrozenEstimator(winner_pipe), 
        method="sigmoid", 
        cv=PreFitCV()
    )
    calibrated_model.fit(X_cal, y_cal)
    
    # ── Calibration Report ──────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("Calibration Report (Test Set)")
    print("=" * 60)
    
    # Get probabilities for the true class
    cal_probs = calibrated_model.predict_proba(X_test)
    cal_preds = calibrated_model.predict(X_test)
    
    # Bucket predictions into confidence ranges
    buckets = {
        "0.0-0.5": {"total": 0, "correct": 0},
        "0.5-0.6": {"total": 0, "correct": 0},
        "0.6-0.7": {"total": 0, "correct": 0},
        "0.7-0.8": {"total": 0, "correct": 0},
        "0.8-0.9": {"total": 0, "correct": 0},
        "0.9-1.0": {"total": 0, "correct": 0},
    }
    
    for i in range(len(cal_preds)):
        pred_class_idx = np.where(calibrated_model.classes_ == cal_preds[i])[0][0]
        confidence = cal_probs[i][pred_class_idx]
        is_correct = (cal_preds[i] == y_test.iloc[i])
        
        if confidence < 0.5:
            b = "0.0-0.5"
        elif confidence < 0.6:
            b = "0.5-0.6"
        elif confidence < 0.7:
            b = "0.6-0.7"
        elif confidence < 0.8:
            b = "0.7-0.8"
        elif confidence < 0.9:
            b = "0.8-0.9"
        else:
            b = "0.9-1.0"
            
        buckets[b]["total"] += 1
        if is_correct:
            buckets[b]["correct"] += 1
            
    for b, stats in buckets.items():
        total = stats["total"]
        if total > 0:
            accuracy = stats["correct"] / total
            print(f"Confidence {b:10s} : {total:3d} predictions | Actual Accuracy: {accuracy:.1%}")
        else:
            print(f"Confidence {b:10s} :   0 predictions | Actual Accuracy: N/A")
            
    cal_acc = accuracy_score(y_test, cal_preds)
    print(f"\nCalibrated Accuracy: {cal_acc:.4f}\n")

    # ── Compute Dynamic Confidence Threshold ────────────────────────────
    computed_threshold = 0.75  # fallback
    for b in sorted(buckets.keys()):
        stats = buckets[b]
        if stats["total"] > 0:
            acc = stats["correct"] / stats["total"]
            if acc >= 0.90:
                lower_bound = float(b.split("-")[0])
                # Small buffer if it's 0.0 to prevent 0 threshold, but here min bucket is 0.0-0.5
                computed_threshold = max(0.5, lower_bound)
                print(f"Computed dynamic confidence threshold: {computed_threshold} (from bucket {b} with {acc:.1%} accuracy on {stats['total']} samples)")
                break


    # ── Save the model ──────────────────────────────────────────────────
    MODEL_OUT_DIR.mkdir(parents=True, exist_ok=True)
    
    # Save uncalibrated for reference
    joblib.dump(winner_pipe, MODEL_OUT_PATH)
    print(f"Saved uncalibrated model to {MODEL_OUT_PATH}")
    
    # Save calibrated
    CALIBRATED_MODEL_OUT_PATH = MODEL_OUT_DIR / "semantic_classifier_calibrated.joblib"
    joblib.dump(calibrated_model, CALIBRATED_MODEL_OUT_PATH)
    print(f"Saved calibrated model to {CALIBRATED_MODEL_OUT_PATH}")

    with open(FEATURES_OUT_PATH, "w") as f:
        json.dump(feature_columns, f, indent=2)
    print(f"Saved feature columns to {FEATURES_OUT_PATH}")

    THRESHOLD_OUT_PATH = MODEL_OUT_DIR / "confidence_threshold.json"
    with open(THRESHOLD_OUT_PATH, "w") as f:
        json.dump({"confidence_threshold": computed_threshold}, f, indent=2)
    print(f"Saved confidence threshold to {THRESHOLD_OUT_PATH}")


if __name__ == "__main__":
    main()
