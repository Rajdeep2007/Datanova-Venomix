"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles, Wand2, Database, ShieldAlert, Cpu, Layers } from "lucide-react";

interface GeminiWelcomeHeaderProps {
  onSelectPrompt?: (promptText: string) => void;
}

const GREETINGS = [
  "What dataset shall we diagnose today?",
  "Ready to clean & optimize your data?",
  "Let's surface hidden insights together.",
  "Upload messy data for AI diagnostic triage."
];

const QUICK_SUGGESTIONS = [
  {
    icon: Sparkles,
    label: "Semantic Type Detection",
    desc: "Classify currency, zip code, emails & continuous IDs",
    badge: "AI Powered",
    color: "from-[var(--accent-primary)]/20 to-[var(--accent-secondary)]/20 border-[var(--accent-primary)]/30 text-[var(--accent-primary)]"
  },
  {
    icon: ShieldAlert,
    label: "Detect Target Leakage",
    desc: "Mutual Information & Random Forest importance check",
    badge: "ML Analytics",
    color: "from-[var(--warning)]/20 to-[var(--danger)]/20 border-[var(--warning)]/30 text-[var(--warning)]"
  },
  {
    icon: Cpu,
    label: "Multivariate Outliers",
    desc: "Isolation Forest anomalous point identification",
    badge: "Isolation Forest",
    color: "from-[var(--success)]/20 to-[var(--accent-primary)]/20 border-[var(--success)]/30 text-[var(--success)]"
  },
  {
    icon: Layers,
    label: "Interactive Node Canvas",
    desc: "Build visually cached React Flow graph pipelines",
    badge: "Developer Mode",
    color: "from-[var(--accent-secondary)]/20 to-[var(--accent-primary)]/20 border-[var(--accent-secondary)]/30 text-[var(--accent-primary)]"
  }
];

export default function GeminiWelcomeHeader({ onSelectPrompt }: GeminiWelcomeHeaderProps) {
  const [greetingIndex, setGreetingIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setGreetingIndex((prev) => (prev + 1) % GREETINGS.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto mb-8 text-center relative z-10 px-4">
      {/* Dynamic Ambient Glow Behind Header */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[240px] bg-gradient-to-r from-[var(--accent-primary)]/20 via-[var(--accent-secondary)]/15 to-[var(--warning)]/20 blur-3xl pointer-events-none rounded-full animate-pulse-glow" />

      {/* Floating Gemini Badge */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-elevated/80 border border-border-subtle shadow-sm backdrop-blur-md mb-6"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent-primary)] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--accent-primary)]"></span>
        </span>
        <span className="text-xs font-semibold gradient-text flex items-center gap-1.5">
          <Sparkles size={13} className="text-[var(--accent-primary)]" />
          Gemini 2.5 Flash Workspace
        </span>
      </motion.div>

      {/* Main Gemini-style Hero Title */}
      <div className="min-h-[70px] flex flex-col items-center justify-center mb-2">
        <motion.h2
          key={greetingIndex}
          initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-xl sm:text-3xl font-bold tracking-tight"
        >
          <span className="text-text-muted font-normal mr-2">Hello,</span>
          <span className="gradient-text drop-shadow-sm">
            {GREETINGS[greetingIndex]}
          </span>
        </motion.h2>
      </div>

      <p className="text-text-muted text-sm sm:text-base max-w-xl mx-auto mb-8 leading-relaxed">
        Upload your tabular dataset (`.csv`, `.xlsx`, `.json`, `.pdf`) and let our hybrid AI model diagnose messy schemas, outlier anomalies, and column intent.
      </p>

      {/* Gemini Feature Pills / Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-w-3xl mx-auto text-left">
        {QUICK_SUGGESTIONS.map((item, idx) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 * idx }}
              onClick={() => onSelectPrompt && onSelectPrompt(item.label)}
              className="group p-4 rounded-2xl bg-surface-elevated/70 border border-border-subtle hover:border-[var(--accent-primary)]/40 hover:bg-surface-elevated transition-all duration-300 cursor-pointer shadow-sm hover:shadow-lg relative overflow-hidden backdrop-blur-md"
            >
              <div className="flex items-start gap-3.5">
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${item.color} border shadow-inner transition-transform group-hover:scale-110`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h4 className="text-sm font-semibold text-text-primary group-hover:text-[var(--accent-primary)] transition-colors">
                      {item.label}
                    </h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface text-text-muted border border-border-subtle uppercase">
                      {item.badge}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted line-clamp-1">
                    {item.desc}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
