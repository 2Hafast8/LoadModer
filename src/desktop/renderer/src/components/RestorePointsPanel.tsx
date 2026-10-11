import React, { useState, useEffect } from 'react';
import { ShieldCheck, Plus, RotateCcw, Trash2, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.js';

interface SnapshotItem {
  snapshotId: string;
  instanceName?: string;
  gameVersion?: string;
  loader?: string;
  createdAt: string;
  note?: string;
  modsCount: number;
  activeCount: number;
}

interface RestorePointsPanelProps {
  activeInstance: any | null;
}

export const RestorePointsPanel: React.FC<RestorePointsPanelProps> = ({ activeInstance }) => {
  const { t } = useLanguage();
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadSnapshots = async () => {
    if (!activeInstance) return;
    setLoading(true);
    try {
      const list = await window.api.snapshots.list();
      setSnapshots(list ?? []);
    } catch {
      setSnapshots([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSnapshots();
  }, [activeInstance?.id, activeInstance?.rootDir]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeInstance) return;
    setCreating(true);
    setNotice(null);
    try {
      const res = await window.api.snapshots.create(note.trim() || undefined);
      if (res.success) {
        setNote('');
        setNotice({ text: t.snapshots.createSuccess, type: 'success' });
        loadSnapshots();
      } else {
        setNotice({ text: res.error || 'Failed to create backup', type: 'error' });
      }
    } catch (err: any) {
      setNotice({ text: err.message, type: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async (snapshotId: string) => {
    if (!window.confirm(t.snapshots.confirmRestore)) return;
    setRestoringId(snapshotId);
    setNotice(null);
    try {
      const res = await window.api.snapshots.restore(snapshotId);
      if (res.success) {
        setNotice({
          text: t.snapshots.restoreSuccess.replace('{count}', String(res.restoredCount ?? 0)),
          type: 'success',
        });
        loadSnapshots();
      } else {
        setNotice({ text: res.error || 'Failed to restore', type: 'error' });
      }
    } catch (err: any) {
      setNotice({ text: err.message, type: 'error' });
    } finally {
      setRestoringId(null);
    }
  };

  const handleDelete = async (snapshotId: string) => {
    if (!window.confirm(t.snapshots.confirmDelete)) return;
    try {
      const res = await window.api.snapshots.delete(snapshotId);
      if (res.success) {
        setNotice({ text: t.snapshots.deleteSuccess, type: 'success' });
        loadSnapshots();
      }
    } catch {}
  };

  if (!activeInstance) return null;

  return (
    <div className="border border-[#1E2822] bg-[#0D1310] rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold text-zinc-100 uppercase tracking-wider font-mono">
            {t.snapshots.title}
          </h3>
        </div>
        <span className="text-[11px] text-zinc-400">{t.snapshots.subtitle}</span>
      </div>

      {notice && (
        <div
          className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
            notice.type === 'success'
              ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30'
              : 'bg-rose-950/40 text-rose-300 border border-rose-500/30'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t.snapshots.notePlaceholder}
          className="flex-1 px-3 py-1.5 bg-[#131B16] border border-[#1E2822] focus:border-emerald-500/50 rounded-lg text-xs text-zinc-200 outline-none placeholder:text-zinc-600"
        />
        <button
          type="submit"
          disabled={creating}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold rounded-lg text-xs transition-colors disabled:opacity-50"
        >
          {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          <span>{creating ? t.snapshots.creating : t.snapshots.createBtn}</span>
        </button>
      </form>

      {loading ? (
        <div className="py-4 text-center text-xs text-zinc-500">Loading snapshots...</div>
      ) : snapshots.length === 0 ? (
        <div className="py-3 text-center text-xs text-zinc-500">{t.snapshots.emptySnapshots}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
          {snapshots.map((snap) => {
            const isRestoring = restoringId === snap.snapshotId;
            const dateStr = new Date(snap.createdAt).toLocaleString();

            return (
              <div
                key={snap.snapshotId}
                className="p-2.5 bg-[#131B16] border border-[#1E2822] rounded-lg flex items-center justify-between text-xs"
              >
                <div className="truncate min-w-0 mr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-zinc-200 truncate">
                      {snap.note || snap.snapshotId}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-[#18221B] border border-[#243028] text-emerald-400 rounded font-mono">
                      {snap.loader || 'universal'}
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                    {dateStr} • {t.snapshots.modsCount.replace('{count}', String(snap.modsCount))}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleRestore(snap.snapshotId)}
                    disabled={isRestoring}
                    title={t.snapshots.restoreBtn}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-[#18221B] hover:bg-emerald-500/20 text-emerald-400 border border-[#243028] hover:border-emerald-500/40 text-[11px] font-medium transition-colors"
                  >
                    <RotateCcw className={`w-3 h-3 ${isRestoring ? 'animate-spin' : ''}`} />
                    <span>{isRestoring ? t.snapshots.restoring : t.snapshots.restoreBtn}</span>
                  </button>
                  <button
                    onClick={() => handleDelete(snap.snapshotId)}
                    title={t.snapshots.deleteBtn}
                    className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-950/20 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
