// iOS 26, приложение на экране «Домой»: visualViewport «залипает» со смещением (offsetTop > 0)
// после клавиатуры и при прокрутке (WebKit 297779). Фиксированные элементы привязаны к области
// раскладки и уезжают вместе с ней: нижнее меню — посреди экрана, шапка — за верхним краем.
// Лечение: (1) когда прокрутка улеглась и ничего не в фокусе — подталкиваем её на 1 px, iOS
// пересчитывает область; (2) пока смещение держится — сдвигаем закреплённые элементы на него
// через CSS-переменные --vv-top (шапка, шторки) и --vv-bottom (нижнее меню, плашки).

export interface ViewportSample {
  offsetTop: number;
  height: number;
  scale: number;
  /** Высота области раскладки — document.documentElement.clientHeight. */
  layoutHeight: number;
  /** В фокусе поле ввода: клавиатура открыта, iOS двигает область сама. */
  typing: boolean;
}

/** Насколько сдвинуть закреплённые элементы, чтобы они остались у краёв видимой области. */
export function viewportShift(v: ViewportSample): { top: number; bottom: number } {
  if (v.typing || Math.abs(v.scale - 1) > 0.01) return { top: 0, bottom: 0 };
  const top = v.offsetTop > 1 ? v.offsetTop : 0;
  // Низ видимой области относительно низа раскладки. Вниз — не больше смещения сверху:
  // иначе при «короткой» области (WebKit 301108) меню ушло бы туда, где iOS его не рисует.
  const raw = v.offsetTop + v.height - v.layoutHeight;
  const bottom = Math.max(-v.layoutHeight / 3, Math.min(top, raw));
  return { top, bottom: Math.abs(bottom) > 1 ? bottom : 0 };
}

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function typing(): boolean {
  const a = document.activeElement as HTMLElement | null;
  return !!a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
}

/** Для диагностики в настройках. */
export const viewportStats = { nudges: 0, installed: false };

export function installViewportFix(): void {
  const vv = window.visualViewport;
  if (!vv || !isStandalone()) return;
  viewportStats.installed = true;
  const root = document.documentElement;
  let frame = 0;
  let timer = 0;
  let nudged = false;
  let last = '';

  const sample = (): ViewportSample => ({
    offsetTop: vv.offsetTop,
    height: vv.height,
    scale: vv.scale,
    layoutHeight: root.clientHeight,
    typing: typing(),
  });

  const apply = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const s = viewportShift(sample());
      const key = `${s.top}|${s.bottom}`;
      if (key === last) return; // переменная на <html> пересчитывает стили всей страницы — только по делу
      last = key;
      root.style.setProperty('--vv-top', `${s.top}px`);
      root.style.setProperty('--vv-bottom', `${s.bottom}px`);
    });
  };

  const check = () => {
    const s = sample();
    if (s.offsetTop <= 1) {
      nudged = false;
      return;
    }
    if (nudged || s.typing || Math.abs(s.scale - 1) > 0.01) return;
    nudged = true;
    viewportStats.nudges++;
    window.scrollBy(0, 1);
    requestAnimationFrame(() => {
      window.scrollBy(0, -1);
      apply();
    });
  };

  const settle = () => {
    apply();
    clearTimeout(timer);
    timer = window.setTimeout(check, 250);
  };

  window.addEventListener('scroll', settle, { passive: true });
  window.addEventListener('resize', settle);
  document.addEventListener('focusout', settle);
  document.addEventListener('visibilitychange', settle);
  vv.addEventListener('resize', settle);
  vv.addEventListener('scroll', settle);
  settle();
}
