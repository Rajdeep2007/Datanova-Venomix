"use client";

import React, { useState, useRef, useCallback } from "react";

interface FileUploadProps {
  onFileSelected: (file: File) => void;
  isUploading: boolean;
  error: string | null;
}

const ACCEPTED_TYPES = [".csv", ".xls", ".xlsx", ".json", ".pdf"];
const ACCEPTED_MIME =
  ".csv,.xls,.xlsx,.json,.pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/json,application/pdf";

export default function FileUpload({ onFileSelected, isUploading, error }: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        setSelectedFile(file);
        onFileSelected(file);
      }
    },
    [onFileSelected]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setSelectedFile(file);
        onFileSelected(file);
      }
    },
    [onFileSelected]
  );

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="w-full max-w-2xl mx-auto animate-scale-in">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !isUploading && inputRef.current?.click()}
        className={`
          glass-card relative cursor-pointer p-12 text-center
          border-2 transition-all duration-300 overflow-hidden
          ${isDragOver
            ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 shadow-[0_0_40px_rgba(255,148,8,0.2)] border-solid"
            : "border-dashed border-border-subtle hover:border-[var(--accent-primary)]/50 hover:bg-surface-elevated"
          }
          ${isUploading ? "pointer-events-none opacity-90 border-solid border-[var(--accent-primary)]/30" : ""}
        `}
      >
        {isUploading && (
          <div className="absolute top-0 left-0 h-1 bg-[var(--accent-primary)]/20 w-full overflow-hidden">
             <div className="h-full bg-[var(--accent-primary)] animate-shimmer" style={{ width: '100%', backgroundSize: '200% 100%', backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)' }} />
          </div>
        )}

        {/* Upload icon */}
        <div className={`mx-auto mb-6 transition-transform duration-300 ${isDragOver ? "scale-110 -translate-y-1" : ""}`}>
          <svg
            className={`w-16 h-16 mx-auto ${isDragOver ? "text-[var(--accent-primary)]" : "text-text-muted"} transition-colors`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7 16a4 4 0 0 1-.88-7.903A5 5 0 1 1 15.9 6h.1a5 5 0 0 1 1 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>

        {isUploading ? (
          <div className="space-y-4">
            {/* Spinner */}
            <div className="mx-auto w-10 h-10 border-3 border-border-subtle border-t-[var(--accent-primary)] rounded-full animate-spin" />
            <p className="text-text-primary font-medium">
              Uploading & diagnosing<span className="animate-pulse">...</span>
            </p>
            {selectedFile && (
              <p className="text-sm text-text-muted">{selectedFile.name}</p>
            )}
          </div>
        ) : selectedFile ? (
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30">
              <svg className="w-4 h-4 text-[var(--accent-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-[var(--accent-primary)] font-medium text-sm">{selectedFile.name}</span>
              <span className="text-text-muted text-xs">({formatSize(selectedFile.size)})</span>
            </div>
            <p className="text-text-secondary text-sm mt-3">Click or drag to replace</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-text-primary font-semibold text-lg">
              Drop your dataset here
            </p>
            <p className="text-text-secondary text-sm">
              or <span className="text-[var(--accent-primary)] font-medium hover:underline">browse files</span> to upload
            </p>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_MIME}
          onChange={handleChange}
          className="hidden"
        />
      </div>

      {/* Accepted formats */}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
        <span className="text-text-muted text-xs">Accepted:</span>
        {ACCEPTED_TYPES.map((ext) => (
          <span
            key={ext}
            className="px-2.5 py-0.5 rounded-full text-[11px] font-medium uppercase tracking-wider bg-surface-elevated text-text-secondary border border-border-subtle"
          >
            {ext}
          </span>
        ))}
      </div>

      {/* Error display */}
      {error && (
        <div className="mt-6 p-4 rounded-xl glass-card-elevated border-l-4 border-l-[var(--danger)] animate-slide-up shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-[var(--danger)]/10 text-[var(--danger)]">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <p className="text-text-primary font-semibold text-sm">Upload Error</p>
              <p className="text-text-muted text-xs mt-0.5">{error}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
