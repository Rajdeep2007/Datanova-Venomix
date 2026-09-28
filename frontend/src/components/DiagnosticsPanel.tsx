"use client";

import React, { useMemo } from "react";
import type { Diagnosis, ApplyActionResponse } from "@/lib/api";
import { GLOSSARY } from "@/lib/glossary";
import ConceptCard from "./ConceptCard";
import RecommendationCard from "./RecommendationCard";
import DataTypeDonut from "./charts/DataTypeDonut";
import MissingnessChart from "./charts/MissingnessChart";

interface DiagnosticsPanelProps {
  diagnosis: Diagnosis;
  hasSeen: (concept: string) => boolean;
  markSeen: (concept: string) => void;
  hasTarget?: boolean;
  onReopenTargetSelection?: () => void;
  sessionId?: string;
  onActionApplied?: (result: ApplyActionResponse) => void;
}

export default function DiagnosticsPanel({ diagnosis, hasSeen, markSeen, hasTarget, onReopenTargetSelection, sessionId, onActionApplied }: DiagnosticsPanelProps) {
  const { shape, dtypes, missingness, correlated_pairs, outliers, cardinality, duplicate_rows, duplicate_columns, constant_features, infinite_values, rare_categories } = diagnosis;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Top stat cards ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M12 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M21.375 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M12 17.25v-5.25" />
            </svg>
          }
          label="Rows"
          value={shape.rows.toLocaleString()}
          gradient="from-[var(--accent-primary)] to-[var(--accent-secondary)]"
          delay="stagger-1"
        />
        <StatCard
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          }
          label="Columns"
          value={shape.columns.toLocaleString()}
          gradient="from-[var(--accent-secondary)] to-[var(--danger)]"
          delay="stagger-2"
        />
        <StatCard
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
            </svg>
          }
          label="Memory"
          value={`${shape.memory_kb.toLocaleString()} KB`}
          gradient="from-[var(--success)] to-[var(--accent-secondary)]"
          delay="stagger-3"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Data Types Donut Chart ────────────────────────── */}
        <Section title="Data Types" icon="🔤" delay="stagger-4" conceptKey="dtype_mismatch" hasSeen={hasSeen} markSeen={markSeen}>
          <DataTypeDonut dtypes={dtypes} />
          <p className="text-xs text-text-muted mt-4 text-center">Breakdown of inferred data types across all columns.</p>
        </Section>

        {/* ── Missingness Bar Chart ───────────────────────────── */}
        {missingness.length > 0 && (
          <Section title="Missingness" icon="🕳️" delay="stagger-5" conceptKey="missingness" hasSeen={hasSeen} markSeen={markSeen}>
            <MissingnessChart missingness={missingness} />
            <p className="text-xs text-text-muted mt-4 text-center">Percentage of null values in each column. Red bars indicate dangerously high missingness ({">40%"}).</p>
          </Section>
        )}
      </div>

      {/* ── Multicollinearity ───────────────────────────────── */}
      <Section title="Multicollinearity" icon="🔗" delay="stagger-6" conceptKey="multicollinearity" hasSeen={hasSeen} markSeen={markSeen}>
        {correlated_pairs.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {correlated_pairs.map((cp, i) => (
                <div
                  key={i}
                  className="flex flex-col p-4 rounded-xl glass-card-elevated transition-transform hover:-translate-y-1"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs text-text-primary truncate max-w-[40%]">{cp.col_a}</span>
                    <svg className="w-4 h-4 text-text-muted mx-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    <span className="font-mono text-xs text-text-primary truncate max-w-[40%]">{cp.col_b}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all"
                        style={{ 
                          width: `${Math.min(100, Math.abs(cp.r) * 100)}%`,
                          backgroundColor: Math.abs(cp.r) > 0.8 ? "var(--danger)" : Math.abs(cp.r) > 0.5 ? "var(--warning)" : "var(--accent-primary)"
                        }}
                      />
                    </div>
                    <span className="font-mono text-xs font-bold" style={{ color: Math.abs(cp.r) > 0.8 ? "var(--danger)" : "var(--text-primary)" }}>
                      {cp.r.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-text-muted mt-4 text-center">Pairs of features with high correlation. Values close to 1.0 or -1.0 indicate strong relationships, which may cause multicollinearity issues.</p>
          </>
        ) : (
          <div className="px-4 py-3 rounded-xl bg-[var(--success)]/10 border border-[var(--success)]/30 text-[var(--success)] flex items-center gap-2">
            <span className="text-xl">✅</span>
            <span className="text-sm font-semibold">No highly correlated pairs found.</span>
          </div>
        )}
      </Section>

      {/* ── Outliers ──────────────────────────────────────── */}
      <Section title="Outliers" icon="📊" delay="stagger-7" conceptKey="outlier" hasSeen={hasSeen} markSeen={markSeen}>
        {outliers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {outliers.map((o) => (
              <OutlierCard key={o.column} outlier={o} />
            ))}
          </div>
        ) : (
          <div className="px-4 py-3 rounded-xl bg-[var(--success)]/10 border border-[var(--success)]/30 text-[var(--success)] flex items-center gap-2">
            <span className="text-xl">✅</span>
            <span className="text-sm font-semibold">No significant outliers detected.</span>
          </div>
        )}
      </Section>

      {/* ── Cardinality ───────────────────────────────────── */}
      <Section title="High Cardinality" icon="⚠️" delay="stagger-8" conceptKey="cardinality" hasSeen={hasSeen} markSeen={markSeen}>
        {cardinality.some((c) => c.flagged_high_cardinality) ? (
          <div className="flex flex-wrap gap-3">
            {cardinality
              .filter((c) => c.flagged_high_cardinality)
              .map((c) => (
                <div
                  key={c.column}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--warning)]/10 border border-[var(--warning)]/30 animate-pulse-attention"
                >
                  <svg className="w-4 h-4 text-[var(--warning)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <span className="font-mono text-sm text-[var(--warning)] font-semibold">{c.column}</span>
                  <span className="text-xs text-text-muted">
                    {c.unique_values.toLocaleString()} unique ({(c.unique_ratio * 100).toFixed(1)}%)
                  </span>
                </div>
              ))}
          </div>
        ) : (
          <div className="px-4 py-3 rounded-xl bg-[var(--success)]/10 border border-[var(--success)]/30 text-[var(--success)] flex items-center gap-2">
            <span className="text-xl">✅</span>
            <span className="text-sm font-semibold">No high cardinality columns detected.</span>
          </div>
        )}
      </Section>

      {/* ── Duplicate Rows ─────────────────────────────────── */}
      <Section title="Duplicate Rows" icon="👯" delay="stagger-9" conceptKey="duplicate_rows" hasSeen={hasSeen} markSeen={markSeen}>
        {duplicate_rows?.duplicate_row_count > 0 ? (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/30">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="text-[var(--danger)] font-semibold">
                {duplicate_rows.duplicate_row_count.toLocaleString()} identical rows found
              </p>
              <p className="text-sm text-text-muted">
                {duplicate_rows.duplicate_row_pct.toFixed(2)}% of your dataset consists of exact duplicates.
              </p>
            </div>
          </div>
        ) : (
          <div className="px-4 py-3 rounded-xl bg-[var(--success)]/10 border border-[var(--success)]/30 text-[var(--success)] flex items-center gap-2">
            <span className="text-xl">✅</span>
            <span className="text-sm font-semibold">No duplicate rows found.</span>
          </div>
        )}
      </Section>

      {/* ── Duplicate Columns ──────────────────────────────── */}
      <Section title="Duplicate Columns" icon="🪞" delay="stagger-10" conceptKey="duplicate_columns" hasSeen={hasSeen} markSeen={markSeen}>
        {duplicate_columns?.duplicate_column_pairs?.length > 0 ? (
          <div className="flex flex-col gap-3">
            {duplicate_columns.duplicate_column_pairs.map((pair, idx) => (
              <div key={idx} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/30">
                <span className="text-xl">⚠️</span>
                <p className="text-sm text-text-primary">
                  <span className="font-mono text-[var(--danger)] font-bold">{pair.col_a}</span> is identical to <span className="font-mono text-[var(--danger)] font-bold">{pair.col_b}</span>
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-3 rounded-xl bg-[var(--success)]/10 border border-[var(--success)]/30 text-[var(--success)] flex items-center gap-2">
            <span className="text-xl">✅</span>
            <span className="text-sm font-semibold">No duplicate columns found.</span>
          </div>
        )}
      </Section>

      {/* ── Constant Features ──────────────────────────────── */}
      <Section title="Constant Features" icon="🧊" delay="stagger-11" conceptKey="constant_features" hasSeen={hasSeen} markSeen={markSeen}>
        {constant_features?.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {constant_features.map((c) => (
              <div
                key={c.column}
                className={`flex flex-col p-4 rounded-xl glass-card-elevated border-l-4 ${c.fully_constant ? "border-l-[var(--danger)] bg-[var(--danger)]/5" : "border-l-[var(--warning)] bg-[var(--warning)]/5"}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-sm font-bold text-text-primary truncate">{c.column}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${c.fully_constant ? "bg-[var(--danger)]/15 text-[var(--danger)]" : "bg-[var(--warning)]/15 text-[var(--warning)]"}`}>
                    {c.fully_constant ? "Fully Constant" : "Has Missing"}
                  </span>
                </div>
                <p className="text-xs text-text-secondary truncate">
                  Value: <span className="font-mono font-semibold text-text-primary">{String(c.constant_value)}</span>
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-3 rounded-xl bg-[var(--success)]/10 border border-[var(--success)]/30 text-[var(--success)] flex items-center gap-2">
            <span className="text-xl">✅</span>
            <span className="text-sm font-semibold">No constant features found.</span>
          </div>
        )}
      </Section>

      {/* ── Infinite Values ────────────────────────────────── */}
      <Section title="Infinite Values" icon="♾️" delay="stagger-12" conceptKey="infinite_values" hasSeen={hasSeen} markSeen={markSeen}>
        {infinite_values?.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {infinite_values.map((v) => (
              <div
                key={v.column}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/30 animate-pulse-attention"
              >
                <span className="text-xl">⚠️</span>
                <span className="font-mono text-sm text-[var(--danger)] font-semibold">{v.column}</span>
                <span className="text-xs text-text-muted">
                  {v.infinite_count.toLocaleString()} infinite value{v.infinite_count > 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-3 rounded-xl bg-[var(--success)]/10 border border-[var(--success)]/30 text-[var(--success)] flex items-center gap-2">
            <span className="text-xl">✅</span>
            <span className="text-sm font-semibold">No infinite values found.</span>
          </div>
        )}
      </Section>

      {/* ── Rare Categories ────────────────────────────────── */}
      <Section title="Rare Categories" icon="🦄" delay="stagger-13" conceptKey="rare_categories" hasSeen={hasSeen} markSeen={markSeen}>
        {rare_categories?.length > 0 ? (
          <div className="space-y-4">
            {rare_categories.map((rc) => (
              <RecommendationCard
                key={rc.column}
                sessionId={sessionId!}
                dtypes={dtypes}
                onActionApplied={onActionApplied!}
                rec={{
                  column: rc.column,
                  issue: `Found ${rc.rare_category_count} rare categor${rc.rare_category_count === 1 ? "y" : "ies"} (<1% frequency).`,
                  severity: "medium",
                  recommended_action: "merge_categories",
                  justification: "Merging rare long-tail categories into 'Other' reduces dimensionality and prevents model overfitting on rare values.",
                  confidence: 0.95,
                }}
              />
            ))}
          </div>
        ) : (
          <div className="px-4 py-3 rounded-xl bg-[var(--success)]/10 border border-[var(--success)]/30 text-[var(--success)] flex items-center gap-2">
            <span className="text-xl">✅</span>
            <span className="text-sm font-semibold">No rare categories found.</span>
          </div>
        )}
      </Section>

      {/* ── Target Selection CTA ────────────────────────────── */}
      {!hasTarget && onReopenTargetSelection && (
        <div className="glass-card-elevated p-6 animate-slide-up bg-[var(--accent-primary)]/5 border-l-4 border-l-[var(--accent-primary)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-md font-bold text-text-primary flex items-center gap-2 mb-1">
                🎯 Target-Aware Checks Available
              </h4>
              <p className="text-sm text-text-secondary">
                Want feature leakage, class imbalance, and feature-relevance checks? Tell us which column you&apos;re predicting.
              </p>
            </div>
            <button
              onClick={onReopenTargetSelection}
              className="flex-shrink-0 px-5 py-2.5 rounded-lg btn-gradient text-white font-semibold transition-all shadow-md"
            >
              Select Target Column
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  Sub-components                                              */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function StatCard({
  icon,
  label,
  value,
  gradient,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  gradient: string;
  delay: string;
}) {
  return (
    <div className={`glass-card-elevated gradient-border p-5 animate-slide-up ${delay}`}>
      <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} text-white shadow-lg mb-3`}>
        {icon}
      </div>
      <p className="text-text-muted text-xs uppercase tracking-wider font-medium mb-1">{label}</p>
      <p className="text-2xl font-bold text-text-primary">{value}</p>
    </div>
  );
}

function Section({
  title,
  icon,
  delay,
  conceptKey,
  hasSeen,
  markSeen,
  children,
}: {
  title: string;
  icon: string;
  delay: string;
  conceptKey?: string;
  hasSeen?: (concept: string) => boolean;
  markSeen?: (concept: string) => void;
  children: React.ReactNode;
}) {
  const concept = conceptKey ? GLOSSARY[conceptKey] : null;

  return (
    <div className={`glass-card p-6 animate-slide-up ${delay}`}>
      <div className="flex items-start justify-between mb-4">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-text-primary">
          <span>{icon}</span>
          {title}
        </h3>
        {concept && hasSeen && markSeen && (
          <ConceptCard 
            concept={concept}
            alreadySeen={hasSeen(conceptKey!)}
            onSeen={() => markSeen(conceptKey!)}
          />
        )}
      </div>
      {children}
    </div>
  );
}

function OutlierCard({ outlier }: { outlier: { column: string; outlier_count: number; outlier_pct: number; lower_bound: number; upper_bound: number } }) {
  const intensity =
    outlier.outlier_pct > 10 ? "border-[var(--danger)]/50 bg-[var(--danger)]/5 shadow-sm shadow-[var(--danger)]/20" :
    outlier.outlier_pct > 3 ? "border-[var(--warning)]/50 bg-[var(--warning)]/5" :
    "border-border-subtle bg-surface-elevated";

  return (
    <div className={`p-4 rounded-xl border ${intensity} transition-colors`}>
      <p className="font-mono text-sm font-semibold text-text-primary mb-2 truncate">{outlier.column}</p>
      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-text-muted">Count</span>
          <span className="text-text-primary font-medium">{outlier.outlier_count.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">Percentage</span>
          <span className={`font-medium ${outlier.outlier_pct > 10 ? "text-[var(--danger)]" : outlier.outlier_pct > 3 ? "text-[var(--warning)]" : "text-[var(--accent-primary)]"}`}>
            {outlier.outlier_pct.toFixed(1)}%
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">Bounds</span>
          <span className="text-text-secondary font-mono text-[11px]">
            [{outlier.lower_bound.toFixed(1)}, {outlier.upper_bound.toFixed(1)}]
          </span>
        </div>
      </div>
    </div>
  );
}
