import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Wrench,
  XCircle,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.js';

interface Finding {
  type: string;
  severity: 'critical' | 'error' | 'warning';
  title: string;
  details: string;
  suggestedAction: string;
  affectedMods?: string[];
  confidence: number;
}

interface AnalysisResult {
  hasLogs: boolean;
  analyzedFile?: string;
  isCrashReport?: boolean;
  findings: Finding[];
}

export const CrashLogViewer: React.FC = () => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [rawLog, setRawLog] = useState('');
  const [showRawLog, setShowRawLog] = useState(false);
  const [copied, setCopied] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const loadAnalysis = async () => {
    setLoading(true);
    setActionNotice(null);
    try {
      const res = await window.api.logs.analyze();
      setResult(res);
      const logText = await window.api.logs.getLatestLog();
      setRawLog(logText || '');
    } catch {
      setResult({ hasLogs: false, findings: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalysis();
  }, []);

  const handleCopyLog = () => {
    if (!rawLog) return;
    navigator.clipboard.writeText(rawLog);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDisableMod = async (modFileName: string) => {
    try {
      const res = await window.api.mods.toggle(modFileName, false);
      if (res.success) {
        setActionNotice(t.logs.fixApplied.replace('{action}', `Disabled ${modFileName}`));
        loadAnalysis();
      }
    } catch {}
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-zinc-400 gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
        <span className="text-sm font-medium">{t.logs.analyzing}</span>
      </div>
    );
  }

  const hasIssues = result && result.findings && result.findings.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-zinc-400">
          {result?.analyzedFile && (
            <span>
              Analyzing: <code className="text-zinc-300 font-mono">{result.analyzedFile}</code>
            </span>
          )}
        </div>
        <button
          onClick={loadAnalysis}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#131B16] hover:bg-[#1A241F] border border-[#1E2822] text-zinc-200 rounded-lg text-xs font-medium transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {t.logs.refreshLogs}
        </button>
      </div>

      {actionNotice && (
        <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {!hasIssues ? (
        <div className="p-8 bg-[#0D1310] border border-[#1E2822] rounded-xl flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-950/40 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-semibold text-zinc-100 mb-1">{t.logs.noCrashFound}</h4>
          <p className="text-xs text-zinc-400 max-w-md">{t.logs.noCrashDesc}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {result?.findings.map((finding, idx) => {
            const isCritical = finding.severity === 'critical';
            const isWarning = finding.severity === 'warning';

            return (
              <div
                key={idx}
                className={`p-4 rounded-xl border bg-[#0D1310] ${
                  isCritical
                    ? 'border-rose-500/30'
                    : isWarning
                    ? 'border-amber-500/30'
                    : 'border-rose-400/20'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    {isCritical ? (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                    <h4 className="text-sm font-semibold text-zinc-100">{finding.title}</h4>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#18221B] text-zinc-300 border border-[#1E2822]">
                      {t.logs.confidence.replace('{percent}', String(finding.confidence))}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-zinc-500 font-medium">{t.logs.rootCause}: </span>
                    <span className="text-zinc-300">{finding.details}</span>
                  </div>

                  <div className="p-2.5 bg-[#131B16] rounded-lg border border-[#1E2822] flex items-start gap-2">
                    <Wrench className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <span className="font-medium text-emerald-400">{t.logs.suggestedFix}: </span>
                      <span className="text-zinc-200">{finding.suggestedAction}</span>
                    </div>
                  </div>

                  {finding.affectedMods && finding.affectedMods.length > 0 && (
                    <div className="pt-1 flex flex-wrap items-center gap-1.5">
                      <span className="text-zinc-500 text-[11px]">{t.logs.affectedMods}:</span>
                      {finding.affectedMods.map((modName, mIdx) => (
                        <div
                          key={mIdx}
                          className="flex items-center gap-1.5 px-2 py-0.5 bg-[#18221B] border border-[#243028] rounded text-[11px] text-zinc-300 font-mono"
                        >
                          <span>{modName}</span>
                          <button
                            onClick={() => handleDisableMod(modName)}
                            className="text-[10px] text-rose-400 hover:text-rose-300 underline"
                          >
                            Disable
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {rawLog && (
        <div className="bg-[#0D1310] border border-[#1E2822] rounded-xl overflow-hidden">
          <button
            onClick={() => setShowRawLog(!showRawLog)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-[#131B16] hover:bg-[#18221B] transition-colors text-left"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              <span>{showRawLog ? t.logs.hideRawLog : t.logs.viewRawLog}</span>
            </div>
            {showRawLog ? (
              <ChevronDown className="w-4 h-4 text-zinc-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-zinc-400" />
            )}
          </button>

          {showRawLog && (
            <div className="p-3 border-t border-[#1E2822]">
              <div className="flex justify-end mb-2">
                <button
                  onClick={handleCopyLog}
                  className="flex items-center gap-1 px-2.5 py-1 bg-[#131B16] hover:bg-[#1A241F] border border-[#1E2822] text-zinc-300 rounded text-[11px] transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copied ? t.logs.copied : t.logs.copyLog}
                </button>
              </div>
              <pre className="text-[11px] font-mono text-zinc-400 bg-[#090D0B] p-3 rounded-lg overflow-x-auto max-h-80 border border-[#1E2822] whitespace-pre-wrap leading-relaxed select-text">
                {rawLog}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
