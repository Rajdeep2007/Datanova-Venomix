// Canvas pipeline → reproducible Python script / Jupyter notebook.
//
// Walks the executed graph in topological order (dataset source first) and
// emits the pandas/sklearn equivalent of every configured node, so the
// exported code reproduces exactly what the canvas did — on any machine,
// without DataNova.

import type { Node, Edge } from '@xyflow/react';

interface CanvasNodeData {
  config?: Record<string, any>;
  preview?: any;
  type?: string;
}

const q = (s: string) => JSON.stringify(s ?? '');

/** Topological order over edges; falls back to canvas order on cycles. */
function topoSort(nodes: Node[], edges: Edge[]): Node[] {
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  nodes.forEach((n) => {
    indeg.set(n.id, 0);
    adj.set(n.id, []);
  });
  edges.forEach((e) => {
    if (indeg.has(e.target) && adj.has(e.source)) {
      adj.get(e.source)!.push(e.target);
      indeg.set(e.target, (indeg.get(e.target) || 0) + 1);
    }
  });
  const queue = nodes.filter((n) => (indeg.get(n.id) || 0) === 0).map((n) => n.id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of adj.get(id) || []) {
      indeg.set(next, (indeg.get(next) || 0) - 1);
      if ((indeg.get(next) || 0) === 0) queue.push(next);
    }
  }
  // Nodes in cycles keep canvas order (best effort).
  const seen = new Set(order);
  nodes.forEach((n) => { if (!seen.has(n.id)) order.push(n.id); });
  return order.map((id) => nodes.find((n) => n.id === id)!).filter(Boolean);
}

