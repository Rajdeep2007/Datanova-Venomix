import React from "react";
import type { TargetAnalysis } from "@/lib/api";

interface TargetAnalysisPanelProps {
  analysis: TargetAnalysis;
}

export default function TargetAnalysisPanel({ analysis }: TargetAnalysisPanelProps) {
  if (!analysis.target_column) return null;

  return (
    <div className="space-y-6">
      {/* Target Info Header */}
      <div className="glass-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-text-primary flex items-center gap-2">
            🎯 Target Analysis
          </h3>
          <p className="text-sm text-text-secondary mt-1">
            Analyzing relationship between features and <span className="font-mono text-[var(--accent-primary)] font-semibold">{analysis.target_column}</span>.
          </p>
        </div>
        <div className="px-4 py-2 rounded-full bg-[var(--accent-secondary)]/10 border border-[var(--accent-secondary)]/30 text-[var(--accent-secondary)] text-sm font-semibold capitalize tracking-wide">
          {analysis.problem_type} Task
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Class Imbalance (Classification only) */}
        {analysis.problem_type === "classification" && analysis.class_balance && (
          <div className="glass-card p-6 animate-slide-up">
            <h4 className="text-md font-bold text-text-primary mb-2 flex items-center gap-2">
              ⚖️ Class Balance
            </h4>
            <p className="text-sm text-text-secondary mb-4">
              Checks if the target column has a severely underrepresented class.
            </p>
            
            {analysis.class_balance.is_imbalanced && (
              <div className="mb-4 px-3 py-3 rounded-lg bg-[var(--danger)]/5 border-l-4 border-[var(--danger)] text-text-primary text-xs flex items-start gap-3 shadow-none animate-pulse-attention">
                <span className="text-lg">⚠️</span>
                <p>
                  <strong className="text-[var(--danger)]">Imbalance Detected:</strong> The class <span className="font-mono bg-[var(--danger)]/10 px-1 rounded">{analysis.class_balance.minority_class}</span> represents less than 10% of the data. Models may ignore this class to achieve high accuracy. Consider balancing techniques (e.g., SMOTE) before training.
                </p>
              </div>
            )}

            <div className="space-y-3 mt-4">
              {Object.entries(analysis.class_balance.class_counts_pct)
                .sort(([, a], [, b]) => b - a)
                .map(([className, pct]) => (
                <div key={className} className="flex items-center gap-3">
                  <div className="w-24 text-sm text-text-primary truncate font-mono" title={className}>
                    {className}
                  </div>
                  <div className="flex-1 h-2.5 bg-surface-elevated border border-border-subtle rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] rounded-full transition-all duration-1000"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="w-12 text-right text-xs text-text-muted font-mono">
                    {pct.toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Feature Leakage */}
        {analysis.leakage_flags && analysis.leakage_flags.length > 0 && (
          <div className="glass-card p-6 animate-slide-up border-l-4 border-l-[var(--danger)] animate-pulse-attention">
            <h4 className="text-md font-bold text-[var(--danger)] mb-2 flex items-center gap-2">
              🚨 Potential Target Leakage
            </h4>
            <p className="text-sm text-text-secondary mb-4">
              These features have an suspiciously high association with the target. Ensure this data is actually available <em>before</em> the prediction occurs.
            </p>
            
            <div className="space-y-3">
              {analysis.leakage_flags.map((flag) => (
                <div key={flag.column} className="p-3 rounded-lg bg-[var(--danger)]/5 border border-[var(--danger)]/15">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-sm text-[var(--danger)] font-semibold">{flag.column}</span>
                    <span className="text-xs font-mono bg-surface-elevated px-2 py-0.5 rounded text-[var(--danger)] border border-[var(--danger)]/20">Score: {flag.score.toFixed(3)}</span>
                  </div>
                  <p className="text-xs text-text-secondary">{flag.reason}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Feature Relevance */}
        <div className={`glass-card p-6 animate-slide-up ${analysis.problem_type === "regression" || !analysis.leakage_flags?.length ? "lg:col-span-2" : ""}`}>
          <h4 className="text-md font-bold text-text-primary mb-2 flex items-center gap-2">
            📊 Feature Relevance Ranking
          </h4>
          <p className="text-sm text-text-secondary mb-4">
            Features ranked by association (Mutual Information) with <span className="font-mono text-[var(--accent-primary)]">{analysis.target_column}</span>. Higher is better.
          </p>
          
          <div className="space-y-3">
            {analysis.feature_relevance.slice(0, 10).map((feat) => {
              const strength = feat.score / (analysis.feature_relevance[0]?.score || 1);
              return (
                <div key={feat.column} className="flex items-center gap-3">
                  <div className="w-32 text-sm text-text-primary truncate font-mono" title={feat.column}>
                    {feat.column}
                  </div>
                  <div className="flex-1 h-2.5 bg-surface-elevated border border-border-subtle rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-1000"
                      style={{ 
                        width: `${Math.min(100, strength * 100)}%`,
                        background: strength > 0.7 ? "var(--success)" : strength > 0.3 ? "var(--accent-primary)" : "var(--accent-secondary)"
                      }}
                    />
                  </div>
                  <div className="w-16 text-right text-xs text-text-muted font-mono">
                    {feat.score.toFixed(3)}
                  </div>
                </div>
              );
            })}
            {analysis.feature_relevance.length > 10 && (
              <div className="text-center text-xs text-text-muted pt-2">
                ... and {analysis.feature_relevance.length - 10} more columns
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
