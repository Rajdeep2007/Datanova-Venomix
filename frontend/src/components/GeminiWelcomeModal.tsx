"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowRight, Zap, ShieldCheck, Cpu, Layers, CheckCircle2 } from "lucide-react";

interface GeminiWelcomeModalProps {
  isOpen: boolean;
  onStart: () => void;
}

export default function GeminiWelcomeModal({ isOpen, onStart }: GeminiWelcomeModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
        {/* Dark Blurred Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-xl"
          onClick={onStart}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-2xl rounded-3xl bg-surface-elevated/95 border border-[var(--accent-primary)]/30 p-6 sm:p-8 shadow-[0_0_60px_rgba(255,148,8,0.25)] backdrop-blur-2xl overflow-hidden z-10 my-auto"
        >
          {/* Top Gradient Shimmer Bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[var(--accent-primary)] via-[var(--accent-secondary)] to-[var(--warning)]" />
          
          {/* Ambient Glow Aura */}
          <div className="absolute -top-24 -left-24 w-72 h-72 bg-[var(--accent-primary)]/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-[var(--accent-secondary)]/15 rounded-full blur-3xl pointer-events-none" />

          {/* Top Badge */}
          <div className="flex items-center justify-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 text-[var(--accent-primary)] text-xs font-semibold backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent-primary)] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--accent-primary)]"></span>
              </span>
              <Sparkles size={14} className="text-[var(--accent-primary)]" />
              <span>Powered by Google Gemini 2.5 Flash</span>
            </div>
          </div>

          {/* Heading */}
          <div className="text-center mb-8">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">
              <span className="text-text-primary">Welcome to </span>
              <span className="gradient-text">
                Data Nova AI
              </span>
            </h2>
            <p className="text-text-muted text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
              Your intelligent data diagnostic clinic for messy tabular datasets. Semantic reasoning, target leakage auditing, and interactive graph pipelines.
            </p>
          </div>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-8">
            <div className="p-3.5 rounded-2xl bg-surface/80 border border-border-subtle flex items-start gap-3">
              <div className="p-2 rounded-xl bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/20 shrink-0">
                <Zap size={18} />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-text-primary mb-0.5">Semantic Classifier</h4>
                <p className="text-[11px] text-text-muted">Understands column context (currency, zip, emails, continuous IDs).</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-surface/80 border border-border-subtle flex items-start gap-3">
              <div className="p-2 rounded-xl bg-[var(--warning)]/10 text-[var(--warning)] border border-[var(--warning)]/20 shrink-0">
                <ShieldCheck size={18} />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-text-primary mb-0.5">Target Leakage Check</h4>
                <p className="text-[11px] text-text-muted">Mutual Information & Random Forest leakage detection.</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-surface/80 border border-border-subtle flex items-start gap-3">
              <div className="p-2 rounded-xl bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/20 shrink-0">
                <Cpu size={18} />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-text-primary mb-0.5">Multivariate Outliers</h4>
                <p className="text-[11px] text-text-muted">Isolation Forest anomalous point identification.</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-surface/80 border border-border-subtle flex items-start gap-3">
              <div className="p-2 rounded-xl bg-[var(--accent-secondary)]/10 text-[var(--accent-primary)] border border-[var(--accent-secondary)]/20 shrink-0">
                <Layers size={18} />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-text-primary mb-0.5">Developer Canvas</h4>
                <p className="text-[11px] text-text-muted">React Flow node editor with cached data transformations.</p>
              </div>
            </div>
          </div>

          {/* Action Button: Try Data Nova */}
          <div className="flex flex-col items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={onStart}
              className="btn-gradient relative group px-10 py-4 rounded-2xl font-bold text-lg text-white shadow-[0_0_30px_rgba(255,148,8,0.4)] transition-all duration-300 w-full sm:w-auto min-w-[240px] flex items-center justify-center gap-3 border border-white/20"
            >
              <span>Try Data Nova</span>
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </motion.button>

            <p className="text-[11px] text-text-muted flex items-center gap-1.5">
              <CheckCircle2 size={12} className="text-[var(--success)]" />
              No registration required · Instant upload & profiling
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