/** One snippet per node — transforms, ML training, and visualizations. */
function nodeToCode(type: string, cfg: Record<string, any>): { comment: string; code: string[] } | null {
  const col = cfg?.column ?? '';
  switch (type) {
    case 'ImputeNode': {
      if (!col) return null;
      const method = cfg.method === 'mode' ? 'mode' : 'median';
      return {
        comment: `Impute "${col}" with ${method}`,
        code: method === 'median'
          ? [`df[${q(col)}] = df[${q(col)}].fillna(df[${q(col)}].median())`]
          : [`df[${q(col)}] = df[${q(col)}].fillna(df[${q(col)}].mode().iloc[0])`],
      };
    }
    case 'DropColumnNode':
      if (!col) return null;
      return { comment: `Drop column "${col}"`, code: [`df = df.drop(columns=[${q(col)}])`] };

    case 'ClipOutliersNode': {
      if (!col) return null;
      return {
        comment: `Clip "${col}" outliers at 1st/99th percentile`,
        code: [
          `_lo, _hi = df[${q(col)}].quantile([0.01, 0.99])`,
          `df[${q(col)}] = df[${q(col)}].clip(_lo, _hi)`,
        ],
      };
    }
    case 'LogTransformNode': {
      if (!col) return null;
      return {
        comment: `Log1p transform "${col}" (shifted if non-positive)`,
        code: [
          `_min = df[${q(col)}].min()`,
          `_shift = abs(_min) + 1 if _min <= 0 else 0`,
          `df[${q(col)}] = np.log1p(df[${q(col)}] + _shift)`,
        ],
      };
    }
    case 'MergeCategoriesNode': {
      if (!col) return null;
      return {
        comment: `Merge rare categories (<1%) in "${col}" into "Other"`,
        code: [
          `df[${q(col)}] = df[${q(col)}].astype(str).str.lower().str.strip()`,
          `_vc = df[${q(col)}].value_counts(normalize=True) * 100`,
          `_rare = _vc[_vc < 1.0].index`,
          `df.loc[df[${q(col)}].isin(_rare), ${q(col)}] = "Other"`,
        ],
      };
    }
    case 'FilterRowsNode': {
      if (!col) return null;
      const v = cfg.value ?? '';
      const ops: Record<string, string> = {
        equals: `df = df[df[${q(col)}].astype(str).str.lower() == str(${q(String(v))}).lower()] if not pd.api.types.is_numeric_dtype(df[${q(col)}]) else df[df[${q(col)}] == ${Number(v) || q(String(v))}]`,
        not_equals: `df = df[~(df[${q(col)}].astype(str).str.lower() == str(${q(String(v))}).lower())]`,
        greater_than: `df = df[pd.to_numeric(df[${q(col)}], errors="coerce") > ${Number(v) || 0}]`,
        less_than: `df = df[pd.to_numeric(df[${q(col)}], errors="coerce") < ${Number(v) || 0}]`,
        contains: `df = df[df[${q(col)}].astype(str).str.contains(${q(String(v))}, case=False, na=False)]`,
        not_empty: `df = df[df[${q(col)}].notna() & (df[${q(col)}].astype(str).str.strip() != "")]`,
        is_empty: `df = df[df[${q(col)}].isna() | (df[${q(col)}].astype(str).str.strip() == "")]`,
      };
      const op = ops[cfg.operator] || ops.equals;
      return { comment: `Filter rows: ${col} ${cfg.operator} ${v}`, code: [op] };
    }
    case 'SortNode': {
      if (!col) return null;
      const asc = cfg.ascending !== false;
      return { comment: `Sort by "${col}" ${asc ? 'ascending' : 'descending'}`, code: [`df = df.sort_values(${q(col)}, ascending=${asc}, na_position="last").reset_index(drop=True)`] };
    }
    case 'RenameColumnNode': {
      const newName = cfg.new_name ?? '';
      if (!col || !newName) return null;
      return { comment: `Rename "${col}" → "${newName}"`, code: [`df = df.rename(columns={${q(col)}: ${q(newName)}})`] };
    }
    case 'TypeCastNode': {
      if (!col) return null;
      const t = cfg.target_type ?? 'string';
      const casts: Record<string, string> = {
        numeric: `df[${q(col)}] = pd.to_numeric(df[${q(col)}], errors="coerce")`,
        float: `df[${q(col)}] = pd.to_numeric(df[${q(col)}], errors="coerce")`,
        int: `df[${q(col)}] = pd.to_numeric(df[${q(col)}], errors="coerce").astype("Int64")`,
        string: `df[${q(col)}] = df[${q(col)}].astype(str)`,
        datetime: `df[${q(col)}] = pd.to_datetime(df[${q(col)}], errors="coerce")`,
        boolean: `df[${q(col)}] = df[${q(col)}].astype(str).str.lower().isin(["true", "1", "yes", "y", "t"])`,
        category: `df[${q(col)}] = df[${q(col)}].astype("category")`,
      };
      return { comment: `Type-cast "${col}" → ${t}`, code: [casts[t] || casts.string] };
    }
    case 'EncodeNode': {
      if (!col) return null;
      if (cfg.method === 'onehot') {
        return {
          comment: `One-hot encode "${col}"`,
          code: [`df = pd.concat([df.drop(columns=[${q(col)}]), pd.get_dummies(df[${q(col)}], prefix=${q(col)}, dtype=int)], axis=1)`],
        };
      }
      return {
        comment: `Label-encode "${col}"`,
        code: [`df[${q(col)}] = df[${q(col)}].astype(str).map({c: i for i, c in enumerate(sorted(df[${q(col)}].dropna().astype(str).unique()))})`],
      };
    }
    case 'ScaleNode': {
      if (!col) return null;
      const m = cfg.method ?? 'standard';
      if (m === 'minmax') {
        return { comment: `Min-max scale "${col}"`, code: [`_mn, _mx = df[${q(col)}].min(), df[${q(col)}].max()`, `df[${q(col)}] = (df[${q(col)}] - _mn) / (_mx - _mn)`] };
      }
      if (m === 'robust') {
        return { comment: `Robust scale "${col}" (IQR)`, code: [`_med, _q75, _q25 = df[${q(col)}].median(), df[${q(col)}].quantile(0.75), df[${q(col)}].quantile(0.25)`, `df[${q(col)}] = (df[${q(col)}] - _med) / (_q75 - _q25)`] };
      }
      return { comment: `Standard-scale "${col}" (z-score)`, code: [`df[${q(col)}] = (df[${q(col)}] - df[${q(col)}].mean()) / df[${q(col)}].std()`] };
    }
    case 'SampleNode': {
      const n = Number(cfg.n ?? 100);
      const m = cfg.method ?? 'random';
      if (m === 'head') return { comment: `Sample first ${n} rows`, code: [`df = df.head(${n}).reset_index(drop=True)`] };
      if (m === 'tail') return { comment: `Sample last ${n} rows`, code: [`df = df.tail(${n}).reset_index(drop=True)`] };
      return { comment: `Random sample of ${n} rows (seeded)`, code: [`df = df.sample(n=min(${n}, len(df)), random_state=42).reset_index(drop=True)`] };
    }
    default:
      return null;
  }
}

