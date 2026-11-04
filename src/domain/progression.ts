// Двойная прогрессия — SPEC 5.2.

import type { Exercise, Kg100, LocalDate } from '../db/types';
import { formatKg, NBSP } from './format';
import { increaseWeight, reduceWeight, roundWeight } from './weights';

export interface HistoryEntry {
  date: LocalDate;
  isDeload: boolean;
  isCalibration: boolean;
  /** Рабочие подходы по порядку. Для упражнений на время reps — секунды. */
  sets: { weight: Kg100; reps: number }[];
}

export interface ProgressionInput {
  exercise: Pick<Exercise, 'equipment' | 'unit'>;
  /** Подходов сегодня (уже с учётом фазы и разгрузки). */
  sets: number;
  /** Подходов по программе без разгрузки — сколько нужно, чтобы засчитать «все на максимуме». */
  normalSets: number;
  repMin: number;
  repMax: number;
  step: number;
  /** Прошлые сессии упражнения, от старых к новым. */
  history: readonly HistoryEntry[];
  isDeload: boolean;
  isCalibration: boolean;
}

export type SuggestionMode = 'manual' | 'progress' | 'hold' | 'stall' | 'deload';

export interface Suggestion {
  mode: SuggestionMode;
  /** null — вес вводит пользователь. Для упражнений без веса — 0. */
  weight: Kg100 | null;
  /** Цель повторов (или секунд) по подходам. */
  targets: number[];
  reason: string;
}

export const STALL_TEXT = 'Вес стоит 3 тренировки. Снизим на 10% и наберём заново';
export const MANUAL_TEXT = 'Возьми вес, с которым легко сделаешь 12';

function repsList(entry: HistoryEntry, unit: Exercise['unit']): string {
  const s = entry.sets.map((x) => x.reps).join(' / ');
  return unit === 'seconds' ? `${s}${NBSP}с` : s;
}

const fill = (n: number, v: number) => Array.from({ length: n }, () => v);
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
const topWeight = (e: HistoryEntry) => Math.max(0, ...e.sets.map((s) => s.weight));

export function suggest(input: ProgressionInput): Suggestion {
  return input.exercise.unit === 'kg' ? suggestWeighted(input) : suggestValue(input);
}

function suggestWeighted(input: ProgressionInput): Suggestion {
  const { exercise, sets, repMin, repMax, step, isDeload } = input;
  const eq = exercise.equipment;
  const history = input.history.filter((e) => e.sets.length > 0);
  if (input.isCalibration || history.length === 0) {
    return { mode: 'manual', weight: null, targets: fill(sets, repMax), reason: MANUAL_TEXT };
  }

  const normal = history.filter((e) => !e.isDeload);
  const last = normal[normal.length - 1];
  // Только разгрузочные сессии в истории: восстанавливаем рабочий вес из × 0,8.
  const baseWeight = last ? topWeight(last) : roundWeight(eq, topWeight(history[history.length - 1]!) / 0.8);

  if (isDeload) {
    return {
      mode: 'deload',
      weight: reduceWeight(eq, baseWeight, 0.8, false),
      targets: fill(sets, repMin),
      reason: `Разгрузка: ${sets} × ${repMin}, вес × 0,8 — без прогрессии`,
    };
  }
  if (!last) return { mode: 'hold', weight: baseWeight, targets: fill(sets, repMin), reason: 'После разгрузки — рабочий вес' };

  const required = Math.min(input.normalSets, 3);
  const allMax = last.sets.length >= required && last.sets.every((s) => s.reps >= repMax);
  if (allMax) {
    const weight = increaseWeight(eq, baseWeight, step);
    return {
      mode: 'progress',
      weight,
      targets: fill(sets, repMin),
      reason: `+${formatKg(weight - baseWeight)}: в прошлый раз ${repsList(last, 'kg')}`,
    };
  }

  const recent = normal.slice(-3);
  if (recent.length === 3 && recent.every((e) => topWeight(e) === baseWeight)) {
    const [s0, s1, s2] = recent.map((e) => sum(e.sets.map((s) => s.reps))) as [number, number, number];
    if (s1 <= s0 && s2 <= s0) {
      return { mode: 'stall', weight: reduceWeight(eq, baseWeight, 0.9), targets: fill(sets, repMin), reason: STALL_TEXT };
    }
  }

  return { mode: 'hold', weight: baseWeight, targets: plusOne(last, sets, repMin, repMax), reason: `Цель +1 повтор: в прошлый раз ${repsList(last, 'kg')}` };
}

/** Повторы прошлого раза, +1 в подходе, где меньше всего. */
function plusOne(last: HistoryEntry, sets: number, repMin: number, repMax: number): number[] {
  const prev = last.sets.map((s) => s.reps);
  const targets = Array.from({ length: sets }, (_, i) => Math.min(repMax, Math.max(repMin, prev[i] ?? repMin)));
  let minI = 0;
  targets.forEach((t, i) => {
    if (t < targets[minI]!) minI = i;
  });
  if (targets[minI]! < repMax) targets[minI] = targets[minI]! + 1;
  return targets;
}

/**
 * Упражнения на время и на повторы без веса: цель — значение в подходе.
 * Все подходы на цели или выше → цель + шаг; 3 сессии подряд без выполнения → цель × 0,9.
 * Цель восстанавливается по всей истории, поэтому её не нужно хранить.
 */
function suggestValue(input: ProgressionInput): Suggestion {
  const { exercise, sets, repMin, step, isDeload } = input;
  const unit = exercise.unit;
  const suffix = unit === 'seconds' ? `${NBSP}с` : '';
  const history = input.history.filter((e) => e.sets.length > 0 && !e.isDeload);
  if (input.isCalibration || history.length === 0) {
    return { mode: 'manual', weight: 0, targets: fill(sets, repMin), reason: 'Сделай, сколько сможешь, с запасом' };
  }

  const required = Math.min(input.normalSets, 3);
  const roundTo = unit === 'seconds' ? 5 : 1;
  let target: number | null = null;
  let misses = 0;
  let mode: SuggestionMode = 'hold';
  for (const e of history) {
    const values = e.sets.map((s) => s.reps);
    if (target === null) {
      target = Math.max(repMin, Math.min(...values));
      mode = 'hold';
      continue;
    }
    if (values.length >= required && values.every((v) => v >= target!)) {
      target += step;
      misses = 0;
      mode = 'progress';
    } else if (++misses >= 3) {
      target = Math.max(repMin, Math.round((target * 0.9) / roundTo) * roundTo);
      misses = 0;
      mode = 'stall';
    } else {
      mode = 'hold';
    }
  }
  const last = history[history.length - 1]!;
  const t = target!;
  if (isDeload) return { mode: 'deload', weight: 0, targets: fill(sets, t), reason: `Разгрузка: ${sets} подхода, без прогрессии` };
  const reason =
    mode === 'progress'
      ? `+${step}${suffix}: в прошлый раз ${repsList(last, unit)}`
      : mode === 'stall'
        ? 'Цель стоит 3 тренировки. Снизим на 10% и наберём заново'
        : `Цель ${t}${suffix}: в прошлый раз ${repsList(last, unit)}`;
  return { mode, weight: 0, targets: fill(sets, t), reason };
}
