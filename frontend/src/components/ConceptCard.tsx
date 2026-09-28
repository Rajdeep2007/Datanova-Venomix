"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { type ConceptEntry } from "@/lib/glossary";

interface ConceptCardProps {
  concept: ConceptEntry;
  alreadySeen: boolean;
  onSeen: () => void;
  autoExpand?: boolean;
}

export default function ConceptCard({ concept, alreadySeen, onSeen, autoExpand = true }: ConceptCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Auto-expand on first encounter, mark as seen
  useEffect(() => {
    if (!alreadySeen && autoExpand) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExpanded(true);
      onSeen();
    }
  }, [alreadySeen, onSeen, autoExpand]);

  return (
    <div className="relative">
      {!expanded ? (
        // Collapsed state — small inline tooltip trigger
        <button
          onClick={() => setExpanded(true)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--accent-secondary)]/10 border border-[var(--accent-secondary)]/25 
                     text-[var(--accent-secondary)] text-xs font-medium hover:bg-[var(--accent-secondary)]/20 transition-all group"
          title={`Learn: ${concept.title}`}
        >
          <span className="text-sm">{concept.icon}</span>
          <span className="hidden sm:inline">{concept.title}</span>
          <svg
            className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01" />
          </svg>
        </button>
      ) :         // Expanded state — full screen fixed modal rendered via Portal
        typeof document !== 'undefined' ? createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
            {/* Backdrop overlay */}
            <div 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
              onClick={() => setExpanded(false)}
            />

            {/* Modal Container */}
            <div className="relative w-full max-w-4xl min-h-[50vh] glass-card-elevated animate-scale-in border-[var(--accent-secondary)]/30 shadow-2xl overflow-hidden flex flex-col max-h-full">
              {/* Close button (kept outside the scrollable area) */}
              <button
                onClick={() => setExpanded(false)}
                className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-surface hover:bg-surface-elevated 
                           flex items-center justify-center text-text-muted hover:text-text-primary transition-colors border border-border-subtle shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Scrollable content area */}
              <div className="p-8 sm:p-12 overflow-y-auto flex-1 flex flex-col">
                {/* Header */}
                <div className="flex items-center gap-4 mb-10 pr-8">
                  <span className="text-3xl">{concept.icon}</span>
                  <h4 className="text-2xl font-bold text-[var(--accent-secondary)] uppercase tracking-wider">
                    Learn: {concept.title}
                  </h4>
                </div>

                {/* Content grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 flex-1">
                  {/* Plain explanation */}
                  <div className="p-6 rounded-xl bg-surface border border-border-subtle flex flex-col">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-base">💡</span>
                      <span className="text-sm uppercase tracking-wider text-text-muted font-bold">What is this?</span>
                    </div>
                    <p className="text-base text-text-secondary leading-relaxed flex-1">{concept.plain}</p>
                  </div>

                  {/* Analogy */}
                  <div className="p-6 rounded-xl bg-surface border border-border-subtle flex flex-col">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-base">🎯</span>
                      <span className="text-sm uppercase tracking-wider text-text-muted font-bold">Think of it like...</span>
                    </div>
                    <p className="text-base text-text-secondary leading-relaxed italic flex-1">{concept.analogy}</p>
                  </div>

                  {/* Why it matters */}
                  <div className="p-6 rounded-xl bg-[var(--accent-primary)]/5 border border-[var(--accent-primary)]/15 flex flex-col">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-base">⚡</span>
                      <span className="text-sm uppercase tracking-wider text-[var(--accent-primary)] font-bold">Why it matters</span>
                    </div>
                    <p className="text-base text-text-secondary leading-relaxed flex-1">{concept.why_it_matters}</p>
                  </div>

                  {/* How we check */}
                  <div className="p-6 rounded-xl bg-[var(--success)]/5 border border-[var(--success)]/15 flex flex-col">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-base">🔬</span>
                      <span className="text-sm uppercase tracking-wider text-[var(--success)] font-bold">How we check</span>
                    </div>
                    <p className="text-base text-text-secondary leading-relaxed flex-1">{concept.how_we_check}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        ) : null
      }
    </div>
  );
}