// ── ML nodes ────────────────────────────────────────────────────────
// Mirrors executor.train_ml_models: numeric features, median-fill, 80/20
// split (seed 42), scaling for distance/linear models, task inferred from
// target dtype/cardinality. Classification adds accuracy/precision/recall/F1
// + confusion matrix; regression adds R²/RMSE/MAE.

const SKLEARN_MODEL_MAP: Record<string, string> = {
  'Logistic Regression': 'LogisticRegression(max_iter=1000, random_state=42)',
  'Random Forest': 'RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)',
  'Gradient Boosting': 'GradientBoostingClassifier(n_estimators=100, random_state=42)',
  'KNN': 'KNeighborsClassifier(n_neighbors=5)',
  'Decision Tree': 'DecisionTreeClassifier(random_state=42)',
  'SVM': 'SVC(kernel="rbf", probability=True, random_state=42)',
  'Linear Regression': 'LinearRegression()',
  'Ridge': 'Ridge(alpha=1.0)',
  'Lasso': 'Lasso(alpha=0.1)',
  'SVR': 'SVR(kernel="rbf")',
};

// Cross-task aliasing, same as the backend: a classifier node on a regression
// target trains its regression counterpart (and vice versa).
const TASK_ALIASES: Record<string, string> = {
  'logistic regression': 'Linear Regression',
  'random forest': 'Random Forest',
  'gradient boosting': 'Gradient Boosting',
  'knn': 'KNN',
  'decision tree': 'Decision Tree',
  'svm': 'SVR',
  'linear regression': 'Logistic Regression',
  'ridge': 'Logistic Regression',
  'lasso': 'Logistic Regression',
  'svr': 'SVM',
};

