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

    const handleUpdate = () => {
      const el = document.querySelector(currentStep.targetSelector) as HTMLElement | null;
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
    };

    // Cek posisi elemen target: hanya scroll jika benar-benar di luar viewport
    const el = document.querySelector(currentStep.targetSelector) as HTMLElement | null;
    if (el) {
      const r = el.getBoundingClientRect();
      const inView =
        r.top >= 44 &&
        r.bottom <= window.innerHeight - 16 &&
        r.left >= 0 &&
        r.right <= window.innerWidth;

      if (!inView) {
        // Scroll instan langsung tanpa delay/smooth scroll lambat Chromium
        el.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
      }
      setTargetRect(el.getBoundingClientRect());
    } else {
      setTargetRect(null);
    }

    // Update rect pada next animation frame untuk menangkap render layout yang selesai
    const raf = requestAnimationFrame(handleUpdate);
    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate, true);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
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

  // Safe padding around the spotlight cutout
  const padding = 6;
  const spotLeft = targetRect ? Math.max(4, targetRect.left - padding) : 0;
  const spotTop = targetRect ? Math.max(4, targetRect.top - padding) : 0;
  const spotWidth = targetRect
    ? Math.min(window.innerWidth - spotLeft - 8, targetRect.width + padding * 2)
    : 0;
  const spotHeight = targetRect
    ? Math.min(window.innerHeight - spotTop - 8, targetRect.height + padding * 2)
    : 0;

  // Clamped tooltip positioning to guarantee buttons and card are 100% inside viewport
  const cardWidth = 336;
  const cardHeight = 210;
  const safeMargin = 16;
  const spacing = 12;

  const tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 9999,
  };

  if (targetRect) {
    // Horizontal clamping: align with target left, bounded by window boundaries
    const clampedX = Math.max(
      safeMargin,
      Math.min(window.innerWidth - cardWidth - safeMargin, targetRect.left)
    );

    // Vertical positioning: choose space below or space above
    const spaceBelow = window.innerHeight - (targetRect.bottom + padding);
    const spaceAbove = targetRect.top - padding;

    let clampedY: number;
    if (spaceBelow >= cardHeight + spacing) {
      clampedY = targetRect.bottom + padding + spacing;
    } else if (spaceAbove >= cardHeight + spacing) {
      clampedY = targetRect.top - padding - cardHeight - spacing;
    } else {
      // If target element is very tall or near edge, dock safely inside the viewport
      clampedY = Math.max(safeMargin, window.innerHeight - cardHeight - safeMargin);
    }

    tooltipStyle.top = `${clampedY}px`;
    tooltipStyle.left = `${clampedX}px`;
  } else {
    // Center fallback if target element is not found
    tooltipStyle.top = '50%';
    tooltipStyle.left = '50%';
    tooltipStyle.transform = 'translate(-50%, -50%)';
  }

  return (
    <div className="fixed inset-0 z-[9990] pointer-events-auto overflow-hidden">
      {/* If target element found, use transparent spotlight cutout with massive 9999px box-shadow.
          This eliminates blur entirely and displays highlighted elements razor-sharp. */}
      {targetRect ? (
        <div
          className="fixed rounded-xl border-2 border-emerald-400 ring-4 ring-emerald-500/30 transition-all duration-200 pointer-events-none shadow-[0_0_30px_rgba(46,204,113,0.35)]"
          style={{
            top: `${spotTop}px`,
            left: `${spotLeft}px`,
            width: `${spotWidth}px`,
            height: `${spotHeight}px`,
            boxShadow: '0 0 0 9999px rgba(10, 15, 13, 0.82)',
            background: 'transparent',
          }}
        />
      ) : (
        /* Fallback dark overlay if no target is active */
        <div className="absolute inset-0 bg-[#0A0F0D]/85 transition-opacity duration-200" />
      )}

      {/* Floating Tooltip Card */}
      <div
        style={tooltipStyle}
        className="w-[336px] bg-[#0E1511] border border-emerald-500/50 rounded-xl shadow-2xl p-4 text-xs space-y-3 animate-fade-in"
      >
        <div className="flex items-center justify-between border-b border-[#1E2822] pb-2">
          <div className="flex items-center space-x-1.5 text-emerald-400 font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="text-[11px] font-mono uppercase">
              {(t.tour?.stepOf || 'Tur Panduan ({current}/{total})')
                .replace('{current}', String(currentStepIndex + 1))
                .replace('{total}', String(steps.length))}
            </span>
          </div>
          <button
            onClick={handleSkip}
            className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-[#1E2822] transition-colors cursor-pointer"
            title={t.tour?.skipTooltip || 'Tutup & Lewati Tur'}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-1.5">
          <h4 className="font-bold text-zinc-100 text-xs leading-snug">
            {currentStep?.title}
          </h4>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            {currentStep?.description}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-1 border-t border-[#1E2822]">
          <button
            onClick={handleSkip}
            className="text-[10px] text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            {t.tour?.skip || 'Lewati'}
          </button>

          <div className="flex items-center space-x-1.5">
            {currentStepIndex > 0 && (
              <button
                onClick={handlePrev}
                className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#131B16] border border-[#1E2822] text-zinc-200 hover:text-emerald-400 text-[11px] font-semibold transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>{t.tour?.prev || 'Sebelumnya'}</span>
              </button>
            )}

            <button
              onClick={handleNext}
              className="flex items-center space-x-1 px-3 py-1 rounded bg-emerald-500 text-black hover:bg-emerald-400 text-[11px] font-bold transition-colors cursor-pointer shadow-lg shadow-emerald-950/40"
            >
              <span>{isLastStep ? (t.tour?.finish || 'Selesai') : (t.tour?.next || 'Lanjut')}</span>
              {isLastStep ? <Check className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

