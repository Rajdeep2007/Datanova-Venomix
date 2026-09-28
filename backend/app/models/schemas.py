from __future__ import annotations

from pydantic import BaseModel, Field

from app.models.enums import SemanticType, RecommendedAction


class UploadResponse(BaseModel):
    session_id: str
    diagnosis: dict


class ColumnSemantic(BaseModel):
    column: str
    semantic_type: SemanticType
    is_identifier: bool
    notes: str = ""


class ClassifyResponse(BaseModel):
    columns: list[ColumnSemantic]


class Recommendation(BaseModel):
    column: str
    issue: str
    severity: str
    recommended_action: RecommendedAction
    justification: str
    confidence: float = Field(ge=0.0, le=1.0)
    needs_review: bool = False
    # --- explainability (LLM-generated, shown to the learner) ---
    rationale: str = ""
    why_not_other_actions: list[str] = []
    confidence_reason: str = ""


class RecommendResponse(BaseModel):
    recommendations: list[Recommendation]


class ActionRequest(BaseModel):
    session_id: str
    column: str
    action: RecommendedAction
    justification: str = ""


class ActionResponse(BaseModel):
    success: bool
    column: str
    action: str
    before: dict
    after: dict
    full_diagnosis: dict


class AnalyzeRequest(BaseModel):
    session_id: str
    target_column: str | None = None
    target_purpose: str | None = None


class AnalyzeResponse(BaseModel):
    semantic_types: list[ColumnSemantic]
    recommendations: list[Recommendation]
    target_analysis: dict | None = None
    warnings: list[str] = []


class JobResponse(BaseModel):
    job_id: str
    session_id: str
    status: str  # queued | processing | succeeded | failed
    progress_pct: int = 0
    message: str = ""
    result: dict | None = None
    error: str | None = None


class PreviewResponse(BaseModel):
    columns: list[str]
    rows: list[dict]
    total_rows: int
    truncated: bool


class RecipeSaveRequest(BaseModel):
    name: str
    description: str = ""
    session_id: str


class RecipeApplyRequest(BaseModel):
    recipe_id: str
    session_id: str


class RecipeAction(BaseModel):
    column: str
    action: str
    justification: str = ""


class RecipeApplyResult(BaseModel):
    recipe_id: str
    recipe_name: str
    actions_applied: list[RecipeAction]
    actions_skipped: list[RecipeAction]
    warnings: list[str]
    full_diagnosis: dict


class RecipeInfo(BaseModel):
    id: str
    name: str
    description: str = ""
    created_at: str
    source_shape: dict
    source_columns: list[str]
    action_count: int
    actions: list[RecipeAction]


class RecipeListResponse(BaseModel):
    recipes: list[RecipeInfo]


class RecipeSaveResponse(BaseModel):
    id: str
    name: str
    action_count: int

class ActionSummary(BaseModel):
    column: str
    action: str
    justification: str
    before: dict
    after: dict

class SummaryResponse(BaseModel):
    original_shape: dict
    final_shape: dict
    actions_applied: list[ActionSummary]
    export_ready: bool

class ResetRequest(BaseModel):
    session_id: str

class ResetResponse(BaseModel):
    success: bool
    full_diagnosis: dict

class CanvasExecuteRequest(BaseModel):
    session_id: str
    node_type: str
    config: dict
    upstream_node_output_id: str | None = None
    node_id: str  # Added node_id to uniquely identify the node execution on the canvas

class CanvasExecuteResponse(BaseModel):
    node_output_id: str
    preview: dict  # shape, sample_rows
    diagnosis_delta: dict | None = None
