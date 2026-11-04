import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';

interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

let locks = 0;
function lockScroll(): void {
  if (locks++ === 0) document.documentElement.style.overflow = 'hidden';
}
function unlockScroll(): void {
  if (--locks === 0) document.documentElement.style.overflow = '';
}

/** Нижняя шторка поверх экрана. Закрывается тапом по фону, крестиком и Escape. */
export function Sheet({ open, title, onClose, children }: SheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Страница под шторкой не прокручивается: на iOS иначе докрутка списка до конца тащит фон.
  useEffect(() => {
    if (!open) return;
    lockScroll();
    return unlockScroll;
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Закрыть"
        tabIndex={-1}
        className="animate-fade-in absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="animate-sheet-in pb-safe relative flex max-h-[92dvh] flex-col rounded-t-3xl bg-surface text-ink shadow-2xl outline-none"
      >
        <div className="flex shrink-0 items-center justify-between px-5 pt-4 pb-2">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Закрыть"
            onClick={onClose}
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-muted active:bg-track"
          >
            <X size={22} />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-3 pb-4">{children}</div>
      </div>
    </div>
  );
}
