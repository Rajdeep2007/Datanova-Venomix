"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, BookOpen, Lightbulb, AlertTriangle, Star, RefreshCw } from "lucide-react";

interface DataStory {
  title: string;
  summary: string;
  persona: string;
  strengths: string[];
  weaknesses: string[];
  journey: string;
  recommendation_priority: string;
  fun_fact: string;
  grade_explanation: string;
  source: string;
}

interface Props {
  sessionId: string;
}

export default function DataStorytelling({ sessionId }: Props) {
  const [story, setStory] = useState<DataStory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("http://127.0.0.1:8000/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (!res.ok) throw new Error("Failed to generate story");
      setStory(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionId) fetchStory();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="glass-card p-8 text-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
          <Sparkles className="w-12 h-12 text-[var(--accent-primary)] mx-auto" />
        </motion.div>
        <p className="mt-4 text-text-secondary">AI is reading your data story...</p>
      </div>
    );
  }

  if (error || !story) {
    return (
      <div className="glass-card p-6 text-center">
        <p className="text-text-secondary mb-4">{error || "No story generated yet"}</p>
        <button onClick={fetchStory} className="btn-gradient px-4 py-2 rounded-xl text-white text-sm font-semibold">
          <RefreshCw className="w-4 h-4 mr-2 inline" />
          Generate Story
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card overflow-hidden"
    >
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-[var(--accent-secondary)]/15 via-[var(--accent-primary)]/15 to-[var(--success)]/10 p-6 border-b border-border-subtle">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-text-primary flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-[var(--accent-primary)]" />
              {story.title}
            </h2>
            <p className="text-text-secondary mt-2">{story.summary}</p>
          </div>
          <button
            onClick={fetchStory}
            className="p-2 rounded-lg hover:bg-overlay-hover transition-colors"
            title="Regenerate story"
          >
            <RefreshCw className="w-4 h-4 text-text-secondary" />
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Persona */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-r from-[var(--accent-secondary)]/10 to-transparent p-4 rounded-lg border border-[var(--accent-secondary)]/20"
        >
          <p className="text-sm text-[var(--accent-secondary)] font-medium mb-1">Dataset Persona</p>
          <p className="text-text-primary italic">&ldquo;{story.persona}&rdquo;</p>
        </motion.div>

        {/* Strengths & Weaknesses */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-2"
          >
            <h3 className="text-sm font-medium text-[var(--success)] flex items-center gap-1">
              <Star className="w-4 h-4" /> Strengths
            </h3>
            {story.strengths.map((s, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                <span className="text-[var(--success)] mt-1">&#10003;</span>
                <span>{s}</span>
              </div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-2"
          >
            <h3 className="text-sm font-medium text-[var(--warning)] flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" /> Areas for Improvement
            </h3>
            {story.weaknesses.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                <span className="text-[var(--warning)] mt-1">&#9888;</span>
                <span>{w}</span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Journey */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-overlay-light p-4 rounded-lg"
        >
          <p className="text-sm text-text-secondary">{story.journey}</p>
        </motion.div>

        {/* Priority & Fun Fact */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-[var(--accent-primary)]/10 p-4 rounded-lg border border-[var(--accent-primary)]/20"
          >
            <p className="text-sm text-[var(--accent-primary)] font-medium mb-1 flex items-center gap-1">
              <Lightbulb className="w-4 h-4" /> Priority Action
            </p>
            <p className="text-sm text-text-primary">{story.recommendation_priority}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-[var(--accent-secondary)]/10 p-4 rounded-lg border border-[var(--accent-secondary)]/20"
          >
            <p className="text-sm text-[var(--accent-secondary)] font-medium mb-1">Fun Fact</p>
            <p className="text-sm text-text-primary">{story.fun_fact}</p>
          </motion.div>
        </div>

        {/* Grade Explanation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="text-center py-4 border-t border-border-subtle"
        >
          <p className="text-text-secondary text-sm">{story.grade_explanation}</p>
          <p className="text-xs text-text-muted mt-2">
            Generated by {story.source === "gemini" ? "Gemini AI" : "rule-based analysis"}
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
