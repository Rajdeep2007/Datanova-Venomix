"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { NumericChartData } from "@/lib/api";

interface Props {
  data: NumericChartData;
}

export default function NumericDistributionChart({ data }: Props) {
  // Format the histogram data for Recharts
  const chartData = data.histogram.map((bin) => ({
    name: `${bin.bin_start.toFixed(2)} - ${bin.bin_end.toFixed(2)}`,
    mid: (bin.bin_start + bin.bin_end) / 2,
    count: bin.count,
  }));

  // Define scale
  const minVal = data.histogram.length > 0 ? data.histogram[0].bin_start : 0;
  const maxVal = data.histogram.length > 0 ? data.histogram[data.histogram.length - 1].bin_end : 100;
  const range = maxVal - minVal || 1;

  // Helper to convert a value to a percentage width across the box plot container
  const toPct = (val: number) => {
    const p = ((val - minVal) / range) * 100;
    return Math.max(0, Math.min(100, p));
  };

  const q1Pct = toPct(data.q1);
  const q3Pct = toPct(data.q3);
  const medPct = toPct(data.median);
  const lowerPct = toPct(data.lower_bound);
  const upperPct = toPct(data.upper_bound);

  return (
    <div className="w-full h-full flex flex-col gap-2">
      {/* Histogram */}
      <div className="flex-1 min-h-[150px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 15 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
            <XAxis 
              dataKey="mid" 
              tickFormatter={(val) => val.toFixed(1)} 
              stroke="var(--text-muted)" 
              fontSize={11} 
              label={{ value: data.column, position: 'insideBottom', offset: -10, fill: 'var(--text-muted)', fontSize: 12 }} 
            />
            <YAxis 
              stroke="var(--text-muted)" 
              fontSize={11} 
              tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val} 
              label={{ value: 'Frequency', angle: -90, position: 'insideLeft', offset: 5, fill: 'var(--text-muted)', fontSize: 12 }} 
            />
            <Tooltip
              contentStyle={{ backgroundColor: "var(--surface-elevated)", borderColor: "var(--border-subtle)", borderRadius: 8, color: "var(--text-primary)" }}
              itemStyle={{ color: "var(--accent-primary)" }}
              labelStyle={{ color: "var(--text-muted)", marginBottom: 4 }}
              formatter={(value: any) => [value, "Count"]}
              labelFormatter={(label, payload) => payload[0]?.payload.name}
            />
            <Bar dataKey="count" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} opacity={0.8} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Box Plot (Overlay) */}
      <div className="h-12 relative w-[calc(100%-30px)] mx-auto mt-2 border-t border-border-subtle pt-2">
        {/* Whisker line */}
        <div 
          className="absolute top-1/2 -translate-y-1/2 h-0.5 bg-text-muted/50 rounded"
          style={{ left: `${lowerPct}%`, width: `${upperPct - lowerPct}%` }}
        />
        {/* Lower Bound Tick */}
        <div 
          className="absolute top-1/2 -translate-y-1/2 h-3 w-0.5 bg-text-muted/80"
          style={{ left: `${lowerPct}%` }}
        />
        {/* Upper Bound Tick */}
        <div 
          className="absolute top-1/2 -translate-y-1/2 h-3 w-0.5 bg-text-muted/80"
          style={{ left: `${upperPct}%` }}
        />
        {/* IQR Box */}
        <div 
          className="absolute top-1/2 -translate-y-1/2 h-4 bg-accent-secondary/30 border border-accent-secondary/60 rounded-sm"
          style={{ left: `${q1Pct}%`, width: `${q3Pct - q1Pct}%` }}
        />
        {/* Median Line */}
        <div 
          className="absolute top-1/2 -translate-y-1/2 h-5 w-0.5 bg-accent-secondary"
          style={{ left: `${medPct}%` }}
        />
      </div>
    </div>
  );
}
