// Свои SVG-графики (SPEC 2: без библиотек графиков).

import { useLayoutEffect, useRef, useState } from 'react';

function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(320);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setW(Math.max(200, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export interface LinePoint {
  x: number;
  y: number | null;
}

export interface LineSeries {
  points: LinePoint[];
  color: string;
  kind: 'line' | 'dots' | 'dashed';
  width?: number;
  /** Радиус точки для kind: 'dots' (по умолчанию 2.6) и её непрозрачность. */
  dotR?: number;
  opacity?: number;
  label: string;
}

export interface HLine {
  y: number;
  color: string;
  label?: string;
}

export interface Marker {
  x: number;
  y: number;
  color: string;
  label: string;
  /** Залитый ромб (пройденная контрольная точка) или контурный. */
  filled?: boolean;
}

export interface ChartTheme {
  grid: string;
  text: string;
  /** Заливка контурных маркеров и конечной точки. */
  surface: string;
}

const LIGHT: ChartTheme = { grid: 'var(--line)', text: 'var(--muted)', surface: 'var(--surface)' };

export function LineChart({
  series, hlines = [], markers = [], xLabels = [], height = 200, yFormat = (v: number) => String(v), ariaLabel, yPad = 0.08, theme = LIGHT, endDot, xMax,
}: {
  series: LineSeries[];
  hlines?: HLine[];
  markers?: Marker[];
  xLabels?: { x: number; label: string }[];
  height?: number;
  yFormat?: (v: number) => string;
  ariaLabel: string;
  yPad?: number;
  theme?: ChartTheme;
  /** Кольцо на последней точке: центр — surface темы, обводка — color. */
  endDot?: { x: number; y: number; color: string };
  /** Расширить ось X вправо (прогноз). */
  xMax?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const ys = [
    ...series.flatMap((s) => s.points.map((p) => p.y).filter((y): y is number => y !== null)),
    ...hlines.map((h) => h.y),
    ...markers.map((m) => m.y),
  ];
  const xs = series.flatMap((s) => s.points.map((p) => p.x)).concat(markers.map((m) => m.x));
  if (ys.length === 0 || xs.length === 0) return <div ref={ref} />;
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  const span = Math.max(1, maxY - minY);
  minY -= span * yPad;
  maxY += span * yPad;
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs, minX + 1, xMax ?? minX);
  const L = 30;
  const R = 8;
  const T = 10;
  const B = 22;
  const px = (x: number) => L + ((x - minX) / (maxX - minX)) * (width - L - R);
  const py = (y: number) => T + (1 - (y - minY) / (maxY - minY)) * (height - T - B);
  const ticks = [0, 0.5, 1].map((k) => minY + (maxY - minY) * k);
  return (
    <div ref={ref}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={L} x2={width - R} y1={py(t)} y2={py(t)} stroke={theme.grid} />
            <text x={0} y={py(t) + 4} fontSize={11} fill={theme.text}>
              {yFormat(t)}
            </text>
          </g>
        ))}
        {xLabels.map((l, i) => (
          <text key={l.x} x={px(l.x)} y={height - 6} fontSize={11} textAnchor={i === 0 && xLabels.length > 1 ? 'start' : i === xLabels.length - 1 && xLabels.length > 1 ? 'end' : 'middle'} fill={theme.text}>
            {l.label}
          </text>
        ))}
        {hlines.map((h, i) => (
          <g key={i}>
            <line x1={L} x2={width - R} y1={py(h.y)} y2={py(h.y)} stroke={h.color} strokeDasharray="5 4" strokeWidth={1.5} opacity={0.8} />
            {h.label && (
              <text x={width - R - 2} y={py(h.y) - 5} fontSize={11} fontWeight={700} textAnchor="end" fill={h.color}>
                {h.label}
              </text>
            )}
          </g>
        ))}
        {series.map((s, i) =>
          s.kind === 'dots' ? (
            <g key={i} fill={s.color}>
              {s.points.map((p) => p.y !== null && <circle key={p.x} cx={px(p.x)} cy={py(p.y)} r={s.dotR ?? 2.6} opacity={s.opacity ?? 0.55} />)}
            </g>
          ) : (
            <path
              key={i}
              d={pathOf(s.points, px, py)}
              fill="none"
              stroke={s.color}
              strokeWidth={s.width ?? 2.5}
              strokeDasharray={s.kind === 'dashed' ? '3 5' : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ),
        )}
        {markers.map((m, i) => (
          <g key={i} transform={`translate(${px(m.x)} ${py(m.y)}) rotate(45)`}>
            <rect x={-4.5} y={-4.5} width={9} height={9} fill={m.filled ? m.color : theme.surface} stroke={m.color} strokeWidth={1.5} />
            <title>{m.label}</title>
          </g>
        ))}
        {endDot && <circle cx={px(endDot.x)} cy={py(endDot.y)} r={7} fill={theme.surface} stroke={endDot.color} strokeWidth={3.5} />}
      </svg>
    </div>
  );
}

