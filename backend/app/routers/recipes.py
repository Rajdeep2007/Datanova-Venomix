from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from app.models.enums import RecommendedAction
from app.models.schemas import (
    RecipeApplyRequest,
    RecipeApplyResult,
    RecipeAction,
    RecipeInfo,
    RecipeListResponse,
    RecipeSaveRequest,
    RecipeSaveResponse,
)
from app.services import recipe_store, session_store, stats_engine
from app.services.executor import execute_action

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Recipes"])


def _recipe_to_info(recipe: dict) -> RecipeInfo:
    return RecipeInfo(
        id=recipe["id"],
        name=recipe["name"],
        description=recipe.get("description", ""),
        created_at=recipe.get("created_at", ""),
        source_shape=recipe.get("source_shape", {}),
        source_columns=recipe.get("source_columns", []),
        action_count=len(recipe.get("actions", [])),
        actions=[RecipeAction(**a) for a in recipe.get("actions", [])],
    )


@router.post("/recipes/save", response_model=RecipeSaveResponse)
async def save_recipe(request: RecipeSaveRequest):
    if session_store.get_session(request.session_id) is None:
        raise HTTPException(status_code=404, detail="Session not found")
    try:
        recipe = recipe_store.save_recipe(request.session_id, request.name, request.description)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return RecipeSaveResponse(id=recipe["id"], name=recipe["name"], action_count=len(recipe["actions"]))


@router.get("/recipes/list", response_model=RecipeListResponse)
async def list_recipes():
    return RecipeListResponse(recipes=[_recipe_to_info(r) for r in recipe_store.list_recipes()])


@router.get("/recipes/{recipe_id}", response_model=RecipeInfo)
async def get_recipe(recipe_id: str):
    recipe = recipe_store.get_recipe(recipe_id)
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return _recipe_to_info(recipe)


@router.delete("/recipes/{recipe_id}")
async def delete_recipe(recipe_id: str):
    if not recipe_store.delete_recipe(recipe_id):
        raise HTTPException(status_code=404, detail="Recipe not found")
    return {"success": True, "deleted": recipe_id}


@router.post("/recipes/apply", response_model=RecipeApplyResult)
async def apply_recipe(request: RecipeApplyRequest):
    recipe = recipe_store.get_recipe(request.recipe_id)
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")

    df = session_store.get_session(request.session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")

    available_actions = {a.value for a in RecommendedAction}
    applied: list[RecipeAction] = []
    skipped: list[RecipeAction] = []
    warnings: list[str] = []

    missing_from_new = [c for c in recipe.get("source_columns", []) if c not in df.columns]
    if missing_from_new:
        warnings.append(
            f"Schema differs: {len(missing_from_new)} column(s) from the recipe's source "
            f"dataset are absent here ({', '.join(missing_from_new[:5])})."
        )

    modified_df = df.copy()
    for action in recipe.get("actions", []):
        column = action.get("column", "")
        action_name = action.get("action", "")
        rec_action = RecipeAction(
            column=column, action=action_name, justification=action.get("justification", "")
        )

        if action_name not in available_actions:
            skipped.append(rec_action)
            warnings.append(f"Skipped unknown action '{action_name}' on '{column}'.")
            continue
        if column not in modified_df.columns:
            # Column may already have been dropped by an earlier recipe step
            if action_name == "drop_column":
                applied.append(rec_action)  # idempotent — already gone
                continue
            skipped.append(rec_action)
            continue

        try:
            enum_action = RecommendedAction(action_name)
            modified_df, before, after = execute_action(modified_df, column, enum_action)
            applied.append(rec_action)
            session_store.log_action(
                session_id=request.session_id,
                column=column,
                action=action_name,
                justification=action.get("justification", ""),
                before=before,
                after=after,
            )
        except Exception as exc:
            logger.warning("Recipe action failed on %s: %s", column, exc)
            skipped.append(rec_action)
            warnings.append(f"Could not apply '{action_name}' to '{column}': {exc}")

    session_store.update_session(request.session_id, modified_df)
    full_diagnosis = stats_engine.full_diagnosis(modified_df)

    return RecipeApplyResult(
        recipe_id=recipe["id"],
        recipe_name=recipe["name"],
        actions_applied=applied,
        actions_skipped=skipped,
        warnings=warnings,
        full_diagnosis=full_diagnosis,
    )
