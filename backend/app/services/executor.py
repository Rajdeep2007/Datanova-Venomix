from __future__ import annotations

import numpy as np
import pandas as pd
import hashlib

from app.models.enums import RecommendedAction


def _column_stats(df: pd.DataFrame, column: str) -> dict:
    """Compute summary stats for a single column (handles both numeric and non-numeric)."""
    if column not in df.columns:
        return {"missing_count": None, "missing_pct": None}

    series = df[column]
    n = len(series)
    missing = int(series.isna().sum())
    stats: dict = {
        "missing_count": missing,
        "missing_pct": round(100 * missing / n, 2) if n > 0 else 0.0,
    }
    if pd.api.types.is_numeric_dtype(series):
        desc = series.describe()
        stats.update({
            "mean": round(float(desc.get("mean", 0)), 4),
            "std": round(float(desc.get("std", 0)), 4),
            "min": round(float(desc.get("min", 0)), 4),
            "max": round(float(desc.get("max", 0)), 4),
        })
    return stats


def execute_action(
    df: pd.DataFrame, column: str, action: RecommendedAction
) -> tuple[pd.DataFrame, dict, dict]:
    """Execute a cleaning action on *column* and return (modified_df, before_stats, after_stats)."""

    before = _column_stats(df, column)
    result_df = df.copy()

    if action == RecommendedAction.impute_median:
        if column in result_df.columns and pd.api.types.is_numeric_dtype(result_df[column]):
            median_val = result_df[column].median()
            result_df[column] = result_df[column].fillna(median_val)

    elif action == RecommendedAction.impute_mode:
        if column in result_df.columns:
            mode_vals = result_df[column].mode()
            if not mode_vals.empty:
                result_df[column] = result_df[column].fillna(mode_vals.iloc[0])

    elif action == RecommendedAction.drop_column:
        if column in result_df.columns:
            result_df = result_df.drop(columns=[column])
            after: dict = {"missing_count": None, "missing_pct": None}
            return result_df, before, after

    elif action == RecommendedAction.clip_outliers:
        if column in result_df.columns and pd.api.types.is_numeric_dtype(result_df[column]):
            lower = result_df[column].quantile(0.01)
            upper = result_df[column].quantile(0.99)
            result_df[column] = result_df[column].clip(lower=lower, upper=upper)

    elif action == RecommendedAction.log_transform:
        if column in result_df.columns and pd.api.types.is_numeric_dtype(result_df[column]):
            min_val = result_df[column].min()
            if min_val <= 0:
                shift = abs(min_val) + 1
                result_df[column] = np.log1p(result_df[column] + shift)
            else:
                result_df[column] = np.log1p(result_df[column])

    elif action == RecommendedAction.merge_categories:
        if column in result_df.columns:
            if pd.api.types.is_string_dtype(result_df[column]):
                result_df[column] = result_df[column].str.lower().str.strip()
            if not pd.api.types.is_numeric_dtype(result_df[column]):
                vc = result_df[column].value_counts(normalize=True) * 100
                rare_categories = vc[vc < 1.0].index
                if len(rare_categories) > 0:
                    result_df.loc[result_df[column].isin(rare_categories), column] = "Other"

    elif action == RecommendedAction.none:
        pass

    after = _column_stats(result_df, column)
    return result_df, before, after


# ── Canvas-specific transforms (beyond RecommendedAction enum) ──────────

def filter_rows(df: pd.DataFrame, column: str, operator: str, value: str) -> pd.DataFrame:
    """Filter rows by condition on a column."""
    result = df.copy()
    if column not in result.columns:
        return result

    series = result[column]
    try:
        if operator == "equals":
            if pd.api.types.is_numeric_dtype(series):
                result = result[series == float(value)]
            else:
                result = result[series.astype(str).str.lower() == value.lower()]
        elif operator == "not_equals":
            if pd.api.types.is_numeric_dtype(series):
                result = result[series != float(value)]
            else:
                result = result[series.astype(str).str.lower() != value.lower()]
        elif operator == "greater_than":
            result = result[pd.to_numeric(series, errors="coerce") > float(value)]
        elif operator == "less_than":
            result = result[pd.to_numeric(series, errors="coerce") < float(value)]
        elif operator == "contains":
            result = result[series.astype(str).str.contains(value, case=False, na=False)]
        elif operator == "not_empty":
            result = result[series.notna() & (series.astype(str).str.strip() != "")]
        elif operator == "is_empty":
            result = result[series.isna() | (series.astype(str).str.strip() == "")]
    except (ValueError, TypeError):
        pass

    return result.reset_index(drop=True)


