"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { fetchPreviewRows, type Diagnosis, type PreviewRow } from "@/lib/api";

interface DataPreviewModalProps {
  sessionId: string;
  diagnosis: Diagnosis;
  isOpen: boolean;
  onClose: () => void;
}

export default function DataPreviewModal({ sessionId, diagnosis, isOpen, onClose }: DataPreviewModalProps) {
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derived highlight maps from the diagnosis (stable per session state)
  const outlierBounds = useMemo(() => {
    const map = new Map<string, { lower: number; upper: number }>();
    for (const o of diagnosis.outliers || []) {
      map.set(o.column, { lower: o.lower_bound, upper: o.upper_bound });
    }
    return map;
  }, [diagnosis]);

  const duplicateRows = useMemo(
    () => new Set(diagnosis.duplicate_rows?.duplicate_row_indices ?? []),
    [diagnosis]
  );

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPreviewRows(sessionId, 250)
      .then((res) => {
        if (cancelled) return;
        setRows(res.rows);
        setTotalRows(res.total_rows);
        setTruncated(res.truncated);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load the data preview.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, isOpen]);

  // Escape to close
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  if (!isOpen) return null;

  const cellStyle = (col: string, value: PreviewRow[string], rowIdx: number): string => {
    const base = "px-3 py-2 text-xs whitespace-nowrap font-mono border-b border-border-subtle";
    if (value === null || value === undefined || value === "") {
      return `${base} bg-[var(--danger)]/25 text-[var(--danger)] font-semibold`;
    }
    if (typeof value === "number") {
      const bounds = outlierBounds.get(col);
      if (bounds && (value < bounds.lower || value > bounds.upper)) {
        return `${base} bg-[var(--warning)]/30 text-[var(--warning)] font-semibold`;
      }
    }
    if (duplicateRows.has(rowIdx)) {
      return `${base} bg-[#7C3AED]/10 text-text-primary`;
    }
    return `${base} text-text-secondary`;
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
      onKeyDown={handleKeyDown}
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative glass-card-elevated w-full max-w-6xl max-h-[85vh] flex flex-col overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle shrink-0">
          <div>
            <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <span>🔍</span> Data Preview
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              {totalRows.toLocaleString()} rows{truncated ? ` — showing the first ${rows.length}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface transition-colors"
            aria-label="Close preview"
          >
            <X size={20} />
          </button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 px-6 py-2.5 border-b border-border-subtle bg-surface/40 shrink-0">
          <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">Legend:</span>
          <LegendChip color="rgba(202,63,22,0.35)" label="Missing value" />
          <LegendChip color="rgba(255,148,8,0.4)" label="Outlier" />
          <LegendChip color="rgba(124,58,237,0.25)" label="Duplicate row" />
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center py-16 text-[var(--danger)]">{error}</div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="border-collapse w-full">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 text-[10px] uppercase tracking-wider font-bold text-text-muted bg-surface-elevated border-b border-border-subtle text-left">
                    #
                  </th>
                  {(diagnosis.dtypes || []).map((d) => (
                    <th
                      key={d.column}
                      className="px-3 py-2 text-[10px] uppercase tracking-wider font-bold text-[var(--accent-primary)] bg-surface-elevated border-b border-border-subtle text-left"
                    >
                      {d.column}
                      <span className="block text-[9px] font-normal text-text-muted">{d.inferred_type}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIdx) => (
                  <tr key={rowIdx} className="hover:bg-surface/60 transition-colors">
                    <td className="px-3 py-2 text-[10px] text-text-muted font-mono border-b border-border-subtle">
                      {duplicateRows.has(rowIdx) ? "🔁" : rowIdx}
                    </td>
                    {(diagnosis.dtypes || []).map((d) => {
                      const raw = row[d.column];
                      const display =
                        raw === null || raw === undefined ? "NULL" : String(raw);
                      return (
                        <td key={d.column} className={cellStyle(d.column, raw as PreviewRow[string], rowIdx)}>
                          {display.length > 40 ? `${display.slice(0, 37)}…` : display}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={(diagnosis.dtypes?.length ?? 1) + 1} className="px-6 py-12 text-center text-text-muted">
                      No rows to show.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-6 py-3 border-t border-border-subtle text-xs text-text-muted shrink-0">
          Missing values are highlighted red · numeric outliers amber · duplicate rows purple.
        </div>
      </div>
    </div>
  );
}

function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-text-secondary">
      <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