function mlNodeToCode(type: string, cfg: Record<string, any>, nodeLabel: string): { comment: string; code: string[] } | null {
  const target = cfg?.target_column ?? '';
  if (!target) return null;

  // Which algorithm(s) does this node train?
  let modelNames: string[] = [];
  if (type === 'MLTrainNode') {
    modelNames = Array.isArray(cfg.models) && cfg.models.length ? cfg.models : ['Logistic Regression', 'Random Forest', 'Gradient Boosting', 'KNN', 'Decision Tree', 'SVM'];
  } else {
    modelNames = [nodeLabel]; // individual ModelNode trains exactly one
  }

  const features = Array.isArray(cfg.feature_columns) && cfg.feature_columns.length
    ? `FEATURE_COLS = ${JSON.stringify(cfg.feature_columns)}`
    : 'FEATURE_COLS = None  # all numeric columns except target';

  return {
    comment: `Train ${modelNames.join(', ')} on target "${target}"`,
    code: [
      `TARGET = ${JSON.stringify(target)}`,
      features,
      '',
      'work = df.dropna(subset=[TARGET])',
      'y_raw = work[TARGET]',
      'X = work.drop(columns=[TARGET])',
      'if FEATURE_COLS:',
      '    X = X[FEATURE_COLS]',
      'X = X.select_dtypes(include=[np.number])',
      'X = X.fillna(X.median())',
      '',
      '# Task inference + label encoding (mirrors the canvas backend)',
      'if y_raw.dtype == "object" or y_raw.nunique() <= 20:',
      '    TASK = "classification"',
      '    from sklearn.preprocessing import LabelEncoder',
      '    le = LabelEncoder()',
      '    y = le.fit_transform(y_raw.astype(str))',
      'else:',
      '    TASK = "regression"',
      '    y = y_raw.astype(float)',
      '',
      'from sklearn.model_selection import train_test_split',
      'from sklearn.preprocessing import StandardScaler',
      'X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)',
      'scaler = StandardScaler()',
      'X_train_scaled = scaler.fit_transform(X_train)',
      'X_test_scaled = scaler.transform(X_test)',
      '',
      'SCALED_MODELS = {"Logistic Regression", "SVM", "SVR", "KNN", "Ridge", "Lasso"}',
      'results = {}',
    ]
      .concat(
        modelNames.map((name) => {
          const key = SKLEARN_MODEL_MAP[name] ? name : TASK_ALIASES[name.toLowerCase()] || name;
          const ctor = SKLEARN_MODEL_MAP[key];
          if (!ctor) return null;
          const scaled = ['Logistic Regression', 'SVM', 'SVR', 'KNN', 'Ridge', 'Lasso'].includes(key);
          const xtr = scaled ? 'X_train_scaled' : 'X_train';
          const xte = scaled ? 'X_test_scaled' : 'X_test';
          const lines = [
            '',
            `# ── ${key} ──`,
            `from sklearn.${key.includes('Regression') || key === 'Ridge' || key === 'Lasso' ? 'linear_model' : key.includes('Forest') || key.includes('Gradient') || key.includes('Tree') ? 'ensemble' : key === 'KNN' ? 'neighbors' : 'svm'} import ${ctor.split('(')[0]}`,`model_${key.replace(/\s+/g, '_').toLowerCase()} = ${ctor}`,`model_${key.replace(/\s+/g, '_').toLowerCase()}.fit(${xtr}, y_train)`,`y_pred = model_${key.replace(/\s+/g, '_').toLowerCase()}.predict(${xte})`,
            'if TASK == "classification":',
            '    from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix',
            '    results["' + key + '"] = {',
            '        "accuracy": accuracy_score(y_test, y_pred),',
            '        "precision": precision_score(y_test, y_pred, average="weighted", zero_division=0),',
            '        "recall": recall_score(y_test, y_pred, average="weighted", zero_division=0),',
            '        "f1": f1_score(y_test, y_pred, average="weighted", zero_division=0),',
            '        "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),',
            '    }',
            'else:',
            '    from sklearn.metrics import r2_score, mean_squared_error, mean_absolute_error',
            '    results["' + key + '"] = {',
            '        "r2": r2_score(y_test, y_pred),',
            '        "rmse": mean_squared_error(y_test, y_pred) ** 0.5,',
            '        "mae": mean_absolute_error(y_test, y_pred),',
            '    }',
          ];
          return lines.join('\n');
        }).filter(Boolean) as string[],
      )
      .concat(['', 'print(pd.DataFrame(results).T)']),
  };
}

// ── Visualization nodes (matplotlib equivalents) ────────────────────

