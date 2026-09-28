import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from "recharts";
import type { MissingnessInfo } from "@/lib/api";

export default function MissingnessChart({ missingness }: { missingness: MissingnessInfo[] }) {
  const missingData = useMemo(() => {
    return missingness.map(m => ({
      name: m.column,
      missing_pct: m.missing_pct,
      flagged: m.flagged
    }));
  }, [missingness]);

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={missingData} layout="vertical" margin={{ left: 20, right: 20, top: 10, bottom: 0 }}>
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 11 }} width={80} />
          <RechartsTooltip 
            cursor={{ fill: "var(--surface-elevated)", opacity: 0.5 }} 
            contentStyle={{ backgroundColor: "var(--surface-elevated)", borderColor: "var(--border-color)", color: "var(--text-primary)", borderRadius: "12px" }} 
             
            formatter={(value: any) => [`${Number(value || 0).toFixed(1)}%`, "Missing"]}
          />
          <Bar dataKey="missing_pct" radius={[0, 4, 4, 0]} maxBarSize={20}>
            {missingData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.flagged ? "var(--danger)" : "var(--accent-primary)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