def sort_rows(df: pd.DataFrame, column: str, ascending: bool = True) -> pd.DataFrame:
    """Sort by column."""
    if column not in df.columns:
        return df
    return df.sort_values(by=column, ascending=ascending, na_position="last").reset_index(drop=True)


def rename_column(df: pd.DataFrame, column: str, new_name: str) -> pd.DataFrame:
    """Rename a column."""
    if column not in df.columns or not new_name or new_name in df.columns:
        return df
    return df.rename(columns={column: new_name})


def type_cast(df: pd.DataFrame, column: str, target_type: str) -> pd.DataFrame:
    """Cast column to a new type."""
    result = df.copy()
    if column not in result.columns:
        return result

    try:
        if target_type == "numeric":
            result[column] = pd.to_numeric(result[column], errors="coerce")
        elif target_type == "string":
            result[column] = result[column].astype(str)
        elif target_type == "datetime":
            result[column] = pd.to_datetime(result[column], errors="coerce")
        elif target_type == "boolean":
            true_vals = {"true", "1", "yes", "y", "t"}
            result[column] = result[column].astype(str).str.lower().isin(true_vals)
        elif target_type == "category":
            result[column] = result[column].astype("category")
        elif target_type == "int":
            result[column] = pd.to_numeric(result[column], errors="coerce").astype("Int64")
        elif target_type == "float":
            result[column] = pd.to_numeric(result[column], errors="coerce")
    except Exception:
        pass

    return result


def encode_categories(df: pd.DataFrame, column: str, method: str = "label") -> pd.DataFrame:
    """Encode categorical column."""
    result = df.copy()
    if column not in result.columns:
        return result

    if method == "label":
        cats = result[column].dropna().astype(str).unique()
        mapping = {cat: i for i, cat in enumerate(sorted(cats))}
        result[column] = result[column].astype(str).map(mapping)
    elif method == "onehot":
        dummies = pd.get_dummies(result[column], prefix=column, dummy_na=False, dtype=int)
        result = pd.concat([result.drop(columns=[column]), dummies], axis=1)

    return result


def scale_normalize(df: pd.DataFrame, column: str, method: str = "standard") -> pd.DataFrame:
    """Scale/normalize a numeric column."""
    result = df.copy()
    if column not in result.columns or not pd.api.types.is_numeric_dtype(result[column]):
        return result

    series = result[column].dropna()
    if len(series) == 0:
        return result

    if method == "standard":
        mean = series.mean()
        std = series.std()
        if std > 0:
            result[column] = (result[column] - mean) / std
    elif method == "minmax":
        min_val = series.min()
        max_val = series.max()
        if max_val > min_val:
            result[column] = (result[column] - min_val) / (max_val - min_val)
    elif method == "robust":
        median = series.median()
        q75 = series.quantile(0.75)
        q25 = series.quantile(0.25)
        iqr = q75 - q25
        if iqr > 0:
            result[column] = (result[column] - median) / iqr

    return result


def log_transform_column(df: pd.DataFrame, column: str) -> pd.DataFrame:
    """Apply log(1+x) transform."""
    result = df.copy()
    if column not in result.columns or not pd.api.types.is_numeric_dtype(result[column]):
        return result

    min_val = result[column].min()
    if min_val <= 0:
        shift = abs(min_val) + 1
        result[column] = np.log1p(result[column] + shift)
    else:
        result[column] = np.log1p(result[column])

    return result


def duplicate_rows(df: pd.DataFrame, times: int = 2) -> pd.DataFrame:
    """Duplicate the dataset N times (for stress testing)."""
    return pd.concat([df] * max(1, times), ignore_index=True)


def sample_rows(df: pd.DataFrame, n: int = 100, method: str = "random") -> pd.DataFrame:
    """Sample N rows from the dataset."""
    if method == "random":
        return df.sample(n=min(n, len(df)), random_state=42).reset_index(drop=True)
    elif method == "head":
        return df.head(n).reset_index(drop=True)
    elif method == "tail":
        return df.tail(n).reset_index(drop=True)
    return df


def concat_dataframes(dfs: list[pd.DataFrame], how: str = "rows") -> pd.DataFrame:
    """Concatenate multiple DataFrames."""
    if not dfs:
        return pd.DataFrame()

    if how == "rows":
        return pd.concat(dfs, ignore_index=True)
    elif how == "columns":
        return pd.concat(dfs, axis=1)
    return dfs[0]


