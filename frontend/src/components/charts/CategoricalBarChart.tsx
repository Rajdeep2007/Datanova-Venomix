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
import { CategoricalChartData } from "@/lib/api";

interface Props {
  data: CategoricalChartData;
}

export default function CategoricalBarChart({ data }: Props) {
  return (
    <div className="w-full h-full min-h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data.value_counts}
          layout="vertical"
          margin={{ top: 10, right: 30, left: 20, bottom: 15 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
          <XAxis 
            type="number" 
            stroke="var(--text-muted)" 
            fontSize={11} 
            tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val} 
            label={{ value: 'Count', position: 'insideBottom', offset: -10, fill: 'var(--text-muted)', fontSize: 12 }} 
          />
          <YAxis
            dataKey="value"
            type="category"
            stroke="var(--text-muted)"
            fontSize={11}
            width={80}
            tickFormatter={(val) => val.length > 10 ? val.substring(0, 10) + '...' : val}
            label={{ value: data.column, angle: -90, position: 'insideLeft', offset: -15, fill: 'var(--text-muted)', fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: "var(--surface-elevated)", borderColor: "var(--border-subtle)", borderRadius: 8, color: "var(--text-primary)" }}
            itemStyle={{ color: "var(--accent-secondary)" }}
            labelStyle={{ color: "var(--text-muted)", marginBottom: 4 }}
            formatter={(value: any) => [value, "Count"]}
          />
          <Bar dataKey="count" fill="var(--accent-secondary)" radius={[0, 4, 4, 0]} opacity={0.8} barSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
