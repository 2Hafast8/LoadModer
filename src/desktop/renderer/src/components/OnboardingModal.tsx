import React from 'react';
import { Sparkles, Layers, ArrowRight, X, Compass, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.js';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTour: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onStartTour,
}) => {
  const { t } = useLanguage();

  if (!isOpen) return null;

  const handleStart = () => {
    localStorage.setItem('loadmoder_onboarding_welcomed', 'true');
    onStartTour();
    onClose();
  };

  const handleSkip = () => {
    localStorage.setItem('loadmoder_onboarding_welcomed', 'true');
    // Tandai seluruh tur sebagai dilewati agar tidak mengganggu jika pengguna memilih lewati
    localStorage.setItem('loadmoder_tour_mods', 'completed');
    localStorage.setItem('loadmoder_tour_explore', 'completed');
    localStorage.setItem('loadmoder_tour_instances', 'completed');
    localStorage.setItem('loadmoder_tour_bisect', 'completed');
    localStorage.setItem('loadmoder_tour_help', 'completed');
    localStorage.setItem('loadmoder_tour_settings', 'completed');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-bg/85 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-obsidian-card border border-emerald-primary/40 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        {/* Banner Visual */}
        <div className="bg-gradient-to-r from-emerald-950/60 to-obsidian-card p-6 border-b border-obsidian-border text-center relative">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center mx-auto mb-3 text-emerald-primary shadow-lg shadow-emerald-950/30">
            <Sparkles className="w-7 h-7" />
          </div>
          <h2 className="text-base font-bold text-nordic-text">
            {t.onboarding?.welcomeTitle || 'Selamat Datang di LoadModer!'}
          </h2>
          <p className="text-xs text-nordic-muted mt-1 max-w-sm mx-auto leading-relaxed">
            {t.onboarding?.welcomeSubtitle ||
              'Aplikasi mandiri pengelolaan mod, modpack, shader, dan resource pack Minecraft berkecepatan tinggi.'}
          </p>
        </div>

        {/* Feature Highlights */}
        <div className="p-5 space-y-3.5">
          <div className="space-y-2 text-xs">
            <div className="flex items-start space-x-3 p-2.5 rounded bg-obsidian-surface border border-obsidian-border">
              <CheckCircle2 className="w-4 h-4 text-emerald-primary shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-nordic-text block">Eksplorasi & Unduhan Cepat</span>
                <span className="text-[11px] text-nordic-muted">Akses jutaan mod langsung dari Modrinth API v2 secara instan.</span>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-2.5 rounded bg-obsidian-surface border border-obsidian-border">
              <CheckCircle2 className="w-4 h-4 text-emerald-primary shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-nordic-text block">Isolasi Wadah Modpack Mandiri</span>
                <span className="text-[11px] text-nordic-muted">Pisahkan folder mod per-versi tanpa merusak game Minecraft utama Anda.</span>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-2.5 rounded bg-obsidian-surface border border-obsidian-border">
              <CheckCircle2 className="w-4 h-4 text-emerald-primary shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-nordic-text block">Diagnostik Crash & Solusi Pintar</span>
                <span className="text-[11px] text-nordic-muted">Analisis log crash otomatis dan temukan mod penyebab crash lewat bisect.</span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded bg-emerald-950/20 border border-emerald-500/30 text-center text-xs text-emerald-300">
            {t.onboarding?.promptTour || 'Apakah Anda ingin mengikuti tur spotlight interaktif untuk memandu navigasi aplikasi?'}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-obsidian-surface border-t border-obsidian-border flex items-center justify-between gap-3">
          <button
            onClick={handleSkip}
            className="px-4 py-2 text-xs text-nordic-muted hover:text-nordic-text transition-colors cursor-pointer"
          >
            {t.onboarding?.skipBtn || 'Lewati / Sudah Paham'}
          </button>

          <button
            onClick={handleStart}
            className="flex items-center space-x-2 px-4 py-2 rounded bg-emerald-primary text-obsidian-bg hover:bg-emerald-active text-xs font-bold transition-colors cursor-pointer shadow-sm"
          >
            <span>{t.onboarding?.startTourBtn || 'Mulai Tutorial Interaktif'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

