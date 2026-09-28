"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import type { Recommendation, ApplyActionResponse, Diagnosis } from "./api";

interface UndoEntry {
  column: string;
  action: string;
  justification: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

interface UndoRedoContextType {
  undoStack: UndoEntry[];
  redoStack: UndoEntry[];
  pushAction: (entry: UndoEntry) => void;
  undo: () => UndoEntry | null;
  redo: () => UndoEntry | null;
  canUndo: boolean;
  canRedo: boolean;
  clearHistory: () => void;
}

const UndoRedoContext = createContext<UndoRedoContextType | undefined>(undefined);

export function UndoRedoProvider({ children }: { children: ReactNode }) {
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [redoStack, setRedoStack] = useState<UndoEntry[]>([]);

  const pushAction = useCallback((entry: UndoEntry) => {
    setUndoStack((prev) => [...prev, entry]);
    setRedoStack([]);
  }, []);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return null;
    const last = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, last]);
    return last;
  }, [undoStack]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return null;
    const last = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, last]);
    return last;
  }, [redoStack]);

  const clearHistory = useCallback(() => {
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  return (
    <UndoRedoContext.Provider
      value={{
        undoStack,
        redoStack,
        pushAction,
        undo,
        redo,
        canUndo: undoStack.length > 0,
        canRedo: redoStack.length > 0,
        clearHistory,
      }}
    >
      {children}
    </UndoRedoContext.Provider>
  );
}

export function useUndoRedo() {
  const context = useContext(UndoRedoContext);
  if (context === undefined) {
    throw new Error("useUndoRedo must be used within an UndoRedoProvider");
  }
  return context;
}
