import React from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ExportSuccessModalProps {
  isOpen: boolean;
  onStartNewSession: () => void;
}

export default function ExportSuccessModal({ isOpen, onStartNewSession }: ExportSuccessModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-surface/80 backdrop-blur-sm"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="relative bg-surface-elevated border border-border-subtle p-10 md:p-12 rounded-3xl shadow-2xl max-w-lg w-full text-center mx-4"
          >
            {/* Success Icon */}
            <div className="flex justify-center mb-6">
              <div className="relative flex items-center justify-center w-20 h-20">
                <div className="absolute inset-0 bg-[var(--success)]/20 rounded-full animate-pulse-glow" />
                <div className="absolute inset-2 bg-[var(--success)]/30 rounded-full" />
                <svg
                  className="relative w-10 h-10 text-[var(--success)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            {/* Text Content */}
            <h2 className="text-3xl font-extrabold text-text-primary mb-3">
              Successfully exported!
            </h2>
            <p className="text-text-muted text-base leading-relaxed mb-10">
              Your cleaned dataset has been successfully downloaded. It is now ready for machine learning, BI tools, or sharing with your team.
            </p>

            {/* Reset Action */}
            <button
              onClick={onStartNewSession}
              className="px-8 py-3.5 rounded-xl bg-surface border border-border-subtle text-text-primary font-semibold hover:bg-surface-elevated transition-all shadow-sm"
            >
              Start New Session
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
