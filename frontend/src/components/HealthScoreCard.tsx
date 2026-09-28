"use client";

import React from "react";
import { motion } from "framer-motion";
import type { DataQuality } from "@/lib/api";

const GRADE_COLORS: Record<string, string> = {
  A: "var(--success)",
  B: "var(--grade-b)",
  C: "var(--warning)",
  D: "var(--grade-d)",
  F: "var(--danger)",
};

export default function HealthScoreCard({
  quality,
  compact = false,
}: {
  quality: DataQuality;
  compact?: boolean;
}) {
  const score = quality.overall_score ?? 0;
  const grade = quality.overall_grade ?? "F";
  const color = GRADE_COLORS[grade] || GRADE_COLORS.F;
  // ring circumference for r=42: 2*pi*42 ≈ 263.9
  const dash = (score / 100) * 263.9;
  const pct = Math.round(score);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="glass-card-elevated relative overflow-hidden p-6 animate-slide-up"
    >
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{
          background: `radial-gradient(circle at 20% 0%, ${color}, transparent 60%)`,
        }}
      />
      <div className="flex flex-col sm:flex-row items-center gap-6 relative">
        {/* Donut ring */}
        <div className="relative w-28 h-28 shrink-0">
          <svg viewBox="0 0 100 100" className="w-28 h-28 -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--surface)" strokeWidth="10" />
            <motion.circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke={color}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray="263.9"
              initial={{ strokeDashoffset: 263.9 }}
              animate={{ strokeDashoffset: 263.9 - dash }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-extrabold leading-none" style={{ color }}>
              {pct}
            </span>
            <span className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">
              / 100
            </span>
          </div>
        </div>

        <div className="flex-1 min-w-0 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-extrabold"
              style={{ backgroundColor: color }}
            >
              {grade}
            </span>
            <h3 className="text-lg font-bold text-text-primary">Data Health</h3>
          </div>
          <p className="text-sm text-text-secondary leading-relaxed">{quality.summary}</p>

          {!compact && quality.biggest_risks.length > 0 && (
            <div className="mt-3 flex flex-wrap justify-center sm:justify-start gap-1.5">
              {quality.biggest_risks.slice(0, 5).map((risk, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[var(--warning)]/10 text-[var(--warning)] border border-[var(--warning)]/25"
                >
                  <span className="w-1 h-1 rounded-full bg-current" />
                  {risk}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