function vizNodeToCode(type: string, cfg: Record<string, any>): { comment: string; code: string[] } | null {
  switch (type) {
    case 'ScatterPlotNode': {
      const x = cfg?.x_col, y = cfg?.y_col;
      if (!x || !y) return null;
      return {
        comment: `Scatter plot: ${x} vs ${y}`,
        code: [
          'plt.figure(figsize=(8, 5))',
          `plt.scatter(df[${JSON.stringify(x)}], df[${JSON.stringify(y)}], alpha=0.6, edgecolor="k", linewidth=0.3)`,
          `plt.xlabel(${JSON.stringify(x)}); plt.ylabel(${JSON.stringify(y)})`,
          `plt.title(${JSON.stringify(`${x} vs ${y}`)})`,
          'plt.tight_layout(); plt.show()',
        ],
      };
    }
    case 'BoxPlotNode': {
      const v = cfg?.value_col, g = cfg?.group_col;
      if (!v) return null;
      return {
        comment: g ? `Box plot of ${v} grouped by ${g}` : `Box plot of ${v}`,
        code: g
          ? [
              'plt.figure(figsize=(9, 5))',
              `df.boxplot(column=${JSON.stringify(v)}, by=${JSON.stringify(g)})`,
              'plt.suptitle(""); plt.tight_layout(); plt.show()',
            ]
          : [
              'plt.figure(figsize=(6, 4))',
              `plt.boxplot(df[${JSON.stringify(v)}].dropna(), vert=True)`,
              `plt.xticks([1], [${JSON.stringify(v)}]); plt.tight_layout(); plt.show()`,
            ],
      };
    }
    case 'HeatMapNode': {
      const cols = typeof cfg?.columns === 'string' && cfg.columns.trim()
        ? cfg.columns.split(',').map((s: string) => s.trim()).filter(Boolean)
        : null;
      const subset = cols ? `df[${JSON.stringify(cols)}]` : 'df.select_dtypes(include=[np.number])';
      return {
        comment: cols ? `Correlation heatmap of ${cols.join(', ')}` : 'Correlation heatmap (numeric columns)',
        code: [
          'plt.figure(figsize=(9, 7))',
          `corr = ${subset}.corr()`,
          'im = plt.imshow(corr, cmap="coolwarm", vmin=-1, vmax=1)',
          'plt.colorbar(im, label="correlation")',
          'plt.xticks(range(len(corr.columns)), corr.columns, rotation=45, ha="right")',
          'plt.yticks(range(len(corr.columns)), corr.columns)',
          'plt.tight_layout(); plt.show()',
        ],
      };
    }
    default:
      return null;
  }
}

export interface GeneratedExport {
  python: string;
  notebook: object;
}

// Node types that train models, and their sidebar labels (for single-model nodes)
const ML_MODEL_NODE_LABELS: Record<string, string> = {
  LogRegNode: 'Logistic Regression',
  RandomForestNode: 'Random Forest',
  GradientBoostingNode: 'Gradient Boosting',
  KNNNode: 'KNN',
  DecisionTreeNode: 'Decision Tree',
  SVMNode: 'SVM',
  MLTrainNode: '', // uses config.models
};

const VIZ_NODE_TYPES = new Set(['ScatterPlotNode', 'BoxPlotNode', 'HeatMapNode']);

