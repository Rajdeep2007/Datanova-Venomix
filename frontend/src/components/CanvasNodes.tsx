import React, { memo, useState } from 'react';
import { LineChart, Line, Legend } from 'recharts';
import { Handle, Position, NodeResizer, useNodeId, useReactFlow } from '@xyflow/react';

const getCategoryColor = (category?: string) => {
  if (category === 'data') return 'var(--accent-secondary)';
  if (category === 'transform') return 'var(--warning)';
  if (category === 'visualize') return 'var(--accent-primary)';
  if (category === 'ml') return '#7C3AED';
  return 'var(--border-subtle)';
};

const NodeStatus = ({ data }: { data: any }) => {
  if (data.isExecuting) return <div className="w-3 h-3 rounded-full border-2 border-[var(--text-muted)] border-t-transparent animate-spin" />;
  if (data.error) return <span className="text-[var(--danger)] text-xs font-bold" title={data.error}>!</span>;
  if (data.preview) return <span className="text-[var(--success)] text-xs">✓</span>;
  return null;
};

const CardBase = ({ children, title, icon, selected, category, data, className = "", deletable = true }: { children: React.ReactNode, title: string, icon: string, selected?: boolean, category?: string, data?: any, className?: string, deletable?: boolean }) => {
  const nodeId = useNodeId();
  const { deleteElements } = useReactFlow();
  return (
  <div className={`glass-card h-full w-full flex flex-col border-2 transition-colors ${selected ? 'shadow-lg' : 'shadow-sm'} ${className}`} style={{ borderColor: selected ? getCategoryColor(category) : 'var(--border-subtle)' }}>
    <div className="bg-surface-elevated border-b border-border-subtle px-3 py-2 flex items-center justify-between rounded-t-xl shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-sm rounded p-1" style={{ backgroundColor: getCategoryColor(category) + '33' }}>{icon}</span>
        <span className="text-xs font-bold text-text-primary uppercase tracking-wider">{title}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {data && <NodeStatus data={data} />}
        {selected && nodeId && deletable && (
          <button
            type="button"
            title="Delete node"
            aria-label="Delete node"
            className="nodrag nopan w-5 h-5 rounded-md flex items-center justify-center text-[11px] leading-none text-text-muted hover:text-white hover:bg-[var(--danger)] transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              deleteElements({ nodes: [{ id: nodeId }] });
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
    <div className="p-3 bg-surface flex-1 min-h-0 flex flex-col w-full h-full">
      {children}
    </div>
  </div>
  );
};

const ColumnSelector = ({ value, onChange, availableColumns, filterType, placeholder = "Select Column", className = "" }: any) => {
  let options = availableColumns || [];
  if (filterType === 'numeric') {
    options = options.filter((c: any) => c.type.includes('float') || c.type.includes('int') || c.type.includes('number'));
  } else if (filterType === 'categorical') {
    options = options.filter((c: any) => c.type.includes('object') || c.type.includes('bool') || c.type.includes('category'));
  }

  return (
    <select
      className={`text-xs px-2 py-1 rounded bg-surface border border-border-subtle outline-none focus:border-[var(--accent-primary)] ${className}`}
      value={value || ''}
      onChange={onChange}
    >
      <option value="" disabled>{placeholder}</option>
      {options.map((col: any) => (
        <option key={col.name} value={col.name}>{col.name}</option>
      ))}
    </select>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// DATA NODES
// ═══════════════════════════════════════════════════════════════════════

export const FileNode = memo(({ data, selected }: any) => {
  return (
    <>
      <CardBase title="File / Session" icon="📄" selected={selected} category="data" data={data} deletable={false}>
        <div className="text-[10px] text-text-muted mb-2 italic">Entry point for the dataset</div>
        <div className="text-xs text-text-muted mb-1">Session ID:</div>
        <div className="text-xs font-mono truncate max-w-[150px] mb-2">{data.sessionId || "Unknown"}</div>
        {data.preview && (
          <div className="flex gap-2">
            <span className="px-2 py-1 bg-surface-elevated rounded text-[10px] font-semibold">{data.preview.shape.rows} rows</span>
            <span className="px-2 py-1 bg-surface-elevated rounded text-[10px] font-semibold">{data.preview.shape.columns} cols</span>
          </div>
        )}
      </CardBase>
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-[var(--accent-primary)] border-2 border-surface" />
    </>
  );
});
FileNode.displayName = "FileNode";

export const DataTableNode = memo(({ data, selected }: any) => {
  return (
    <>
      <NodeResizer minWidth={250} minHeight={200} isVisible={selected} />
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-[var(--accent-primary)] border-2 border-surface" />
      <CardBase title="Data Preview" icon="📊" selected={selected} category="data" data={data} className="w-full h-full">
        <div className="text-[10px] text-text-muted mb-2 italic shrink-0">View tabular data rows</div>
        {data.preview?.sample_rows && data.preview.sample_rows.length > 0 ? (
          <div className="overflow-auto w-full h-full text-[10px] border border-border-subtle rounded custom-scrollbar flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface-elevated sticky top-0 z-10">
                <tr>
                  {Object.keys(data.preview.sample_rows[0]).map(k => (
                    <th key={k} className="p-1 border-b border-r border-border-subtle whitespace-nowrap bg-surface-elevated">{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.preview.sample_rows.map((row: any, i: number) => (
                  <tr key={i} className="border-b border-border-subtle hover:bg-surface-elevated">
                    {Object.values(row).map((v: any, j: number) => (
                      <td key={j} className="p-1 border-r border-border-subtle whitespace-nowrap truncate max-w-[150px]">{String(v)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-xs text-text-muted italic flex-1 w-full h-full flex items-center justify-center border border-border-subtle rounded">Connect upstream node...</div>
        )}
      </CardBase>
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-[var(--accent-primary)] border-2 border-surface" />
    </>
  );
});
DataTableNode.displayName = "DataTableNode";

// ═══════════════════════════════════════════════════════════════════════
// TRANSFORM NODES (generic wrapper)
// ═══════════════════════════════════════════════════════════════════════

const TransformNode = memo(({ typeName, icon, description, data, selected, children }: any) => {
  return (
    <>
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-[var(--warning)] border-2 border-surface" />
      <CardBase title={typeName} icon={icon} selected={selected} category="transform" data={data}>
        <div className="text-[10px] text-text-muted mb-2 italic">{description}</div>
        {children}
        {data.error && (
          <div className="mt-2 text-[10px] text-[var(--danger)] font-semibold break-words">
            {data.error}
          </div>
        )}
      </CardBase>
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-[var(--warning)] border-2 border-surface" />
    </>
  );
});

export const ImputeNode = memo((props: any) => {
  const { data } = props;
  return (
    <TransformNode typeName="Impute" icon="💉" description="Fill missing values" {...props}>
      <div className="flex flex-col gap-2">
        <ColumnSelector
          value={data.config?.column}
          onChange={(e: any) => data.onChange(props.id, { column: e.target.value })}
          availableColumns={data.availableColumns}
        />
        <select
          className="text-xs px-2 py-1 rounded bg-surface border border-border-subtle outline-none"
          value={data.config?.method || 'median'}
          onChange={(e) => data.onChange(props.id, { method: e.target.value })}
        >
          <option value="median">Median (Numeric)</option>
          <option value="mode">Mode (Categorical)</option>
        </select>
      </div>
    </TransformNode>
  );
});
ImputeNode.displayName = "ImputeNode";

export const DropColumnNode = memo((props: any) => {
  const { data } = props;
  return (
    <TransformNode typeName="Drop Column" icon="🗑️" description="Remove column entirely" {...props}>
      <ColumnSelector
        value={data.config?.column}
        onChange={(e: any) => data.onChange(props.id, { column: e.target.value })}
        availableColumns={data.availableColumns}
        className="w-full"
      />
    </TransformNode>
  );
});
DropColumnNode.displayName = "DropColumnNode";

export const ClipOutliersNode = memo((props: any) => {
  const { data } = props;
  return (
    <TransformNode typeName="Clip Outliers" icon="✂️" description="Cap extreme numeric values" {...props}>
      <ColumnSelector
        value={data.config?.column}
        onChange={(e: any) => data.onChange(props.id, { column: e.target.value })}
        availableColumns={data.availableColumns}
        filterType="numeric"
        className="w-full"
      />
    </TransformNode>
  );
});
ClipOutliersNode.displayName = "ClipOutliersNode";

export const MergeCategoriesNode = memo((props: any) => {
  const { data } = props;
  return (
    <TransformNode typeName="Merge Categories" icon="🔗" description="Group rare categories" {...props}>
      <ColumnSelector
        value={data.config?.column}
        onChange={(e: any) => data.onChange(props.id, { column: e.target.value })}
        availableColumns={data.availableColumns}
        filterType="categorical"
        className="w-full"
      />
    </TransformNode>
  );
});
MergeCategoriesNode.displayName = "MergeCategoriesNode";

// ── NEW TRANSFORM NODES ────────────────────────────────────────────

export const FilterRowsNode = memo((props: any) => {
  const { data } = props;
  return (
    <TransformNode typeName="Filter Rows" icon="🔍" description="Keep rows matching condition" {...props}>
      <div className="flex flex-col gap-2">
        <ColumnSelector
          value={data.config?.column}
          onChange={(e: any) => data.onChange(props.id, { column: e.target.value })}
          availableColumns={data.availableColumns}
          className="w-full"
        />
        <select
          className="text-xs px-2 py-1 rounded bg-surface border border-border-subtle outline-none"
          value={data.config?.operator || 'equals'}
          onChange={(e) => data.onChange(props.id, { operator: e.target.value })}
        >
          <option value="equals">Equals</option>
          <option value="not_equals">Not Equals</option>
          <option value="greater_than">Greater Than</option>
          <option value="less_than">Less Than</option>
          <option value="contains">Contains</option>
          <option value="not_empty">Not Empty</option>
          <option value="is_empty">Is Empty</option>
        </select>
        {data.config?.operator !== 'not_empty' && data.config?.operator !== 'is_empty' && (
          <input
            type="text"
            placeholder="Value"
            className="text-xs px-2 py-1 rounded bg-surface border border-border-subtle outline-none focus:border-[var(--accent-primary)]"
            value={data.config?.value || ''}
            onChange={(e) => data.onChange(props.id, { value: e.target.value })}
          />
        )}
      </div>
    </TransformNode>
  );
});
FilterRowsNode.displayName = "FilterRowsNode";

export const SortNode = memo((props: any) => {
  const { data } = props;
  return (
    <TransformNode typeName="Sort" icon="↕️" description="Sort rows by column" {...props}>
      <div className="flex flex-col gap-2">
        <ColumnSelector
          value={data.config?.column}
          onChange={(e: any) => data.onChange(props.id, { column: e.target.value })}
          availableColumns={data.availableColumns}
          className="w-full"
        />
        <select
          className="text-xs px-2 py-1 rounded bg-surface border border-border-subtle outline-none"
          value={data.config?.ascending !== false ? 'true' : 'false'}
          onChange={(e) => data.onChange(props.id, { ascending: e.target.value === 'true' })}
        >
          <option value="true">Ascending ↑</option>
          <option value="false">Descending ↓</option>
        </select>
      </div>
    </TransformNode>
  );
});
SortNode.displayName = "SortNode";

export const RenameColumnNode = memo((props: any) => {
  const { data } = props;
  return (
    <TransformNode typeName="Rename Column" icon="✏️" description="Rename a column" {...props}>
      <div className="flex flex-col gap-2">
        <ColumnSelector
          value={data.config?.column}
          onChange={(e: any) => data.onChange(props.id, { column: e.target.value })}
          availableColumns={data.availableColumns}
          className="w-full"
        />
        <input
          type="text"
          placeholder="New name"
          className="text-xs px-2 py-1 rounded bg-surface border border-border-subtle outline-none focus:border-[var(--accent-primary)]"
          value={data.config?.new_name || ''}
          onChange={(e) => data.onChange(props.id, { new_name: e.target.value })}
        />
      </div>
    </TransformNode>
  );
});
RenameColumnNode.displayName = "RenameColumnNode";

export const TypeCastNode = memo((props: any) => {
  const { data } = props;
  return (
    <TransformNode typeName="Type Cast" icon="🔄" description="Change column data type" {...props}>
      <div className="flex flex-col gap-2">
        <ColumnSelector
          value={data.config?.column}
          onChange={(e: any) => data.onChange(props.id, { column: e.target.value })}
          availableColumns={data.availableColumns}
          className="w-full"
        />
        <select
          className="text-xs px-2 py-1 rounded bg-surface border border-border-subtle outline-none"
          value={data.config?.target_type || 'numeric'}
          onChange={(e) => data.onChange(props.id, { target_type: e.target.value })}
        >
          <option value="numeric">Numeric</option>
          <option value="string">String</option>
          <option value="int">Integer</option>
          <option value="float">Float</option>
          <option value="datetime">DateTime</option>
          <option value="boolean">Boolean</option>
          <option value="category">Category</option>
        </select>
      </div>
    </TransformNode>
  );
});
TypeCastNode.displayName = "TypeCastNode";

export const EncodeNode = memo((props: any) => {
  const { data } = props;
  return (
    <TransformNode typeName="Encode Categories" icon="🔢" description="Encode categorical to numeric" {...props}>
      <div className="flex flex-col gap-2">
        <ColumnSelector
          value={data.config?.column}
          onChange={(e: any) => data.onChange(props.id, { column: e.target.value })}
          availableColumns={data.availableColumns}
          filterType="categorical"
          className="w-full"
        />
        <select
          className="text-xs px-2 py-1 rounded bg-surface border border-border-subtle outline-none"
          value={data.config?.method || 'label'}
          onChange={(e) => data.onChange(props.id, { method: e.target.value })}
        >
          <option value="label">Label Encoding</option>
          <option value="onehot">One-Hot Encoding</option>
        </select>
      </div>
    </TransformNode>
  );
});
EncodeNode.displayName = "EncodeNode";

export const ScaleNode = memo((props: any) => {
  const { data } = props;
  return (
    <TransformNode typeName="Scale / Normalize" icon="📐" description="Scale numeric column" {...props}>
      <div className="flex flex-col gap-2">
        <ColumnSelector
          value={data.config?.column}
          onChange={(e: any) => data.onChange(props.id, { column: e.target.value })}
          availableColumns={data.availableColumns}
          filterType="numeric"
          className="w-full"
        />
        <select
          className="text-xs px-2 py-1 rounded bg-surface border border-border-subtle outline-none"
          value={data.config?.method || 'standard'}
          onChange={(e) => data.onChange(props.id, { method: e.target.value })}
        >
          <option value="standard">Standard (z-score)</option>
          <option value="minmax">Min-Max (0-1)</option>
          <option value="robust">Robust (IQR)</option>
        </select>
      </div>
    </TransformNode>
  );
});
ScaleNode.displayName = "ScaleNode";

export const LogTransformNode = memo((props: any) => {
  const { data } = props;
  return (
    <TransformNode typeName="Log Transform" icon="📈" description="Apply log(1+x) to reduce skew" {...props}>
      <ColumnSelector
        value={data.config?.column}
        onChange={(e: any) => data.onChange(props.id, { column: e.target.value })}
        availableColumns={data.availableColumns}
        filterType="numeric"
        className="w-full"
      />
    </TransformNode>
  );
});
LogTransformNode.displayName = "LogTransformNode";

export const SampleNode = memo((props: any) => {
  const { data } = props;
  return (
    <TransformNode typeName="Sample Rows" icon="🎲" description="Take a sample of rows" {...props}>
      <div className="flex flex-col gap-2">
        <input
          type="number"
          placeholder="Number of rows"
          className="text-xs px-2 py-1 rounded bg-surface border border-border-subtle outline-none focus:border-[var(--accent-primary)]"
          value={data.config?.n || ''}
          onChange={(e) => data.onChange(props.id, { n: parseInt(e.target.value) || 100 })}
          min={1}
        />
        <select
          className="text-xs px-2 py-1 rounded bg-surface border border-border-subtle outline-none"
          value={data.config?.method || 'random'}
          onChange={(e) => data.onChange(props.id, { method: e.target.value })}
        >
          <option value="random">Random Sample</option>
          <option value="head">First N Rows</option>
          <option value="tail">Last N Rows</option>
        </select>
      </div>
    </TransformNode>
  );
});
SampleNode.displayName = "SampleNode";

export const StatsNode = memo((props: any) => {
  const { data } = props;
  const stats = data.preview?.stats;

  return (
    <>
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-[var(--accent-secondary)] border-2 border-surface" />
      <CardBase title="Dataset Stats" icon="📋" selected={props.selected} category="data" data={data}>
        <div className="text-[10px] text-text-muted mb-2 italic">Comprehensive column statistics</div>
        {stats ? (
          <div className="overflow-auto max-h-[250px] custom-scrollbar text-[10px]">
            <div className="mb-2 text-text-muted">
              <span className="font-semibold text-text-primary">{stats.shape.rows}</span> rows × <span className="font-semibold text-text-primary">{stats.shape.columns}</span> cols
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="p-1 text-text-muted">Column</th>
                  <th className="p-1 text-text-muted">Type</th>
                  <th className="p-1 text-text-muted">Missing</th>
                  <th className="p-1 text-text-muted">Unique</th>
                </tr>
              </thead>
              <tbody>
                {stats.columns?.map((col: any, i: number) => (
                  <tr key={i} className="border-b border-border-subtle hover:bg-surface-elevated">
                    <td className="p-1 font-mono font-semibold text-text-primary truncate max-w-[80px]">{col.name}</td>
                    <td className="p-1 text-text-muted">{col.dtype}</td>
                    <td className="p-1">{col.missing_pct > 0 ? <span className="text-[var(--warning)]">{col.missing_pct}%</span> : <span className="text-[var(--success)]">0%</span>}</td>
                    <td className="p-1 text-text-muted">{col.unique}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-xs text-text-muted italic flex-1 w-full flex items-center justify-center">Connect to view stats</div>
        )}
      </CardBase>
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-[var(--accent-secondary)] border-2 border-surface" />
    </>
  );
});
StatsNode.displayName = "StatsNode";

// ═══════════════════════════════════════════════════════════════════════
// ML NODES
// ═══════════════════════════════════════════════════════════════════════

const MLNode = memo(({ typeName, icon, description, data, selected, children }: any) => {
  return (
    <>
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-[#7C3AED] border-2 border-surface" />
      <CardBase title={typeName} icon={icon} selected={selected} category="ml" data={data}>
        <div className="text-[10px] text-text-muted mb-2 italic">{description}</div>
        {children}
        {data.error && (
          <div className="mt-2 text-[10px] text-[var(--danger)] font-semibold break-words">
            {data.error}
          </div>
        )}
      </CardBase>
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-[#7C3AED] border-2 border-surface" />
    </>
  );
});

export const MLTrainNode = memo((props: any) => {
  const { data } = props;
  const results = data.preview?.ml_results;
  const availableColumns = data.availableColumns || [];
  const numericCols = availableColumns.filter((c: any) => c.type.includes('float') || c.type.includes('int') || c.type.includes('number'));

  const MODEL_OPTIONS = [
    "Logistic Regression", "Random Forest", "Gradient Boosting",
    "KNN", "Decision Tree", "SVM",
    "Linear Regression", "Ridge", "Lasso", "SVR",
  ];

  const selectedModels = data.config?.models || [];

  return (
    <MLNode typeName="ML Train" icon="🤖" description="Train ML models & get accuracy" {...props}>
      <div className="flex flex-col gap-2">
        <ColumnSelector
          value={data.config?.target_column}
          onChange={(e: any) => data.onChange(props.id, { target_column: e.target.value })}
          availableColumns={numericCols.length > 0 ? numericCols : availableColumns}
          placeholder="Target Column"
          className="w-full"
        />
        <div className="text-[10px] text-text-muted font-semibold">Select Models:</div>
        <div className="flex flex-wrap gap-1 max-h-[80px] overflow-auto custom-scrollbar">
          {MODEL_OPTIONS.map(m => (
            <button
              key={m}
              onClick={() => {
                const next = selectedModels.includes(m)
                  ? selectedModels.filter((x: string) => x !== m)
                  : [...selectedModels, m];
                data.onChange(props.id, { models: next });
              }}
              className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${
                selectedModels.includes(m)
                  ? 'bg-[#7C3AED]/20 border-[#7C3AED]/50 text-[#7C3AED]'
                  : 'bg-surface border-border-subtle text-text-muted hover:bg-surface-elevated'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Results display */}
      {results && !results.error && (
        <div className="mt-2 border-t border-border-subtle pt-2">
          <div className="text-[10px] text-text-muted mb-1">
            <span className="font-semibold text-text-primary">{results.task}</span> · {results.n_samples} samples · {results.n_features} features
          </div>
          <div className="overflow-auto max-h-[200px] custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="p-1 text-[9px] text-text-muted">Model</th>
                  {results.task === "classification" ? (
                    <>
                      <th className="p-1 text-[9px] text-text-muted">Acc</th>
                      <th className="p-1 text-[9px] text-text-muted">Prec</th>
                      <th className="p-1 text-[9px] text-text-muted">Rec</th>
                      <th className="p-1 text-[9px] text-text-muted">F1</th>
                    </>
                  ) : (
                    <>
                      <th className="p-1 text-[9px] text-text-muted">R²</th>
                      <th className="p-1 text-[9px] text-text-muted">RMSE</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {Object.entries(results.models).map(([name, res]: [string, any]) => (
                  <tr key={name} className="border-b border-border-subtle hover:bg-surface-elevated">
                    <td className="p-1 text-[9px] font-semibold text-text-primary">{name}</td>
                    {results.task === "classification" ? (
                      <>
                        <td className="p-1 text-[9px]">
                          <span className={res.metrics?.accuracy >= 0.8 ? 'text-[var(--success)]' : res.metrics?.accuracy >= 0.6 ? 'text-[var(--warning)]' : 'text-[var(--danger)]'}>
                            {(res.metrics?.accuracy * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td className="p-1 text-[9px] text-text-secondary">{res.metrics?.precision?.toFixed(3)}</td>
                        <td className="p-1 text-[9px] text-text-secondary">{res.metrics?.recall?.toFixed(3)}</td>
                        <td className="p-1 text-[9px] text-text-secondary">{res.metrics?.f1?.toFixed(3)}</td>
                      </>
                    ) : (
                      <>
                        <td className="p-1 text-[9px]">
                          <span className={res.metrics?.r2 >= 0.7 ? 'text-[var(--success)]' : res.metrics?.r2 >= 0.4 ? 'text-[var(--warning)]' : 'text-[var(--danger)]'}>
                            {res.metrics?.r2?.toFixed(3)}
                          </span>
                        </td>
                        <td className="p-1 text-[9px] text-text-secondary">{res.metrics?.rmse?.toFixed(2)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Feature importance for best model */}
          {Object.entries(results.models).map(([name, res]: [string, any]) => {
            if (!res.feature_importance || res.feature_importance.length === 0) return null;
            const topFeatures = res.feature_importance.slice(0, 5);
            const maxImp = Math.max(...topFeatures.map((f: any) => f.importance), 0.001);
            return (
              <div key={name} className="mt-2">
                <div className="text-[9px] text-text-muted mb-1 font-semibold">{name} — Top Features:</div>
                {topFeatures.map((f: any, i: number) => (
                  <div key={i} className="flex items-center gap-1 mb-0.5">
                    <span className="text-[8px] text-text-muted w-[70px] truncate">{f.feature}</span>
                    <div className="flex-1 h-1.5 bg-surface-elevated rounded-full overflow-hidden">
                      <div className="h-full bg-[#7C3AED] rounded-full" style={{ width: `${(f.importance / maxImp) * 100}%` }} />
                    </div>
                    <span className="text-[8px] text-text-muted w-[30px] text-right">{(f.importance * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </MLNode>
  );
});
MLTrainNode.displayName = "MLTrainNode";

// ── Individual ML model nodes ──────────────────────────────────────────
// Each node trains exactly ONE algorithm on its upstream dataset. The
// ModelCompareNode aggregates results from every connected model node.

export const ML_MODEL_NODES = [
  { type: 'LogRegNode', label: 'Logistic Regression', model: 'Logistic Regression', icon: '𝗟' },
  { type: 'RandomForestNode', label: 'Random Forest', model: 'Random Forest', icon: '🌲' },
  { type: 'GradientBoostingNode', label: 'Gradient Boosting', model: 'Gradient Boosting', icon: '⚡' },
  { type: 'KNNNode', label: 'KNN', model: 'KNN', icon: '📍' },
  { type: 'DecisionTreeNode', label: 'Decision Tree', model: 'Decision Tree', icon: '🌳' },
  { type: 'SVMNode', label: 'SVM', model: 'SVM', icon: '🛡️' },
] as const;

const ScoreBadge = ({ label, value, pct }: { label: string; value: number | undefined; pct: number }) => {
  const color = pct >= 80 ? 'var(--success)' : pct >= 60 ? 'var(--warning)' : pct > 0 ? 'var(--danger)' : 'var(--text-muted)';
  return (
    <div className="flex-1 min-w-[70px]">
      <div className="flex justify-between items-baseline mb-0.5">
        <span className="text-[9px] text-text-muted uppercase tracking-wide">{label}</span>
        <span className="text-[11px] font-bold" style={{ color }}>{value !== undefined ? (pct < 1.5 ? pct.toFixed(1) + '%' : value.toFixed(3)) : '—'}</span>
      </div>
      <div className="h-1.5 bg-surface-elevated rounded-full overflow-hidden border border-border-subtle">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: color }} />
      </div>
    </div>
  );
};

const MODEL_METRIC_COLORS = { accuracy: '#22c55e', precision: '#3b82f6', recall: '#f59e0b', f1: '#ec4899' } as const;

// Multi-select dropdown for the X axes (feature columns). Stores the picked
// columns in config.feature_columns; empty = all numeric columns.
const XFeatureSelector = ({ config, onChange, nodeId, availableColumns }: { config: any; onChange: (id: string, patch: any) => void; nodeId: string; availableColumns: any[] }) => {
  const [open, setOpen] = useState(false);
  const selected: string[] = config?.feature_columns || [];
  const toggle = (name: string) => {
    const next = selected.includes(name) ? selected.filter((c) => c !== name) : [...selected, name];
    onChange(nodeId, { feature_columns: next });
  };
  return (
    <div className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full text-left text-xs px-2 py-1 rounded bg-surface border border-border-subtle hover:border-[var(--accent-primary)] flex items-center justify-between"
      >
        <span className="truncate text-text-muted">
          {selected.length === 0 ? 'Features (X): all numeric' : `Features (X): ${selected.length} selected`}
        </span>
        <span className="text-[8px] text-text-muted">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-[110px] overflow-auto custom-scrollbar bg-surface border border-border-subtle rounded shadow-lg">
          {availableColumns.map((col: any) => {
            const isTarget = col.name === config?.target_column;
            const isSel = selected.includes(col.name);
            return (
              <button
                key={col.name}
                type="button"
                disabled={isTarget}
                onClick={() => toggle(col.name)}
                className={`w-full text-left text-[10px] px-2 py-0.5 flex items-center gap-1.5 transition-colors ${
                  isTarget ? 'opacity-40 cursor-not-allowed' : isSel ? 'bg-[#7C3AED]/20 text-text-primary' : 'text-text-secondary hover:bg-surface-elevated'
                }`}
              >
                <span className={`w-3 h-3 rounded-sm border flex items-center justify-center text-[7px] ${isSel ? 'bg-[#7C3AED] border-[#7C3AED] text-white' : 'border-border-subtle'}`}>
                  {isSel ? '✓' : ''}
                </span>
                <span className="truncate">{col.name}{isTarget ? ' (target)' : ''}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Mini line plot of the 4 classification metrics (or R²/RMSE/MAE/MSE for
// regression, with MSE plotted on its own scale) for a single trained model.
const MetricLinePlot = ({ task, metrics }: { task: string; metrics: any }) => {
  if (!metrics) return null;
  const data = task === 'classification'
    ? [
        { metric: 'Acc', value: Math.round((metrics.accuracy ?? 0) * 1000) / 10 },
        { metric: 'Prec', value: Math.round((metrics.precision ?? 0) * 1000) / 10 },
        { metric: 'Rec', value: Math.round((metrics.recall ?? 0) * 1000) / 10 },
        { metric: 'F1', value: Math.round((metrics.f1 ?? 0) * 1000) / 10 },
      ]
    : [
        { metric: 'R²', value: metrics.r2 ?? 0 },
        { metric: 'RMSE', value: metrics.rmse ?? 0 },
        { metric: 'MAE', value: metrics.mae ?? 0 },
        { metric: 'MSE', value: metrics.mse ?? 0 },
      ];
  return (
    <div className="h-[64px] bg-surface-elevated rounded border border-border-subtle p-0.5">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -30 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="var(--border-subtle)" />
          <XAxis dataKey="metric" tick={{ fontSize: 7 }} axisLine={false} tickLine={false} interval={0} />
          <YAxis tick={{ fontSize: 7 }} axisLine={false} tickLine={false} width={30} />
          <Tooltip
            formatter={(v: any) => [typeof v === 'number' ? v.toFixed(3) : v, '']}
            contentStyle={{ fontSize: '9px', borderRadius: '6px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)' }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#7C3AED"
            strokeWidth={1.5}
            dot={{ r: 2, fill: '#7C3AED' }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

const ModelNode = memo(({ modelLabel, props, icon }: { modelLabel: string; props: any; icon: string }) => {
  const { data } = props;
  const results = data.preview?.ml_results;
  const availableModels: any[] = results && !results.error && results.models ? Object.values(results.models) : [];
  // Exact match first; on cross-task aliasing (e.g. LogReg node on a
  // regression target) the backend returns the counterpart model instead,
  // so fall back to the single trained entry.
  const modelRes =
    availableModels.length > 0
      ? (results.models[modelLabel] && !results.models[modelLabel].error
          ? results.models[modelLabel]
          : availableModels.length === 1 && !availableModels[0].error
            ? availableModels[0]
            : undefined)
      : undefined;
  const [expanded, setExpanded] = useState(false);

  return (
    <MLNode typeName={modelLabel} icon={icon} description={`Train ${modelLabel} on the connected dataset`} {...props}>
      <ColumnSelector
        value={data.config?.target_column}
        onChange={(e: any) => data.onChange(props.id, { target_column: e.target.value })}
        availableColumns={data.availableColumns || []}
        placeholder="Target Column (y)"
        className="w-full"
      />
      <XFeatureSelector
        config={data.config}
        onChange={data.onChange}
        nodeId={props.id}
        availableColumns={data.availableColumns || []}
      />

      {results && !results.error && (
        <div className="mt-2 border-t border-border-subtle pt-2">
          <div className="text-[9px] text-text-muted mb-1.5">
            <span className="font-semibold text-text-primary">{results.task}</span>
            {' '}· {results.n_samples} samples · {results.n_features} features
          </div>
          {modelRes && !modelRes.error ? (
            <>
              <div className="grid grid-cols-2 gap-1.5 mb-2">
                {results.task === 'classification' ? (
                  <>
                    <ScoreBadge label="Accuracy" value={modelRes.metrics?.accuracy} pct={(modelRes.metrics?.accuracy || 0) * 100} />
                    <ScoreBadge label="Precision" value={modelRes.metrics?.precision} pct={(modelRes.metrics?.precision || 0) * 100} />
                    <ScoreBadge label="Recall" value={modelRes.metrics?.recall} pct={(modelRes.metrics?.recall || 0) * 100} />
                    <ScoreBadge label="F1" value={modelRes.metrics?.f1} pct={(modelRes.metrics?.f1 || 0) * 100} />
                  </>
                ) : (
                  <>
                    <ScoreBadge label="R²" value={modelRes.metrics?.r2} pct={Math.max(0, (modelRes.metrics?.r2 || 0)) * 100} />
                    <ScoreBadge label="RMSE" value={modelRes.metrics?.rmse} pct={0} />
                    <ScoreBadge label="MAE" value={modelRes.metrics?.mae} pct={0} />
                    <ScoreBadge label="MSE" value={modelRes.metrics?.mse} pct={0} />
                  </>
                )}
              </div>

              <MetricLinePlot
                task={results.task}
                metrics={modelRes.metrics}
              />

              <button
                onClick={() => setExpanded(!expanded)}
                className="text-[9px] font-semibold text-[#7C3AED] hover:underline mt-1"
              >
                {expanded ? '▼ Hide details' : '▶ Details (confusion matrix, ROC, importance)'}
              </button>
              {expanded && (
                <div className="mt-1.5 flex flex-col gap-2">
                  {modelRes.feature_importance && modelRes.feature_importance.length > 0 && (
                    <div>
                      <div className="text-[9px] text-text-muted font-semibold mb-1">Top Features</div>
                      {modelRes.feature_importance.slice(0, 5).map((f: any, i: number) => {
                        const maxImp = Math.max(...modelRes.feature_importance.slice(0, 5).map((x: any) => x.importance), 0.001);
                        return (
                          <div key={i} className="flex items-center gap-1 mb-0.5">
                            <span className="text-[8px] text-text-muted w-[70px] truncate">{f.feature}</span>
                            <div className="flex-1 h-1.5 bg-surface-elevated rounded-full overflow-hidden">
                              <div className="h-full bg-[#7C3AED] rounded-full" style={{ width: `${(f.importance / maxImp) * 100}%` }} />
                            </div>
                            <span className="text-[8px] text-text-muted w-[30px] text-right">{(f.importance * 100).toFixed(1)}%</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {modelRes.confusion_matrix && (
                    <div>
                      <div className="text-[9px] text-text-muted font-semibold mb-1">Confusion Matrix</div>
                      <div className="inline-grid gap-px" style={{ gridTemplateColumns: `repeat(${modelRes.confusion_matrix.length}, minmax(0, 1fr))` }}>
                        {modelRes.confusion_matrix.flat().map((v: number, i: number) => {
                          const maxVal = Math.max(...modelRes.confusion_matrix.flat());
                          const opacity = maxVal > 0 ? 0.15 + (v / maxVal) * 0.85 : 0;
                          const isDiag = Math.floor(i / modelRes.confusion_matrix.length) === i % modelRes.confusion_matrix.length;
                          return (
                            <div key={i} className="w-6 h-6 flex items-center justify-center text-[8px] font-mono rounded-sm"
                              style={{
                                backgroundColor: isDiag ? `rgba(45, 156, 110, ${opacity})` : `rgba(149, 18, 44, ${opacity})`,
                                color: opacity > 0.5 ? 'white' : 'var(--text-muted)',
                              }}>
                              {v}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {modelRes.roc_data && (
                    <div>
                      <div className="text-[9px] text-text-muted font-semibold mb-1">ROC Curve (AUC {modelRes.roc_data.auc?.toFixed(3)})</div>
                      <div className="h-20 bg-surface-elevated rounded border border-border-subtle relative">
                        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                          <polyline
                            points={modelRes.roc_data.fpr.map((fpr: number, i: number) => `${fpr * 100},${100 - modelRes.roc_data.tpr[i] * 100}`).join(' ')}
                            fill="none" stroke="#7C3AED" strokeWidth="2"
                          />
                          <line x1="0" y1="100" x2="100" y2="0" stroke="var(--text-muted)" strokeWidth="0.5" strokeDasharray="2,2" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-[9px] text-[var(--danger)] font-semibold">
              {modelRes?.error || 'Training failed'}
            </div>
          )}
        </div>
      )}
      {results?.error && (
        <div className="mt-2 text-[9px] text-[var(--danger)] font-semibold break-words">{results.error}</div>
      )}
    </MLNode>
  );
});
ModelNode.displayName = "ModelNode";

export const LogRegNode = memo((props: any) => <ModelNode modelLabel="Logistic Regression" icon="𝗟" props={props} />);
LogRegNode.displayName = "LogRegNode";
export const RandomForestNode = memo((props: any) => <ModelNode modelLabel="Random Forest" icon="🌲" props={props} />);
RandomForestNode.displayName = "RandomForestNode";
export const GradientBoostingNode = memo((props: any) => <ModelNode modelLabel="Gradient Boosting" icon="⚡" props={props} />);
GradientBoostingNode.displayName = "GradientBoostingNode";
export const KNNNode = memo((props: any) => <ModelNode modelLabel="KNN" icon="📍" props={props} />);
KNNNode.displayName = "KNNNode";
export const DecisionTreeNode = memo((props: any) => <ModelNode modelLabel="Decision Tree" icon="🌳" props={props} />);
DecisionTreeNode.displayName = "DecisionTreeNode";
export const SVMNode = memo((props: any) => <ModelNode modelLabel="SVM" icon="🛡️" props={props} />);
SVMNode.displayName = "SVMNode";

export const ModelCompareNode = memo((props: any) => {
  const { data } = props;

  // Aggregate results from ALL connected model nodes upstream (collected by
  // DeveloperCanvas as data.compareResults), with a fallback to a single
  // upstream ml_results payload for backwards compatibility.
  const entries: { name: string; task: string; res: any }[] = [];
  if (Array.isArray(data.compareResults)) {
    for (const cr of data.compareResults) {
      const ml = cr.ml_results;
      if (!ml || ml.error) continue;
      const res = ml.models?.[cr.model];
      if (res && !res.error) entries.push({ name: cr.model, task: ml.task, res });
    }
  } else if (data.preview?.ml_results && !data.preview.ml_results.error) {
    const ml = data.preview.ml_results;
    for (const [name, res] of Object.entries(ml.models || {})) {
      const r = res as any;
      if (!r.error) entries.push({ name, task: ml.task, res: r });
    }
  }

  const task = entries[0]?.task || 'classification';
  const primary = (e: { task: string; res: any }) =>
    e.task === 'classification' ? e.res.metrics?.accuracy : e.res.metrics?.r2;
  const best = entries.reduce<{ name: string; score: number } | null>((acc, e) => {
    const s = primary(e);
    if (s === undefined) return acc;
    return !acc || s > acc.score ? { name: e.name, score: s } : acc;
  }, null);

  // One line per metric across all connected models — single combined plot.
  // Regression omits MSE from the chart (different scale); it stays in the table.
  const CHART_METRICS = task === 'classification'
    ? [
        { key: 'accuracy', label: 'Accuracy', color: '#22c55e' },
        { key: 'precision', label: 'Precision', color: '#3b82f6' },
        { key: 'recall', label: 'Recall', color: '#f59e0b' },
        { key: 'f1', label: 'F1', color: '#ec4899' },
      ]
    : [
        { key: 'r2', label: 'R²', color: '#22c55e' },
        { key: 'rmse', label: 'RMSE', color: '#f59e0b' },
        { key: 'mae', label: 'MAE', color: '#3b82f6' },
      ];
  const lineData = entries.map((e) => {
    const m = e.res.metrics || {};
    const row: any = {
      model: e.name.length > 12 ? e.name.slice(0, 11) + '…' : e.name,
      fullName: e.name,
    };
    for (const met of CHART_METRICS) row[met.key] = m[met.key] ?? 0;
    return row;
  });

  // Aggregate all binary-classification ROC curves into one overlay.
  const rocCurves = entries.filter((e) => e.res.roc_data);
  const ROC_COLORS = ['#7C3AED', '#3b82f6', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4'];

  return (
    <>
      <NodeResizer minWidth={440} minHeight={320} isVisible={props.selected} />
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-[#7C3AED] border-2 border-surface" />
      <CardBase title="Model Comparison" icon="📊" selected={props.selected} category="ml" data={data} className="w-full h-full">
        <div className="text-[10px] text-text-muted mb-2 italic shrink-0">
          {entries.length > 0
            ? `${entries.length} model${entries.length > 1 ? 's' : ''} compared${best ? ` · best: ${best.name} (${(best.score * 100).toFixed(1)}%)` : ''}`
            : 'Connect one or more ML model nodes'}
        </div>

        {entries.length > 0 ? (
          <div className="flex-1 overflow-auto custom-scrollbar text-[10px] flex flex-col gap-3 min-h-0">
            {/* ── Comparison table ─────────────────────────────── */}
            <table className="w-full text-left border-collapse shrink-0">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="p-1 text-[9px] text-text-muted">Model</th>
                  {task === 'classification' ? (
                    <>
                      <th className="p-1 text-[9px] text-text-muted">Accuracy</th>
                      <th className="p-1 text-[9px] text-text-muted">Precision</th>
                      <th className="p-1 text-[9px] text-text-muted">Recall</th>
                      <th className="p-1 text-[9px] text-text-muted">F1</th>
                    </>
                  ) : (
                    <>
                      <th className="p-1 text-[9px] text-text-muted">R²</th>
                      <th className="p-1 text-[9px] text-text-muted">RMSE</th>
                      <th className="p-1 text-[9px] text-text-muted">MAE</th>
                      <th className="p-1 text-[9px] text-text-muted">MSE</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const m = e.res.metrics || {};
                  const score = primary(e) || 0;
                  const isBest = best && e.name === best.name;
                  return (
                    <tr key={e.name} className="border-b border-border-subtle hover:bg-surface-elevated">
                      <td className="p-1 text-[9px] font-semibold text-text-primary whitespace-nowrap">
                        {isBest && <span className="text-[var(--success)] mr-0.5">★</span>}{e.name}
                      </td>
                      {task === 'classification' ? (
                        <>
                          <td className="p-1 text-[9px]">
                            <span className={score >= 0.8 ? 'text-[var(--success)] font-bold' : score >= 0.6 ? 'text-[var(--warning)]' : 'text-[var(--danger)]'}>
                              {(score * 100).toFixed(1)}%
                            </span>
                          </td>
                          <td className="p-1 text-[9px] text-text-secondary">{(m.precision ?? 0).toFixed(3)}</td>
                          <td className="p-1 text-[9px] text-text-secondary">{(m.recall ?? 0).toFixed(3)}</td>
                          <td className="p-1 text-[9px] text-text-secondary">{(m.f1 ?? 0).toFixed(3)}</td>
                        </>
                      ) : (
                        <>
                          <td className="p-1 text-[9px]">
                            <span className={score >= 0.7 ? 'text-[var(--success)] font-bold' : score >= 0.4 ? 'text-[var(--warning)]' : 'text-[var(--danger)]'}>
                              {score.toFixed(3)}
                            </span>
                          </td>
                          <td className="p-1 text-[9px] text-text-secondary">{(m.rmse ?? 0).toFixed(2)}</td>
                          <td className="p-1 text-[9px] text-text-secondary">{(m.mae ?? 0).toFixed(2)}</td>
                          <td className="p-1 text-[9px] text-text-secondary">{(m.mse ?? 0).toFixed(2)}</td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* ── Single combined line plot: one line per metric ── */}
            <div className="shrink-0">
              <div className="text-[9px] text-text-muted font-semibold mb-1">
                {task === 'classification' ? 'Metric Comparison (Accuracy · Precision · Recall · F1)' : 'Metric Comparison (R² · RMSE · MAE)'}
              </div>
              <div className="h-[160px] bg-surface-elevated rounded border border-border-subtle p-1">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                    <XAxis dataKey="model" tick={{ fontSize: 8 }} interval={0} axisLine={false} tickLine={false} />
                    <YAxis
                      domain={task === 'classification' ? [0, 100] : ['auto', 'auto']}
                      tick={{ fontSize: 8 }} axisLine={false} tickLine={false}
                    />
                    <Tooltip
                      formatter={(v: any) => (typeof v === 'number' ? v.toFixed(3) : v)}
                      labelFormatter={(l: any) => lineData.find((d) => d.model === l)?.fullName || l}
                      contentStyle={{ fontSize: '10px', borderRadius: '8px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 8 }} />
                    {CHART_METRICS.map((met) => (
                      <Line
                        key={met.key}
                        type="monotone"
                        dataKey={met.key}
                        name={met.label}
                        stroke={met.color}
                        strokeWidth={1.5}
                        dot={{ r: 2, fill: met.color }}
                        isAnimationActive={false}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── ROC overlay (binary classification only) ─────── */}
            {rocCurves.length > 0 && (
              <div className="shrink-0">
                <div className="text-[9px] text-text-muted font-semibold mb-1">ROC Curves (overlay)</div>
                <div className="h-[140px] bg-surface-elevated rounded border border-border-subtle p-1 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                      <XAxis type="number" dataKey="x" domain={[0, 1]} tick={{ fontSize: 8 }} axisLine={false} tickLine={false} />
                      <YAxis type="number" domain={[0, 1]} tick={{ fontSize: 8 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ fontSize: '10px', borderRadius: '8px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)' }}
                        labelFormatter={() => ''}
                        formatter={(v: any, n: any) => [typeof v === 'number' ? v.toFixed(3) : v, n === 'y' ? undefined : n]}
                      />
                      {rocCurves.map((e, i) => (
                        <Line
                          key={e.name}
                          name={`${e.name} (AUC ${e.res.roc_data.auc?.toFixed(3)})`}
                          data={e.res.roc_data.fpr.map((fpr: number, j: number) => ({ x: fpr, y: e.res.roc_data.tpr[j] }))}
                          dataKey="y"
                          type="monotone"
                          stroke={ROC_COLORS[i % ROC_COLORS.length]}
                          strokeWidth={1.5}
                          dot={false}
                          isAnimationActive={false}
                        />
                      ))}
                      <Line
                        name="Random"
                        data={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
                        dataKey="y"
                        type="linear"
                        stroke="var(--text-muted)"
                        strokeWidth={1}
                        strokeDasharray="4 4"
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ── Feature importance of best model ─────────────── */}
            {best && (() => {
              const bestEntry = entries.find((e) => e.name === best.name);
              const imp = bestEntry?.res.feature_importance || [];
              if (imp.length === 0) return null;
              const top = imp.slice(0, 6);
              const maxImp = Math.max(...top.map((f: any) => f.importance), 0.001);
              return (
                <div className="shrink-0">
                  <div className="text-[9px] text-text-muted font-semibold mb-1">{best.name} — Top Features</div>
                  {top.map((f: any, i: number) => (
                    <div key={i} className="flex items-center gap-1 mb-0.5">
                      <span className="text-[8px] text-text-muted w-[70px] truncate">{f.feature}</span>
                      <div className="flex-1 h-1.5 bg-surface-elevated rounded-full overflow-hidden">
                        <div className="h-full bg-[#7C3AED] rounded-full" style={{ width: `${(f.importance / maxImp) * 100}%` }} />
                      </div>
                      <span className="text-[8px] text-text-muted w-[30px] text-right">{(f.importance * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        ) : (
          <div className="text-xs text-text-muted italic flex-1 w-full flex items-center justify-center border border-border-subtle rounded border-dashed">
            Connect one or more ML model nodes here
          </div>
        )}
      </CardBase>
    </>
  );
});
ModelCompareNode.displayName = "ModelCompareNode";

// ═══════════════════════════════════════════════════════════════════════
// VISUALIZE NODES
// ═══════════════════════════════════════════════════════════════════════

const VisualizeNode = memo(({ typeName, icon, description, data, selected, children }: any) => {
  return (
    <>
      <NodeResizer minWidth={320} minHeight={240} isVisible={selected} />
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-[var(--accent-primary)] border-2 border-surface" />
      <CardBase title={typeName} icon={icon} selected={selected} category="visualize" data={data} className="w-full h-full">
        <div className="text-[10px] text-text-muted mb-2 italic shrink-0">{description}</div>
        {children}
        {data.error && (
          <div className="mt-2 text-[10px] text-[var(--danger)] font-semibold break-words shrink-0">
            {data.error}
          </div>
        )}
      </CardBase>
    </>
  );
});

import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export const ScatterPlotNode = memo((props: any) => {
  const { data } = props;
  const config = data.config || {};
  const vizData = data.preview?.vizData;
  const truncated = data.preview?.truncated;

  const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
  const getGroupColor = (group: string, idx: number) => {
    return COLORS[idx % COLORS.length];
  };

  let uniqueGroups: string[] = [];
  if (vizData && vizData.points && config.color_col) {
    uniqueGroups = Array.from(new Set(vizData.points.map((p: any) => p.color_group).filter(Boolean))) as string[];
  }

  return (
    <VisualizeNode typeName="Scatter Plot" icon="📈" description="Plot 2D relationships" {...props}>
      <div className="flex flex-col gap-2 w-full h-full">
        <div className="flex gap-2 shrink-0">
          <ColumnSelector
            placeholder="X Column (Num)"
            value={config.x_col}
            onChange={(e: any) => data.onChange(props.id, { x_col: e.target.value })}
            availableColumns={data.availableColumns}
            filterType="numeric"
            className="flex-1 w-0"
          />
          <ColumnSelector
            placeholder="Y Column (Num)"
            value={config.y_col}
            onChange={(e: any) => data.onChange(props.id, { y_col: e.target.value })}
            availableColumns={data.availableColumns}
            filterType="numeric"
            className="flex-1 w-0"
          />
        </div>
        <ColumnSelector
          placeholder="Color By Column (Cat, Optional)"
          value={config.color_col}
          onChange={(e: any) => data.onChange(props.id, { color_col: e.target.value })}
          availableColumns={data.availableColumns}
          filterType="categorical"
          className="w-full shrink-0"
        />

        <div className="flex-1 w-full mt-2 bg-surface-elevated rounded border border-border-subtle flex items-center justify-center p-2 relative min-h-0">
          {vizData && vizData.points && vizData.points.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis type="number" dataKey="x" name={vizData.x_col} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="number" dataKey="y" name={vizData.y_col} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ fontSize: '12px', borderRadius: '8px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)' }} />
                <Scatter data={vizData.points} fill="var(--accent-primary)">
                  {vizData.points.map((entry: any, index: number) => {
                    if (entry.color_group && uniqueGroups.length > 0) {
                      const colorIdx = uniqueGroups.indexOf(entry.color_group);
                      return <Cell key={`cell-${index}`} fill={getGroupColor(entry.color_group, colorIdx)} />;
                    }
                    return <Cell key={`cell-${index}`} fill="var(--accent-primary)" />;
                  })}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <span className="text-xs text-text-muted text-center max-w-[80%] border border-border-subtle p-4 rounded border-dashed">
              Configure numeric X and Y columns
            </span>
          )}
          {truncated && (
            <div className="absolute top-1 right-2 text-[9px] text-[var(--warning)] font-bold bg-surface px-1 rounded shadow-sm border border-[var(--warning)]/30">
              Limited to 5k pts
            </div>
          )}
        </div>
        {uniqueGroups.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1 shrink-0">
            {uniqueGroups.map((g, i) => (
              <div key={g} className="flex items-center gap-1 text-[10px]">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getGroupColor(g, i) }} />
                <span>{g}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </VisualizeNode>
  );
});
ScatterPlotNode.displayName = "ScatterPlotNode";

import BoxPlotChart from './charts/BoxPlotChart';

export const BoxPlotNode = memo((props: any) => {
  const { data } = props;
  const config = data.config || {};
  const vizData = data.preview?.vizData;

  return (
    <VisualizeNode typeName="Box Plot" icon="📊" description="Distribution & outliers" {...props}>
      <div className="flex flex-col gap-2 w-full h-full">
        <div className="flex gap-2 shrink-0">
          <ColumnSelector
            placeholder="Value Column (Num)"
            value={config.value_col}
            onChange={(e: any) => data.onChange(props.id, { value_col: e.target.value })}
            availableColumns={data.availableColumns}
            filterType="numeric"
            className="flex-1 w-0"
          />
          <ColumnSelector
            placeholder="Group By (Cat, Optional)"
            value={config.group_col}
            onChange={(e: any) => data.onChange(props.id, { group_col: e.target.value })}
            availableColumns={data.availableColumns}
            filterType="categorical"
            className="flex-1 w-0"
          />
        </div>

        <div className="flex-1 w-full mt-2 bg-surface-elevated rounded border border-border-subtle flex items-center justify-center p-2 relative overflow-hidden min-h-0">
          {vizData && vizData.groups && vizData.groups.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BoxPlotChart groups={vizData.groups} />
            </ResponsiveContainer>
          ) : (
            <span className="text-xs text-text-muted text-center max-w-[80%] border border-border-subtle p-4 rounded border-dashed">
              Configure a numeric Value column
            </span>
          )}
        </div>
      </div>
    </VisualizeNode>
  );
});
BoxPlotNode.displayName = "BoxPlotNode";

import CorrelationHeatmap from './charts/CorrelationHeatmap';

export const HeatMapNode = memo((props: any) => {
  const { data } = props;
  const config = data.config || {};
  const vizData = data.preview?.vizData;

  return (
    <VisualizeNode typeName="Heat Map" icon="🔥" description="Correlation matrix" {...props}>
      <div className="flex flex-col gap-2 w-full h-full">
        <input
          type="text" placeholder="Columns (comma separated, empty for all num)"
          className="text-xs px-2 py-1 rounded bg-surface border border-border-subtle w-full outline-none focus:border-[var(--accent-primary)] shrink-0"
          value={config.columns || ''} onChange={(e) => data.onChange(props.id, { columns: e.target.value })}
        />

        <div className="flex-1 w-full mt-2 bg-surface-elevated rounded border border-border-subtle p-2 relative overflow-auto custom-scrollbar min-h-0">
          {vizData && vizData.matrix ? (
            <CorrelationHeatmap data={vizData.matrix} />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-xs text-text-muted">Loading correlation...</span>
            </div>
          )}
        </div>
      </div>
    </VisualizeNode>
  );
});
HeatMapNode.displayName = "HeatMapNode";

// ═══════════════════════════════════════════════════════════════════════
// NODE TYPE REGISTRY
// ═══════════════════════════════════════════════════════════════════════

export const nodeTypes = {
  FileNode,
  DataTableNode,
  ImputeNode,
  DropColumnNode,
  ClipOutliersNode,
  MergeCategoriesNode,
  ScatterPlotNode,
  BoxPlotNode,
  HeatMapNode,
  // New transforms
  FilterRowsNode,
  SortNode,
  RenameColumnNode,
  TypeCastNode,
  EncodeNode,
  ScaleNode,
  LogTransformNode,
  SampleNode,
  StatsNode,
  // ML
  MLTrainNode,
  ModelCompareNode,
  // Individual ML models
  LogRegNode,
  RandomForestNode,
  GradientBoostingNode,
  KNNNode,
  DecisionTreeNode,
  SVMNode,
};
