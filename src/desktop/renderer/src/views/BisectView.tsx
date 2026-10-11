import React, { useState, useEffect } from 'react';
import {
  Activity,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileSearch,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.js';
import { CrashLogViewer } from '../components/CrashLogViewer.js';

export const BisectView: React.FC = () => {
  const { t } = useLanguage();
  const [subTab, setSubTab] = useState<'logs' | 'bisect'>('logs');
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
      if (res.active) {
        setSubTab('bisect');
      }
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
      <div className="max-w-3xl mx-auto w-full space-y-5">
        <div className="flex items-center gap-2 border-b border-[#1E2822] pb-3">
          <button
            onClick={() => setSubTab('logs')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              subTab === 'logs'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#131B16]'
            }`}
          >
            <FileSearch className="w-3.5 h-3.5" />
            <span>{t.logs.tabCrashLogs}</span>
          </button>
          <button
            onClick={() => setSubTab('bisect')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              subTab === 'bisect'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#131B16]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>{t.logs.tabBisect}</span>
            {active && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
          </button>
        </div>

        {subTab === 'logs' ? (
          <CrashLogViewer />
        ) : (
          <div className="space-y-5">
            <div className="border border-obsidian-border bg-obsidian-surface rounded p-5 space-y-2">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded bg-emerald-dark/30 text-emerald-primary border border-emerald-primary/30">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-nordic-text">{t.bisect.title}</h2>
                  <p className="text-xs text-nordic-muted">{t.bisect.subtitle}</p>
                </div>
              </div>
            </div>

            {culprit ? (
              <div className="border border-status-danger/40 bg-status-danger/10 rounded p-6 space-y-4 text-center">
                <div className="inline-flex p-3 rounded-full bg-status-danger/20 text-status-danger">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-nordic-text">{t.bisect.culpritTitle}</h3>
                  <p className="text-xs text-nordic-muted">{t.bisect.culpritDesc}</p>
                  <div className="mt-2 py-2 px-4 rounded bg-obsidian-bg border border-status-danger/50 text-status-danger font-mono text-xs font-semibold inline-block">
                    {culprit}
                  </div>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => handleAction('reset')}
                    className="px-4 py-2 rounded bg-emerald-primary text-obsidian-bg text-xs font-semibold hover:bg-emerald-active transition-colors cursor-pointer"
                  >
                    {t.bisect.completeBtn}
                  </button>
                </div>
              </div>
            ) : active ? (
              <div className="border border-emerald-primary/40 bg-obsidian-card rounded p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-obsidian-border pb-4">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-active animate-pulse" />
                    <span className="text-xs font-semibold text-nordic-text uppercase font-mono">
                      {t.bisect.runningTitle.replace('{step}', String(step))}
                    </span>
                  </div>
                  {remaining !== null && (
                    <span className="text-[11px] font-mono text-nordic-muted bg-obsidian-surface px-2.5 py-1 rounded border border-obsidian-border">
                      {t.bisect.candidatesRemaining.replace('{count}', String(remaining))}
                    </span>
                  )}
                </div>

                <div className="space-y-2 text-center py-2">
                  <p className="text-xs font-medium text-nordic-text">{t.bisect.promptLine1}</p>
                  <p className="text-xs text-nordic-muted max-w-md mx-auto">{t.bisect.promptLine2}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => handleAction('good')}
                    disabled={loading}
                    className="flex items-center justify-center space-x-2 py-3 rounded bg-emerald-dark/40 border border-emerald-primary/60 text-emerald-active hover:bg-emerald-dark/60 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{t.bisect.goodBtn}</span>
                  </button>

                  <button
                    onClick={() => handleAction('bad')}
                    disabled={loading}
                    className="flex items-center justify-center space-x-2 py-3 rounded bg-status-danger/20 border border-status-danger/60 text-status-danger hover:bg-status-danger/30 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>{t.bisect.badBtn}</span>
                  </button>
                </div>

                <div className="pt-2 text-center">
                  <button
                    onClick={() => handleAction('reset')}
                    disabled={loading}
                    className="inline-flex items-center space-x-1.5 text-xs text-nordic-muted hover:text-status-danger transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t.bisect.cancelBtn}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="border border-obsidian-border bg-obsidian-card rounded p-6 space-y-5 text-center">
                <div className="space-y-2 max-w-md mx-auto">
                  <h3 className="text-xs font-bold text-nordic-text uppercase tracking-wide">
                    {t.bisect.readyTitle}
                  </h3>
                  <p className="text-xs text-nordic-muted leading-relaxed">{t.bisect.readyDesc}</p>
                </div>

                <button
                  onClick={() => handleAction('start')}
                  disabled={loading}
                  className="inline-flex items-center space-x-2 px-5 py-2.5 rounded bg-emerald-primary text-obsidian-bg text-xs font-bold hover:bg-emerald-active transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{t.bisect.startBtn}</span>
                </button>
              </div>
            )}

            {message && (
              <div className="p-3 rounded bg-obsidian-surface border border-obsidian-border text-[11px] font-mono text-nordic-muted">
                {message}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
