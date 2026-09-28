"use client";

import React, { useState } from "react";
import { exportData } from "@/lib/api";

interface ExportButtonProps {
  sessionId: string;
  onSuccess: () => void;
}

export default function ExportButton({ sessionId, onSuccess }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setError(null);
    try {
      await exportData(sessionId);
      onSuccess();
    } catch (err) {
      setError("Failed to download CSV. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 animate-fade-in">
      <button
        onClick={handleExport}
        disabled={isExporting}
        className={`
          group relative px-10 py-4 rounded-2xl text-white font-bold text-lg
          flex items-center gap-3 transition-all duration-300 btn-gradient
          shadow-lg hover:shadow-[0_0_30px_rgba(255,148,8,0.3)] hover:-translate-y-1
          disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0
        `}
      >
        {isExporting ? (
          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <svg
            className="w-6 h-6 group-hover:-translate-y-1 transition-transform"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )}
        {isExporting ? "Downloading..." : "Export Cleaned CSV"}
      </button>
      {error && (
        <p className="text-[var(--danger)] text-sm font-medium bg-[var(--danger)]/10 px-3 py-1.5 rounded-lg border border-[var(--danger)]/20 animate-fade-in">
          {error}
        </p>
      )}
      {!error && (
        <p className="text-sm text-text-muted">
          Ready for machine learning, BI tools, or sharing with your team.
        </p>
      )}
    </div>
  );
}
