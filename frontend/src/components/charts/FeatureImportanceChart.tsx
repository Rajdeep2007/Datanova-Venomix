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
import { FeatureRelevance } from "@/lib/api";

interface Props {
  data: FeatureRelevance[];
}

export default function FeatureImportanceChart({ data }: Props) {
  // Sort by score descending
  const sortedData = [...data].sort((a, b) => b.score - a.score).slice(0, 15); // Top 15

  return (
    <div className="w-full h-full min-h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={sortedData}
          layout="vertical"
          margin={{ top: 10, right: 30, left: 20, bottom: 15 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
          <XAxis 
            type="number" 
            stroke="var(--text-muted)" 
            fontSize={11} 
            domain={[0, 'auto']} 
            label={{ value: 'Importance Score', position: 'insideBottom', offset: -10, fill: 'var(--text-muted)', fontSize: 12 }} 
          />
          <YAxis
            dataKey="column"
            type="category"
            stroke="var(--text-muted)"
            fontSize={11}
            width={100}
            tickFormatter={(val) => val.length > 12 ? val.substring(0, 12) + '...' : val}
            label={{ value: 'Feature', angle: -90, position: 'insideLeft', offset: -15, fill: 'var(--text-muted)', fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: "var(--surface-elevated)", borderColor: "var(--border-subtle)", borderRadius: 8, color: "var(--text-primary)" }}
            itemStyle={{ color: "var(--accent-primary)" }}
            labelStyle={{ color: "var(--text-muted)", marginBottom: 4 }}
            formatter={(value: any) => [Number(value).toFixed(3), "Importance"]}
          />
          <Bar dataKey="score" fill="var(--accent-primary)" radius={[0, 4, 4, 0]} opacity={0.8} barSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
