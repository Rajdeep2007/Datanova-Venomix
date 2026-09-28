"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";

interface TargetSelectionFormProps {
  columns: string[];
  initialTargetColumn?: string;
  initialTargetPurpose?: string;
  onConfirm: (targetColumn?: string, targetPurpose?: string) => void;
}

export default function TargetSelectionForm({ columns, initialTargetColumn, initialTargetPurpose, onConfirm }: TargetSelectionFormProps) {
  const [targetColumn, setTargetColumn] = useState<string>(initialTargetColumn || "");
  const [targetPurpose, setTargetPurpose] = useState<string>(initialTargetPurpose || "");

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="glass-card p-8 max-w-xl mx-auto mt-8"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold gradient-text mb-3">
          What are you trying to predict?
        </h2>
        <p className="text-text-secondary text-sm">
          Select a target column to unlock advanced checks like feature leakage, class imbalance, and relevance ranking.
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-text-primary mb-2">
            Target Column (optional)
          </label>
          <select
            value={targetColumn}
            onChange={(e) => setTargetColumn(e.target.value)}
            className="w-full bg-surface-elevated border border-border-subtle rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all"
          >
            <option value="">None / just exploring</option>
            {columns.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {targetColumn && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="overflow-hidden"
          >
            <div className="pt-2">
              <label className="block text-sm font-semibold text-text-primary mb-2">
                What&apos;s this for? (optional)
              </label>
              <input
                type="text"
                value={targetPurpose}
                onChange={(e) => setTargetPurpose(e.target.value)}
                placeholder="e.g. predicting whether a customer cancels"
                className="w-full bg-surface-elevated border border-border-subtle rounded-xl px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all"
              />
              <p className="text-[10px] text-text-muted mt-2">
                This helps the AI give better context for its cleaning recommendations.
              </p>
            </div>
          </motion.div>
        )}

        <div className="pt-4 flex items-center justify-end gap-4 border-t border-border-subtle">
          <button
            onClick={() => onConfirm(targetColumn || undefined, targetPurpose || undefined)}
            className="btn-gradient px-6 py-2.5 rounded-xl text-white font-semibold flex items-center gap-2"
          >
            {targetColumn ? "Continue with Target" : "Skip Target Checks"}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
