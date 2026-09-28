"use client";

import React, { useState } from "react";
import { ACTION_LABELS } from "@/lib/glossary";
import type { Recommendation } from "@/lib/api";

interface GuessBeforeRevealProps {
  rec: Recommendation;
  onReveal: () => void;
  onScore?: (correct: boolean) => void;
  streak?: number;
  children: React.ReactNode;
}

export default function GuessBeforeReveal({ rec, onReveal, onScore, streak = 0, children }: GuessBeforeRevealProps) {
  const [userGuess, setUserGuess] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [skipped, setSkipped] = useState(false);

  if (revealed || skipped) {
    return (
      <div className="space-y-3">
        {revealed && userGuess && (
          <div
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium animate-slide-up ${
              userGuess === rec.recommended_action
                ? "bg-[var(--success)]/10 border border-[var(--success)]/30 text-[var(--success)]"
                : "bg-[var(--warning)]/10 border border-[var(--warning)]/30 text-[var(--warning)]"
            }`}
          >
            {userGuess === rec.recommended_action ? (
              <>
                <span className="text-lg">🎯</span>
                <span>
                  <strong>You matched the AI!</strong> +10 points
                  {streak >= 2 && <span className="ml-2 text-xs bg-overlay-light px-2 py-0.5 rounded-full">🔥 {streak} streak</span>}
                </span>
              </>
            ) : (
              <>
                <span className="text-lg">🤔</span>
                <span>
                  You chose{" "}
                  <span className="font-mono text-xs bg-overlay-light px-1.5 py-0.5 rounded">
                    {ACTION_LABELS[userGuess]?.label ?? userGuess}
                  </span>
                  {" — "}the AI chose{" "}
                  <span className="font-mono text-xs bg-overlay-light px-1.5 py-0.5 rounded">
                    {ACTION_LABELS[rec.recommended_action]?.label ?? rec.recommended_action}
                  </span>
                </span>
              </>
            )}
          </div>
        )}
        {children}
      </div>
    );
  }

  return (
    <div className="glass-card-elevated p-6 animate-scale-in border-l-4 border-[var(--accent-secondary)] shadow-lg">
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🧠</span>
            <h4 className="text-sm font-bold text-[var(--accent-secondary)] uppercase tracking-wider">
              Test Your Instinct
            </h4>
            {streak >= 2 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--warning)]/10 text-[var(--warning)] border border-[var(--warning)]/20">
                🔥 {streak} streak
              </span>
            )}
          </div>
          <p className="text-text-secondary text-sm">
            Column{" "}
            <span className="font-mono text-[var(--accent-primary)] font-semibold">{rec.column}</span>
            {" "}has an issue:{" "}
            <span className="text-text-primary font-medium">{rec.issue}</span>
          </p>
        </div>
        <button
          onClick={() => {
            setSkipped(true);
            onReveal();
          }}
          className="text-text-muted text-xs hover:text-text-secondary transition-colors px-3 py-1.5 rounded-lg hover:bg-surface"
        >
          Skip →
        </button>
      </div>

      <p className="text-text-muted text-xs mb-4">What would you do to fix this?</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {Object.entries(ACTION_LABELS).map(([action, info]) => {
          if (action === "none") return null;
          const isSelected = userGuess === action;
          return (
            <button
              key={action}
              onClick={() => setUserGuess(action)}
              className={`
                p-3 rounded-xl text-left transition-all duration-200 border
                ${isSelected
                  ? "bg-[var(--accent-secondary)]/15 border-[var(--accent-secondary)]/50 shadow-md"
                  : "bg-surface border-border-subtle hover:bg-surface-elevated hover:border-text-muted/30"
                }
              `}
            >
              <span className={`text-sm font-semibold block ${isSelected ? "text-[var(--accent-secondary)]" : "text-text-primary"}`}>
                {info.label}
              </span>
              <span className="text-[11px] text-text-muted leading-tight block mt-0.5">
                {info.description}
              </span>
            </button>
          );
        })}
      </div>

      {userGuess && (
        <div className="mt-5 flex justify-center animate-slide-up">
          <button
            onClick={() => {
              setRevealed(true);
              const correct = userGuess === rec.recommended_action;
              onScore?.(correct);
              onReveal();
            }}
            className="btn-gradient px-6 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center gap-2 shadow-lg hover:shadow-xl transition-shadow"
          >
            <span>Reveal AI&apos;s Choice</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
