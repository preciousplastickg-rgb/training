import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';

interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Нижняя шторка поверх экрана. Закрывается тапом по фону, крестиком и Escape. */
export function Sheet({ open, title, onClose, children }: SheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    // Без прокрутки к элементу: на iOS focus() двигает документ, и закреплённые элементы дёргаются.
    // Если содержимое уже поставило фокус (поле поиска с autoFocus) — не перехватываем.
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) panel.focus({ preventScroll: true });
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    // Фон под шторкой не прокручивается жестом по затемнению и по заголовку (touch-none), а список
    // внутри не передаёт докрутку странице (overscroll-contain). overflow на <html> не трогаем:
    // на iOS его переключение само сдвигает область экрана.
    <div className="vv-top fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Закрыть"
        tabIndex={-1}
        className="animate-fade-in absolute inset-0 touch-none bg-black/50"
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
        <div className="flex shrink-0 touch-none items-center justify-between px-5 pt-4 pb-2">
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
