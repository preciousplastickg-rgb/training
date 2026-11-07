// Двойная прогрессия — SPEC 5.2. История — по упражнению (exerciseId), слот и блок не важны.

import type { Exercise, Kg100, LocalDate } from '../db/types';
import { formatKg, NBSP } from './format';
import { increaseWeight, reduceWeight, roundWeight } from './weights';

export interface HistoryEntry {
  date: LocalDate;
  isDeload: boolean;
  isCalibration: boolean;
  /** Рабочие подходы по порядку. Для упражнений на время reps — секунды, для гравитрона weight — противовес. */
  sets: { weight: Kg100; reps: number }[];
}

export interface ProgressionInput {
  exercise: Pick<Exercise, 'equipment' | 'unit'> & { id?: string };
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

/** 'switch' — противовес гравитрона дошёл до 0: пора на своё упражнение (SPEC 5.2 п. 8). */
export type SuggestionMode = 'manual' | 'progress' | 'hold' | 'stall' | 'deload' | 'switch';

export interface Suggestion {
  mode: SuggestionMode;
  /** null — вес вводит пользователь. Для упражнений без веса — 0. Для гравитрона — противовес. */
  weight: Kg100 | null;
  /** Цель повторов (или секунд) по подходам. */
  targets: number[];
  reason: string;
  /** Для 'switch': на какое упражнение переключиться. */
  switchTo?: string;
}

export const STALL_TEXT = 'Вес стоит 3 тренировки. Снизим на 10% и наберём заново';
export const MANUAL_TEXT = 'Возьми вес, с которым легко сделаешь 12';
export const MANUAL_ASSIST_TEXT = 'Подбери противовес, с которым легко сделаешь 12';
export const ASSIST_STALL_TEXT = 'Стоит 3 тренировки. Добавим 5 кг противовеса и наберём заново';

/** Гравитрон: куда переключаться, когда противовес дошёл до 0. */
export const ASSIST_SWITCH: Record<string, string> = { pullup_assisted: 'pullup', chinup_assisted: 'pullup', dip_assisted: 'dip' };
export const ASSIST_STEP = 500;

function repsList(entry: HistoryEntry, unit: Exercise['unit']): string {
  const s = entry.sets.map((x) => x.reps).join(' / ');
  return unit === 'seconds' ? `${s}${NBSP}с` : s;
}

const fill = (n: number, v: number) => Array.from({ length: n }, () => v);
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
const topWeight = (e: HistoryEntry) => Math.max(0, ...e.sets.map((s) => s.weight));
const minWeight = (e: HistoryEntry) => Math.min(...e.sets.map((s) => s.weight));

export function suggest(input: ProgressionInput): Suggestion {
  if (input.exercise.unit === 'kg') return suggestWeighted(input);
  if (input.exercise.unit === 'assist_kg') return suggestAssisted(input);
  return suggestValue(input);
}

function suggestWeighted(input: ProgressionInput): Suggestion {
  const { exercise, sets, repMin, repMax, step, isDeload } = input;
  const eq = exercise;
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

/**
 * Гравитрон (SPEC 5.2 п. 8): вес — противовес, прогресс = уменьшение. Все рабочие подходы ≥ repMax → −5 кг;
 * противовес 0 и снова ≥ repMax → «переключить на своё упражнение»; застой 3 сессии → +5 кг вместо «× 0,9».
 */
function suggestAssisted(input: ProgressionInput): Suggestion {
  const { exercise, sets, repMin, repMax, isDeload } = input;
  const history = input.history.filter((e) => e.sets.length > 0);
  if (input.isCalibration || history.length === 0) {
    return { mode: 'manual', weight: null, targets: fill(sets, repMax), reason: MANUAL_ASSIST_TEXT };
  }
  const normal = history.filter((e) => !e.isDeload);
  const last = normal[normal.length - 1];
  // В разгрузку противовес больше (легче); база — последняя обычная сессия, иначе разгрузочная минус её прибавка.
  const base = last ? minWeight(last) : Math.max(0, minWeight(history[history.length - 1]!) - ASSIST_STEP);
  if (isDeload) {
    return { mode: 'deload', weight: base + ASSIST_STEP, targets: fill(sets, repMin), reason: `Разгрузка: ${sets} × ${repMin}, противовес +5 кг — без прогрессии` };
  }
  if (!last) return { mode: 'hold', weight: base, targets: fill(sets, repMin), reason: 'После разгрузки — рабочий противовес' };

  const required = Math.min(input.normalSets, 3);
  const allMax = last.sets.length >= required && last.sets.every((s) => s.reps >= repMax);
  if (allMax) {
    if (base <= 0) {
      const to = exercise.id ? ASSIST_SWITCH[exercise.id] : undefined;
      return {
        mode: 'switch', weight: 0, targets: fill(sets, repMin),
        reason: `${to === 'dip' ? 'Отжимаешься сам' : 'Подтягиваешься сам'} — переключить на ${to === 'dip' ? 'брусья' : 'подтягивания'}?`,
        ...(to ? { switchTo: to } : {}),
      };
    }
    const weight = Math.max(0, base - ASSIST_STEP);
    return { mode: 'progress', weight, targets: fill(sets, repMin), reason: `Противовес −${formatKg(base - weight)}: в прошлый раз ${repsList(last, 'kg')}` };
  }
  const recent = normal.slice(-3);
  if (recent.length === 3 && recent.every((e) => minWeight(e) === base)) {
    const [s0, s1, s2] = recent.map((e) => sum(e.sets.map((s) => s.reps))) as [number, number, number];
    if (s1 <= s0 && s2 <= s0) return { mode: 'stall', weight: base + ASSIST_STEP, targets: fill(sets, repMin), reason: ASSIST_STALL_TEXT };
  }
  return { mode: 'hold', weight: base, targets: plusOne(last, sets, repMin, repMax), reason: `Цель +1 повтор: в прошлый раз ${repsList(last, 'kg')}` };
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
