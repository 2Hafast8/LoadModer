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
  FolderOpen,
  Cpu,
  Layers,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.js';

interface CrashAction {
  type: 'disable' | 'install' | 'reinstall' | 'none';
  target: string;
  label: string;
}

interface CrashReportData {
  hasCrash: boolean;
  sourceFile?: string;
  sourceType?: 'crash_report' | 'latest_log';
  timestamp?: string;
  category?: string;
  culprit?: string;
  summary?: string;
  solution?: string;
  action?: CrashAction;
  rawExcerpt?: string;
  findings?: Array<{
    title: string;
    severity: 'critical' | 'error' | 'warning';
    details: string;
    suggestedAction: string;
    confidence: number;
    affectedMods?: string[];
  }>;
}

export const CrashLogViewer: React.FC = () => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<CrashReportData | null>(null);
  const [rawLog, setRawLog] = useState('');
  const [showRawLog, setShowRawLog] = useState(false);
  const [copied, setCopied] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [disablingMod, setDisablingMod] = useState(false);

  const loadAnalysis = async () => {
    setLoading(true);
    setActionNotice(null);
    try {
      const res = await window.api.logs.analyze();
      setReport(res);
      const logText = await window.api.logs.getLatestLog();
      setRawLog(logText || res?.rawExcerpt || '');
    } catch {
      setReport({ hasCrash: false });
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

  const handleCopyDiagnosticSummary = () => {
    if (!report) return;
    const summaryText = `${t.logs?.diagCopyHeader || '=== LoadModer Diagnostic Report ==='}
${t.logs?.diagCopySource || 'Source File:'} ${report.sourceFile || 'latest.log'} (${report.sourceType || 'log'})
${t.logs?.diagCopyCategory || 'Issue Category:'} ${report.category || 'Unknown'}
${t.logs?.diagCopyCulprit || 'Primary Culprit:'} ${report.culprit || (t.logs?.unidentified || 'Unidentified')}
${t.logs?.diagCopyDetail || 'Issue Details:'} ${report.summary || '-'}
${t.logs?.diagCopyRecommendation || 'Recommendation:'} ${report.solution || '-'}`;

    navigator.clipboard.writeText(summaryText);
    setActionNotice(t.logs?.diagCopiedNotice || 'Ringkasan diagnosa berhasil disalin ke clipboard!');
    setTimeout(() => setActionNotice(null), 3000);
  };

  const handleOpenFolder = async (folderType: 'crash-reports' | 'logs' | 'config') => {
    try {
      const instData = await window.api.instances.getAll();
      const active = instData?.active;
      if (!active?.rootDir) return;
      const targetPath = `${active.rootDir}\\${folderType}`;
      await window.api.instances.openFolder(targetPath);
    } catch (err: any) {
      setActionNotice(
        (t.logs?.openFolderFailedNotice || 'Gagal membuka folder: {error}').replace('{error}', err.message)
      );
    }
  };

  const handleDisableTarget = async (targetFile: string) => {
    if (!targetFile) return;
    setDisablingMod(true);
    try {
      const res = await window.api.mods.toggle(targetFile, false);
      if (res.success) {
        setActionNotice(
          (t.logs?.modDisabledNotice || 'Mod "{mod}" berhasil dinonaktifkan! Jalankan kembali Minecraft.')
            .replace('{mod}', targetFile)
        );
        loadAnalysis();
      } else {
        setActionNotice(
          (t.logs?.modDisableFailedNotice || 'Gagal menonaktifkan mod: {error}')
            .replace('{error}', res.error || '')
        );
      }
    } catch (err: any) {
      setActionNotice(`Error: ${err.message}`);
    } finally {
      setDisablingMod(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-zinc-400 gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
        <span className="text-sm font-medium">{t.logs.analyzing}</span>
      </div>
    );
  }

  const hasIssues = report && (report.hasCrash || (report.findings && report.findings.length > 0));

  return (
    <div className="space-y-4">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-zinc-400">
          {report?.sourceFile ? (
            <span className="flex items-center space-x-1.5">
              <span>{t.logs?.analyzedFile || 'Berkas yang Dianalisis:'}</span>
              <code className="text-emerald-400 font-mono bg-obsidian-card px-2 py-0.5 rounded border border-obsidian-border font-semibold">
                {report.sourceFile}
              </code>
            </span>
          ) : (
            <span>{t.logs?.activeLogAnalysis || 'Analisis log runtime aktif'}</span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleOpenFolder('crash-reports')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#131B16] hover:bg-[#1A241F] border border-[#1E2822] text-zinc-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            title={t.logs?.crashFolderTooltip || 'Buka folder crash-reports di File Explorer'}
          >
            <FolderOpen className="w-3.5 h-3.5 text-nordic-muted" />
            <span>{t.logs?.crashFolder || 'Folder Crash'}</span>
          </button>

          <button
            onClick={loadAnalysis}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#131B16] hover:bg-[#1A241F] border border-[#1E2822] text-zinc-200 rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{t.logs.refreshLogs}</span>
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionNotice}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-emerald-400/60 hover:text-emerald-300">
            &times;
          </button>
        </div>
      )}

      {/* When NO crash detected */}
      {!hasIssues ? (
        <div className="p-8 bg-[#0D1310] border border-[#1E2822] rounded-xl flex flex-col items-center justify-center text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-2 shadow-lg">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-zinc-100">{t.logs.noCrashFound}</h4>
          <p className="text-xs text-zinc-400 max-w-md leading-relaxed">
            {t.logs?.noCrashDesc || 'Tidak ditemukan indikasi crash fatal pada berkas crash-reports maupun latest.log. Semua sistem berjalan normal.'}
          </p>
        </div>
      ) : (
        /* Actionable Crash Analysis Card */
        <div className="p-5 rounded-xl border border-red-500/40 bg-[#0D1310] shadow-2xl space-y-4">
          <div className="flex items-start justify-between gap-3 border-b border-obsidian-border pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-red-950/60 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-red-400">
                  {(t.logs?.crashDetected || 'Crash Terdeteksi')} ({report.category ? report.category.replace('_', ' ').toUpperCase() : 'FATAL EXCEPTION'})
                </h4>
                <p className="text-[11px] text-zinc-400">
                  {(t.logs?.analyzedFromFile || 'Dianalisis dari berkas')}{' '}
                  <span className="font-mono text-zinc-200">{report.sourceFile || 'latest.log'}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleCopyDiagnosticSummary}
                className="flex items-center space-x-1 px-2.5 py-1 rounded bg-obsidian-card border border-obsidian-border text-[11px] text-zinc-300 hover:text-emerald-400 hover:border-emerald-400/40 transition-colors cursor-pointer"
                title={t.logs?.copyDiagnosticTooltip || 'Salin ringkasan diagnosa untuk forum / discord'}
              >
                <Copy className="w-3 h-3" />
                <span>{t.logs?.copyDiagnostic || 'Salin Diagnosa'}</span>
              </button>
            </div>
          </div>

          {/* Root Cause & Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-obsidian-card border border-obsidian-border rounded-lg space-y-1">
              <span className="text-[10px] font-mono uppercase text-zinc-500 block font-semibold">
                {t.logs?.primaryCulprit || 'Penyebab Utama (Culprit)'}
              </span>
              <span className="font-mono font-bold text-red-300 text-xs break-all">
                {report.culprit || (t.logs?.unidentified || 'Tidak teridentifikasi spesifik')}
              </span>
            </div>

            <div className="p-3 bg-obsidian-card border border-obsidian-border rounded-lg space-y-1">
              <span className="text-[10px] font-mono uppercase text-zinc-500 block font-semibold">
                {t.logs?.issueCategory || 'Kategori Masalah'}
              </span>
              <span className="text-zinc-200 font-semibold text-xs capitalize">
                {report.category ? report.category.replace(/_/g, ' ') : 'General Exception'}
              </span>
            </div>
          </div>

          {/* Explanation */}
          <div className="p-3 bg-red-950/20 border border-red-500/30 rounded-lg text-xs space-y-1">
            <span className="text-[11px] font-bold text-red-300 block">
              {t.logs?.whatHappened || 'Apa yang Terjadi:'}
            </span>
            <p className="text-zinc-300 leading-relaxed text-xs">
              {report.summary}
            </p>
          </div>

          {/* Actionable Steps / Suggested Solution */}
          <div className="p-3.5 bg-emerald-950/20 border border-emerald-500/30 rounded-lg text-xs space-y-2">
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
              <Wrench className="w-4 h-4" />
              <span>{t.logs?.recommendedFixAction || 'Saran Tindakan Perbaikan:'}</span>
            </div>
            <p className="text-zinc-200 text-xs leading-relaxed">
              {report.solution || 'Lakukan pengujian dengan menonaktifkan mod yang baru dipasang atau gunakan tab Diagnostik Bisect.'}
            </p>

            {/* Direct Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-emerald-500/20">
              {report.action && report.action.type === 'disable' && report.action.target && (
                <button
                  onClick={() => handleDisableTarget(report.action!.target)}
                  disabled={disablingMod}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>{report.action.label || (t.logs?.disableMod || 'Nonaktifkan "{mod}"').replace('{mod}', report.action.target)}</span>
                </button>
              )}

              {report.culprit && report.culprit.toLowerCase().endsWith('.jar') && (!report.action || report.action.type !== 'disable') && (
                <button
                  onClick={() => handleDisableTarget(report.culprit!)}
                  disabled={disablingMod}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>
                    {(t.logs?.disableMod || 'Nonaktifkan Mod ({mod})').replace('{mod}', report.culprit)}
                  </span>
                </button>
              )}

              {report.category === 'corrupted_file' && (
                <button
                  onClick={() => handleOpenFolder('config')}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded bg-obsidian-card border border-obsidian-border text-xs text-zinc-200 hover:border-emerald-400/40 transition-colors cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t.logs?.openConfigFolder || 'Buka Folder Config'}</span>
                </button>
              )}

              <button
                onClick={() => handleOpenFolder('logs')}
                className="flex items-center space-x-1 px-3 py-1.5 rounded bg-obsidian-card border border-obsidian-border text-xs text-zinc-300 hover:text-white transition-colors cursor-pointer"
              >
                <FolderOpen className="w-3.5 h-3.5 text-nordic-muted" />
                <span>{t.logs?.openLogsFolder || 'Buka Folder Logs'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Raw Log Excerpt Viewer */}
      {rawLog && (
        <div className="bg-[#0D1310] border border-[#1E2822] rounded-xl overflow-hidden">
          <button
            onClick={() => setShowRawLog(!showRawLog)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-[#131B16] hover:bg-[#18221B] transition-colors text-left cursor-pointer"
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
              <div className="flex justify-between items-center mb-2">
                <span className="text-[11px] text-zinc-500 font-mono">
                  {t.logs?.rawLogTraceHeader || 'Potongan Log / Stack Trace Terakhir'}
                </span>
                <button
                  onClick={handleCopyLog}
                  className="flex items-center gap-1 px-2.5 py-1 bg-[#131B16] hover:bg-[#1A241F] border border-[#1E2822] text-zinc-300 rounded text-[11px] transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? t.logs.copied : t.logs.copyLog}</span>
                </button>
              </div>

              <pre className="max-h-72 overflow-y-auto p-3 bg-black/60 rounded-lg text-[11px] font-mono text-zinc-300 leading-relaxed border border-[#18221B] whitespace-pre-wrap">
                {rawLog}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
