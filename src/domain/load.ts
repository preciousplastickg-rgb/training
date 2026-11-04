// «Нагрузка за неделю» — SPEC 6.7.1: рабочие подходы за 7 дней, основная мышца = 1, помогающая = 0,5.

import { EXERCISE_BY_ID } from '../data/exercises';
import type { LocalDate, Muscle, SetLog, WorkoutSession } from '../db/types';
import { addDays } from './dates';

export const ALL_MUSCLES: Muscle[] = [
  'chest', 'front_delt', 'side_delt', 'rear_delt', 'lats', 'upper_back', 'biceps', 'triceps', 'abs', 'lower_back', 'glutes', 'quads', 'hamstrings', 'calves',
];

export function weeklyLoad(sets: readonly SetLog[], sessions: readonly WorkoutSession[], today: LocalDate): Record<Muscle, number> {
  const from = addDays(today, -6);
  const ok = new Set(sessions.filter((s) => s.finishedAt !== undefined && s.date >= from && s.date <= today).map((s) => s.id));
  const out = Object.fromEntries(ALL_MUSCLES.map((m) => [m, 0])) as Record<Muscle, number>;
  for (const s of sets) {
    if (s.kind !== 'work' || !ok.has(s.sessionId)) continue;
    const ex = EXERCISE_BY_ID[s.exerciseId];
    if (!ex) continue;
    for (const m of ex.muscles.primary) out[m] += 1;
    for (const m of ex.muscles.secondary) out[m] += 0.5;
  }
  return out;
}

/** Уровни цвета: 0 · 1–5 · 6–9 · 10–20 · больше 20 («перебор»). */
export function loadLevel(n: number): 0 | 1 | 2 | 3 | 4 {
  if (n <= 0) return 0;
  if (n <= 5) return 1;
  if (n < 10) return 2;
  if (n <= 20) return 3;
  return 4;
}

export const LOAD_COLORS = ['var(--m-idle)', 'var(--load-1)', 'var(--load-2)', 'var(--load-3)', 'var(--load-4)'] as const;

/** 3 самые недогруженные мышцы (икры не тренируются отдельно по плану — не в счёт). */
export function underloaded(load: Record<Muscle, number>, n = 3): Muscle[] {
  return ALL_MUSCLES.filter((m) => m !== 'calves')
    .sort((a, b) => load[a] - load[b])
    .slice(0, n);
}
