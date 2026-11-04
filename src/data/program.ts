// Программа — SPEC 3 (план тренировок от 5 ноября 2026).
// Веса и шаги — Kg100; для упражнений на время шаг в секундах, на повторы — в повторах.

import type { Deload, LocalDate, Phase, ProgramSlot } from '../db/types';

export const CALIBRATION_DATE: LocalDate = '2026-11-06';
export const PROGRAM_START: LocalDate = '2026-11-09';
export const PROGRAM_END: LocalDate = '2027-04-30';

export const PHASES: Phase[] = [
  {
    n: 1, name: 'Техника', start: '2026-11-09', end: '2026-12-06',
    kcal: 2050, protein: 155, fat: 65, extraSetExerciseIds: [],
  },
  {
    n: 2, name: 'Жиросжигание', start: '2026-12-07', end: '2027-02-28',
    kcal: 2050, protein: 155, fat: 65, extraSetExerciseIds: [],
  },
  {
    n: 3, name: 'Рельеф', start: '2027-03-01', end: '2027-04-30',
    kcal: 2050, protein: 155, fat: 65,
    extraSetExerciseIds: ['db_row', 'lateral_raise', 'db_shoulder_press', 'lat_pulldown', 'biceps_curl', 'triceps_pushdown'],
  },
];

/** Поддержка для фазы 3 (выбор «поддержка») и для новогодней разгрузки. */
export const MAINTENANCE_KCAL_PHASE3 = 2400;
export const MAINTENANCE_KCAL_DELOAD = 2500;
/** Неделя разгрузки, в которую цель калорий = поддержка (SPEC 5.6). */
export const MAINTENANCE_DELOAD = { start: '2026-12-28', end: '2027-01-03' } as const;
export const MIN_KCAL = 1800;

export const DELOADS: Deload[] = [
  { start: '2026-12-28', end: '2027-01-03', setsFactor: 0.67, weightFactor: 0.8 },
  { start: '2027-02-15', end: '2027-02-21', setsFactor: 0.67, weightFactor: 0.8 },
  { start: '2027-04-12', end: '2027-04-18', setsFactor: 0.67, weightFactor: 0.8 },
];

export const REST_SUPERSET = 60;

export const SEED_SLOTS: ProgramSlot[] = [
  // Тренировка A
  { id: 'A1g', workout: 'A', order: 1, exerciseId: 'goblet_squat', altExerciseIds: [], sets: 3, repMin: 6, repMax: 10, step: 200, rest: 'long', toPhase: 1 },
  { id: 'A1b', workout: 'A', order: 1, exerciseId: 'barbell_squat', altExerciseIds: [], sets: 3, repMin: 6, repMax: 10, step: 500, rest: 'long', fromPhase: 2 },
  { id: 'A2', workout: 'A', order: 2, exerciseId: 'bench_press', altExerciseIds: ['db_bench_press'], sets: 3, repMin: 6, repMax: 10, step: 250, rest: 'long' },
  { id: 'A3', workout: 'A', order: 3, exerciseId: 'db_row', altExerciseIds: [], sets: 3, repMin: 8, repMax: 12, step: 200, rest: 'short' },
  { id: 'A4', workout: 'A', order: 4, exerciseId: 'db_rdl', altExerciseIds: [], sets: 3, repMin: 8, repMax: 12, step: 200, rest: 'short' },
  { id: 'A5', workout: 'A', order: 5, exerciseId: 'lateral_raise', altExerciseIds: [], sets: 3, repMin: 12, repMax: 20, step: 100, rest: 'short' },
  { id: 'A6', workout: 'A', order: 6, exerciseId: 'plank', altExerciseIds: [], sets: 3, repMin: 30, repMax: 60, step: 10, rest: 'short' },
  // Тренировка B
  { id: 'B1', workout: 'B', order: 1, exerciseId: 'barbell_rdl', altExerciseIds: [], sets: 3, repMin: 6, repMax: 10, step: 500, rest: 'long' },
  { id: 'B2', workout: 'B', order: 2, exerciseId: 'db_shoulder_press', altExerciseIds: [], sets: 3, repMin: 8, repMax: 12, step: 200, rest: 'short' },
  { id: 'B3', workout: 'B', order: 3, exerciseId: 'lat_pulldown', altExerciseIds: ['pullup'], sets: 3, repMin: 8, repMax: 12, step: 500, rest: 'short' },
  { id: 'B4', workout: 'B', order: 4, exerciseId: 'bulgarian_split_squat', altExerciseIds: ['leg_press'], sets: 3, repMin: 8, repMax: 12, step: 200, rest: 'short' },
  { id: 'B5', workout: 'B', order: 5, exerciseId: 'incline_db_press', altExerciseIds: [], sets: 3, repMin: 8, repMax: 12, step: 200, rest: 'short' },
  { id: 'B6a', workout: 'B', order: 6, exerciseId: 'biceps_curl', altExerciseIds: [], sets: 3, repMin: 10, repMax: 15, step: 100, rest: REST_SUPERSET, supersetWith: 'B6b' },
  { id: 'B6b', workout: 'B', order: 7, exerciseId: 'triceps_pushdown', altExerciseIds: [], sets: 3, repMin: 10, repMax: 15, step: 500, rest: REST_SUPERSET, supersetWith: 'B6a' },
  { id: 'B7', workout: 'B', order: 8, exerciseId: 'hanging_leg_raise', altExerciseIds: ['cable_crunch'], sets: 3, repMin: 10, repMax: 15, step: 2, rest: 'short' },
];

