"use client";

import React from "react";
import { GLOSSARY } from "@/lib/glossary";

interface ConceptTrackerProps {
  seenConcepts: Set<string>;
}

const ALL_CONCEPTS = Object.values(GLOSSARY);

export default function ConceptTracker({ seenConcepts }: ConceptTrackerProps) {
  const seenCount = ALL_CONCEPTS.filter((c) => seenConcepts.has(c.id)).length;
  const total = ALL_CONCEPTS.length;
  const pct = total > 0 ? Math.round((seenCount / total) * 100) : 0;

  return (
    <div className="glass-card-elevated p-4 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">📚</span>
          <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">
            Concepts Learned
          </h4>
        </div>
        <span className="text-[11px] text-text-muted font-medium">
          {seenCount}/{total}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-surface-elevated border border-border-subtle rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Concept pills */}
      <div className="flex flex-wrap gap-1.5">
        {ALL_CONCEPTS.map((concept) => {
          const seen = seenConcepts.has(concept.id);
          return (
            <div
              key={concept.id}
              className={`
                inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium transition-all duration-300
                ${seen
                  ? "bg-[var(--success)]/15 text-[var(--success)] border border-[var(--success)]/25"
                  : "bg-surface text-text-muted border border-border-subtle opacity-50"
                }
              `}
            >
              {seen ? (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <span className="w-3 h-3 rounded-full border border-current opacity-40 block" />
              )}
              {concept.title}
            </div>
          );
        })}
      </div>
    </div>
  );
}
