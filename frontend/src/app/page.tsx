"use client";

import React, { useState, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/ThemeContext";
import {
  uploadFile,
  analyzeData,
  fetchSummary,
  type Recommendation,
  type SemanticType,
  type JobStatus,
  type SummaryResponse,
  resetSession,
} from "@/lib/api";
import FileUpload from "@/components/FileUpload";
import DiagnosticsPanel from "@/components/DiagnosticsPanel";
import RecommendationCard from "@/components/RecommendationCard";
import ConceptTracker from "@/components/ConceptTracker";
import GuessBeforeReveal from "@/components/GuessBeforeReveal";
import HealthScoreCard from "@/components/HealthScoreCard";
import DataPreviewModal from "@/components/DataPreviewModal";
import RecipesPanel from "@/components/RecipesPanel";
import { useConceptTracker } from "@/hooks/useConceptTracker";
import TargetSelectionForm from "@/components/TargetSelectionForm";
import TargetAnalysisPanel from "@/components/TargetAnalysisPanel";
import type { TargetAnalysis } from "@/lib/api";
import { useSession } from "@/lib/SessionContext";
import SummaryReport from "@/components/SummaryReport";
import GeminiWelcomeHeader from "@/components/GeminiWelcomeHeader";
import FloatingWelcomeNote from "@/components/FloatingWelcomeNote";
import GeminiWelcomeModal from "@/components/GeminiWelcomeModal";
import DataStorytelling from "@/components/DataStorytelling";
import DataChat from "@/components/DataChat";
import StrategySimulator from "@/components/StrategySimulator";
import ExportCode from "@/components/ExportCode";
import RecoveryDashboard from "@/components/RecoveryDashboard";

type Step = "upload" | "targetSelection" | "diagnostics" | "analyzing" | "recommendations" | "summary" | "done";

const STEPS = [
  { key: "upload", label: "Upload", icon: "↑" },
  { key: "diagnostics", label: "Diagnose", icon: "🔍" },
  { key: "recommendations", label: "AI Analysis", icon: "✦" },
  { key: "summary", label: "Summary", icon: "📋" },
  { key: "done", label: "Export", icon: "↓" },
] as const;

function stepIndex(step: Step): number {
  const map: Record<Step, number> = { upload: 0, targetSelection: 0, diagnostics: 1, analyzing: 2, recommendations: 2, summary: 3, done: 4 };
  return map[step];
}

const pageTransition = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.4, ease: "easeOut" as const }
};