def dataset_summary(df: pd.DataFrame) -> dict:
    """Generate a comprehensive summary of the dataset."""
    shape = {"rows": len(df), "columns": len(df.columns)}
    memory = df.memory_usage(deep=True).sum()

    columns_info = []
    for col in df.columns:
        series = df[col]
        info: dict = {
            "name": col,
            "dtype": str(series.dtype),
            "missing": int(series.isna().sum()),
            "missing_pct": round(100 * series.isna().sum() / len(df), 2) if len(df) > 0 else 0,
            "unique": int(series.nunique()),
        }
        if pd.api.types.is_numeric_dtype(series):
            desc = series.describe()
            info.update({
                "mean": round(float(desc.get("mean", 0)), 4),
                "std": round(float(desc.get("std", 0)), 4),
                "min": round(float(desc.get("min", 0)), 4),
                "q25": round(float(desc.get("25%", 0)), 4),
                "median": round(float(desc.get("50%", 0)), 4),
                "q75": round(float(desc.get("75%", 0)), 4),
                "max": round(float(desc.get("max", 0)), 4),
            })
        else:
            vc = series.value_counts()
            if len(vc) > 0:
                info["top_value"] = str(vc.index[0])
                info["top_count"] = int(vc.iloc[0])
        columns_info.append(info)

    return {
        "shape": shape,
        "memory_bytes": int(memory),
        "columns": columns_info,
    }


# ── ML Training ───────────────────────────────────────────────────────

