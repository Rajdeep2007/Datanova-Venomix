"use client";

import React from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ScatterSample } from "@/lib/api";

interface Props {
  data: ScatterSample;
}

export default function ScatterPlotChart({ data }: Props) {
  return (
    <div className="w-full h-full flex flex-col min-h-[300px]">
      <div className="flex justify-between items-center mb-2 px-2">
        <span className="text-xs font-medium text-text-muted">r = {data.r.toFixed(2)}</span>
        <span className="text-[10px] text-text-muted italic">Sampled (n={data.sample.length})</span>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
            <XAxis 
              type="number" 
              dataKey="x" 
              name={data.col_a} 
              stroke="var(--text-muted)" 
              fontSize={11} 
              tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val} 
              label={{ value: data.col_a, position: 'insideBottom', offset: -10, fill: 'var(--text-muted)', fontSize: 12 }} 
            />
            <YAxis 
              type="number" 
              dataKey="y" 
              name={data.col_b} 
              stroke="var(--text-muted)" 
              fontSize={11} 
              tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val} 
              label={{ value: data.col_b, angle: -90, position: 'insideLeft', offset: 10, fill: 'var(--text-muted)', fontSize: 12 }} 
            />
            <Tooltip 
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ backgroundColor: "var(--surface-elevated)", borderColor: "var(--border-subtle)", borderRadius: 8, color: "var(--text-primary)" }}
              itemStyle={{ color: "var(--accent-primary)" }}
            />
            <Scatter name="Sample" data={data.sample} fill="var(--accent-primary)" opacity={0.6} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
