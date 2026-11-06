import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';

/** Открытые шторки снизу вверх. */
const STACK: object[] = [];

interface SheetProps {
  open: boolean;
  title: string;
  /** Маленькая подпись над заголовком: «Как делать». */
  kicker?: string;
  onClose: () => void;
  children: ReactNode;
}

/** Нижняя шторка поверх экрана (REDESIGN: фон `--bg`, карточки внутри — `--surface`). Закрывается тапом по фону, крестиком и Escape. */
export function Sheet({ open, title, kicker, onClose, children }: SheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // onClose — через ref: новая функция при каждом рендере родителя не должна переставлять шторку в стеке.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    // Escape закрывает только верхнюю шторку (календарь → день): стек открытых шторок.
    const me = {};
    STACK.push(me);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && STACK[STACK.length - 1] === me) closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    // Без прокрутки к элементу: на iOS focus() двигает документ, и закреплённые элементы дёргаются.
    // Если содержимое уже поставило фокус (поле поиска с autoFocus) — не перехватываем.
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) panel.focus({ preventScroll: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      STACK.splice(STACK.indexOf(me), 1);
    };
  }, [open]);

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
        className="animate-fade-in absolute inset-0 touch-none bg-black/60"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="animate-sheet-in pb-safe relative flex max-h-[92dvh] flex-col rounded-t-[28px] bg-bg text-ink outline-none"
      >
        <div className="flex shrink-0 touch-none flex-col items-center pt-2.5">
          <div className="h-[5px] w-10 rounded-full bg-line" aria-hidden />
        </div>
        <div className="flex shrink-0 touch-none items-start justify-between gap-3 px-5 pt-2 pb-3">
          <div className="min-w-0 flex-1">
            {kicker && <p className="text-[13px] leading-[18px] text-muted">{kicker}</p>}
            <h2 id={titleId} className="font-display text-[22px] leading-[30px] font-bold">
              {title}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Закрыть"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-ink active:bg-track"
          >
            <X size={20} strokeWidth={2.2} />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
      </div>
    </div>
  );
}
