import React, { useState, useEffect } from 'react';
import { Download, ChevronDown, CheckCircle2, AlertCircle, Trash2, X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.js';
import type { DownloadProgressPayload } from '../../../preload/index.js';

export const DownloadCenter: React.FC = () => {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [downloads, setDownloads] = useState<Record<string, DownloadProgressPayload>>({});

  useEffect(() => {
    const cleanup = window.api.downloads.onProgress((payload: DownloadProgressPayload) => {
      setDownloads((prev) => ({
        ...prev,
        [payload.id]: payload,
      }));
    });
    return () => cleanup();
  }, []);

  const items = Object.values(downloads);
  const activeDownloads = items.filter((d) => d.status === 'downloading');

  const clearCompleted = () => {
    setDownloads((prev) => {
      const next: Record<string, DownloadProgressPayload> = {};
      for (const [id, item] of Object.entries(prev)) {
        if (item.status === 'downloading') {
          next[id] = item;
        }
      }
      return next;
    });
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="w-80 md:w-96 bg-[#0D1310] border border-[#1E2822] rounded-xl shadow-2xl overflow-hidden mb-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#131B16] border-b border-[#1E2822]">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold text-zinc-100">{t.downloads.title}</span>
              {activeDownloads.length > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-400 rounded-full font-medium">
                  {activeDownloads.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={clearCompleted}
                title={t.downloads.clearFinished}
                className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-[#1E2822] rounded transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-[#1E2822] rounded transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-[#1A231D]/60 p-1">
            {items.map((item) => {
              const isDone = item.status === 'completed';
              const isErr = item.status === 'failed';

              return (
                <div key={item.id} className="p-2.5 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-zinc-200 truncate flex-1" title={item.name}>
                      {item.name}
                    </span>
                    <div className="flex items-center gap-1.5 text-[11px] shrink-0 font-mono">
                      {isDone ? (
                        <span className="flex items-center gap-1 text-emerald-400 text-[10px]">
                          <CheckCircle2 className="w-3 h-3" />
                          {t.downloads.completed}
                        </span>
                      ) : isErr ? (
                        <span className="flex items-center gap-1 text-rose-400 text-[10px]">
                          <AlertCircle className="w-3 h-3" />
                          {t.downloads.failed}
                        </span>
                      ) : (
                        <span className="text-zinc-400 text-[10px]">{item.speed}</span>
                      )}
                    </div>
                  </div>

                  <div className="w-full bg-[#18221B] h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-200 ${
                        isDone ? 'bg-emerald-500' : isErr ? 'bg-rose-500' : 'bg-emerald-400'
                      }`}
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-[#131B16] hover:bg-[#1A241F] border border-[#1E2822] hover:border-emerald-500/40 text-zinc-200 rounded-full shadow-lg transition-all text-xs font-medium"
      >
        <Download className={`w-3.5 h-3.5 text-emerald-400 ${activeDownloads.length > 0 ? 'animate-bounce' : ''}`} />
        <span>
          {activeDownloads.length > 0
            ? `${activeDownloads.length} ${t.downloads.downloading}...`
            : t.downloads.title}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
    </div>
  );
};
