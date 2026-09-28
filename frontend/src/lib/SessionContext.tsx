"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import type { Diagnosis, Recommendation, SemanticType, TargetAnalysis } from "./api";

interface SessionState {
  sessionId: string | null;
  diagnosis: Diagnosis | null;
  recommendations: Recommendation[];
  semanticTypes: SemanticType[];
  targetColumn: string | undefined;
  targetPurpose: string | undefined;
  targetAnalysis: TargetAnalysis | null;
}

interface SessionContextType extends SessionState {
  setSessionId: (id: string | null) => void;
  setDiagnosis: (d: Diagnosis | null) => void;
  setRecommendations: (r: Recommendation[]) => void;
  setSemanticTypes: (s: SemanticType[]) => void;
  setTargetColumn: (col: string | undefined) => void;
  setTargetPurpose: (purpose: string | undefined) => void;
  setTargetAnalysis: (analysis: TargetAnalysis | null) => void;
  clearSession: () => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [semanticTypes, setSemanticTypes] = useState<SemanticType[]>([]);
  const [targetColumn, setTargetColumn] = useState<string | undefined>(undefined);
  const [targetPurpose, setTargetPurpose] = useState<string | undefined>(undefined);
  const [targetAnalysis, setTargetAnalysis] = useState<TargetAnalysis | null>(null);

  const clearSession = () => {
    setSessionId(null);
    setDiagnosis(null);
    setRecommendations([]);
    setSemanticTypes([]);
    setTargetColumn(undefined);
    setTargetPurpose(undefined);
    setTargetAnalysis(null);
  };

  return (
    <SessionContext.Provider
      value={{
        sessionId,
        diagnosis,
        recommendations,
        semanticTypes,
        targetColumn,
        targetPurpose,
        targetAnalysis,
        setSessionId,
        setDiagnosis,
        setRecommendations,
        setSemanticTypes,
        setTargetColumn,
        setTargetPurpose,
        setTargetAnalysis,
        clearSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