def train_ml_models(
    df: pd.DataFrame,
    target_column: str,
    model_names: list[str] | None = None,
    test_size: float = 0.2,
    max_rows: int = 10000,
    feature_columns: list[str] | None = None,
) -> dict:
    """Train multiple ML models and return comparison metrics.

    Args:
        feature_columns: Explicit X axes (feature columns). None = all numeric
            columns except the target.
    """
    from sklearn.model_selection import train_test_split, cross_val_score
    from sklearn.preprocessing import LabelEncoder, StandardScaler
    from sklearn.metrics import (
        accuracy_score, precision_score, recall_score, f1_score,
        mean_squared_error, mean_absolute_error, r2_score,
        confusion_matrix, roc_curve, auc,
    )
    from sklearn.linear_model import LogisticRegression, LinearRegression, Ridge, Lasso
    from sklearn.ensemble import (
        RandomForestClassifier, RandomForestRegressor,
        GradientBoostingClassifier, GradientBoostingRegressor,
    )
    from sklearn.svm import SVC, SVR
    from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
    from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor

    if target_column not in df.columns:
        return {"error": f"Target column '{target_column}' not found"}

    # Prepare data
    work_df = df.copy()

    # Drop rows with missing target
    work_df = work_df.dropna(subset=[target_column])

    # Subsample if too large
    if len(work_df) > max_rows:
        work_df = work_df.sample(n=max_rows, random_state=42)

    # Separate features and target
    y = work_df[target_column]
    X = work_df.drop(columns=[target_column])

    # Feature selection: honor explicit X axes if provided, else all numeric
    if feature_columns:
        missing = [c for c in feature_columns if c not in X.columns]
        if missing:
            return {"error": f"Feature columns not found: {', '.join(missing)}"}
        X = X[feature_columns]
    numeric_cols = X.select_dtypes(include=[np.number]).columns.tolist()
    if not numeric_cols:
        return {"error": "No numeric features found. Encode categorical columns first."}
    X = X[numeric_cols]

    # Fill remaining NaN
    X = X.fillna(X.median())

    # Determine task type
    if y.dtype == "object" or y.nunique() <= 20:
        task = "classification"
        le = LabelEncoder()
        y = le.fit_transform(y.astype(str))
        class_names = le.classes_.tolist()
    else:
        task = "regression"
        y = y.astype(float)
        class_names = []

    # Split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=42)

    # Scale
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # Define models
    if task == "classification":
        all_models = {
            "Logistic Regression": LogisticRegression(max_iter=1000, random_state=42),
            "Random Forest": RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1),
            "Gradient Boosting": GradientBoostingClassifier(n_estimators=100, random_state=42),
            "KNN": KNeighborsClassifier(n_neighbors=5),
            "Decision Tree": DecisionTreeClassifier(random_state=42),
            "SVM": SVC(kernel="rbf", probability=True, random_state=42, max_iter=2000),
        }
    else:
        all_models = {
            "Linear Regression": LinearRegression(),
            "Ridge": Ridge(alpha=1.0),
            "Lasso": Lasso(alpha=0.1),
            "Random Forest": RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1),
            "Gradient Boosting": GradientBoostingRegressor(n_estimators=100, random_state=42),
            "KNN": KNeighborsRegressor(n_neighbors=5),
            "Decision Tree": DecisionTreeRegressor(random_state=42),
            "SVR": SVR(kernel="rbf", max_iter=2000),
        }

    # Filter requested models, with cross-task aliasing: a classifier name
    # requested on a regression task (or vice versa) maps to its counterpart
    # so individual model nodes don't silently fall back to training ALL models.
    _TASK_ALIASES = {
        "logistic regression": "Linear Regression",
        "random forest": "Random Forest",
        "gradient boosting": "Gradient Boosting",
        "knn": "KNN",
        "decision tree": "Decision Tree",
        "svm": "SVR",
        "linear regression": "Logistic Regression",
        "ridge": "Logistic Regression",
        "lasso": "Logistic Regression",
        "svr": "SVM",
    }
    if model_names:
        selected: dict[str, object] = {}
        for name in model_names:
            if name in all_models:
                selected[name] = all_models[name]
            else:
                alias = _TASK_ALIASES.get(name.strip().lower())
                if alias and alias in all_models:
                    selected[alias] = all_models[alias]
        if not selected:
            selected = all_models
    else:
        selected = all_models

    results = {}
    feature_names = X.columns.tolist()

    for name, model in selected.items():
        try:
            use_scaled = name in ("Logistic Regression", "SVM", "SVR", "KNN", "Ridge", "Lasso")
            Xtr = X_train_scaled if use_scaled else X_train.values
            Xte = X_test_scaled if use_scaled else X_test.values

            model.fit(Xtr, y_train)
            y_pred = model.predict(Xte)

            # Feature importance
            importance = []
            if hasattr(model, "feature_importances_"):
                imp = model.feature_importances_
                importance = sorted(
                    [{"feature": f, "importance": round(float(v), 4)} for f, v in zip(feature_names, imp)],
                    key=lambda x: x["importance"], reverse=True,
                )[:15]
            elif hasattr(model, "coef_"):
                coef = np.abs(model.coef_).flatten() if model.coef_.ndim > 1 else np.abs(model.coef_)
                importance = sorted(
                    [{"feature": f, "importance": round(float(v), 4)} for f, v in zip(feature_names, coef)],
                    key=lambda x: x["importance"], reverse=True,
                )[:15]

            if task == "classification":
                accuracy = round(float(accuracy_score(y_test, y_pred)), 4)
                metrics = {
                    "accuracy": accuracy,
                    "precision": round(float(precision_score(y_test, y_pred, average="weighted", zero_division=0)), 4),
                    "recall": round(float(recall_score(y_test, y_pred, average="weighted", zero_division=0)), 4),
                    "f1": round(float(f1_score(y_test, y_pred, average="weighted", zero_division=0)), 4),
                }

                # ROC data (for binary)
                roc_data = None
                if len(class_names) == 2 and hasattr(model, "predict_proba"):
                    y_proba = model.predict_proba(Xte)[:, 1]
                    fpr, tpr, _ = roc_curve(y_test, y_proba)
                    roc_auc = round(float(auc(fpr, tpr)), 4)
                    roc_data = {
                        "fpr": [round(float(x), 4) for x in fpr[::max(1, len(fpr)//50)]],
                        "tpr": [round(float(x), 4) for x in tpr[::max(1, len(tpr)//50)]],
                        "auc": roc_auc,
                    }

                # Confusion matrix
                cm = confusion_matrix(y_test, y_pred).tolist()

                results[name] = {
                    "metrics": metrics,
                    "feature_importance": importance,
                    "roc_data": roc_data,
                    "confusion_matrix": cm,
                    "task": "classification",
                    "class_names": class_names,
                }
            else:
                mse = round(float(mean_squared_error(y_test, y_pred)), 4)
                mae = round(float(mean_absolute_error(y_test, y_pred)), 4)
                r2 = round(float(r2_score(y_test, y_pred)), 4)
                metrics = {
                    "mse": mse,
                    "rmse": round(float(np.sqrt(mse)), 4),
                    "mae": mae,
                    "r2": r2,
                }

                # Prediction vs actual scatter data
                scatter = None
                if len(y_test) <= 500:
                    scatter = {
                        "actual": [round(float(x), 4) for x in y_test],
                        "predicted": [round(float(x), 4) for x in y_pred],
                    }

                results[name] = {
                    "metrics": metrics,
                    "feature_importance": importance,
                    "scatter": scatter,
                    "task": "regression",
                }

        except Exception as e:
            results[name] = {"error": str(e)}

    return {
        "task": task,
        "target": target_column,
        "n_samples": len(X_train) + len(X_test),
        "n_features": len(feature_names),
        "models": results,
    }
