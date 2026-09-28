"use client";

import React, { useCallback, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/ThemeContext";
import { useSession } from "@/lib/SessionContext";
import { resetSession } from "@/lib/api";
import DeveloperCanvas from "@/components/DeveloperCanvas";
import '@xyflow/react/dist/style.css';

export default function DeveloperPage() {
  const { sessionId } = useParams();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  
  const {
    sessionId: ctxSessionId,
    setSessionId,
    setDiagnosis,
    setRecommendations,
    clearSession,
  } = useSession();

  useEffect(() => {
    if (typeof sessionId === "string" && sessionId !== ctxSessionId) {
      setSessionId(sessionId);
    }
  }, [sessionId, ctxSessionId, setSessionId]);

  const handleResetData = useCallback(async () => {
    if (!sessionId || typeof sessionId !== "string") return;
    try {
      const res = await resetSession(sessionId);
      if (res.success) {
        setDiagnosis(res.full_diagnosis);
        setRecommendations([]);
        router.push("/");
      }
    } catch (err) {
      console.error("Failed to reset session:", err);
      alert("Failed to reset session to original state.");
    }
  }, [sessionId, setDiagnosis, setRecommendations, router]);

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-bg-primary">
      {/* ── Header ────────────────────────────────────────── */}
      <header className="relative py-4 px-6 shrink-0 border-b border-border-subtle z-10 flex items-center justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--accent-primary),transparent_70%)] opacity-[0.08] pointer-events-none" />
        
        <div className="relative z-10 flex items-center gap-4">
          <Link href="/">
            <h1 className="text-xl font-extrabold tracking-tight">
              <span className="gradient-text">Data Nova</span>
              <span className="text-text-primary"> AI</span>
            </h1>
          </Link>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-surface-elevated text-text-muted border border-border-subtle uppercase tracking-wider">
            Developer Canvas
          </span>
        </div>

        {/* Top Right Controls */}
        <div className="relative z-20 flex items-center gap-4">
          <button 
            onClick={handleResetData}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--danger)]/10 text-[var(--danger)] border border-[var(--danger)]/30 hover:bg-[var(--danger)]/20 transition-colors"
          >
            Reset Data
          </button>
          
          <div className="flex bg-surface-elevated border border-border-subtle rounded-lg p-1">
            <Link href="/" className="px-3 py-1 text-xs font-semibold rounded-md text-text-muted hover:text-text-primary transition-colors">
              Learner
            </Link>
            <button className="px-3 py-1 text-xs font-bold rounded-md bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white shadow-sm">
              Developer
            </button>
          </div>

          <button 
            onClick={toggleTheme} 
            className="p-2 rounded-full bg-surface-elevated border border-border-subtle text-text-muted hover:text-accent-primary transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      {/* ── Canvas ────────────────────────────────────────── */}
      {/* min-h-0 is REQUIRED: without it the flex item grows to its content
          height, the root's overflow-hidden clips it, the sidebar never
          scrolls and the onboarding card ends up off-screen. */}
      <main className="flex-1 relative min-h-0 overflow-hidden">
        <DeveloperCanvas sessionId={typeof sessionId === "string" ? sessionId : ""} />
      </main>
    </div>
  );
}
