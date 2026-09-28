"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Send, Sparkles, Bot, User, Lightbulb } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  insights?: string[];
  followUp?: string[];
  source?: string;
}

interface Props {
  sessionId: string;
}

export default function DataChat({ sessionId }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Hi! I'm your AI Data Analyst. Ask me anything about your dataset -- I can tell you about missing values, outliers, data types, quality scores, or anything else you're curious about.",
      followUp: [
        "What's the data quality score?",
        "Which columns have missing values?",
        "Are there any outliers?",
      ],
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (question: string) => {
    if (!question.trim() || loading) return;

    const userMsg: ChatMessage = { role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("http://127.0.0.1:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          question,
          conversation_history: history,
        }),
      });

      if (!res.ok) throw new Error("Failed to get answer");
      const data = await res.json();

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: data.answer,
        insights: data.insights,
        followUp: data.follow_up_questions,
        source: data.source,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Sorry, I encountered an error: ${e.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card flex flex-col h-[500px]">
      {/* Header */}
      <div className="p-4 border-b border-border-subtle flex items-center gap-2">
        <MessageCircle className="w-5 h-5 text-[var(--accent-primary)]" />
        <h3 className="font-semibold text-text-primary">Data Chat</h3>
        <span className="ml-auto text-xs text-text-muted">Powered by Gemini</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}

              <div
                className={`max-w-[80%] rounded-xl p-3 ${
                  msg.role === "user"
                    ? "bg-[var(--accent-primary)]/15 border border-[var(--accent-primary)]/30"
                    : "bg-overlay-light border border-border-subtle"
                }`}
              >
                <p className="text-sm text-text-primary whitespace-pre-wrap">{msg.content}</p>

                {msg.followUp && msg.followUp.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {msg.followUp.map((q, j) => (
                      <button
                        key={j}
                        onClick={() => sendMessage(q)}
                        className="text-xs px-3 py-1.5 rounded-full bg-overlay-light border border-border-subtle hover:bg-overlay-hover transition-colors flex items-center gap-1"
                      >
                        <Lightbulb className="w-3 h-3 text-[var(--warning)]" />
                        {q}
                      </button>
                    ))}
                  </div>
                )}

                {msg.source && (
                  <p className="text-xs text-text-muted mt-2">
                    {msg.source === "gemini" ? "Gemini AI" : "Rule-based"}
                  </p>
                )}
              </div>

              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-overlay-light flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-text-secondary" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                <Sparkles className="w-4 h-4 text-white" />
              </motion.div>
            </div>
            <div className="bg-overlay-light border border-border-subtle rounded-xl px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border-subtle">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your data..."
            className="flex-1 bg-overlay-light border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[var(--accent-primary)]/50 transition-colors"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="btn-gradient p-2.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </form>
      </div>
    </div>
  );
}
