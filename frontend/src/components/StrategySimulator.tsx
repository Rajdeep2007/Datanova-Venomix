"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FlaskConical, Play, RotateCcw, ChevronDown, ChevronUp, Zap, TrendingUp, AlertTriangle } from "lucide-react";

interface StrategyAction {
  column: string;
  action: string;
  severity: string;
  justification: string;
  auto_selectable: boolean;
}

interface SimulationResult {
  applied: Array<{ column: string; action: string; before: any; after: any }>;
  errors: string[];
  before: { quality_score: number; quality_grade: string; missing_columns: number; outlier_columns: number };
  after: { quality_score: number; quality_grade: string; missing_columns: number; outlier_columns: number };
  quality_change: { before: number; after: number };
}

interface Props {
  sessionId: string;
}

export default function StrategySimulator({ sessionId }: Props) {
  const [suggestions, setSuggestions] = useState<StrategyAction[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    fetchSuggestions();
  }, [sessionId]);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/strategy-suggestions/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
        const autoSelect = new Set<string>(
          data.suggestions?.filter((s: StrategyAction) => s.auto_selectable).map((s: StrategyAction) => `${s.column}-${s.action}`) || []
        );
        setSelected(autoSelect);
      }
    } catch (e) {
      console.error("Failed to fetch suggestions:", e);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(suggestions.map((s) => `${s.column}-${s.action}`)));
  };

  const clearAll = () => setSelected(new Set());

  const simulate = async () => {
    if (selected.size === 0) return;
    setSimulating(true);
    try {
      const actions = suggestions
        .filter((s) => selected.has(`${s.column}-${s.action}`))
        .map((s) => ({ column: s.column, action: s.action }));

      const res = await fetch("http://127.0.0.1:8000/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, actions }),
      });

      if (res.ok) {
        setResult(await res.json());
      }
    } catch (e) {
      console.error("Simulation failed:", e);
    } finally {
      setSimulating(false);
    }
  };

  const severityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "text-[var(--danger)] bg-[var(--danger)]/10 border-[var(--danger)]/20";
      case "high": return "text-[var(--warning)] bg-[var(--warning)]/10 border-[var(--warning)]/20";
      case "medium": return "text-[var(--warning)] bg-[var(--warning)]/5 border-[var(--warning)]/15";
      default: return "text-[var(--success)] bg-[var(--success)]/10 border-[var(--success)]/20";
    }
  };

  const gradeColor = (grade: string) => {
    switch (grade) {
      case "A": return "text-[var(--success)]";
      case "B": return "text-[var(--grade-b)]";
      case "C": return "text-[var(--warning)]";
      case "D": return "text-[var(--grade-d)]";
      default: return "text-[var(--danger)]";
    }
  };

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center gap-2 hover:bg-overlay-hover transition-colors"
      >
        <FlaskConical className="w-5 h-5 text-[var(--accent-primary)]" />
        <h3 className="font-semibold text-text-primary">What-If Strategy Simulator</h3>
        <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
          {selected.size} selected
        </span>
        <div className="ml-auto">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {/* Actions */}
            <div className="px-4 pb-3 flex gap-2">
              <button onClick={selectAll} className="text-xs px-3 py-1.5 rounded-lg bg-overlay-light hover:bg-overlay-hover transition-colors">
                Select All
              </button>
              <button onClick={clearAll} className="text-xs px-3 py-1.5 rounded-lg bg-overlay-light hover:bg-overlay-hover transition-colors">
                Clear All
              </button>
              <button
                onClick={simulate}
                disabled={selected.size === 0 || simulating}
                className="ml-auto text-xs px-4 py-1.5 rounded-lg btn-gradient disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1 text-white"
              >
                {simulating ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }}>
                    <RotateCcw className="w-3 h-3" />
                  </motion.div>
                ) : (
                  <Play className="w-3 h-3" />
                )}
                Simulate ({selected.size})
              </button>
            </div>

            {/* Suggestion list */}
            <div className="px-4 pb-4 space-y-2 max-h-[300px] overflow-y-auto">
              {loading ? (
                <div className="text-center text-text-muted py-8">Loading suggestions...</div>
              ) : suggestions.length === 0 ? (
                <div className="text-center text-text-muted py-8">No cleaning suggestions found</div>
              ) : (
                suggestions.map((s, i) => {
                  const key = `${s.column}-${s.action}`;
                  const isSelected = selected.has(key);
                  return (
                    <motion.div
                      key={key}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => toggleSelect(key)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? "border-[var(--accent-primary)]/50 bg-[var(--accent-primary)]/10"
                          : "border-border-subtle bg-overlay-light hover:bg-overlay-hover"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(key)}
                          className="w-4 h-4 accent-[var(--accent-primary)]"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-text-primary">{s.column}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
                              {s.action.replace(/_/g, " ")}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${severityColor(s.severity)}`}>
                              {s.severity}
                            </span>
                          </div>
                          <p className="text-xs text-text-secondary mt-1">{s.justification}</p>
                        </div>
                        {s.auto_selectable && (
                          <span title="Auto-selectable"><Zap className="w-4 h-4 text-[var(--warning)]" /></span>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Simulation Result */}
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-4 mb-4 p-4 rounded-lg bg-gradient-to-r from-[var(--success)]/10 to-[var(--accent-primary)]/10 border border-[var(--success)]/20"
              >
                <h4 className="text-sm font-medium text-[var(--success)] mb-3 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" /> Simulation Result
                </h4>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-xs text-text-muted">Quality Before</p>
                    <p className={`text-2xl font-bold ${gradeColor(result.before.quality_grade)}`}>
                      {result.before.quality_score}
                    </p>
                    <p className="text-xs text-text-muted">Grade: {result.before.quality_grade}</p>
                  </div>
                  <div className="text-center flex items-center justify-center">
                    <div className="text-[var(--success)] text-lg font-bold">
                      {result.quality_change.after > result.quality_change.before ? "+" : ""}
                      {result.quality_change.after - result.quality_change.before} pts
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-text-muted">Quality After</p>
                    <p className={`text-2xl font-bold ${gradeColor(result.after.quality_grade)}`}>
                      {result.after.quality_score}
                    </p>
                    <p className="text-xs text-text-muted">Grade: {result.after.quality_grade}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-text-muted">Missing columns:</span>
                    <span className="ml-2 text-text-primary">
                      {result.before.missing_columns} &rarr; {result.after.missing_columns}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-muted">Outlier columns:</span>
                    <span className="ml-2 text-text-primary">
                      {result.before.outlier_columns} &rarr; {result.after.outlier_columns}
                    </span>
                  </div>
                </div>

                {result.applied.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[var(--success)]/20">
                    <p className="text-xs text-text-muted mb-2">Applied {result.applied.length} actions:</p>
                    <div className="flex flex-wrap gap-1">
                      {result.applied.map((a, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded bg-overlay-light text-text-secondary">
                          {a.action}({a.column})
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {result.errors.length > 0 && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-[var(--warning)]">
                    <AlertTriangle className="w-3 h-3" />
                    {result.errors.length} actions failed
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
