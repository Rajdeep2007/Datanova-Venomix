from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from app.models.schemas import CanvasExecuteRequest, CanvasExecuteResponse
from app.models.enums import RecommendedAction
from app.services import session_store, canvas_store, executor
import pandas as pd
import numpy as np
import io

router = APIRouter(tags=["Canvas"])

@router.post("/execute-node", response_model=CanvasExecuteResponse)
async def execute_node(request: CanvasExecuteRequest):
    # 1. Fetch the data to act upon
    if request.node_type == "FileNode":
        df = session_store.get_session(request.session_id)
        if df is None:
            raise HTTPException(status_code=404, detail="Session not found")
    else:
        if not request.upstream_node_output_id:
            raise HTTPException(status_code=400, detail="Missing upstream_node_output_id for Transform node")
        df = canvas_store.get_output(request.upstream_node_output_id)
        if df is None:
            raise HTTPException(status_code=400, detail="Upstream data not found. Execute upstream node first.")

    # 2. Execute transform logic if it's a transform node
    result_df = df.copy()
    if request.node_type != "FileNode":
        config = request.config
        column = config.get("column", "")

        # ── Existing node types ─────────────────────────────────
        if request.node_type == "ImputeNode":
            if column and column in result_df.columns:
                method = config.get("method", "median")
                action_enum = RecommendedAction.impute_median if method == "median" else RecommendedAction.impute_mode
                result_df, _, _ = executor.execute_action(result_df, column, action_enum)

        elif request.node_type == "DropColumnNode":
            if column and column in result_df.columns:
                result_df, _, _ = executor.execute_action(result_df, column, RecommendedAction.drop_column)

        elif request.node_type == "ClipOutliersNode":
            if column and column in result_df.columns:
                result_df, _, _ = executor.execute_action(result_df, column, RecommendedAction.clip_outliers)

        elif request.node_type == "MergeCategoriesNode":
            if column and column in result_df.columns:
                result_df, _, _ = executor.execute_action(result_df, column, RecommendedAction.merge_categories)

        # ── New transform node types ────────────────────────────
        elif request.node_type == "FilterRowsNode":
            operator = config.get("operator", "equals")
            value = config.get("value", "")
            if column:
                result_df = executor.filter_rows(result_df, column, operator, value)

        elif request.node_type == "SortNode":
            ascending = config.get("ascending", True)
            if column:
                result_df = executor.sort_rows(result_df, column, ascending)

        elif request.node_type == "RenameColumnNode":
            new_name = config.get("new_name", "")
            if column and new_name:
                result_df = executor.rename_column(result_df, column, new_name)

        elif request.node_type == "TypeCastNode":
            target_type = config.get("target_type", "string")
            if column:
                result_df = executor.type_cast(result_df, column, target_type)

        elif request.node_type == "EncodeNode":
            method = config.get("method", "label")
            if column:
                result_df = executor.encode_categories(result_df, column, method)

        elif request.node_type == "ScaleNode":
            method = config.get("method", "standard")
            if column:
                result_df = executor.scale_normalize(result_df, column, method)

        elif request.node_type == "LogTransformNode":
            if column:
                result_df = executor.log_transform_column(result_df, column)

        elif request.node_type == "SampleNode":
            n = int(config.get("n", 100))
            method = config.get("method", "random")
            result_df = executor.sample_rows(result_df, n, method)

        elif request.node_type == "StatsNode":
            summary = executor.dataset_summary(result_df)
            node_output_id = f"{request.session_id}_{request.node_id}"
            canvas_store.set_output(node_output_id, result_df)
            return CanvasExecuteResponse(
                node_output_id=node_output_id,
                preview={
                    "shape": {"rows": len(result_df), "columns": len(result_df.columns)},
                    "sample_rows": [],
                    "columns": [{"name": col, "type": str(result_df[col].dtype)} for col in result_df.columns],
                    "stats": summary,
                }
            )

        elif request.node_type == "MLTrainNode":
            target_col = config.get("target_column", "")
            model_names = config.get("models", [])
            feature_cols = config.get("feature_columns", []) or None
            if not target_col or target_col not in result_df.columns:
                raise HTTPException(status_code=400, detail=f"Target column '{target_col}' not found")
            ml_results = executor.train_ml_models(result_df, target_col, model_names or None, feature_columns=feature_cols)
            node_output_id = f"{request.session_id}_{request.node_id}"
            canvas_store.set_output(node_output_id, result_df)
            return CanvasExecuteResponse(
                node_output_id=node_output_id,
                preview={
                    "shape": {"rows": len(result_df), "columns": len(result_df.columns)},
                    "sample_rows": [],
                    "columns": [{"name": col, "type": str(result_df[col].dtype)} for col in result_df.columns],
                    "ml_results": ml_results,
                }
            )

    # 3. Save the resulting dataframe to canvas_store and update the global session_store
    node_output_id = f"{request.session_id}_{request.node_id}"
    canvas_store.set_output(node_output_id, result_df)
    session_store.update_session(request.session_id, result_df)

    # 4. Generate preview
    head_df = result_df.head(5).replace({np.nan: None})
    sample_rows = head_df.to_dict(orient="records")
    columns_info = [{"name": col, "type": str(result_df[col].dtype)} for col in result_df.columns]

    preview = {
        "shape": {"rows": len(result_df), "columns": len(result_df.columns)},
        "sample_rows": sample_rows,
        "columns": columns_info
    }

    return CanvasExecuteResponse(
        node_output_id=node_output_id,
        preview=preview
    )