export default function Home() {
  const [step, setStep] = useState<Step>("upload");
  const [showWelcomeModal, setShowWelcomeModal] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [analyzeWarnings, setAnalyzeWarnings] = useState<string[]>([]);
  const [jobProgress, setJobProgress] = useState<JobStatus | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [baselineHealth, setBaselineHealth] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizStreak, setQuizStreak] = useState(0);
  const [quizTotal, setQuizTotal] = useState(0);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);

  const {
    sessionId,
    setSessionId,
    diagnosis,
    setDiagnosis,
    recommendations,
    setRecommendations,
    semanticTypes,
    setSemanticTypes,
    targetColumn,
    setTargetColumn,
    targetPurpose,
    setTargetPurpose,
    targetAnalysis,
    setTargetAnalysis,
    clearSession,
  } = useSession();

  const { seenConcepts, markSeen, hasSeen } = useConceptTracker();
  const { theme, toggleTheme } = useTheme();

  // Handle restoring state when navigating back from graphs page to "/"
  React.useEffect(() => {
    // We only want to run this if we are newly mounted and stuck on "upload"
    // but the session already has a diagnosis.
    if (step === "upload" && diagnosis) {
      if (recommendations && recommendations.length > 0) {
        setStep("recommendations");
      } else {
        setStep("diagnostics");
      }
    }
  }, [diagnosis, recommendations]); // Intentionally not including `step` to avoid continuous triggers if they legitimately go back to upload

  /* ── Upload handler ─────────────────────────────────────── */
  const handleUpload = useCallback(async (file: File) => {
    setIsUploading(true);
    setUploadError(null);
    try {
      const res = await uploadFile(file);
      setSessionId(res.session_id);
      setDiagnosis(res.diagnosis);
      setBaselineHealth(res.diagnosis.quality?.overall_score ?? null);
      setAnalyzeWarnings([]);
      setStep("targetSelection");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed. Please try again.";
      setUploadError(msg);
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleTargetConfirm = useCallback((col?: string, purpose?: string) => {
    setTargetColumn(col);
    setTargetPurpose(purpose);
    setStep("diagnostics");
  }, []);

  /* ── Analyze handler ────────────────────────────────────── */
  const handleAnalyze = useCallback(async () => {
    if (!sessionId) return;
    setStep("analyzing");
    setAnalyzeError(null);
    setAnalyzeWarnings([]);
    setJobProgress({ job_id: "", session_id: sessionId, status: "processing", progress_pct: 2, message: "Starting analysis…" } as JobStatus);
    try {
      const res = await analyzeData(sessionId, targetColumn, targetPurpose, (job) =>
        setJobProgress(job)
      );
      setRecommendations(res.recommendations);
      setSemanticTypes(res.semantic_types);
      setTargetAnalysis(res.target_analysis || null);
      setAnalyzeWarnings(res.warnings || []);
      setStep("recommendations");
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || "Analysis failed.";
      setAnalyzeError(msg);
      setJobProgress(null);
      setStep("diagnostics");
    }
  }, [sessionId, targetColumn, targetPurpose]);

  const canGoBack = step !== "upload" && step !== "analyzing";
  const goBack = () => {
    if (step === "targetSelection") setStep("upload");
    else if (step === "diagnostics") setStep("targetSelection");
    else if (step === "recommendations") setStep("diagnostics");
    else if (step === "summary" || step === "done") setStep("recommendations");
  };

  const canGoNext = 
    (step === "upload" && diagnosis !== null) || 
    (step === "targetSelection" && diagnosis !== null) || 
    (step === "diagnostics" && recommendations && recommendations.length > 0) ||
    (step === "recommendations");

  const goNext = () => {
    if (step === "upload" && diagnosis) setStep("targetSelection");
    else if (step === "targetSelection" && diagnosis) setStep("diagnostics");
    else if (step === "diagnostics" && recommendations.length > 0) setStep("recommendations");
    else if (step === "recommendations") setStep("summary");
  };

  // Fetch summary when entering summary step
  React.useEffect(() => {
    if (step === "summary" && sessionId && !summary) {
      fetchSummary(sessionId).then(setSummary).catch(() => {});
    }
  }, [step, sessionId]);

  const handleReset = useCallback(() => {
    clearSession();
    setStep("upload");
  }, [clearSession]);

  const handleResetData = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await resetSession(sessionId);
      if (res.success) {
        setDiagnosis(res.full_diagnosis);
        setRecommendations([]);
        setStep("targetSelection"); // go back to start of diagnosis
      }
    } catch (err) {
      console.error("Failed to reset session:", err);
      alert("Failed to reset session to original state.");
    }
  }, [sessionId, setDiagnosis, setRecommendations]);

  const currentIdx = stepIndex(step);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Pop-up Gemini Welcome Modal on initial load */}
      <GeminiWelcomeModal 
        isOpen={showWelcomeModal} 
        onStart={() => setShowWelcomeModal(false)} 
      />

      {/* ── Header ────────────────────────────────────────── */}
      <header className="relative py-8 px-6 text-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--accent-primary),transparent_70%)] opacity-[0.08] pointer-events-none" />
        
        {/* Top Right Controls */}
        <div className="absolute top-6 right-6 z-20 flex items-center gap-4">
          {sessionId && (
            <>
              <button 
                onClick={handleResetData}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--danger)]/10 text-[var(--danger)] border border-[var(--danger)]/30 hover:bg-[var(--danger)]/20 transition-colors"
              >
                Reset Data
              </button>
              
              <div className="flex bg-surface-elevated border border-border-subtle rounded-lg p-1">
                <button className="px-3 py-1 text-xs font-bold rounded-md bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white shadow-sm">
                  Learner
                </button>
                <Link href={`/developer/${sessionId}`} className="px-3 py-1 text-xs font-semibold rounded-md text-text-muted hover:text-text-primary transition-colors">
                  Developer
                </Link>
              </div>

              {/* Quiz Score */}
              {quizTotal > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-elevated border border-border-subtle">
                  <span className="text-xs text-text-muted">Score:</span>
                  <span className="text-sm font-bold text-[var(--accent-primary)]">{quizScore}</span>
                  <span className="text-[10px] text-text-muted">({quizScore > 0 ? Math.round((quizTotal > 0 ? (quizScore / (quizTotal * 15)) * 100 : 0)) : 0}%)</span>
                </div>
              )}
            </>
          )}

          <button 
            onClick={toggleTheme} 
            className="p-2 rounded-full bg-surface-elevated border border-border-subtle text-text-muted hover:text-accent-primary transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>

        <div className="relative z-10 mt-4">
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-2">
            <span className="gradient-text">Data Nova</span>
            <span className="text-text-primary"> AI</span>
          </h1>
          <p className="text-text-muted text-xs sm:text-sm font-medium max-w-md mx-auto">
            AI-powered data diagnostics — upload, diagnose, fix, export.
          </p>
        </div>
      </header>

      {/* ── Progress Stepper ──────────────────────────────── */}
      <div className="px-6 mb-10 mt-4 relative z-10">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            {STEPS.map((s, i) => {
              const isCompleted = i < currentIdx;
              const isCurrent = i === currentIdx;
              return (
                <React.Fragment key={s.key}>
                  {/* Step node */}
                  <div className="flex flex-col items-center gap-1.5 z-10 relative">
                    <div
                      className={`
                        w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-500
                        ${isCompleted
                          ? "bg-[var(--success)] text-white shadow-[0_0_15px_var(--success)]"
                          : isCurrent
                          ? "bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white animate-pulse-glow"
                          : "bg-surface text-text-muted border border-border-subtle"
                        }
                      `}
                    >
                      {isCompleted ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        s.icon
                      )}
                    </div>
                    <span
                      className={`text-[11px] font-medium transition-colors ${isCurrent ? "text-[var(--accent-primary)]" : isCompleted ? "text-[var(--success)]" : "text-text-muted"}`}
                    >
                      {s.label}
                    </span>
                  </div>

                  {/* Connector */}
                  {i < STEPS.length - 1 && (
                    <div className="flex-1 h-px mx-2 relative top-[-10px] z-0">
                      <div className="h-full bg-border-subtle rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[var(--success)] to-[var(--accent-primary)] transition-all duration-700 rounded-full"
                          style={{ width: i < currentIdx ? "100%" : "0%" }}
                        />
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Main Content ──────────────────────────────────── */}
      <main className="flex-1 px-4 sm:px-6 pb-16 max-w-[90rem] mx-auto w-full relative flex flex-col xl:flex-row gap-8 items-start">
        {/* Mobile/Tablet Tracker */}
        {step !== "upload" && (
          <div className="xl:hidden w-full max-w-5xl mx-auto mb-2">
            <ConceptTracker seenConcepts={seenConcepts} />
          </div>
        )}

        {/* Left Column (Main) */}
        <div className="flex-1 min-w-0 w-full max-w-5xl mx-auto">
          {/* ── Global Navigation ────────────────────────────── */}
        {step !== "analyzing" && (
          <div className="flex justify-start mb-6 z-20 relative">
            <div className="flex items-center gap-3">
              <button
                onClick={goBack}
                disabled={!canGoBack}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  canGoBack 
                    ? "bg-surface-elevated text-text-primary hover:bg-surface border border-border-subtle shadow-sm"
                    : "opacity-50 cursor-not-allowed text-text-muted bg-transparent border border-transparent"
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              
              <button
                onClick={goNext}
                disabled={!canGoNext}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  canGoNext
                    ? "bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white shadow-md hover:shadow-lg hover:-translate-y-0.5"
                    : "opacity-50 cursor-not-allowed text-text-muted bg-surface-elevated border border-border-subtle"
                }`}
              >
                Next
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}


        <AnimatePresence mode="wait">
          {/* Step 1: Upload */}
          {step === "upload" && (
            <motion.div key="upload" {...pageTransition} className="flex flex-col items-center justify-center min-h-[50vh] w-full">
              <GeminiWelcomeHeader />
              <FileUpload
                onFileSelected={handleUpload}
                isUploading={isUploading}
                error={uploadError}
              />
            </motion.div>
          )}

          {/* Step 1.5: Target Selection */}
          {step === "targetSelection" && diagnosis && (
            <motion.div key="targetSelection" {...pageTransition}>
              <TargetSelectionForm
                columns={diagnosis.dtypes.map((d) => d.column)}
                initialTargetColumn={targetColumn}
                initialTargetPurpose={targetPurpose}
                onConfirm={handleTargetConfirm}
              />
            </motion.div>
          )}

          {/* Step 2: Diagnostics */}
          {step === "diagnostics" && diagnosis && (
            <motion.div key="diagnostics" {...pageTransition} className="space-y-8 relative">
              {diagnosis.quality && (
                <HealthScoreCard quality={diagnosis.quality} />
              )}
              <DiagnosticsPanel 
                diagnosis={diagnosis} 
                hasSeen={hasSeen} 
                markSeen={markSeen}
                hasTarget={!!targetColumn}
                onReopenTargetSelection={() => setStep("targetSelection")}
                sessionId={sessionId!}
                onActionApplied={(res) => {
                  if (res.full_diagnosis) {
                    setDiagnosis(res.full_diagnosis);
                  }
                }}
              />

              {/* AI Data Chat */}
              {sessionId && (
                <DataChat sessionId={sessionId} />
              )}

              {/* Actions */}
              <div className="flex flex-col items-center gap-4 mt-8">
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleAnalyze}
                    className="btn-gradient px-8 py-4 rounded-2xl text-white font-semibold text-lg flex items-center gap-3 group border border-white/10"
                  >
                    <span className="text-xl group-hover:rotate-12 transition-transform">✦</span>
                    Analyze with AI
                    <svg
                      className="w-5 h-5 group-hover:translate-x-1 transition-transform"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>

                  {sessionId && (
                    <Link
                      href={`/diagnose/${sessionId}/graphs`}
                      className="px-8 py-4 rounded-2xl bg-surface-elevated border border-border-subtle text-text-primary font-semibold text-lg flex items-center gap-3 hover:bg-surface transition-colors"
                    >
                      <span>📊</span>
                      View Graphs Gallery
                    </Link>
                  )}
                </div>
                <p className="text-text-muted text-xs">
                  Powered by Gemini — deep semantic analysis of your data
                </p>
                {analyzeError && (
                  <div className="p-3 rounded-xl border-l-4 border-[var(--danger)] bg-surface-elevated animate-slide-up shadow-sm">
                    <p className="text-[var(--danger)] text-sm font-medium">{analyzeError}</p>
                  </div>
                )}
              </div>

              {/* Data tools: preview + recipes */}
              {sessionId && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => setIsPreviewOpen(true)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-elevated border border-border-subtle text-text-primary text-sm font-semibold hover:bg-surface transition-colors shadow-sm"
                    >
                      <span>👀</span>
                      Preview Data (issue highlighting)
                    </button>
                    <p className="text-xs text-text-muted">
                      Inspect the raw rows — missing, outlier and duplicate cells are color-coded.
                    </p>
                  </div>
                  <RecipesPanel
                    sessionId={sessionId}
                    onRecipeApplied={(diag, _msg) => {
                      setDiagnosis(diag);
                      // The data changed — stale AI results must be regenerated
                      setRecommendations([]);
                      setSemanticTypes([]);
                    }}
                  />
                </div>
              )}
            </motion.div>
          )}

          {/* Step 2.5: Analyzing state */}
          {step === "analyzing" && (
            <motion.div key="analyzing" {...pageTransition} className="flex flex-col items-center justify-center min-h-[40vh] gap-8">
              <div className="relative flex items-center justify-center w-24 h-24">
                {/* Outer counter-rotating ring */}
                <svg className="absolute inset-0 w-full h-full animate-spin-slower-reverse opacity-70" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="46" fill="none" stroke="url(#grad2)" strokeWidth="2" strokeDasharray="60 40 20 40" strokeLinecap="round" />
                  <defs>
                    <linearGradient id="grad2" x1="100%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="var(--accent-secondary)" />
                      <stop offset="100%" stopColor="transparent" />
                    </linearGradient>
                  </defs>
                </svg>
                {/* Inner fast-rotating ring */}
                <svg className="absolute inset-0 w-full h-full animate-spin" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="38" fill="none" stroke="url(#grad1)" strokeWidth="4" strokeDasharray="100 140" strokeLinecap="round" />
                  <defs>
                    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="var(--accent-primary)" />
                      <stop offset="100%" stopColor="transparent" />
                    </linearGradient>
                  </defs>
                </svg>
                {/* Center pulsing icon */}
                <span className="text-3xl text-[var(--accent-primary)] animate-pulse-glow rounded-full p-2">✦</span>
              </div>
              <div className="text-center space-y-2">
                <p className="text-text-primary text-lg font-semibold">
                  Analyzing your data<span className="animate-pulse">...</span>
                </p>
                <p className="text-text-muted text-sm max-w-sm">
                  Semantic type detection + AI recommendations, stage by stage.
                </p>
              </div>

              {/* Live progress bar */}
              <div className="w-full max-w-md">
                <div className="flex items-center justify-between text-xs font-semibold mb-2">
                  <span className="text-[var(--accent-primary)] truncate pr-4">
                    {jobProgress?.message || "Working…"}
                  </span>
                  <span className="text-text-primary font-mono">{jobProgress?.progress_pct ?? 0}%</span>
                </div>
                <div className="h-2.5 w-full bg-surface-elevated border border-border-subtle rounded-full overflow-hidden shadow-inner">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)]"
                    initial={{ width: "0%" }}
                    animate={{ width: `${jobProgress?.progress_pct ?? 0}%` }}
                    transition={{ ease: "easeOut", duration: 0.4 }}
                  />
                </div>
                <div className="flex justify-between mt-1.5 text-[10px] text-text-muted font-medium">
                  <span>Classify</span>
                  <span>Target checks</span>
                  <span>Recommend</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 3: Recommendations */}
          {(step === "recommendations" || step === "done") && (
            <motion.div key="recommendations" {...pageTransition} className="space-y-8">
              {/* Local-only / fallback warnings */}
              {analyzeWarnings.length > 0 && (
                <div className="p-4 rounded-xl bg-[var(--warning)]/10 border border-[var(--warning)]/30 animate-slide-up">
                  <div className="flex items-start gap-3">
                    <span className="text-xl shrink-0">💡</span>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-[var(--warning)]">
                        Running in local fallback mode
                      </p>
                      <ul className="text-xs text-text-secondary space-y-1">
                        {analyzeWarnings.map((w, i) => (
                          <li key={i}>· {w}</li>
                        ))}
                      </ul>
                      <p className="text-[11px] text-text-muted pt-1">
                        Set <code className="font-mono bg-surface px-1 rounded">GOOGLE_API_KEY</code> in{" "}
                        <code className="font-mono bg-surface px-1 rounded">backend/.env</code> to enable deep Gemini reasoning.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {/* Target Analysis Panel */}
              {targetAnalysis && (
                <TargetAnalysisPanel analysis={targetAnalysis} />
              )}
              {/* Semantic types summary */}
              {semanticTypes.length > 0 && (
                <div className="glass-card p-6">
                  <h3 className="flex items-center gap-2 text-lg font-semibold text-text-primary mb-4">
                    <span>🧠</span> Semantic Types
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {semanticTypes.map((st) => (
                      <div
                        key={st.column}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border ${
                          st.is_identifier
                            ? "bg-[var(--warning)]/10 border-[var(--warning)]/30 text-[var(--warning)]"
                            : "bg-surface-elevated border-border-subtle text-text-secondary"
                        }`}
                      >
                        <span className="font-semibold font-mono">{st.column}</span>
                        <span className="opacity-40">→</span>
                        <span>{st.semantic_type}</span>
                        {st.is_identifier && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--warning)]/20 font-semibold uppercase">ID</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations list */}
              {recommendations.length > 0 && (
                <div>
                  {/* Strategy Simulator */}
                  {sessionId && (
                    <StrategySimulator sessionId={sessionId} />
                  )}

                  <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2 mt-6">
                    <span>⚡</span> AI Recommendations
                    <span className="text-sm font-normal text-text-muted">
                      ({recommendations.length} issue{recommendations.length !== 1 ? "s" : ""} found)
                    </span>
                  </h2>
                  <div className="space-y-4">
                    {recommendations.map((rec, i) => (
                      <motion.div 
                        key={`${rec.column}-${i}`} 
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05, duration: 0.3 }}
                      >
                        <GuessBeforeReveal 
                          rec={rec} 
                          onReveal={() => {}}
                          streak={quizStreak}
                          onScore={(correct) => {
                            setQuizTotal(t => t + 1);
                            if (correct) {
                              setQuizScore(s => s + 10 + quizStreak * 5);
                              setQuizStreak(s => s + 1);
                            } else {
                              setQuizStreak(0);
                            }
                          }}
                        >                          <RecommendationCard 
                            rec={rec} 
                            sessionId={sessionId!}
                            dtypes={diagnosis?.dtypes}
                            onActionApplied={(res) => {
                              if (res.full_diagnosis) {
                                setDiagnosis(res.full_diagnosis);
                              }
                            }}
                          />
                        </GuessBeforeReveal>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {recommendations.length === 0 && (
                <div className="glass-card-elevated p-8 text-center shadow-lg border-l-4 border-[var(--success)]">
                  <div className="text-4xl mb-3">🎉</div>
                  <p className="text-text-primary font-semibold text-lg">Your data looks great!</p>
                  <p className="text-text-muted text-sm mt-1">No issues detected — you&apos;re good to go.</p>
                </div>
              )}

              {/* Transition to Summary section */}
              {sessionId && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="pt-4 flex flex-col items-center gap-4">
                  <div className="h-px w-32 bg-gradient-to-r from-transparent via-border-subtle to-transparent" />
                  <button
                    onClick={() => setStep("summary")}
                    className="group relative px-10 py-4 rounded-2xl text-white font-bold text-lg flex items-center gap-3 transition-all duration-300 btn-gradient shadow-lg hover:shadow-[0_0_30px_rgba(255,148,8,0.3)] hover:-translate-y-1"
                  >
                    Review Changes & Export
                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Step 4: Summary */}
          {step === "summary" && sessionId && (
            <motion.div key="summary" {...pageTransition} className="space-y-8">
              {/* Data Story */}
              <DataStorytelling sessionId={sessionId} />

              {/* Recovery Dashboard */}
              <RecoveryDashboard sessionId={sessionId} actionsApplied={summary?.actions_applied?.length ?? 0} />

              <SummaryReport 
                sessionId={sessionId} 
                skippedIssues={recommendations} 
                onReset={handleReset}
                originalHealth={baselineHealth}
                currentHealth={diagnosis?.quality?.overall_score ?? null}
              />

              {/* Export as Code */}
              <ExportCode
                sessionId={sessionId}
                actions={(summary?.actions_applied ?? []).map((a: any) => ({
                  column: a.column,
                  action: a.action,
                  justification: a.justification,
                }))}
              />
            </motion.div>
          )}
        </AnimatePresence>
        </div>

        {/* Desktop Tracker (Right Column) */}
        {step !== "upload" && (
          <div className="hidden xl:block w-72 shrink-0 sticky top-6 z-50">
            <ConceptTracker seenConcepts={seenConcepts} />
          </div>
        )}
      </main>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer className="py-6 text-center border-t border-border-subtle relative z-10">
        <p className="text-text-muted text-xs">
          Data Nova AI · Built with Next.js, Gemini & FastAPI
        </p>
      </footer>

      {/* Floating Animated Gemini Welcome Note */}
      <FloatingWelcomeNote />

      {/* Data preview modal */}
      {diagnosis && sessionId && (
        <DataPreviewModal
          sessionId={sessionId}
          diagnosis={diagnosis}
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
        />
      )}
    </div>
  );
}
