"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, ChevronUp, ChevronDown, CheckCircle2, ShieldCheck, Zap } from "lucide-react";

export default function FloatingWelcomeNote() {
  const [isVisible, setIsVisible] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ 
          opacity: 1, 
          y: [0, -6, 0],
          scale: 1 
        }}
        transition={{
          y: {
            duration: 4,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "easeInOut"
          },
          opacity: { duration: 0.5 },
          scale: { duration: 0.5 }
        }}
        className="fixed bottom-6 right-6 z-50 max-w-sm w-full px-4"
      >
        <div className="relative rounded-2xl bg-surface-elevated/95 border border-[var(--accent-primary)]/30 shadow-[0_10px_35px_rgba(255,148,8,0.15)] backdrop-blur-xl p-4 overflow-hidden group">
          {/* Top Gradient Shimmer Line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--accent-primary)] via-[var(--accent-secondary)] to-[var(--warning)]" />
          
          {/* Header Row */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl btn-gradient p-0.5 shadow-md flex items-center justify-center text-white">
                <Sparkles size={16} className="animate-spin-slow" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                  Data Nova AI
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] text-[10px] border border-[var(--accent-primary)]/30 font-semibold">
                    Live
                  </span>
                </h4>
                <p className="text-[11px] text-text-muted">Powered by Gemini 2.5 Flash</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-1 rounded-lg hover:bg-surface text-text-muted hover:text-text-primary transition-colors"
                title={isCollapsed ? "Expand note" : "Collapse note"}
              >
                {isCollapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              <button
                onClick={() => setIsVisible(false)}
                className="p-1 rounded-lg hover:bg-surface text-text-muted hover:text-text-primary transition-colors"
                title="Dismiss welcome note"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Collapsible Content */}
          {!isCollapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-3 pt-3 border-t border-border-subtle/60 text-xs space-y-2.5 text-text-secondary"
            >
              <p className="leading-relaxed">
                👋 Welcome! Upload your messy tabular dataset to perform automated semantic type classification, target leakage auditing, and multi-variate outlier detection.
              </p>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-medium pt-1">
                <div className="flex items-center gap-1.5 text-[var(--success)]">
                  <CheckCircle2 size={13} />
                  <span>Stateless Session</span>
                </div>
                <div className="flex items-center gap-1.5 text-[var(--accent-primary)]">
                  <Zap size={13} />
                  <span>Hybrid Local ML</span>
                </div>
                <div className="flex items-center gap-1.5 text-[var(--warning)]">
                  <ShieldCheck size={13} />
                  <span>Schema-Constrained</span>
                </div>
                <div className="flex items-center gap-1.5 text-[var(--accent-secondary)]">
                  <Sparkles size={13} />
                  <span>React Flow Canvas</span>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