function pathOf(points: LinePoint[], px: (x: number) => number, py: (y: number) => number): string {
  let d = '';
  let pen = false;
  for (const p of points) {
    if (p.y === null) {
      pen = false;
      continue;
    }
    d += `${pen ? 'L' : 'M'}${px(p.x).toFixed(1)} ${py(p.y).toFixed(1)}`;
    pen = true;
  }
  return d;
}

export function Sparkline({ values, color = 'var(--progress)', width = 90, height = 28, label }: { values: number[]; color?: string; width?: number; height?: number; label: string }) {
  if (values.length < 2) return <span className="text-xs text-muted">—</span>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${((i / (values.length - 1)) * (width - 4) + 2).toFixed(1)} ${(height - 3 - ((v - min) / span) * (height - 6)).toFixed(1)}`).join('');
  return (
    <svg width={width} height={height} role="img" aria-label={label}>
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BarChart({
  bars, target, height = 180, ariaLabel, format = (v: number) => String(v), okColor = 'var(--progress)',
}: {
  bars: { label: string; value: number; ok: boolean }[];
  target: { value: number; label: string }[];
  height?: number;
  ariaLabel: string;
  format?: (v: number) => string;
  /** Цвет столбика «в цели»; «мимо» — всегда --energy. */
  okColor?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const max = Math.max(1, ...bars.map((b) => b.value), ...target.map((t) => t.value)) * 1.1;
  const L = 8;
  const B = 20;
  const T = 14;
  const slot = (width - L * 2) / Math.max(1, bars.length);
  const py = (v: number) => T + (1 - v / max) * (height - T - B);
  return (
    <div ref={ref}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel}>
        {bars.map((b, i) => {
          const x = L + i * slot + slot * 0.18;
          const w = slot * 0.64;
          return (
            <g key={i}>
              <rect x={x} y={py(b.value)} width={w} height={height - B - py(b.value)} rx={4} fill={b.ok ? okColor : 'var(--energy)'} opacity={b.value ? 0.9 : 0.2} />
              <text x={x + w / 2} y={height - 6} fontSize={10} textAnchor="middle" fill="var(--muted)">
                {b.label}
              </text>
            </g>
          );
        })}
        {target.length > 0 && (
          <path
            d={target.map((t, i) => `${i ? 'L' : 'M'}${L + i * slot + 2} ${py(t.value)}H${L + (i + 1) * slot - 2}`).join('')}
            fill="none"
            stroke="var(--ink)"
            strokeDasharray="4 3"
            strokeWidth={1.5}
          />
        )}
        {/* Подписи значений — после линии цели и с обводкой цветом карточки: пунктир их не перечёркивает. */}
        {bars.length <= 10 &&
          bars.map((b, i) =>
            b.value > 0 ? (
              <text
                key={i}
                x={L + i * slot + slot / 2}
                y={py(b.value) - 3}
                fontSize={9}
                textAnchor="middle"
                fill="var(--muted)"
                stroke="var(--surface)"
                strokeWidth={3}
                strokeLinejoin="round"
                paintOrder="stroke"
              >
                {format(b.value)}
              </text>
            ) : null,
          )}
      </svg>
    </div>
  );
}
