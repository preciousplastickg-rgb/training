// Горизонтальная линейка (REDESIGN 4, первый запуск): тик 2 px, шаг 10 px, крупные деления с подписью,
// свайп меняет значение, тап слева/справа от курсора — ±1 шаг. Значения — целые единицы `step`,
// чтобы не копить ошибку плавающей точки (вес в Kg100: step 10 = 0,1 кг).

import { useRef, useState, type PointerEvent } from 'react';

const TICK_GAP = 10;
const VISIBLE = 26;

interface RulerProps {
  value: number;
  min: number;
  max: number;
  step: number;
  /** Крупное деление каждые N шагов — с подписью. */
  majorEvery: number;
  /** Подпись крупного деления. */
  format: (v: number) => string;
  onChange: (v: number) => void;
  label: string;
}

export function Ruler({ value, min, max, step, majorEvery, format, onChange, label }: RulerProps) {
  const count = Math.floor((max - min) / step);
  const index = Math.round((value - min) / step);
  const drag = useRef<{ startX: number; startIndex: number; moved: boolean } | null>(null);
  const [offsetPx, setOffsetPx] = useState(0);

  const commit = (i: number) => onChange(min + Math.min(count, Math.max(0, i)) * step);

  const down = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = { startX: e.clientX, startIndex: index, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    if (Math.abs(dx) > 3) d.moved = true;
    if (!d.moved) return;
    // Линейка едет за пальцем: вправо — значения меньше.
    const steps = Math.round(-dx / TICK_GAP);
    const next = Math.min(count, Math.max(0, d.startIndex + steps));
    if (next !== index) commit(next);
    setOffsetPx(-dx - steps * TICK_GAP);
  };
  const up = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    setOffsetPx(0);
    if (!d) return;
    if (!d.moved) {
      const rect = e.currentTarget.getBoundingClientRect();
      commit(index + (e.clientX < rect.left + rect.width / 2 ? -1 : 1));
    }
  };

  const ticks: { i: number; major: boolean }[] = [];
  for (let i = Math.max(0, index - VISIBLE); i <= Math.min(count, index + VISIBLE); i++) ticks.push({ i, major: i % majorEvery === 0 });

  return (
    <div
      role="slider"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={format(value)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') commit(index - 1);
        if (e.key === 'ArrowRight') commit(index + 1);
      }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      className="relative h-16 touch-none overflow-hidden outline-none select-none"
    >
      <div className="absolute top-0 left-1/2 z-10 h-11 w-1 -translate-x-1/2 rounded-sm bg-ink" aria-hidden />
      <div className="absolute top-1 left-1/2" style={{ transform: `translateX(${-index * TICK_GAP - offsetPx - 1}px)` }} aria-hidden>
        {ticks.map(({ i, major }) => (
          <span
            key={i}
            className="absolute top-0 w-0.5 rounded-px"
            style={{
              left: i * TICK_GAP,
              height: major ? 30 : 18,
              background: i === index ? 'var(--ink)' : major ? 'var(--muted)' : 'color-mix(in srgb, var(--muted) 45%, var(--bg))',
            }}
          >
            {major && (
              <span className="absolute top-[38px] left-1/2 w-10 -translate-x-1/2 text-center text-[11px] font-bold text-muted tabular-nums">
                {format(min + i * step)}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
