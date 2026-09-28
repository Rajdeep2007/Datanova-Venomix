"use client";

import React, { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import {
  applyAction,
  type Recommendation,
  type ApplyActionResponse,
} from "@/lib/api";
import { ACTION_LABELS } from "@/lib/glossary";

interface RecommendationCardProps {
  rec: Recommendation;
  sessionId: string;
  onActionApplied: (result: ApplyActionResponse) => void;
  /** Column dtypes from the diagnosis, used to offer only valid custom actions. */
  dtypes?: { column: string; raw_dtype: string; inferred_type: string }[];
}

export default function RecommendationCard({
  rec,
  sessionId,
  onActionApplied,
  dtypes,
}: RecommendationCardProps) {
  const [isApplying, setIsApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [result, setResult] = useState<ApplyActionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Custom override: which fix to apply + the user's explanation for it.
  // Defaults to the AI's recommendation, so Apply = AI fix unless changed.
  const [selectedAction, setSelectedAction] = useState(rec.recommended_action);
  const [customNote, setCustomNote] = useState("");
  const isCustom = selectedAction !== rec.recommended_action;

  // Numeric-only backend actions (validated in actions.py) — never offer them
  // for non-numeric columns, and vice versa for categorical-only actions.
  const NUMERIC_ONLY_ACTIONS = ["impute_median", "clip_outliers", "log_transform"];
  const colDtype = dtypes?.find((d) => d.column === rec.column)?.raw_dtype?.toLowerCase() ?? "";
  const isNumericCol = /int|float|double|number|decimal/.test(colDtype) || colDtype === "";
  const allowedActions = (Object.keys(ACTION_LABELS) as string[]).filter((a) => {
    if (a === "none") return false;
    if (isNumericCol) return a !== "merge_categories";
    return !NUMERIC_ONLY_ACTIONS.includes(a);
  });

  // If the currently selected action isn't valid for this column's dtype,
  // snap back to the AI's recommendation (or the first valid option).
  useEffect(() => {
    if (!allowedActions.includes(selectedAction)) {
      setSelectedAction(allowedActions.includes(rec.recommended_action) ? rec.recommended_action : allowedActions[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dtypes?.length, rec.column]);

  const severityConfig = {
    high: {
      bg: "bg-[var(--danger)]/10",
      border: "border-[var(--danger)]/40",
      text: "text-[var(--danger)]",
      glow: "shadow-[0_0_20px_rgba(202,63,22,0.15)]", // CA3F16 fallback glow
      label: "High",
      stroke: "var(--danger)"
    },
    medium: {
      bg: "bg-[var(--warning)]/10",
      border: "border-[var(--warning)]/40",
      text: "text-[var(--warning)]",
      glow: "shadow-[0_0_20px_rgba(255,148,8,0.15)]", // FF9408 fallback glow
      label: "Medium",
      stroke: "var(--warning)"
    },
    low: {
      bg: "bg-[var(--success)]/10",
      border: "border-[var(--success)]/40",
      text: "text-[var(--success)]",
      glow: "shadow-[0_0_20px_rgba(45,156,110,0.15)]", // 2D9C6E fallback glow
      label: "Low",
      stroke: "var(--success)"
    },
  };

  const sev = severityConfig[rec.severity] || severityConfig.medium;

  const handleApply = async () => {
    setIsApplying(true);
    setError(null);
    try {
      const res = await applyAction(
        sessionId,
        rec.column,
        selectedAction,
        customNote.trim() || rec.justification
      );
      setResult(res);
      setApplied(true);
      
      // Trigger confetti!
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FF9408', '#CA3F16', '#2D9C6E']
      });

      onActionApplied(res);
    } catch (err: unknown) {
      // Prefer the backend's validation detail (e.g. why an action is invalid)
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        (err instanceof Error ? err.message : "Failed to apply action");
      setError(detail);
    } finally {
      setIsApplying(false);
    }
  };

  const confidencePct = Math.round((rec.confidence ?? 0) * 100);

  return (
    <div
      className={`glass-card-elevated p-6 transition-all duration-300 hover:bg-surface-elevated ${sev.glow} animate-slide-up @container`}
      style={{ borderLeftColor: sev.stroke, borderLeftWidth: "4px" }}
    >
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
        {/* Left: Column info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span className="px-3 py-1 rounded-lg bg-[var(--accent-secondary)]/15 text-[var(--accent-secondary)] text-sm font-semibold font-mono truncate">
              {rec.column}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${sev.bg} ${sev.text} border ${sev.border}`}>
              {sev.label}
            </span>
          </div>
          <p className="text-text-primary font-medium text-sm leading-relaxed mb-3">
            {rec.issue}
          </p>
          <div className="p-3 rounded-lg bg-surface border border-border-subtle">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-xs">⚡</span>
              <span className="text-[10px] uppercase tracking-wider text-[var(--accent-primary)] font-semibold">Why it matters</span>
            </div>
            <p className="text-text-secondary text-xs leading-relaxed">
              {rec.justification}
            </p>
          </div>
        </div>

        {/* Right: Confidence ring */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <div className="relative w-14 h-14">
            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
              <circle
                cx="28" cy="28" r="24"
                fill="none"
                stroke="var(--border-subtle)"
                strokeWidth="4"
              />
              <circle
                cx="28" cy="28" r="24"
                fill="none"
                stroke={sev.stroke}
                strokeWidth="4"
                strokeDasharray={`${confidencePct * 1.508} 150.8`}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-text-primary">
              {confidencePct}%
            </span>
          </div>
          <span className="text-[10px] text-text-muted uppercase tracking-wider">Confidence</span>
        </div>
      </div>

      {rec.needs_review && (
        <div className="mb-4 px-3 py-3 rounded-lg bg-[var(--warning)]/10 border border-[var(--warning)]/30 text-text-primary text-xs flex items-start gap-3 animate-pulse-attention shadow-sm">
          <span className="text-lg">⚠️</span>
          <p>
            <strong className="text-[var(--warning)]">Needs Review:</strong> The AI consistency check did not reach a clear consensus. The action below is the most likely fix, but please verify it matches your intent.
          </p>
        </div>
      )}

      {/* Recommended action */}
      <div className="mb-3 px-3 py-2 rounded-lg bg-surface border border-border-subtle">
        <span className="text-[10px] uppercase tracking-wider text-text-muted block mb-1">Recommended Fix</span>
        <span className="text-sm text-[var(--accent-primary)] font-medium">{rec.recommended_action.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</span>
      </div>

      {/* ── Custom override: change the fix for THIS column ──────────── */}
      {!applied && (
        <div className="mb-4 p-3 rounded-lg bg-surface border border-border-subtle">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">
              Your Choice for <span className="font-mono text-text-secondary normal-case">{rec.column}</span>
            </span>
            {isCustom && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--warning)]/10 text-[var(--warning)] border border-[var(--warning)]/30 font-semibold">
                CUSTOM
              </span>
            )}
            {!isCustom && (
              <button
                type="button"
                onClick={() => {
                  setSelectedAction(rec.recommended_action);
                  setCustomNote("");
                }}
                className="text-[9px] text-text-muted hover:text-text-secondary transition-colors"
              >
                Reset to AI choice
              </button>
            )}
          </div>

          {/* Action selector (defaults to the AI's recommendation) */}
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="w-full text-xs px-2.5 py-2 rounded-lg bg-surface-elevated border border-border-subtle outline-none focus:border-[var(--accent-primary)] text-text-primary mb-2"
          >
            {allowedActions.map((action) => (
                <option key={action} value={action}>
                  {action === rec.recommended_action ? `⚡ ${ACTION_LABELS[action].label} (AI recommended)` : ACTION_LABELS[action].label}
                </option>
              ))
            }
          </select>

          {/* Explanation textbox for the custom change */}
          <textarea
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value)}
            rows={2}
            placeholder={isCustom
              ? "Explain why you chose a different fix (saved with the action log)…"
              : "Optional note — explain your reasoning (saved with the action log)…"}
            className="w-full text-xs px-2.5 py-2 rounded-lg bg-surface-elevated border border-border-subtle outline-none focus:border-[var(--accent-primary)] text-text-primary resize-none"
          />
          {isCustom && !customNote.trim() && (
            <p className="text-[10px] text-[var(--warning)] mt-1">
              Tip: add a short explanation so the change is documented in the action log.
            </p>
          )}
        </div>
      )}

      {/* Apply button or result */}
      {!applied ? (
        <div className="flex items-center gap-3">
          <button
            onClick={handleApply}
            disabled={isApplying}
            className="btn-gradient px-5 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-md hover:shadow-lg transition-shadow"
          >
            {isApplying ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {isCustom ? "Apply My Fix" : "Apply Fix"}
              </>
            )}
          </button>
          {error && (
            <span className="text-[var(--danger)] text-xs font-medium bg-[var(--danger)]/10 px-3 py-2 rounded-lg border border-[var(--danger)]/20">{error}</span>
          )}
        </div>
      ) : (
        <div className="animate-slide-up">
          {/* Applied badge */}
          <div className="flex flex-col gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[var(--success)]/20 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-[var(--success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-[var(--success)] text-sm font-semibold">Fix Applied</span>
              {isCustom && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--warning)]/10 text-[var(--warning)] border border-[var(--warning)]/30 font-semibold ml-1">
                  CUSTOM
                </span>
              )}
            </div>
            
            {/* Acceptable residual thresholds */}
            {result && result.after.missing_pct > 0 && result.after.missing_pct <= 3 && (
              <div className="flex items-center gap-1.5 text-xs text-text-muted ml-8 bg-surface-elevated border border-border-subtle px-2 py-1 rounded w-fit">
                <span className="text-[var(--success)] font-bold">✓</span>
                <span>Residual missingness is <strong className="text-text-primary">{result.after.missing_pct.toFixed(1)}%</strong> (under 3% acceptable threshold)</span>
              </div>
            )}
          </div>

          {/* Before / After comparison */}
          {result && (
            <div className="grid grid-cols-1 @sm:grid-cols-2 gap-3">
              <StatsBlock label="Before" stats={result.before} />
              <StatsBlock label="After" stats={result.after} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Mini stats block ────────────────────────────────────── */
function StatsBlock({
  label,
  stats,
}: {
  label: string;
  stats: { missing_count: number; missing_pct: number; mean: number | null; std: number | null; min: number | null; max: number | null };
}) {
  const isBefore = label === "Before";
  const fmt = (v: number | null | undefined) => {
    if (v === null || v === undefined) return "—";
    return typeof v === "number" ? (Number.isInteger(v) ? v.toString() : v.toFixed(2)) : String(v);
  };

  return (
    <div className={`p-3 rounded-lg border transition-colors ${isBefore ? "bg-[var(--danger)]/5 border-[var(--danger)]/20" : "bg-[var(--success)]/5 border-[var(--success)]/20"}`}>
      <span className={`text-[10px] uppercase tracking-wider font-bold ${isBefore ? "text-[var(--danger)]" : "text-[var(--success)]"}`}>
        {label}
      </span>
      <div className="mt-2 space-y-1.5 text-xs">
        <div className="flex justify-between items-center">
          <span className="text-text-muted">Missing</span>
          <span className="text-text-primary font-mono">{stats.missing_count} <span className="text-text-muted text-[10px]">({fmt(stats.missing_pct)}%)</span></span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-text-muted">Mean</span>
          <span className="text-text-primary font-mono">{fmt(stats.mean)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-text-muted">Std</span>
          <span className="text-text-primary font-mono">{fmt(stats.std)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-text-muted">Range</span>
          <span className="text-text-primary font-mono text-[10px]">{fmt(stats.min)} — {fmt(stats.max)}</span>
        </div>
      </div>
    </div>
  );
}
