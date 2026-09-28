"""Tests for the recipe store."""
import pytest
from pathlib import Path

from app.services import recipe_store, session_store
import pandas as pd


@pytest.fixture(autouse=True)
def cleanup_recipes():
    """Clean up test recipes after each test."""
    yield
    recipes_dir = Path(".cache/recipes")
    if recipes_dir.exists():
        for f in recipes_dir.glob("*.json"):
            if f.name.startswith("test"):
                f.unlink(missing_ok=True)


def test_save_recipe():
    session_store.create_session("test-save-recipe", pd.DataFrame({"a": [1, 2]}))
    session_store.log_action("test-save-recipe", "a", "impute_median", "test", {"missing_pct": 10}, {"missing_pct": 0})
    recipe = recipe_store.save_recipe("test-save-recipe", "Test Recipe", "A test recipe")
    assert "id" in recipe
    assert recipe["name"] == "Test Recipe"
    assert len(recipe["actions"]) == 1


def test_list_recipes():
    session_store.create_session("test-list-recipe", pd.DataFrame({"a": [1, 2]}))
    session_store.log_action("test-list-recipe", "a", "impute_median", "test", {}, {})
    recipe_store.save_recipe("test-list-recipe", "List Recipe")
    recipes = recipe_store.list_recipes()
    assert isinstance(recipes, list)


def test_get_recipe():
    session_store.create_session("test-get-recipe", pd.DataFrame({"a": [1, 2]}))
    session_store.log_action("test-get-recipe", "a", "impute_median", "test", {}, {})
    saved = recipe_store.save_recipe("test-get-recipe", "Get Recipe")
    retrieved = recipe_store.get_recipe(saved["id"])
    assert retrieved is not None
    assert retrieved["name"] == "Get Recipe"


def test_delete_recipe():
    session_store.create_session("test-delete-recipe", pd.DataFrame({"a": [1, 2]}))
    session_store.log_action("test-delete-recipe", "a", "impute_median", "test", {}, {})
    saved = recipe_store.save_recipe("test-delete-recipe", "Delete Recipe")
    assert recipe_store.delete_recipe(saved["id"]) is True
    assert recipe_store.get_recipe(saved["id"]) is None


def test_delete_nonexistent_recipe():
    assert recipe_store.delete_recipe("nonexistent") is False


def test_get_nonexistent_recipe():
    assert recipe_store.get_recipe("nonexistent") is None


def test_save_recipe_empty_actions_raises():
    session_store.create_session("test-empty-recipe", pd.DataFrame({"a": [1, 2]}))
    with pytest.raises(ValueError, match="No cleaning actions"):
        recipe_store.save_recipe("test-empty-recipe", "Empty Recipe")
