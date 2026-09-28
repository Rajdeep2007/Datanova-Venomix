"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Code, FileCode, FileText, Database, Download, Copy, Check, ChevronDown } from "lucide-react";

interface ExportResult {
  code?: string;
  notebook?: any;
  format: string;
  filename: string;
}

interface Props {
  sessionId: string;
  actions: Array<{ column: string; action: string; justification?: string }>;
}

export default function ExportCode({ sessionId, actions }: Props) {
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [format, setFormat] = useState<"python" | "notebook" | "sql">("python");
  const [showDropdown, setShowDropdown] = useState(false);

  const exportCode = async (fmt: "python" | "notebook" | "sql") => {
    setLoading(true);
    setFormat(fmt);
    try {
      const res = await fetch("http://127.0.0.1:8000/export/code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          actions: actions.map((a) => ({ column: a.column, action: a.action })),
          format: fmt,
        }),
      });
      if (res.ok) {
        setExportResult(await res.json());
      }
    } catch (e) {
      console.error("Export failed:", e);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (exportResult?.code) {
      navigator.clipboard.writeText(exportResult.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const downloadFile = () => {
    if (!exportResult) return;
    const content = exportResult.code || JSON.stringify(exportResult.notebook, null, 2);
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportResult.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formats = [
    { key: "python" as const, label: "Python Script", icon: FileCode, desc: "Standalone .py file" },
    { key: "notebook" as const, label: "Jupyter Notebook", icon: FileText, desc: ".ipynb with cells" },
    { key: "sql" as const, label: "SQL Migration", icon: Database, desc: "SQL UPDATE statements" },
  ];

  return (
    <div className="glass-card overflow-hidden">
      <div className="p-4 border-b border-border-subtle">
        <h3 className="font-semibold text-text-primary flex items-center gap-2">
          <Code className="w-5 h-5 text-[var(--success)]" />
          Export as Code
        </h3>
        <p className="text-xs text-text-secondary mt-1">
          Export your cleaning pipeline as reproducible code
        </p>
      </div>

      <div className="p-4">
        {/* Format selector */}
        <div className="flex gap-2 mb-4">
          {formats.map((f) => (
            <button
              key={f.key}
              onClick={() => exportCode(f.key)}
              disabled={loading}
              className={`flex-1 p-3 rounded-lg border transition-all ${
                format === f.key && exportResult
                  ? "border-[var(--success)]/50 bg-[var(--success)]/10"
                  : "border-border-subtle bg-overlay-light hover:bg-overlay-hover"
              }`}
            >
              <f.icon className="w-5 h-5 mx-auto mb-1 text-text-secondary" />
              <p className="text-xs font-medium text-text-primary">{f.label}</p>
              <p className="text-[10px] text-text-muted">{f.desc}</p>
            </button>
          ))}
        </div>

        {/* Code preview */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-8 text-text-muted"
            >
              Generating {format}...
            </motion.div>
          ) : exportResult?.code ? (
            <motion.div
              key="code"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {/* Action bar */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-overlay-light hover:bg-overlay-hover transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-[var(--success)]" /> : <Copy className="w-3 h-3" />}
                  {copied ? "Copied!" : "Copy"}
                </button>
                <button
                  onClick={downloadFile}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-overlay-light hover:bg-overlay-hover transition-colors"
                >
                  <Download className="w-3 h-3" />
                  Download {exportResult.filename}
                </button>
              </div>

              {/* Code block */}
              <div className="bg-[var(--bg-primary)] rounded-lg p-4 overflow-x-auto max-h-[400px] overflow-y-auto border border-border-subtle">
                <pre className="text-xs text-[var(--success)] font-mono whitespace-pre-wrap">
                  {exportResult.code}
                </pre>
              </div>

              {/* Stats */}
              <div className="mt-3 flex gap-4 text-xs text-text-muted">
                <span>{exportResult.code.split("\n").length} lines</span>
                <span>{actions.length} cleaning steps</span>
                <span>{format === "python" ? "Run with: python cleaning_pipeline.py" : format === "notebook" ? "Open in Jupyter Lab" : "Run in SQL editor"}</span>
              </div>
            </motion.div>
          ) : exportResult?.notebook ? (
            <motion.div
              key="notebook"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="flex gap-2 mb-3">
                <button
                  onClick={downloadFile}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-overlay-light hover:bg-overlay-hover transition-colors"
                >
                  <Download className="w-3 h-3" />
                  Download {exportResult.filename}
                </button>
              </div>
              <div className="bg-[var(--bg-primary)] rounded-lg p-4 border border-border-subtle">
                <p className="text-xs text-text-muted mb-2">
                  Jupyter Notebook with {exportResult.notebook.cells.length} cells
                </p>
                {exportResult.notebook.cells.map((cell: any, i: number) => (
                  <div key={i} className="mb-2 p-2 rounded bg-overlay-light">
                    <span className="text-[10px] text-text-muted uppercase">
                      {cell.cell_type} cell
                    </span>
                    <pre className="text-[11px] text-text-secondary mt-1 font-mono overflow-x-auto">
                      {Array.isArray(cell.source) ? cell.source.join("") : cell.source}
                    </pre>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8 text-text-muted"
            >
              Select a format above to generate your cleaning pipeline
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
