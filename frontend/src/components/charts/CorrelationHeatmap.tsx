"use client";

import React, { useMemo } from "react";

interface CorrRecord {
  col_a: string;
  col_b: string;
  r: number;
}

interface Props {
  data: CorrRecord[];
}

export default function CorrelationHeatmap({ data }: Props) {
  const { columns, matrix } = useMemo(() => {
    const cols = new Set<string>();
    data.forEach((d) => {
      cols.add(d.col_a);
      cols.add(d.col_b);
    });
    
    const uniqueCols = Array.from(cols);
    const mat: Record<string, Record<string, number>> = {};
    
    uniqueCols.forEach(c => { mat[c] = {}; });
    
    data.forEach((d) => {
      mat[d.col_a][d.col_b] = d.r;
      mat[d.col_b][d.col_a] = d.r; // symmetrical
    });
    
    uniqueCols.forEach(c => { mat[c][c] = 1.0; }); // diagonal
    
    return { columns: uniqueCols, matrix: mat };
  }, [data]);

  // Color helper based on r value (-1 to 1)
  const getCellColor = (r: number) => {
    if (isNaN(r) || r === undefined) return "transparent";
    // Negative correlation -> red, Positive -> green
    const intensity = Math.abs(r);
    const alpha = (intensity * 0.8).toFixed(2);
    if (r < 0) return `rgba(239, 68, 68, ${alpha})`; // red
    return `rgba(34, 197, 94, ${alpha})`; // green
  };

  if (columns.length === 0) {
    return <div className="text-text-muted text-sm text-center">Not enough numeric columns for a correlation heatmap.</div>;
  }

  return (
    <div className="w-full h-full overflow-auto flex items-center justify-center min-h-[300px]">
      <div className="inline-block relative">
        <div className="flex">
          {/* Top-left empty corner */}
          <div className="w-32 shrink-0" />
          {/* Column headers */}
          {columns.map(c => (
            <div key={c} className="w-14 h-32 shrink-0 relative">
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 -rotate-45 origin-bottom-left text-xs text-text-muted whitespace-nowrap">
                {c.length > 20 ? c.substring(0, 20) + '...' : c}
              </div>
            </div>
          ))}
        </div>
        
        {/* Rows */}
        {columns.map(rowCol => (
          <div key={rowCol} className="flex items-center">
            {/* Row header */}
            <div className="w-32 shrink-0 text-xs text-text-muted text-right pr-4 truncate" title={rowCol}>
              {rowCol}
            </div>
            {/* Cells */}
            {columns.map(colCol => {
              const r = matrix[rowCol][colCol];
              return (
                <div 
                  key={`${rowCol}-${colCol}`} 
                  className="w-14 h-14 shrink-0 border border-border-subtle/50 flex items-center justify-center text-xs font-medium transition-colors hover:border-text-primary hover:z-10 relative"
                  style={{ backgroundColor: getCellColor(r) }}
                  title={`${rowCol} & ${colCol}\nr = ${r}`}
                >
                  {r !== undefined ? r.toFixed(2) : ""}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
