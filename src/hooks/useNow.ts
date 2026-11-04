import { useEffect, useState } from 'react';

/**
 * Текущее время для перерисовки (таймеры). Время всегда берётся из Date.now(),
 * интервал лишь будит рендер; при возврате в приложение — сразу пересчёт.
 */
export function useNow(intervalMs = 250, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
    };
  }, [intervalMs, enabled]);
  return now;
}