export function generatePipelineExport(
  sessionId: string,
  nodes: Node[],
  edges: Edge[],
): GeneratedExport {
  const ordered = topoSort(nodes, edges);
  const steps = ordered
    .filter((n) => n.type !== 'FileNode')
    .map((n) => {
      const data = (n.data || {}) as CanvasNodeData;
      const type = (n.type || data.type || '') as string;
      const cfg = data.config || {};
      let snippet: { comment: string; code: string[] } | null = null;
      if (type === 'MLTrainNode' || ML_MODEL_NODE_LABELS[type] !== undefined) {
        snippet = mlNodeToCode(type, cfg, type === 'MLTrainNode' ? '' : ML_MODEL_NODE_LABELS[type]);
      } else if (VIZ_NODE_TYPES.has(type)) {
        snippet = vizNodeToCode(type, cfg);
      } else {
        snippet = nodeToCode(type, cfg);
      }
      return snippet ? { id: n.id, type, ...snippet } : null;
    })
    .filter(Boolean) as { id: string; type: string; comment: string; code: string[] }[];

  // What does the pipeline need?
  const hasViz = steps.some((s) => VIZ_NODE_TYPES.has(s.type));
  const hasML = steps.some((s) => ML_MODEL_NODE_LABELS[s.type] !== undefined);

  const header = [
    '"""',
    'DataNova AI - Developer Canvas pipeline',
    `Session: ${sessionId}`,`Generated ${new Date().toISOString()}`,
    `${steps.length} step(s): full canvas implementation (transforms${hasML ? ' + ML training' : ''}${hasViz ? ' + visualizations' : ''})`,
    '',
    'Reproduces the entire developer-canvas pipeline with plain pandas/sklearn/matplotlib.',
    'Set INPUT_FILE, then run top-to-bottom.',
    '"""',
  ];

  // ── Python script ──────────────────────────────────────────────
  const py: string[] = [
    ...header,
    '',
    'import pandas as pd',
    'import numpy as np',
    ...(hasViz ? ['import matplotlib.pyplot as plt'] : []),
    '',
    'INPUT_FILE = "your_dataset.csv"  # TODO: point at your data',
    'OUTPUT_FILE = "cleaned_dataset.csv"',
    '',
    'df = pd.read_csv(INPUT_FILE)',
    `print(f"Loaded {df.shape[0]} rows x {df.shape[1]} columns")`,
    '',
    '# ── Pipeline steps ────────────────────────────────────────',
  ];
  steps.forEach((s, i) => {
    py.push('', `# Step ${i + 1}: ${s.comment}`);
    py.push(...s.code);
  });
  py.push(
    '',
    '# ── Save result ───────────────────────────────────────────',
    'df.to_csv(OUTPUT_FILE, index=False)',
    `print(f"Saved {df.shape[0]} rows x {df.shape[1]} columns -> {OUTPUT_FILE}")`,
    '',
  );
  const python = py.join('\n');


  // ── Jupyter notebook (.ipynb JSON) ────────────────────────────
  const codeCell = (source: string[]) => ({
    cell_type: 'code',
    execution_count: null,
    metadata: {},
    outputs: [],
    source: source.map((l, i) => (i < source.length - 1 ? l + '\n' : l)),
  });
  const mdCell = (source: string) => ({
    cell_type: 'markdown',
    metadata: {},
    source,
  });

  const nbCells: any[] = [
    mdCell(
      [
        '# DataNova AI — Developer Canvas Pipeline',
        '',
        `**Session:** \`${sessionId}\`  `,
        `**Generated:** ${new Date().toLocaleString()}  `,
        `**Steps:** ${steps.length}`,
        '',
        'Run cells top-to-bottom to reproduce the canvas pipeline.',
      ].join('\n'),
    ),
    codeCell([
      'import pandas as pd',
      'import numpy as np',
      ...(hasViz ? ['import matplotlib.pyplot as plt', '%matplotlib inline'] : []),
      '',
      'INPUT_FILE = "your_dataset.csv"  # TODO: point at your data',
      'df = pd.read_csv(INPUT_FILE)',
      'print(f"Loaded {df.shape[0]} rows x {df.shape[1]} columns")',
      'df.head()',
    ]),
  ];
  steps.forEach((s, i) => {
    nbCells.push(mdCell(`## Step ${i + 1}: ${s.comment}`));
    nbCells.push(codeCell(s.code));
  });
  nbCells.push(
    mdCell('## Save result'),
    codeCell([
      'OUTPUT_FILE = "cleaned_dataset.csv"',
      'df.to_csv(OUTPUT_FILE, index=False)',
      'print(f"Saved {df.shape[0]} rows x {df.shape[1]} columns -> {OUTPUT_FILE}")',
    ]),
  );

  const notebook = {
    cells: nbCells,
    metadata: {
      kernelspec: { display_name: 'Python 3', language: 'python', name: 'python3' },
      language_info: { name: 'python', version: '3.11' },
    },
    nbformat: 4,
    nbformat_minor: 5,
  };

  return { python, notebook };
}

/** Trigger a browser download of `content` as a file. */
export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