@router.get("/export-node-output/{session_id}/{node_id}")
async def export_node_output(session_id: str, node_id: str):
    """Download the dataframe produced by a canvas node as CSV.

    Falls back to the session store when the node output has been evicted,
    so users can always download *something* meaningful.
    """
    node_output_id = f"{session_id}_{node_id}"
    df = canvas_store.get_output(node_output_id)
    source = "node"
    if df is None:
        df = session_store.get_session(session_id)
        source = "session"
    if df is None:
        raise HTTPException(status_code=404, detail="No data found for this node or session")

    buffer = io.StringIO()
    df.to_csv(buffer, index=False)
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{node_id}_output.csv"',
            "X-Export-Source": source,
        },
    )


@router.post("/concat-files")
async def concat_files(
    session_ids: str,
    how: str = "rows",
    files: list[UploadFile] = File(...),
):
    """Concatenate uploaded files with the current session data."""
    dfs = []

    # Load current session data
    first_session = session_ids.split(",")[0].strip() if session_ids else None
    if first_session:
        existing = session_store.get_session(first_session)
        if existing is not None:
            dfs.append(existing)

    # Load uploaded files
    for f in files:
        content = await f.read()
        fname = f.filename or "upload.csv"
        try:
            if fname.endswith(".csv"):
                df = pd.read_csv(io.BytesIO(content))
            elif fname.endswith((".xlsx", ".xls")):
                df = pd.read_excel(io.BytesIO(content))
            elif fname.endswith(".json"):
                df = pd.read_json(io.BytesIO(content))
            elif fname.endswith(".parquet"):
                df = pd.read_parquet(io.BytesIO(content))
            else:
                df = pd.read_csv(io.BytesIO(content))
            dfs.append(df)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to read {fname}: {e}")

    if not dfs:
        raise HTTPException(status_code=400, detail="No data to concatenate")

    result = executor.concat_dataframes(dfs, how)

    # Store result in the first session
    if first_session:
        session_store.update_session(first_session, result)
        # Also save to canvas store
        node_output_id = f"{first_session}_concat"
        canvas_store.set_output(node_output_id, result)

    head_df = result.head(5).replace({np.nan: None})
    return {
        "shape": {"rows": len(result), "columns": len(result.columns)},
        "sample_rows": head_df.to_dict(orient="records"),
        "columns": [{"name": col, "type": str(result[col].dtype)} for col in result.columns],
        "files_merged": len(dfs),
    }


@router.get("/scatter-data")
async def get_scatter_data(session_id: str, x_col: str, y_col: str, color_col: str | None = None, upstream_node_output_id: str | None = None):
    if upstream_node_output_id:
        df = canvas_store.get_output(upstream_node_output_id)
        if df is None:
            raise HTTPException(status_code=400, detail="Upstream data not found")
    else:
        df = session_store.get_session(session_id)

    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")

    if x_col not in df.columns or y_col not in df.columns:
        raise HTTPException(status_code=400, detail="Column not found")

    if not pd.api.types.is_numeric_dtype(df[x_col]) or not pd.api.types.is_numeric_dtype(df[y_col]):
        raise HTTPException(status_code=400, detail="x_col and y_col must be numeric")

    cols = [x_col, y_col]
    if color_col and color_col in df.columns:
        cols.append(color_col)

    subset = df[cols].dropna()
    truncated = False
    if len(subset) > 5000:
        subset = subset.sample(n=5000, random_state=42)
        truncated = True

    points = []
    for _, row in subset.iterrows():
        pt = {"x": float(row[x_col]), "y": float(row[y_col])}
        if color_col and color_col in df.columns:
            pt["color_group"] = str(row[color_col])
        points.append(pt)

    return {
        "points": points,
        "x_col": x_col,
        "y_col": y_col,
        "color_col": color_col,
        "truncated": truncated
    }

@router.get("/boxplot-data")
async def get_boxplot_data(session_id: str, value_col: str, group_col: str | None = None, upstream_node_output_id: str | None = None):
    if upstream_node_output_id:
        df = canvas_store.get_output(upstream_node_output_id)
        if df is None:
            raise HTTPException(status_code=400, detail="Upstream data not found")
    else:
        df = session_store.get_session(session_id)

    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")

    if value_col not in df.columns:
        raise HTTPException(status_code=400, detail="Column not found")

    if not pd.api.types.is_numeric_dtype(df[value_col]):
        raise HTTPException(status_code=400, detail="value_col must be numeric")

    from app.services.stats_engine import boxplot_stats
    return boxplot_stats(df, value_col, group_col)

@router.get("/heatmap-data")
async def get_heatmap_data(session_id: str, columns: str | None = None, upstream_node_output_id: str | None = None):
    if upstream_node_output_id:
        df = canvas_store.get_output(upstream_node_output_id)
        if df is None:
            raise HTTPException(status_code=400, detail="Upstream data not found")
    else:
        df = session_store.get_session(session_id)

    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")

    if columns:
        cols_list = [c.strip() for c in columns.split(",") if c.strip() in df.columns]
        subset = df[cols_list]
    else:
        subset = df

    from app.services.stats_engine import correlation_matrix
    corr = correlation_matrix(subset)

    matrix_data = []
    if not corr.empty:
        cols = corr.columns
        for i in range(len(cols)):
            for j in range(len(cols)):
                r = corr.iloc[i, j]
                if pd.notna(r):
                    matrix_data.append({"col_a": cols[i], "col_b": cols[j], "r": round(float(r), 3)})

    return {
        "matrix": matrix_data,
        "columns": list(corr.columns) if not corr.empty else [],
        "method": "pearson"
    }


@router.get("/dataset-stats/{session_id}")
async def get_dataset_stats(session_id: str, upstream_node_output_id: str | None = None):
    """Get comprehensive dataset statistics."""
    if upstream_node_output_id:
        df = canvas_store.get_output(upstream_node_output_id)
    else:
        df = session_store.get_session(session_id)

    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")

    return executor.dataset_summary(df)
