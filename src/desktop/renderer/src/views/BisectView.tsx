import React, { useState, useEffect } from 'react';
import {
  Activity,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Layers,
} from 'lucide-react';

export const BisectView: React.FC = () => {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(1);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [culprit, setCulprit] = useState<string | null>(null);
  const [message, setMessage] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const checkStatus = async () => {
    try {
      const res = await window.api.bisect.status();
      setActive(res.active);
    } catch (err: any) {
      console.error('Failed to get bisect status:', err);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const handleAction = async (action: 'start' | 'good' | 'bad' | 'reset') => {
    setLoading(true);
    try {
      const res = await window.api.bisect.step(action);
      setMessage(res.message);

      if (action === 'start') {
        setActive(true);
        setStep(1);
        setCulprit(null);
      } else if (action === 'reset') {
        setActive(false);
        setCulprit(null);
        setRemaining(null);
        setStep(1);
      } else if (action === 'good' || action === 'bad') {
        if (res.finished && res.culprit) {
          setCulprit(res.culprit);
        } else if (res.step) {
          setStep(res.step);
          if (res.remaining !== undefined) setRemaining(res.remaining);
        }
      }
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-obsidian-bg p-6 overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full space-y-6">
        <div className="border border-obsidian-border bg-obsidian-surface rounded p-5 space-y-2">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded bg-emerald-dark/30 text-emerald-primary border border-emerald-primary/30">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-nordic-text">
                Alat Diagnostik Crash Bisect
              </h2>
              <p className="text-xs text-nordic-muted">
                Isolasi mod penyebab crash secara efisien menggunakan algoritma pencarian biner (O(log n))
              </p>
            </div>
          </div>
        </div>

        {culprit ? (
          <div className="border border-status-danger/40 bg-status-danger/10 rounded p-6 space-y-4 text-center">
            <div className="inline-flex p-3 rounded-full bg-status-danger/20 text-status-danger">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-nordic-text">
                Mod Penyebab Crash Terdeteksi!
              </h3>
              <p className="text-xs text-nordic-muted">
                Sistem berhasil mengisolasi mod bermasalah:
              </p>
              <div className="mt-2 py-2 px-4 rounded bg-obsidian-bg border border-status-danger/50 text-status-danger font-mono text-xs font-semibold inline-block">
                {culprit}
              </div>
            </div>
            <div className="pt-2">
              <button
                onClick={() => handleAction('reset')}
                className="px-4 py-2 rounded bg-emerald-primary text-obsidian-bg text-xs font-semibold hover:bg-emerald-active transition-colors cursor-pointer"
              >
                Selesaikan & Pulihkan Mod Lainnya
              </button>
            </div>
          </div>
        ) : active ? (
          <div className="border border-emerald-primary/40 bg-obsidian-card rounded p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-obsidian-border pb-4">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-active animate-pulse" />
                <span className="text-xs font-semibold text-nordic-text uppercase font-mono">
                  Sesi Bisect Berjalan — Tahap {step}
                </span>
              </div>
              {remaining !== null && (
                <span className="text-[11px] font-mono text-nordic-muted bg-obsidian-surface px-2.5 py-1 rounded border border-obsidian-border">
                  Tersisa {remaining} kandidat
                </span>
              )}
            </div>

            <div className="space-y-2 text-center py-2">
              <p className="text-xs font-medium text-nordic-text">
                Separuh mod telah dinonaktifkan sementara.
              </p>
              <p className="text-xs text-nordic-muted max-w-md mx-auto">
                Silakan luncurkan game Minecraft Anda sekarang. Apakah game berhasil masuk ke menu utama tanpa crash?
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => handleAction('good')}
                disabled={loading}
                className="flex items-center justify-center space-x-2 py-3 rounded bg-emerald-dark/40 border border-emerald-primary/60 text-emerald-active hover:bg-emerald-dark/60 text-xs font-semibold transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Berhasil Masuk (Good)</span>
              </button>

              <button
                onClick={() => handleAction('bad')}
                disabled={loading}
                className="flex items-center justify-center space-x-2 py-3 rounded bg-status-danger/20 border border-status-danger/60 text-status-danger hover:bg-status-danger/30 text-xs font-semibold transition-colors cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
                <span>Masih Crash (Bad)</span>
              </button>
            </div>

            <div className="pt-2 text-center">
              <button
                onClick={() => handleAction('reset')}
                disabled={loading}
                className="inline-flex items-center space-x-1.5 text-xs text-nordic-muted hover:text-status-danger transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Batalkan Sesi & Pulihkan File Mod</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="border border-obsidian-border bg-obsidian-card rounded p-6 space-y-5 text-center">
            <div className="space-y-2 max-w-md mx-auto">
              <h3 className="text-xs font-bold text-nordic-text uppercase tracking-wide">
                Mulai Investigasi Crash
              </h3>
              <p className="text-xs text-nordic-muted leading-relaxed">
                Jika Minecraft mengalami crash saat loading dan Anda memiliki puluhan mod, jangan uji coba satu per satu secara manual. LoadModer akan otomatis membagi dua daftar mod hingga mod penyebab crash terisolasi dalam hitungan langkah.
              </p>
            </div>

            <button
              onClick={() => handleAction('start')}
              disabled={loading}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded bg-emerald-primary text-obsidian-bg text-xs font-bold hover:bg-emerald-active transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Mulai Diagnostik Bisect</span>
            </button>
          </div>
        )}

        {message && (
          <div className="p-3 rounded bg-obsidian-surface border border-obsidian-border text-[11px] font-mono text-nordic-muted">
            {message}
          </div>
        )}
      </div>
    </div>
  );
};
