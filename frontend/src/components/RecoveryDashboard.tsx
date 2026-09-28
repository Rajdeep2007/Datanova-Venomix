"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, ArrowUp, ArrowDown, Minus, Trophy, Activity, Shield, Zap } from "lucide-react";

interface RecoveryData {
  before: {
    quality_score: number;
    quality_grade: string;
    missing_columns: number;
    outlier_columns: number;
    duplicate_rows: number;
    total_issues: number;
  };
  after: {
    quality_score: number;
    quality_grade: string;
    missing_columns: number;
    outlier_columns: number;
    duplicate_rows: number;
    total_issues: number;
  };
  actions_applied: number;
  session_id: string;
}

interface Props {
  sessionId: string;
  actionsApplied: number;
}

export default function RecoveryDashboard({ sessionId, actionsApplied }: Props) {
  const [data, setData] = useState<RecoveryData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchRecoveryData();
  }, [sessionId, actionsApplied]);

  const fetchRecoveryData = async () => {
    setLoading(true);
    try {
      const [beforeRes, afterRes] = await Promise.all([
        fetch(`http://127.0.0.1:8000/session/${sessionId}/recovery-data`),
        fetch(`http://127.0.0.1:8000/preview/${sessionId}`),
      ]);

      if (beforeRes.ok && afterRes.ok) {
        const before = await beforeRes.json();
        const after = await afterRes.json();
        setData({
          before: before.before,
          after: after.after || before.after,
          actions_applied: actionsApplied,
          session_id: sessionId,
        });
      }
    } catch (e) {
      // Fallback: generate from diagnosis
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="glass-card p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-overlay-light rounded w-1/3" />
          <div className="h-20 bg-overlay-lighter rounded" />
        </div>
      </div>
    );
  }

  const scoreDelta = data.after.quality_score - data.before.quality_score;
  const gradeColors: Record<string, string> = {
    A: "text-[var(--success)]",
    B: "text-[var(--grade-b)]",
    C: "text-[var(--warning)]",
    D: "text-[var(--grade-d)]",
    F: "text-[var(--danger)]",
  };

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[var(--success)]/15 via-[var(--accent-primary)]/10 to-[var(--accent-secondary)]/10 p-6 border-b border-border-subtle">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <Trophy className="w-5 h-5 text-[var(--warning)]" />
              Data Health Recovery
            </h3>
            <p className="text-sm text-text-secondary mt-1">
              {data.actions_applied} cleaning actions applied
            </p>
          </div>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.5 }}
            className={`text-4xl font-black ${scoreDelta > 0 ? "text-[var(--success)]" : scoreDelta < 0 ? "text-[var(--danger)]" : "text-text-muted"}`}
          >
            {scoreDelta > 0 ? "+" : ""}{scoreDelta}
          </motion.div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Score comparison */}
        <div className="grid grid-cols-3 gap-4 items-center">
          {/* Before */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-center"
          >
            <p className="text-xs text-text-muted mb-1">Before</p>
            <div className="relative inline-block">
              <svg className="w-24 h-24" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--ring-bg)" strokeWidth="8" />
                <motion.circle
                  cx="50" cy="50" r="42"
                  fill="none"
                  stroke="var(--danger)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(data.before.quality_score / 100) * 264} 264`}
                  initial={{ strokeDasharray: "0 264" }}
                  animate={{ strokeDasharray: `${(data.before.quality_score / 100) * 264} 264` }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  transform="rotate(-90 50 50)"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-2xl font-black ${gradeColors[data.before.quality_grade] || "text-text-muted"}`}>
                  {data.before.quality_score}
                </span>
              </div>
            </div>
            <p className={`text-sm font-bold ${gradeColors[data.before.quality_grade]}`}>
              Grade {data.before.quality_grade}
            </p>
          </motion.div>

          {/* Arrow */}
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8 }}
            className="text-center"
          >
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-r from-[var(--danger)]/20 to-[var(--success)]/20 flex items-center justify-center border border-border-subtle">
              <motion.div
                animate={{ x: [0, 5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <ArrowUp className="w-8 h-8 text-[var(--success)]" />
              </motion.div>
            </div>
          </motion.div>

          {/* After */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="text-center"
          >
            <p className="text-xs text-text-muted mb-1">After</p>
            <div className="relative inline-block">
              <svg className="w-24 h-24" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--ring-bg)" strokeWidth="8" />
                <motion.circle
                  cx="50" cy="50" r="42"
                  fill="none"
                  stroke="var(--success)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(data.after.quality_score / 100) * 264} 264`}
                  initial={{ strokeDasharray: "0 264" }}
                  animate={{ strokeDasharray: `${(data.after.quality_score / 100) * 264} 264` }}
                  transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 }}
                  transform="rotate(-90 50 50)"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-2xl font-black ${gradeColors[data.after.quality_grade] || "text-text-muted"}`}>
                  {data.after.quality_score}
                </span>
              </div>
            </div>
            <p className={`text-sm font-bold ${gradeColors[data.after.quality_grade]}`}>
              Grade {data.after.quality_grade}
            </p>
          </motion.div>
        </div>

        {/* Issue improvements */}
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              label: "Missing Columns",
              before: data.before.missing_columns,
              after: data.after.missing_columns,
              icon: Activity,
              color: "var(--accent-primary)",
            },
            {
              label: "Outlier Columns",
              before: data.before.outlier_columns,
              after: data.after.outlier_columns,
              icon: Shield,
              color: "var(--accent-secondary)",
            },
            {
              label: "Duplicate Rows",
              before: data.before.duplicate_rows,
              after: data.after.duplicate_rows,
              icon: Zap,
              color: "var(--warning)",
            },
          ].map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 + i * 0.2 }}
              className="bg-overlay-light rounded-lg p-3 text-center"
            >
              <item.icon className="w-4 h-4 mx-auto mb-1" style={{ color: item.color }} />
              <p className="text-[10px] text-text-muted">{item.label}</p>
              <div className="flex items-center justify-center gap-2 mt-1">
                <span className="text-sm text-text-secondary">{item.before}</span>
                <span className="text-text-muted">&rarr;</span>
                <span className={`text-sm font-bold ${item.after < item.before ? "text-[var(--success)]" : item.after === item.before ? "text-text-muted" : "text-[var(--danger)]"}`}>
                  {item.after}
                </span>
              </div>
              {item.after < item.before && (
                <p className="text-[10px] text-[var(--success)] mt-1">
                  -{item.before - item.after} fixed
                </p>
              )}
            </motion.div>
          ))}
        </div>

        {/* Completion message */}
        {scoreDelta > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.8 }}
            className="text-center py-3 bg-[var(--success)]/10 rounded-lg border border-[var(--success)]/20"
          >
            <p className="text-sm text-[var(--success)]">
              Your data improved by <span className="font-bold">{scoreDelta} points</span>!
              {scoreDelta >= 20 && " Incredible recovery!"}
              {scoreDelta >= 10 && scoreDelta < 20 && " Great progress!"}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
