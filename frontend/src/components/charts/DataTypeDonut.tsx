import React, { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import type { DtypeInfo } from "@/lib/api";

const PIE_COLORS = ["var(--accent-primary)", "var(--accent-secondary)", "var(--success)", "var(--warning)", "var(--danger)"];

export default function DataTypeDonut({ dtypes }: { dtypes: DtypeInfo[] }) {
  const pieData = useMemo(() => {
    const counts: Record<string, number> = {};
    dtypes.forEach(d => { counts[d.inferred_type] = (counts[d.inferred_type] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [dtypes]);

  return (
    <div className="h-64 flex flex-col items-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie 
            data={pieData} 
            dataKey="value" 
            nameKey="name" 
            cx="50%" 
            cy="50%" 
            innerRadius={60} 
            outerRadius={80} 
            paddingAngle={4}
          >
            {pieData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} stroke="transparent" />
            ))}
          </Pie>
          <RechartsTooltip 
            contentStyle={{ backgroundColor: "var(--surface-elevated)", borderColor: "var(--border-color)", borderRadius: "12px", color: "var(--text-primary)" }}
            itemStyle={{ color: "var(--text-primary)" }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap justify-center gap-3 mt-2">
        {pieData.map((entry, i) => (
          <div key={entry.name} className="flex items-center gap-1.5 text-xs">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}></span>
            <span className="text-text-muted capitalize">{entry.name} ({entry.value})</span>
          </div>
        ))}
      </div>
    </div>
  );
}
