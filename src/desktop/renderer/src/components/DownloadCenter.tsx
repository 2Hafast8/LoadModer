import React, { useState, useEffect, useRef } from 'react';
import { Download, ChevronDown, CheckCircle2, AlertCircle, Trash2, X, GripVertical } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.js';
import type { DownloadProgressPayload } from '../../../preload/index.js';

interface DragPosition {
  side: 'left' | 'right';
  y: number;
}

export const DownloadCenter: React.FC = () => {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [downloads, setDownloads] = useState<Record<string, DownloadProgressPayload>>({});

  // Window width tracker for symmetric left/right coordinate calculation
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );
  const [buttonWidth, setButtonWidth] = useState(180);

  // Position state with magnetic snapping (left or right)
  const [position, setPosition] = useState<DragPosition>(() => {
    try {
      const saved = localStorage.getItem('loadmoder_download_pos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if ((parsed.side === 'left' || parsed.side === 'right') && typeof parsed.y === 'number') {
          return parsed;
        }
      }
    } catch {}
    return { side: 'right', y: (typeof window !== 'undefined' ? window.innerHeight : 768) - 70 };
  });

  // Real-time drag coordinates while moving freely
  const [dragCoords, setDragCoords] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const dragRef = useRef<{
    startX: number;
    startY: number;
    startElemX: number;
    startElemY: number;
    currentX: number;
    currentY: number;
    hasMoved: boolean;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cleanup = window.api.downloads.onProgress((payload: DownloadProgressPayload) => {
      setDownloads((prev) => ({
        ...prev,
        [payload.id]: payload,
      }));
    });
    return () => cleanup();
  }, []);

  // Measure actual button pill width to guarantee perfect 16px dock margin on the right
  useEffect(() => {
    if (containerRef.current) {
      const measured = containerRef.current.offsetWidth;
      if (measured > 50) {
        setButtonWidth(measured);
      }
    }
  }, [downloads]);

  // Update Y position boundary and window width on window resize
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setPosition((prev) => ({
        ...prev,
        y: Math.min(Math.max(50, prev.y), window.innerHeight - 56),
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent | PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener('pointerdown', handleClickOutside);
    return () => window.removeEventListener('pointerdown', handleClickOutside);
  }, [isOpen]);

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

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return; // Only primary mouse button

    const rect = containerRef.current?.getBoundingClientRect();
    const currentElemWidth = rect?.width || buttonWidth;
    const currentElemX = rect
      ? rect.left
      : (position.side === 'left' ? 16 : window.innerWidth - currentElemWidth - 16);
    const currentElemY = rect ? rect.top : position.y;

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startElemX: currentElemX,
      startElemY: currentElemY,
      currentX: e.clientX,
      currentY: e.clientY,
      hasMoved: false,
    };

    const handlePointerMove = (moveEvt: PointerEvent) => {
      if (!dragRef.current) return;
      const dx = moveEvt.clientX - dragRef.current.startX;
      const dy = moveEvt.clientY - dragRef.current.startY;

      if (!dragRef.current.hasMoved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        dragRef.current.hasMoved = true;
        setIsDragging(true);
        setIsOpen(false); // Close dropdown while dragging
      }

      if (dragRef.current.hasMoved) {
        dragRef.current.currentX = moveEvt.clientX;
        dragRef.current.currentY = moveEvt.clientY;

        const maxDragX = Math.max(16, window.innerWidth - currentElemWidth - 16);
        const newX = Math.min(Math.max(16, dragRef.current.startElemX + dx), maxDragX);
        const newY = Math.min(Math.max(50, dragRef.current.startElemY + dy), window.innerHeight - 56);

        setDragCoords({ x: newX, y: newY });
      }
    };

    const handlePointerUp = () => {
      if (dragRef.current) {
        if (dragRef.current.hasMoved) {
          // Magnet snap to nearest edge (left or right)
          const midX = window.innerWidth / 2;
          const snappedSide: 'left' | 'right' = dragRef.current.currentX < midX ? 'left' : 'right';
          const dy = dragRef.current.currentY - dragRef.current.startY;
          const clampedY = Math.min(
            Math.max(50, dragRef.current.startElemY + dy),
            window.innerHeight - 56
          );

          const finalPos: DragPosition = {
            side: snappedSide,
            y: clampedY,
          };
          setPosition(finalPos);
          try {
            localStorage.setItem('loadmoder_download_pos', JSON.stringify(finalPos));
          } catch {}
        } else {
          // Normal click without movement (toggle dropdown)
          setIsOpen((prev) => !prev);
        }
      }

      setIsDragging(false);
      setDragCoords(null);
      dragRef.current = null;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  if (items.length === 0) {
    return null;
  }

  const isLeft = position.side === 'left';
  // Jika posisi Y berada di atas paruh layar, buka dropdown ke BAWAH. Jika di bawah, buka ke ATAS.
  const isTopHalf = position.y < window.innerHeight / 2;

  // Dropdown panel content (floats absolutely relative to the container button)
  const dropdownPanel = isOpen && !isDragging && (
    <div
      className={`absolute w-80 md:w-96 bg-[#0D1310] border border-[#1E2822] rounded-xl shadow-2xl overflow-hidden animate-in fade-in duration-150 z-50 ${
        isLeft ? 'left-0' : 'right-0'
      } ${
        isTopHalf
          ? 'top-full mt-2 slide-in-from-top-2'
          : 'bottom-full mb-2 slide-in-from-bottom-2'
      }`}
      style={{
        maxHeight: 'min(360px, 60vh)',
      }}
    >
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
            onClick={(e) => {
              e.stopPropagation();
              clearCompleted();
            }}
            title={t.downloads.clearFinished}
            className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-[#1E2822] rounded transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
            }}
            className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-[#1E2822] rounded transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto divide-y divide-[#1A231D]/60 p-1">
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
  );

  // Trigger pill button
  const triggerButton = (
    <div
      onPointerDown={handlePointerDown}
      className={`flex items-center gap-2 px-3 py-2 bg-[#131B16] hover:bg-[#1A241F] border border-[#1E2822] hover:border-emerald-500/40 text-zinc-200 rounded-full shadow-2xl transition-all text-xs font-medium cursor-grab active:cursor-grabbing touch-none select-none ${
        isDragging ? 'ring-2 ring-emerald-500/60 scale-105 shadow-emerald-950/40' : ''
      }`}
      title="Geser bebas ke mana saja • Snap otomatis ke tepi terdekat saat dilepas"
    >
      <GripVertical className="w-3 h-3 text-zinc-500 shrink-0" />
      <Download className={`w-3.5 h-3.5 text-emerald-400 ${activeDownloads.length > 0 ? 'animate-bounce' : ''}`} />
      <span className="pointer-events-none">
        {activeDownloads.length > 0
          ? `${activeDownloads.length} ${t.downloads.downloading}...`
          : t.downloads.title}
      </span>
      <ChevronDown
        className={`w-3.5 h-3.5 text-zinc-400 transition-transform pointer-events-none ${
          isOpen ? (isTopHalf ? 'rotate-180' : 'rotate-0') : (isTopHalf ? 'rotate-0' : 'rotate-180')
        }`}
      />
    </div>
  );

  // Calculate target X position for magnetic snap: both left and right use the 'left' property
  // ensuring CSS transitions interpolate smoothly on both sides without teleporting
  const snappedX = isLeft ? 16 : Math.max(16, windowWidth - buttonWidth - 16);

  // Posisi inline style
  const containerStyle: React.CSSProperties = isDragging && dragCoords
    ? {
        position: 'fixed',
        left: dragCoords.x,
        top: dragCoords.y,
        zIndex: 9999,
        transition: 'none',
      }
    : {
        position: 'fixed',
        left: snappedX,
        top: position.y,
        zIndex: 9999,
        transition: 'top 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), left 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)',
      };

  return (
    <div
      ref={containerRef}
      style={containerStyle}
      className="relative select-none"
    >
      {/* Tombol pemicu drag */}
      {triggerButton}

      {/* Dropdown panel floating absolute (top-full or bottom-full) */}
      {dropdownPanel}
    </div>
  );
};
