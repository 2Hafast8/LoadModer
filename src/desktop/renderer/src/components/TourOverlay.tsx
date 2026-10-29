import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, ArrowRight, ArrowLeft, Check, X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.js';

export interface TourStep {
  targetSelector: string;
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

interface TourOverlayProps {
  isOpen: boolean;
  page: string;
  steps: TourStep[];
  onClose: () => void;
}

export const TourOverlay: React.FC<TourOverlayProps> = ({
  isOpen,
  page,
  steps,
  onClose,
}) => {
  const { t } = useLanguage();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCurrentStepIndex(0);
    }
  }, [isOpen, page]);

  useEffect(() => {
    if (!isOpen || steps.length === 0) return;

    const currentStep = steps[currentStepIndex];
    if (!currentStep) return;

    const updateRect = () => {
      const el = document.querySelector(currentStep.targetSelector);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
    };

    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);

    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [isOpen, currentStepIndex, steps]);

  if (!isOpen || steps.length === 0) return null;

  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      localStorage.setItem(`loadmoder_tour_${page}`, 'completed');
      onClose();
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    setCurrentStepIndex((prev) => Math.max(0, prev - 1));
  };

  const handleSkip = () => {
    localStorage.setItem(`loadmoder_tour_${page}`, 'completed');
    onClose();
  };

  // Hitung posisi tooltip berdasarkan target rect
  const tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 9999,
  };

  if (targetRect) {
    const spacing = 12;
    const preferBottom = targetRect.bottom + 220 < window.innerHeight;

    if (preferBottom) {
      tooltipStyle.top = `${targetRect.bottom + spacing}px`;
      tooltipStyle.left = `${Math.max(16, Math.min(window.innerWidth - 340, targetRect.left))}px`;
    } else {
      tooltipStyle.bottom = `${window.innerHeight - targetRect.top + spacing}px`;
      tooltipStyle.left = `${Math.max(16, Math.min(window.innerWidth - 340, targetRect.left))}px`;
    }
  } else {
    // Center fallback jika elemen target tidak ditemukan
    tooltipStyle.top = '50%';
    tooltipStyle.left = '50%';
    tooltipStyle.transform = 'translate(-50%, -50%)';
  }

  return (
    <div className="fixed inset-0 z-[9990] pointer-events-auto">
      {/* Dimmed backdrop dengan pointer pass-through atau spotlight */}
      <div className="absolute inset-0 bg-obsidian-bg/75 backdrop-blur-[2px] transition-all duration-200" />

      {/* Spotlight cutout border jika elemen ditemukan */}
      {targetRect && (
        <div
          className="fixed rounded-lg border-2 border-emerald-primary ring-4 ring-emerald-500/25 transition-all duration-300 pointer-events-none shadow-[0_0_25px_rgba(46,204,113,0.3)]"
          style={{
            top: `${Math.max(0, targetRect.top - 4)}px`,
            left: `${Math.max(0, targetRect.left - 4)}px`,
            width: `${targetRect.width + 8}px`,
            height: `${targetRect.height + 8}px`,
          }}
        />
      )}

      {/* Floating Tooltip Card */}
      <div
        style={tooltipStyle}
        className="w-80 bg-obsidian-card border border-emerald-primary/60 rounded-xl shadow-2xl p-4 text-xs space-y-3 animate-fade-in"
      >
        <div className="flex items-center justify-between border-b border-obsidian-border pb-2">
          <div className="flex items-center space-x-1.5 text-emerald-primary font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="text-[11px] font-mono uppercase">
              Tur Panduan ({currentStepIndex + 1}/{steps.length})
            </span>
          </div>
          <button
            onClick={handleSkip}
            className="p-1 rounded text-nordic-muted hover:text-nordic-text transition-colors cursor-pointer"
            title="Tutup & Lewati Tur"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-1.5">
          <h4 className="font-bold text-nordic-text text-xs leading-snug">
            {currentStep?.title}
          </h4>
          <p className="text-[11px] text-nordic-muted leading-relaxed">
            {currentStep?.description}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-1 border-t border-obsidian-border">
          <button
            onClick={handleSkip}
            className="text-[10px] text-nordic-muted hover:text-nordic-text transition-colors cursor-pointer"
          >
            Lewati
          </button>

          <div className="flex items-center space-x-1.5">
            {currentStepIndex > 0 && (
              <button
                onClick={handlePrev}
                className="flex items-center space-x-1 px-2.5 py-1 rounded bg-obsidian-surface border border-obsidian-border text-nordic-text hover:text-emerald-primary text-[11px] font-semibold transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Sebelumnya</span>
              </button>
            )}

            <button
              onClick={handleNext}
              className="flex items-center space-x-1 px-3 py-1 rounded bg-emerald-primary text-obsidian-bg hover:bg-emerald-active text-[11px] font-bold transition-colors cursor-pointer"
            >
              <span>{isLastStep ? 'Selesai' : 'Lanjut'}</span>
              {isLastStep ? <Check className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

