// Силуэт прогресса — SPEC 6.7.3. Нейтральный силуэт спереди, свой SVG.

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { DEFAULT_SETTINGS } from '../../db/db';
import { kvGet, kvSet } from '../../db/repo';
import { easeInOut } from '../../domain/pose';
import {
  factorsFrom, lerpParams, outlinePath, paramsFrom, rightHalf, SIL_H, SIL_W, START_FACTORS, type SilhouetteFactors, type SilhouetteParams,
} from '../../domain/silhouette';
import { useAllSets, useBody, useSessions, useSettings } from '../../hooks/useData';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const CX = SIL_W / 2;

export function useSilhouetteFactors(): SilhouetteFactors {
  const body = useBody();
  const sets = useAllSets();
  const sessions = useSessions();
  const settings = useSettings() ?? DEFAULT_SETTINGS;
  return useMemo(() => factorsFrom(body, sets, sessions, settings.heightCm, settings.targetBodyFat), [body, sets, sessions, settings.heightCm, settings.targetBodyFat]);
}

const mix = (f: number) => `color-mix(in srgb, var(--strength-b) ${Math.round(f * 100)}%, var(--strength-a))`;

/** 600 мс от прошлого просмотра к текущему (SPEC 6.7.3). */
function useAnimatedParams(target: SilhouetteParams, remember: boolean): SilhouetteParams {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(target);
  const key = JSON.stringify(target);
  const started = useRef(false);
  useEffect(() => {
    let raf = 0;
    let cancelled = false;
    void (async () => {
      const from = (remember ? await kvGet<SilhouetteParams>('silhouette:last') : undefined) ?? target;
      if (cancelled) return;
      if (remember) void kvSet('silhouette:last', target);
      if (reduced || started.current) {
        setShown(target);
        return;
      }
      started.current = true;
      const t0 = performance.now();
      const loop = (now: number) => {
        const t = Math.min(1, (now - t0) / 600);
        setShown(lerpParams(from, target, easeInOut(t)));
        if (t < 1) raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
    // Перезапуск только при смене целевых параметров.
  }, [key]);
  return shown;
}

function Overlays({ p }: { p: SilhouetteParams }) {
  const s = p.S / 2;
  const a = p.A;
  const off = (y: number) => (y - 52) * 0.2;
  const g = p.groups;
  const both = (x: number, y: number, rx: number, ry: number, fill: string, rot = 0, opacity = 1) =>
    [1, -1].map((side) => (
      <ellipse key={side} cx={CX + side * x} cy={y} rx={rx} ry={ry} fill={fill} opacity={opacity} transform={rot ? `rotate(${side * rot} ${CX + side * x} ${y})` : undefined} />
    ));
  return (
    <g>
      {both(s * 0.45, 68, s * 0.42, 9.5, mix(g.chest))}
      {both(s + a * 0.12, 60, a * 0.36, 9.5, mix(g.delts), 20)}
      {both(s + a * 0.02 + off(86), 86, a * 0.24, 12, mix(g.biceps), -8)}
      {both(s + off(124) + a * 0.0, 124, a * 0.2, 12, mix(g.forearms), -10)}
      {both((p.T / 2) * 0.55, 176, p.T * 0.19, 21, mix(g.quads), 6)}
      {both(p.H / 2 - 7, 220, 5.2, 13, mix(g.calves))}
      {/* Пресс и косые — по % жира */}
      {[90, 102, 114].map((y) =>
        [1, -1].map((side) => <rect key={`${y}${side}`} x={side > 0 ? CX + 1 : CX - 9} y={y} width={8} height={10} rx={3} fill="var(--strength-b)" opacity={p.abs * 0.75} />),
      )}
      {both(p.W / 2 - 5, 106, 3.5, 12, 'var(--strength-b)', -12, p.abs * 0.6)}
    </g>
  );
}

interface SilhouetteProps {
  factors: SilhouetteFactors;
  size?: number;
  compare?: boolean;
  callouts?: { shoulders: string; waist: string; legs: string } | null;
  remember?: boolean;
}

export function Silhouette({ factors, size = 260, compare = false, callouts = null, remember = true }: SilhouetteProps) {
  const gid = useId().replace(/:/g, '');
  const target = paramsFrom(factors);
  const p = useAnimatedParams(target, remember);
  const start = paramsFrom(START_FACTORS);
  const width = (size * SIL_W) / SIL_H;
  const pad = callouts ? 70 : 0;
  const right = rightHalf(p);
  const shoulder = right[6]!;
  const waist = right[17]!;
  const thigh = right[19]!;
  return (
    <svg viewBox={`${-pad} 0 ${SIL_W + pad * 2} ${SIL_H}`} width={width + (pad * 2 * size) / SIL_H} height={size} role="img" aria-label="Силуэт прогресса">
      <defs>
        <linearGradient id={gid} x1="0" x2="1">
          <stop offset="0" stopColor="var(--body-a)" />
          <stop offset="0.5" stopColor="var(--body-b)" />
          <stop offset="1" stopColor="var(--body-a)" />
        </linearGradient>
      </defs>
      <path d={outlinePath(p)} fill={`url(#${gid})`} stroke="var(--body-line)" strokeWidth={0.8} />
      <Overlays p={p} />
      {compare && <path d={outlinePath(start)} fill="none" stroke="var(--ink)" strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />}
      {callouts && (
        <g fontSize={9} fill="var(--ink)">
          <Callout from={[CX + shoulder[0], shoulder[1]]} to={[SIL_W + pad - 4, 40]} text={callouts.shoulders} anchor="end" />
          <Callout from={[CX - waist[0], waist[1]]} to={[-pad + 4, waist[1]]} text={callouts.waist} anchor="start" />
          <Callout from={[CX + thigh[0], thigh[1] + 10]} to={[SIL_W + pad - 4, 180]} text={callouts.legs} anchor="end" />
        </g>
      )}
    </svg>
  );
}

function Callout({ from, to, text, anchor }: { from: [number, number]; to: [number, number]; text: string; anchor: 'start' | 'end' }) {
  return (
    <g>
      <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke="var(--muted)" strokeWidth={0.8} strokeDasharray="2 2" />
      <circle cx={from[0]} cy={from[1]} r={1.6} fill="var(--accent)" />
      <text x={to[0]} y={to[1] - 4} textAnchor={anchor} fontWeight={600}>
        {text}
      </text>
    </g>
  );
}

/** Маленькая версия 120 px для «Сегодня». */
export function SilhouetteMini() {
  const factors = useSilhouetteFactors();
  return (
    <div className="shrink-0" aria-hidden>
      <Silhouette factors={factors} size={120} remember={false} />
    </div>
  );
}
