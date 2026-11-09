import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Handle, ViewConfig } from '../../three/engine';

/**
 * Место для общего канваса двойника (docs/TWIN-3D.md, 3): при монтировании канвас переезжает сюда, при размонтировании —
 * обратно к предыдущему месту. three.js грузится динамически. Нет WebGL, потерян контекст или не загрузился клип —
 * `fallback` (статичные кадры). В dev-сборке в углу — счётчик FPS (приёмка TWIN-3D 9).
 */
export function TwinView({ config, fallback, label, className = '' }: { config: ViewConfig; fallback: ReactNode; label: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const handle = useRef<Handle | null>(null);
  const cfg = useRef(config);
  cfg.current = config;
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [fps, setFps] = useState(0);
  const key = JSON.stringify(config);

  useEffect(() => {
    let alive = true;
    let offFps: (() => void) | undefined;
    import('../../three/engine')
      .then((m) => m.getEngine())
      .then((engine) => {
        if (!alive || !ref.current) return;
        handle.current = engine.push(ref.current, cfg.current, { onLost: () => setState('failed'), onError: () => setState('failed') });
        if (import.meta.env.DEV) offFps = engine.onFps(setFps);
        setState('ready');
      })
      .catch(() => alive && setState('failed'));
    return () => {
      alive = false;
      offFps?.();
      handle.current?.release();
      handle.current = null;
    };
  }, []);

  useEffect(() => {
    handle.current?.update(cfg.current);
  }, [key]);

  if (state === 'failed') return <>{fallback}</>;
  return (
    <div ref={ref} role="img" aria-label={label} className={`relative overflow-hidden ${className}`} data-twin={state}>
      {state === 'loading' && <span className="absolute inset-0 grid place-items-center text-sm text-muted">Загрузка 3D…</span>}
      {import.meta.env.DEV && state === 'ready' && (
        <span className="pointer-events-none absolute top-1 right-2 z-10 text-[11px] font-bold text-muted tabular-nums" data-testid="fps">
          {Math.round(fps)} FPS
        </span>
      )}
    </div>
  );
}
