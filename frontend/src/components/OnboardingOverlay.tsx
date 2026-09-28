"use client";

import React, { useState } from "react";

interface Props {
  onDismiss: () => void;
}

const STEPS = [
  {
    title: "Welcome to Developer Canvas",
    content: "Build custom data pipelines by dragging nodes from the sidebar onto the canvas.",
  },
  {
    title: "Connect Nodes",
    content: "Drag a connection from the dot on the right of one node to the dot on the left of another.",
  },
  {
    title: "Configure",
    content: "Select columns from dropdowns to configure transforms and visualizations.",
  },
  {
    title: "Auto-Execution",
    content: "Charts and tables update automatically as data flows through the graph!",
  }
];

export default function OnboardingOverlay({ onDismiss }: Props) {
  const [step, setStep] = useState(0);

  const nextStep = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      onDismiss();
    }
  };

  return (
    <div className="absolute inset-0 bg-bg-primary/50 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
      <div className="glass-card p-6 max-w-sm w-full max-h-full overflow-y-auto custom-scrollbar shadow-2xl border-[var(--accent-primary)] animate-in fade-in zoom-in duration-300">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-text-primary">{STEPS[step].title}</h2>
          <span className="text-xs font-semibold text-text-muted bg-surface px-2 py-1 rounded">
            {step + 1} / {STEPS.length}
          </span>
        </div>
        
        <p className="text-sm text-text-secondary mb-6 min-h-[60px]">
          {STEPS[step].content}
        </p>

        <div className="flex items-center justify-between">
          <button 
            onClick={onDismiss}
            className="text-xs text-text-muted hover:text-text-primary transition-colors font-medium px-2 py-1"
          >
            Skip
          </button>
          
          <button 
            onClick={nextStep}
            className="btn-gradient text-xs px-4 py-2 rounded-xl text-white font-semibold"
          >
            {step === STEPS.length - 1 ? "Get Started" : "Next"}
          </button>
        </div>
        
        {/* Progress Dots */}
        <div className="flex gap-1 justify-center mt-4">
          {STEPS.map((_, i) => (
            <div 
              key={i} 
              className={`w-1.5 h-1.5 rounded-full transition-colors ${i === step ? 'bg-[var(--accent-primary)]' : 'bg-border-subtle'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
