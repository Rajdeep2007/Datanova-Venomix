"use client";

import React, { useCallback, useEffect, useState } from "react";
import { applyRecipe, deleteRecipe, listRecipes, type Diagnosis, type RecipeInfo } from "@/lib/api";

interface RecipesPanelProps {
  sessionId: string;
  onRecipeApplied: (diagnosis: Diagnosis, message: string) => void;
}

export default function RecipesPanel({ sessionId, onRecipeApplied }: RecipesPanelProps) {
  const [recipes, setRecipes] = useState<RecipeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const refresh = useCallback(() => {
    listRecipes()
      .then(setRecipes)
      .catch(() => setRecipes([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleApply = async (recipe: RecipeInfo) => {
    setApplying(recipe.id);
    setMessage(null);
    setIsError(false);
    try {
      const res = await applyRecipe(recipe.id, sessionId);
      let text = `${res.actions_applied.length}/${res.actions_applied.length + res.actions_skipped.length} actions replayed from "${res.recipe_name}".`;
      if (res.warnings.length > 0) text += ` ${res.warnings[0]}`;
      onRecipeApplied(res.full_diagnosis, text);
      setMessage(text);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to apply recipe.";
      setMessage(msg);
      setIsError(true);
    } finally {
      setApplying(null);
    }
  };

  const handleDelete = async (recipe: RecipeInfo) => {
    try {
      await deleteRecipe(recipe.id);
      setRecipes((prev) => prev.filter((r) => r.id !== recipe.id));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="glass-card p-5 animate-slide-up">
      <div className="flex items-center justify-between mb-3">
        <h4 className="flex items-center gap-2 text-sm font-bold text-text-primary">
          <span>📦</span> Reusable Cleaning Recipes
        </h4>
        <button
          onClick={refresh}
          className="text-[11px] text-text-muted hover:text-[var(--accent-primary)] transition-colors font-medium"
        >
          ↻ Refresh
        </button>
      </div>
      <p className="text-xs text-text-muted mb-4 leading-relaxed">
        Replay a previously saved cleaning workflow onto this dataset. Apply first, then run
        <span className="text-[var(--accent-primary)] font-semibold"> Analyze with AI </span>
        on the cleaned result.
      </p>

      {loading ? (
        <p className="text-xs text-text-muted py-3">Loading recipes…</p>
      ) : recipes.length === 0 ? (
        <p className="text-xs text-text-secondary py-3 bg-surface/50 rounded-lg px-4">
          No saved recipes yet. Apply some fixes and hit <em>Save as Recipe</em> on the Summary step to create one.
        </p>
      ) : (
        <div className="space-y-2">
          {recipes.map((recipe) => (
            <div
              key={recipe.id}
              className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 rounded-xl bg-surface border border-border-subtle"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary truncate">{recipe.name}</p>
                <p className="text-[11px] text-text-muted truncate">
                  {recipe.action_count} action{recipe.action_count !== 1 ? "s" : ""}
                  {recipe.description ? ` · ${recipe.description}` : ""} · {recipe.created_at}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleApply(recipe)}
                  disabled={applying !== null}
                  className="px-4 py-1.5 rounded-lg btn-gradient text-white text-xs font-semibold disabled:opacity-50 transition-all shadow-sm"
                >
                  {applying === recipe.id ? "Applying…" : "Replay on this data"}
                </button>
                <button
                  onClick={() => handleDelete(recipe)}
                  className="px-2.5 py-1.5 rounded-lg text-text-muted hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 text-xs transition-colors"
                  title="Delete recipe"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {message && (
        <div
          className={`mt-3 px-4 py-2.5 rounded-lg text-xs font-medium border ${
            isError
              ? "bg-[var(--danger)]/10 border-[var(--danger)]/30 text-[var(--danger)]"
              : "bg-[var(--success)]/10 border-[var(--success)]/30 text-[var(--success)]"
          }`}
        >
          {message}
        </div>
      )}
    </div>
  );
}
