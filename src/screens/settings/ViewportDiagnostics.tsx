import { useEffect, useState } from 'react';
import { isStandalone, viewportStats } from '../../app/viewport';

interface Info {
  rows: [string, string][];
}

function insets(): { top: number; bottom: number } {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const out = { top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0 };
  probe.remove();
  return out;
}

function read(): Info {
  const vv = window.visualViewport;
  const root = document.documentElement;
  const nav = document.querySelector('nav[aria-label="Основное меню"]')?.getBoundingClientRect();
  const ins = insets();
  const r = (n: number | undefined) => (n === undefined ? '—' : String(Math.round(n)));
  const style = getComputedStyle(root);
  return {
    rows: [
      ['Режим', isStandalone() ? 'на экране «Домой»' : 'в браузере'],
      ['Экран', `${screen.width} × ${screen.height}`],
      ['Окно (innerHeight)', r(window.innerHeight)],
      ['Раскладка (clientHeight)', r(root.clientHeight)],
      ['Видимая область', vv ? `${r(vv.height)}, смещение ${r(vv.offsetTop)}, масштаб ${vv.scale.toFixed(2)}` : '—'],
      ['Прокрутка', `${r(window.scrollY)} из ${r(root.scrollHeight - root.clientHeight)}`],
      ['Отступы (safe area)', `сверху ${r(ins.top)}, снизу ${r(ins.bottom)}`],
      ['Низ меню', nav ? `${r(nav.bottom)} (до низа окна ${r(window.innerHeight - nav.bottom)})` : '—'],
      ['Поправка', `шапка ${style.getPropertyValue('--vv-top') || '0px'}, меню ${style.getPropertyValue('--vv-bottom') || '0px'}, толчков ${viewportStats.nudges}`],
    ],
  };
}

/** Размеры области экрана на этом телефоне — чтобы по снимку понять, какой баг iOS сработал. */
export function ViewportDiagnostics() {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<Info | null>(null);
  useEffect(() => {
    if (!open) return;
    setInfo(read());
    const id = setInterval(() => setInfo(read()), 500);
    return () => clearInterval(id);
  }, [open]);
  return (
    <details className="mt-2" onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="flex min-h-11 cursor-pointer items-center text-accent">Диагностика экрана</summary>
      {info && (
        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xl bg-surface-2 p-3 text-xs">
          {info.rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{k}</dt>
              <dd className="tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </details>
  );
}
