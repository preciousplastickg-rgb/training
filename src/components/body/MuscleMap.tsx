// Карта мышц — SPEC 6.7.1. Полигоны body-highlighter, свой React-компонент.

import { useState } from 'react';
import { EXERCISES, MUSCLE_NAMES } from '../../data/exercises';
import { MUSCLE_SLUGS } from '../../data/anatomy';
import { anteriorData, posteriorData, type MapSlug } from '../../data/muscleMap';
import type { Muscle } from '../../db/types';

export { MUSCLE_SLUGS };

const NEUTRAL: MapSlug[] = ['head', 'knees'];

export type MuscleColors = Partial<Record<Muscle, string>>;

/** Для упражнения: основные — primary, помогающие — secondary. */
export function exerciseColors(primary: readonly Muscle[], secondary: readonly Muscle[]): MuscleColors {
  const out: MuscleColors = {};
  for (const m of secondary) out[m] = 'var(--m-secondary)';
  for (const m of primary) out[m] = 'var(--m-primary)';
  return out;
}

function slugColors(colors: MuscleColors): { fill: Map<MapSlug, string>; glow: Set<MapSlug>; owner: Map<MapSlug, Muscle> } {
  const fill = new Map<MapSlug, string>();
  const glow = new Set<MapSlug>();
  const owner = new Map<MapSlug, Muscle>();
  // Сначала помогающие, затем основные — основная мышца перекрывает общий полигон.
  const entries = Object.entries(colors) as [Muscle, string][];
  entries.sort(([, a], [, b]) => (a === 'var(--m-primary)' ? 1 : 0) - (b === 'var(--m-primary)' ? 1 : 0));
  for (const [m, c] of entries) {
    for (const s of MUSCLE_SLUGS[m]) {
      fill.set(s, c);
      owner.set(s, m);
      if (c === 'var(--m-primary)') glow.add(s);
    }
  }
  return { fill, glow, owner };
}

/** Слаг → наша мышца для подсказки по тапу, даже если она не подсвечена. */
const SLUG_TO_MUSCLE: Partial<Record<MapSlug, Muscle>> = {
  chest: 'chest', 'front-deltoids': 'front_delt', 'back-deltoids': 'rear_delt', 'upper-back': 'lats', trapezius: 'upper_back',
  neck: 'upper_back', biceps: 'biceps', triceps: 'triceps', abs: 'abs', obliques: 'abs', 'lower-back': 'lower_back',
  gluteal: 'glutes', quadriceps: 'quads', hamstring: 'hamstrings', calves: 'calves', 'left-soleus': 'calves', 'right-soleus': 'calves',
};

export function exercisesFor(muscle: Muscle): string[] {
  return EXERCISES.filter((e) => e.muscles.primary.includes(muscle) || e.muscles.secondary.includes(muscle)).map((e) => e.name.toLowerCase());
}

interface MuscleMapProps {
  view: 'front' | 'back';
  colors: MuscleColors;
  onMuscleTap?: (m: Muscle) => void;
  width?: number;
  glow?: boolean;
}

export function MuscleMap({ view, colors, onMuscleTap, width = 130, glow = true }: MuscleMapProps) {
  const data = view === 'front' ? anteriorData : posteriorData;
  const { fill, glow: glowSet } = slugColors(colors);
  return (
    <svg viewBox="0 0 100 220" width={width} height={(width * 220) / 100} role="img" aria-label={view === 'front' ? 'Карта мышц спереди' : 'Карта мышц сзади'}>
      {data.map((group, gi) =>
        group.svgPoints.map((pts, pi) => {
          const slug = group.muscle;
          const f = fill.get(slug) ?? (NEUTRAL.includes(slug) ? 'var(--m-outline)' : 'var(--m-idle)');
          const m = SLUG_TO_MUSCLE[slug];
          return (
            <polygon
              key={`${gi}-${pi}`}
              points={pts}
              fill={f}
              stroke="var(--surface)"
              strokeWidth={0.7}
              strokeLinejoin="round"
              style={glow && glowSet.has(slug) ? { filter: 'drop-shadow(0 0 4px var(--m-glow))' } : undefined}
              onClick={m && onMuscleTap ? () => onMuscleTap(m) : undefined}
              className={m && onMuscleTap ? 'cursor-pointer' : undefined}
            />
          );
        }),
      )}
    </svg>
  );
}

/** Две карты рядом 130 × 286, подписи «Спереди» / «Сзади», подсказка по тапу. */
export function MuscleMapPair({ colors, legend = true, width = 130 }: { colors: MuscleColors; legend?: boolean; width?: number }) {
  const [tip, setTip] = useState<Muscle | null>(null);
  return (
    <div>
      <div className="flex justify-center gap-4">
        {(['front', 'back'] as const).map((v) => (
          <figure key={v} className="flex flex-col items-center">
            <MuscleMap view={v} colors={colors} onMuscleTap={setTip} width={width} />
            <figcaption className="mt-1 text-xs text-muted">{v === 'front' ? 'Спереди' : 'Сзади'}</figcaption>
          </figure>
        ))}
      </div>
      {tip && (
        <p className="mt-2 rounded-xl bg-surface-2 px-3 py-2 text-sm" role="status">
          <b>{MUSCLE_NAMES[tip]}</b> · работает в: {exercisesFor(tip).join(', ') || '—'}
        </p>
      )}
      {legend && (
        <div className="mt-2 flex justify-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <i className="h-3 w-3 rounded-full" style={{ background: 'var(--m-primary)' }} /> Основные
          </span>
          <span className="flex items-center gap-1.5">
            <i className="h-3 w-3 rounded-full" style={{ background: 'var(--m-secondary)' }} /> Помогают
          </span>
        </div>
      )}
    </div>
  );
}
