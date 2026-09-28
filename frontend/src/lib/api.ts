import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 600_000,
});

/* ────────────────────────── Types ────────────────────────── */

export interface ShapeInfo {
  rows: number;
  columns: number;
  memory_kb: number;
}

export interface DtypeInfo {
  column: string;
  raw_dtype: string;
  inferred_type: string;
}

export interface MissingnessInfo {
  column: string;
  missing_pct: number;
  flagged: boolean;
}

export interface CardinalityInfo {
  column: string;
  unique_values: number;
  unique_ratio: number;
  flagged_high_cardinality: boolean;
}

export interface CorrelatedPair {
  col_a: string;
  col_b: string;
  r: number;
}

export interface OutlierInfo {
  column: string;
  outlier_count: number;
  outlier_pct: number;
  lower_bound: number;
  upper_bound: number;
}

export interface DuplicateRowInfo {
  duplicate_row_count: number;
  duplicate_row_pct: number;
  duplicate_row_indices: number[];
}

export interface DuplicateColumnPair {
  col_a: string;
  col_b: string;
}

export interface DuplicateColumnInfo {
  duplicate_column_pairs: DuplicateColumnPair[];
}

export interface ConstantFeatureInfo {
  column: string;
  fully_constant: boolean;
  constant_excluding_missing: boolean;
  constant_value: string | number | boolean | null;
}

export interface InfiniteValueInfo {
  column: string;
  infinite_count: number;
}

export interface RareCategoryDetail {
  value: string;
  pct: number;
}

export interface RareCategoryInfo {
  column: string;
  rare_categories: RareCategoryDetail[];
  rare_category_count: number;
}

export interface HistogramBin {
  bin_start: number;
  bin_end: number;
  count: number;
}

export interface NumericChartData {
  column: string;
  q1: number;
  median: number;
  q3: number;
  lower_bound: number;
  upper_bound: number;
  histogram: HistogramBin[];
}

export interface CategoricalChartData {
  column: string;
  value_counts: { value: string; count: number }[];
}

export interface ScatterSample {
  col_a: string;
  col_b: string;
  r: number;
  sample: { x: number; y: number }[];
}

export interface ChartData {
  numeric: NumericChartData[];
  categorical: CategoricalChartData[];
  correlation_matrix: { col_a: string; col_b: string; r: number }[];
  scatter_samples: ScatterSample[];
}

export interface ColumnQuality {
  column: string;
  score: number;
  grade: string;
  top_issues: string[];
}

export interface DataQuality {
  overall_score: number;
  overall_grade: string;
  per_column: ColumnQuality[];
  biggest_risks: string[];
  summary: string;
}

export interface Diagnosis {
  shape: ShapeInfo;
  dtypes: DtypeInfo[];
  missingness: MissingnessInfo[];
  cardinality: CardinalityInfo[];
  correlated_pairs: CorrelatedPair[];
  outliers: OutlierInfo[];
  duplicate_rows: DuplicateRowInfo;
  duplicate_columns: DuplicateColumnInfo;
  constant_features: ConstantFeatureInfo[];
  infinite_values: InfiniteValueInfo[];
  rare_categories: RareCategoryInfo[];
  chart_data?: ChartData;
  quality?: DataQuality;
}

export interface UploadResponse {
  session_id: string;
  diagnosis: Diagnosis;
}

export interface SemanticType {
  column: string;
  semantic_type: string;
  is_identifier: boolean;
  notes: string;
}

export interface Recommendation {
  column: string;
  issue: string;
  severity: "high" | "medium" | "low";
  recommended_action: string;
  justification: string;
  confidence: number;
  needs_review?: boolean;
}

export interface LeakageFlag {
  column: string;
  score: number;
  reason: string;
}

export interface ClassBalance {
  class_counts_pct: Record<string, number>;
  is_imbalanced: boolean;
  minority_class: string;
}

export interface FeatureRelevance {
  column: string;
  score: number;
  semantic_type: string;
}

export interface TargetAnalysis {
  problem_type: "classification" | "regression";
  target_column: string;
  leakage_flags: LeakageFlag[];
  class_balance: ClassBalance | null;
  feature_relevance: FeatureRelevance[];
}

export interface AnalyzeResponse {
  semantic_types: SemanticType[];
  recommendations: Recommendation[];
  target_analysis?: TargetAnalysis;
  warnings?: string[];
}

export interface JobStatus {
  job_id: string;
  session_id: string;
  status: "queued" | "processing" | "succeeded" | "failed";
  progress_pct: number;
  message: string;
  result?: AnalyzeResponse | null;
  error?: string | null;
}