/** Шаг для упражнения-замены (у слота свой шаг — для основного упражнения). */
export const ALT_STEP: Record<string, number> = {
  db_bench_press: 200,
  bench_press: 250,
  pullup: 2,
  lat_pulldown: 500,
  leg_press: 1000,
  bulgarian_split_squat: 200,
  cable_crunch: 500,
  hanging_leg_raise: 2,
};

export interface Checkpoint {
  date: LocalDate;
  /** Ориентир среднего веса, Kg100: одно число или диапазон. */
  target: Kg100Range;
  todo: string;
  photos: boolean;
}
export type Kg100Range = { min: number; max: number };

export const CHECKPOINTS: Checkpoint[] = [
  { date: '2026-12-06', target: { min: 7850, max: 7850 }, todo: 'Фото, замеры, пересмотр стартовых весов', photos: true },
  { date: '2027-01-03', target: { min: 7700, max: 7700 }, todo: 'Фото, замеры', photos: true },
  { date: '2027-01-31', target: { min: 7550, max: 7550 }, todo: 'Фото, замеры, % жира', photos: true },
  { date: '2027-02-28', target: { min: 7350, max: 7400 }, todo: 'Решение по калориям фазы 3', photos: false },
  { date: '2027-04-30', target: { min: 7200, max: 7300 }, todo: 'Итог', photos: true },
];

export interface PoolPlan {
  minutes: number;
  text: string;
}

/** Бассейн — SPEC 3.4. `optional` — суббота. */
export function poolPlan(date: LocalDate, optional: boolean): PoolPlan {
  const month = Number(date.slice(5, 7));
  if (month === 11) return optional ? { minutes: 30, text: '30 мин спокойно' } : { minutes: 30, text: '30 мин: 10 × 50 м, отдых 30–45 с' };
  if (month === 12 || month === 1)
    return optional ? { minutes: 40, text: '40 мин' } : { minutes: 40, text: '40 мин: 6 × 100 м, отдых 30 с + 10 мин без остановки' };
  return optional ? { minutes: 45, text: '45 мин' } : { minutes: 45, text: '45 мин: 20–25 мин без остановки + 6 × 50 м быстрее' };
}

export const REST_DAY_STEPS = 8000;
