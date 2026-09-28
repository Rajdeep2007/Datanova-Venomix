"use client";

import React from "react";
import { BoxPlotGroup } from "@/lib/api";

interface Props {
  groups: BoxPlotGroup[];
  width?: number;
  height?: number;
}

export default function BoxPlotChart({ groups, width: containerWidth = 400, height: containerHeight = 250 }: Props) {
  if (groups.length === 0) {
    return <div className="text-text-muted text-sm text-center">No data for box plot.</div>;
  }

  // Calculate global min and max to scale the SVG
  const allMins = groups.map((g) => Math.min(g.min, ...g.outliers));
  const allMaxs = groups.map((g) => Math.max(g.max, ...g.outliers));
  const globalMin = Math.min(...allMins);
  const globalMax = Math.max(...allMaxs);

  // SVG parameters
  const svgWidth = containerWidth;
  const minRequiredHeight = groups.length * 60 + 50;
  // Use the larger of the container height or the minimum required height to avoid squishing too much
  const svgHeight = Math.max(containerHeight, minRequiredHeight);
  const margin = { top: 20, right: 20, bottom: 40, left: 80 };
  const width = svgWidth - margin.left - margin.right;
  const height = svgHeight - margin.top - margin.bottom;

  // X scale function (value axis)
  const xScale = (val: number) => {
    if (globalMax === globalMin) return 0;
    return ((val - globalMin) / (globalMax - globalMin)) * width;
  };

  // Y scale function (group axis)
  const bandHeight = height / groups.length;
  const boxHeight = Math.min(30, bandHeight * 0.6);

  return (
    <div className="w-full h-full overflow-auto flex items-center justify-center">
      <svg width={svgWidth} height={svgHeight} className="overflow-visible">
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {/* X Axis Line */}
          <line x1={0} y1={height} x2={width} y2={height} stroke="var(--border-subtle)" strokeWidth={1} />
          
          {/* X Axis Labels (min, max, median of global) */}
          <text x={0} y={height + 20} fontSize={10} fill="var(--text-muted)" textAnchor="middle">
            {globalMin.toFixed(1)}
          </text>
          <text x={width} y={height + 20} fontSize={10} fill="var(--text-muted)" textAnchor="middle">
            {globalMax.toFixed(1)}
          </text>

          {groups.map((group, i) => {
            const yCenter = i * bandHeight + bandHeight / 2;
            const xMin = xScale(group.min);
            const xMax = xScale(group.max);
            const xQ1 = xScale(group.q1);
            const xQ3 = xScale(group.q3);
            const xMed = xScale(group.median);

            return (
              <g key={group.group_label}>
                {/* Y Axis Label */}
                <text
                  x={-10}
                  y={yCenter}
                  fontSize={10}
                  fill="var(--text-secondary)"
                  textAnchor="end"
                  alignmentBaseline="middle"
                  className="truncate"
                >
                  {group.group_label.length > 12 ? group.group_label.substring(0, 10) + "..." : group.group_label}
                </text>

                {/* Whiskers (Line from Min to Max) */}
                <line
                  x1={xMin}
                  y1={yCenter}
                  x2={xMax}
                  y2={yCenter}
                  stroke="var(--accent-primary)"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                />

                {/* Min / Max Ticks */}
                <line x1={xMin} y1={yCenter - 5} x2={xMin} y2={yCenter + 5} stroke="var(--accent-primary)" strokeWidth={2} />
                <line x1={xMax} y1={yCenter - 5} x2={xMax} y2={yCenter + 5} stroke="var(--accent-primary)" strokeWidth={2} />

                {/* IQR Box */}
                <rect
                  x={xQ1}
                  y={yCenter - boxHeight / 2}
                  width={Math.max(1, xQ3 - xQ1)}
                  height={boxHeight}
                  fill="var(--accent-primary)"
                  fillOpacity={0.2}
                  stroke="var(--accent-primary)"
                  strokeWidth={2}
                  rx={2}
                />

                {/* Median Line */}
                <line
                  x1={xMed}
                  y1={yCenter - boxHeight / 2}
                  x2={xMed}
                  y2={yCenter + boxHeight / 2}
                  stroke="var(--accent-primary)"
                  strokeWidth={2}
                />

                {/* Outliers */}
                {group.outliers.map((outlier, j) => (
                  <circle
                    key={j}
                    cx={xScale(outlier)}
                    cy={yCenter}
                    r={3}
                    fill="var(--danger)"
                    fillOpacity={0.6}
                    stroke="var(--surface)"
                    strokeWidth={1}
                  />
                ))}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
