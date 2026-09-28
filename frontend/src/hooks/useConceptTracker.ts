"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "datanova_concepts_seen";

function loadSeen(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveSeen(seen: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen]));
  } catch {
    // localStorage full or blocked — silently degrade
  }
}

export function useConceptTracker() {
  const [seenConcepts, setSeenConcepts] = useState<Set<string>>(new Set());

  // Load from localStorage on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSeenConcepts(loadSeen());
  }, []);

  const markSeen = useCallback((concept: string) => {
    setSeenConcepts((prev) => {
      if (prev.has(concept)) return prev;
      const next = new Set(prev);
      next.add(concept);
      saveSeen(next);
      return next;
    });
  }, []);

  const hasSeen = useCallback(
    (concept: string) => seenConcepts.has(concept),
    [seenConcepts]
  );

  const reset = useCallback(() => {
    setSeenConcepts(new Set());
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  return { seenConcepts, markSeen, hasSeen, reset };
}