export interface ColumnStats {
  missing_count: number;
  missing_pct: number;
  mean: number | null;
  std: number | null;
  min: number | null;
  max: number | null;
}

export interface ApplyActionResponse {
  success: boolean;
  column: string;
  action: string;
  before: ColumnStats;
  after: ColumnStats;
  full_diagnosis: Diagnosis;
}

export interface ActionSummary {
  column: string;
  action: string;
  justification: string;
  before: ColumnStats;
  after: ColumnStats;
}

export interface SummaryResponse {
  original_shape: { rows: number; columns: number };
  final_shape: { rows: number; columns: number };
  actions_applied: ActionSummary[];
  export_ready: boolean;
}

/* ────────────────────────── API Calls ────────────────────────── */

export async function uploadFile(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post<UploadResponse>("/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function analyzeData(
  sessionId: string,
  targetColumn?: string,
  targetPurpose?: string,
  onProgress?: (job: JobStatus) => void
): Promise<AnalyzeResponse> {
  const payload: Record<string, string> = { session_id: sessionId };
  if (targetColumn) payload.target_column = targetColumn;
  if (targetPurpose) payload.target_purpose = targetPurpose;

  // /analyze now returns a background job immediately (202)
  const { data: job } = await api.post<JobStatus>("/analyze", payload);

  // Poll until the job finishes
  for (;;) {
    const { data: status } = await api.get<JobStatus>(`/jobs/${job.job_id}`);
    onProgress?.(status);
    if (status.status === "succeeded") {
      return status.result as unknown as AnalyzeResponse;
    }
    if (status.status === "failed") {
      const raw = status.error || "Analysis failed. Please try again.";
      if (/429|RESOURCE_EXHAUSTED|quota/i.test(raw)) {
        throw new Error(
          "AI Analysis rate limit reached. Please wait a minute and try again."
        );
      }
      throw new Error(`Analysis failed: ${raw}`);
    }
    await sleep(500);
  }
}

export async function applyAction(
  sessionId: string,
  column: string,
  action: string,
  justification: string
): Promise<ApplyActionResponse> {
  const { data } = await api.post<ApplyActionResponse>("/apply-action", {
    session_id: sessionId,
    column,
    action,
    justification,
  });
  return data;
}

export async function fetchSummary(sessionId: string): Promise<SummaryResponse> {
  const { data } = await api.get<SummaryResponse>(`/session/${sessionId}/summary`);
  return data;
}

export async function exportData(sessionId: string): Promise<void> {
  const url = getExportUrl(sessionId);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Export failed: ${response.statusText}`);
  }
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = `datanova_cleaned_${sessionId}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(blobUrl);
}

export function getExportUrl(sessionId: string): string {
  return `${API_BASE}/export/${sessionId}`;
}

export interface ResetResponse {
  success: boolean;
  full_diagnosis: Diagnosis;
}

export async function resetSession(sessionId: string): Promise<ResetResponse> {
  const { data } = await api.post<ResetResponse>("/reset-session", { session_id: sessionId });
  return data;
}

export interface CanvasExecuteRequest {
  session_id: string;
  node_type: string;
  config: Record<string, any>;
  upstream_node_output_id?: string | null;
  node_id: string;
}

export interface CanvasExecuteResponse {
  node_output_id: string;
  preview: {
    shape: { rows: number; columns: number };
    sample_rows: Record<string, any>[];
    columns?: { name: string; type: string }[];
  };
  diagnosis_delta?: Record<string, any>;
}

export async function executeCanvasNode(payload: CanvasExecuteRequest): Promise<CanvasExecuteResponse> {
  const { data } = await api.post<CanvasExecuteResponse>("/execute-node", payload);
  return data;
}

export interface ScatterDataResponse {
  points: { x: number; y: number; color_group?: string }[];
  x_col: string;
  y_col: string;
  color_col?: string;
  truncated: boolean;
}

export async function fetchScatterData(
  sessionId: string,
  xCol: string,
  yCol: string,
  colorCol?: string,
  upstreamNodeOutputId?: string
): Promise<ScatterDataResponse> {
  const params = new URLSearchParams({
    session_id: sessionId,
    x_col: xCol,
    y_col: yCol,
  });
  if (colorCol) params.append("color_col", colorCol);
  if (upstreamNodeOutputId) params.append("upstream_node_output_id", upstreamNodeOutputId);
  const { data } = await api.get<ScatterDataResponse>(`/scatter-data?${params.toString()}`);
  return data;
}

export interface BoxPlotGroup {
  group_label: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  mean: number;
  std: number;
  outliers: number[];
}

export interface BoxPlotDataResponse {
  groups: BoxPlotGroup[];
  value_col: string;
  group_col?: string;
}

export async function fetchBoxPlotData(
  sessionId: string,
  valueCol: string,
  groupCol?: string,
  upstreamNodeOutputId?: string
): Promise<BoxPlotDataResponse> {
  const params = new URLSearchParams({
    session_id: sessionId,
    value_col: valueCol,
  });
  if (groupCol) params.append("group_col", groupCol);
  if (upstreamNodeOutputId) params.append("upstream_node_output_id", upstreamNodeOutputId);
  const { data } = await api.get<BoxPlotDataResponse>(`/boxplot-data?${params.toString()}`);
  return data;
}

export interface HeatMapDataResponse {
  matrix: { col_a: string; col_b: string; r: number }[];
  columns: string[];
  method: string;
}

export async function fetchHeatMapData(
  sessionId: string,
  columns?: string[],
  upstreamNodeOutputId?: string
): Promise<HeatMapDataResponse> {
  const params = new URLSearchParams({ session_id: sessionId });
  if (columns && columns.length > 0) {
    params.append("columns", columns.join(","));
  }
  if (upstreamNodeOutputId) params.append("upstream_node_output_id", upstreamNodeOutputId);
  const { data } = await api.get<HeatMapDataResponse>(`/heatmap-data?${params.toString()}`);
  return data;
}

/* ────────────────── Dataset Stats ────────────────── */

export async function fetchDatasetStats(sessionId: string, upstreamNodeOutputId?: string): Promise<any> {
  const params = new URLSearchParams();
  if (upstreamNodeOutputId) params.append("upstream_node_output_id", upstreamNodeOutputId);
  const qs = params.toString();
  const { data } = await api.get(`/dataset-stats/${sessionId}${qs ? '?' + qs : ''}`);
  return data;
}

/* ────────────────── Concat Files ────────────────── */

export async function concatFiles(sessionIds: string, how: string, files: File[]): Promise<any> {
  const formData = new FormData();
  formData.append("session_ids", sessionIds);
  formData.append("how", how);
  files.forEach(f => formData.append("files", f));
  const { data } = await api.post("/concat-files", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

/* ────────────────── Data Preview ────────────────────────── */

export interface PreviewRow {
  [column: string]: string | number | boolean | null;
}

export interface PreviewResponse {
  columns: string[];
  rows: PreviewRow[];
  total_rows: number;
  truncated: boolean;
}

export async function fetchPreviewRows(sessionId: string, limit = 200): Promise<PreviewResponse> {
  const { data } = await api.get<PreviewResponse>(`/preview/${sessionId}?limit=${limit}`);
  return data;
}

/* ────────────────────────── Recipes ────────────────────────── */

export interface RecipeAction {
  column: string;
  action: string;
  justification: string;
}

export interface RecipeInfo {
  id: string;
  name: string;
  description: string;
  created_at: string;
  source_shape: { rows: number; columns: number };
  source_columns: string[];
  action_count: number;
  actions: RecipeAction[];
}

export interface RecipeApplyResult {
  recipe_id: string;
  recipe_name: string;
  actions_applied: RecipeAction[];
  actions_skipped: RecipeAction[];
  warnings: string[];
  full_diagnosis: Diagnosis;
}

export async function listRecipes(): Promise<RecipeInfo[]> {
  const { data } = await api.get<{ recipes: RecipeInfo[] }>("/recipes/list");
  return data.recipes;
}

export async function saveRecipe(
  sessionId: string,
  name: string,
  description = ""
): Promise<{ id: string; name: string; action_count: number }> {
  const { data } = await api.post("/recipes/save", {
    session_id: sessionId,
    name,
    description,
  });
  return data;
}

export async function applyRecipe(
  recipeId: string,
  sessionId: string
): Promise<RecipeApplyResult> {
  const { data } = await api.post<RecipeApplyResult>("/recipes/apply", {
    recipe_id: recipeId,
    session_id: sessionId,
  });
  return data;
}

export async function deleteRecipe(recipeId: string): Promise<void> {
  await api.delete(`/recipes/${recipeId}`);
}

/* ────────────────── Developer canvas export ────────────────── */

/** Which node's output to download; empty string = raw session data. */
export function buildNodeExportUrl(sessionId: string, nodeId: string): string {
  return `${API_BASE}/export-node-output/${sessionId}/${nodeId}`;
}
