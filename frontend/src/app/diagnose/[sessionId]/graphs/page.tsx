"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/SessionContext";
import DataTypeDonut from "@/components/charts/DataTypeDonut";
import MissingnessChart from "@/components/charts/MissingnessChart";
import NumericDistributionChart from "@/components/charts/NumericDistributionChart";
import CategoricalBarChart from "@/components/charts/CategoricalBarChart";
import CorrelationHeatmap from "@/components/charts/CorrelationHeatmap";
import ScatterPlotChart from "@/components/charts/ScatterPlotChart";
import FeatureImportanceChart from "@/components/charts/FeatureImportanceChart";

import ConceptCard from "@/components/ConceptCard";
import { GLOSSARY } from "@/lib/glossary";
import { useConceptTracker } from "@/hooks/useConceptTracker";

export default function GraphsPage() {
  const { diagnosis, targetAnalysis } = useSession();
  const [filter, setFilter] = useState<string>("All");
  
  // Knowledge Tracking
  const { hasSeen, markSeen } = useConceptTracker();

  if (!diagnosis) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-4">No Diagnosis Data Found</h2>
          <Link href="/" className="btn-gradient px-4 py-2 rounded-lg text-white font-medium">
            Go back to Upload
          </Link>
        </div>
      </div>
    );
  }

  const { dtypes, missingness, chart_data } = diagnosis;
  
  // Safe extraction of chart_data
  const numericCharts = chart_data?.numeric || [];
  const categoricalCharts = chart_data?.categorical || [];
  const correlationMatrix = chart_data?.correlation_matrix || [];
  const scatterSamples = chart_data?.scatter_samples || [];
  
  // Target analysis extraction
  const featureRelevance = targetAnalysis?.feature_relevance || [];
  const targetCol = targetAnalysis?.target_column;
  const isClassification = targetAnalysis?.problem_type === "classification";

  return (
    <div className="min-h-screen p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-text-primary">Visual Analysis Gallery</h1>
          <p className="text-text-muted mt-2">A read-only gallery of all dataset charts</p>
        </div>
        <Link href="/" className="px-4 py-2 bg-surface-elevated border border-border-subtle rounded-lg text-sm hover:bg-[var(--accent-secondary)]/10 hover:border-[var(--accent-secondary)]/30 transition-colors">
          ← Back to Diagnostics
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-8 border-b border-border-subtle pb-4 flex-wrap">
        {["All", "Overview", "Distributions", "Missingness", "Correlations", "Target Analysis"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f 
                ? "bg-[var(--accent-primary)] text-white shadow-sm" 
                : "bg-surface text-text-muted hover:text-text-primary"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* ================= OVERVIEW ================= */}
        {(filter === "All" || filter === "Overview") && (
          <div className="glass-card-elevated p-6 flex flex-col h-[400px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-text-primary flex items-center gap-2">
                <span className="text-[var(--accent-primary)]">◎</span> Data Types Breakdown
              </h3>
            </div>
            <div className="flex-1 min-h-0">
              <DataTypeDonut dtypes={dtypes} />
            </div>
            <p className="text-xs text-text-muted text-center mt-4 border-t border-border-subtle pt-4">
              Overview — All columns
            </p>
          </div>
        )}

        {/* ================= MISSINGNESS ================= */}
        {(filter === "All" || filter === "Missingness") && missingness.length > 0 && (
          <div className="glass-card-elevated p-6 flex flex-col h-[400px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-text-primary flex items-center gap-2">
                <span className="text-[var(--warning)]">⚠</span> Missing Values
              </h3>
              <ConceptCard 
                concept={GLOSSARY["missingness"]} 
                alreadySeen={hasSeen("missingness")} 
                onSeen={() => markSeen("missingness")} 
                autoExpand={false}
              />
            </div>
            <div className="flex-1 min-h-0">
              <MissingnessChart missingness={missingness} />
            </div>
            <p className="text-xs text-text-muted text-center mt-4 border-t border-border-subtle pt-4">
              Missingness — All columns
            </p>
          </div>
        )}

        {/* ================= DISTRIBUTIONS ================= */}
        {(filter === "All" || filter === "Distributions") && numericCharts.map((nc) => (
          <div key={`num-${nc.column}`} className="glass-card-elevated p-6 flex flex-col h-[400px]">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="font-semibold text-text-primary flex items-center gap-2 truncate" title={nc.column}>
                <span className="text-[var(--accent-secondary)]">#</span> {nc.column}
              </h3>
              <div className="shrink-0">
                <ConceptCard 
                  concept={GLOSSARY["distribution_numeric"]} 
                  alreadySeen={hasSeen("distribution_numeric")} 
                  onSeen={() => markSeen("distribution_numeric")} 
                  autoExpand={false}
                />
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <NumericDistributionChart data={nc} />
            </div>
            <p className="text-xs text-text-muted text-center mt-4 border-t border-border-subtle pt-4 truncate">
              Numeric Distribution
            </p>
          </div>
        ))}

        {(filter === "All" || filter === "Distributions") && categoricalCharts.map((cc) => (
          <div key={`cat-${cc.column}`} className="glass-card-elevated p-6 flex flex-col h-[400px]">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="font-semibold text-text-primary flex items-center gap-2 truncate" title={cc.column}>
                <span className="text-[var(--accent-primary)]">A</span> {cc.column}
              </h3>
              <div className="shrink-0">
                <ConceptCard 
                  concept={GLOSSARY["distribution_categorical"]} 
                  alreadySeen={hasSeen("distribution_categorical")} 
                  onSeen={() => markSeen("distribution_categorical")} 
                  autoExpand={false}
                />
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <CategoricalBarChart data={cc} />
            </div>
            <p className="text-xs text-text-muted text-center mt-4 border-t border-border-subtle pt-4 truncate">
              Top Categories
            </p>
          </div>
        ))}

        {/* ================= CORRELATIONS ================= */}
        {(filter === "All" || filter === "Correlations") && correlationMatrix.length > 0 && (
          <div className="glass-card-elevated p-6 flex flex-col min-h-[600px] lg:col-span-full">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="font-semibold text-text-primary flex items-center gap-2">
                <span className="text-[var(--success)]">⚄</span> Correlation Heatmap
              </h3>
              <div className="shrink-0">
                <ConceptCard 
                  concept={GLOSSARY["correlation_heatmap"]} 
                  alreadySeen={hasSeen("correlation_heatmap")} 
                  onSeen={() => markSeen("correlation_heatmap")} 
                  autoExpand={false}
                />
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-surface/50 rounded-xl border border-border-subtle/30 p-4">
              <CorrelationHeatmap data={correlationMatrix} />
            </div>
            <p className="text-xs text-text-muted text-center mt-4 border-t border-border-subtle pt-4">
              Pearson Correlation — Dataset-wide
            </p>
          </div>
        )}

        {(filter === "All" || filter === "Correlations") && scatterSamples.map((sc, idx) => (
          <div key={`scatter-${idx}`} className="glass-card-elevated p-6 flex flex-col h-[400px]">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="font-semibold text-text-primary flex items-center gap-2 truncate" title={`${sc.col_a} vs ${sc.col_b}`}>
                <span className="text-[var(--success)]">⚄</span> {sc.col_a} vs {sc.col_b}
              </h3>
              <div className="shrink-0">
                <ConceptCard 
                  concept={GLOSSARY["scatter_plot"]} 
                  alreadySeen={hasSeen("scatter_plot")} 
                  onSeen={() => markSeen("scatter_plot")} 
                  autoExpand={false}
                />
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <ScatterPlotChart data={sc} />
            </div>
            <p className="text-xs text-text-muted text-center mt-4 border-t border-border-subtle pt-4 truncate">
              Scatter Plot
            </p>
          </div>
        ))}

        {/* ================= TARGET ANALYSIS (Tier 2) ================= */}
        {(filter === "All" || filter === "Target Analysis") && targetCol && featureRelevance.length > 0 && (
          <div className="glass-card-elevated p-6 flex flex-col h-[400px] lg:col-span-2 border-[var(--accent-primary)]/30">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="font-semibold text-[var(--accent-primary)] flex items-center gap-2">
                <span>🎯</span> Feature Importance for "{targetCol}"
              </h3>
              <div className="shrink-0">
                <ConceptCard 
                  concept={GLOSSARY["feature_importance"]} 
                  alreadySeen={hasSeen("feature_importance")} 
                  onSeen={() => markSeen("feature_importance")} 
                  autoExpand={false}
                />
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <FeatureImportanceChart data={featureRelevance} />
            </div>
            <p className="text-xs text-text-muted text-center mt-4 border-t border-[var(--accent-primary)]/10 pt-4">
              Random Forest Feature Importances
            </p>
          </div>
        )}
        
        {(filter === "All" || filter === "Target Analysis") && targetCol && (
          <div className="glass-card-elevated p-6 flex flex-col h-[400px] border-[var(--accent-primary)]/30">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="font-semibold text-[var(--accent-primary)] flex items-center gap-2">
                <span>🎯</span> Target Distribution
              </h3>
            </div>
            <div className="flex-1 min-h-0">
              {isClassification ? (
                // Use Categorical chart for classification
                categoricalCharts.find(c => c.column === targetCol) ? (
                  <CategoricalBarChart data={categoricalCharts.find(c => c.column === targetCol)!} />
                ) : (
                  <div className="h-full flex items-center justify-center text-text-muted">No categorical data found for target</div>
                )
              ) : (
                // Use Numeric chart for regression
                numericCharts.find(c => c.column === targetCol) ? (
                  <NumericDistributionChart data={numericCharts.find(c => c.column === targetCol)!} />
                ) : (
                  <div className="h-full flex items-center justify-center text-text-muted">No numeric data found for target</div>
                )
              )}
            </div>
            <p className="text-xs text-text-muted text-center mt-4 border-t border-[var(--accent-primary)]/10 pt-4">
              Distribution — {targetCol}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
