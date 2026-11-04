// Модель данных — SPEC, раздел 4.
// Веса — Kg100 (кг × 100, целое). Калории — целые. БЖУ — × 10, целые. Сантиметры замеров — × 10.

import type { LocalDate } from '../domain/dates';
import type { Kg100 } from '../domain/format';

export type { LocalDate, Kg100 };
export type Id = string;

export type Muscle =
  | 'chest' | 'front_delt' | 'side_delt' | 'rear_delt' | 'lats' | 'upper_back' | 'biceps'
  | 'triceps' | 'abs' | 'lower_back' | 'glutes' | 'quads' | 'hamstrings' | 'calves';

export interface Exercise {
  id: string;
  name: string;
  equipment: 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'bodyweight';
  unit: 'kg' | 'seconds' | 'reps';
  perSide: boolean;
  muscles: { primary: Muscle[]; secondary: Muscle[] };
  cues: string[];
  mistakes: string[];
  setup?: string;
  videoQuery: string;
}

export interface ProgramSlot {
  id: Id;
  workout: 'A' | 'B';
  order: number;
  exerciseId: string;
  altExerciseIds: string[];
  sets: number;
  repMin: number;
  repMax: number;
  step: Kg100 | number;
  rest: 'long' | 'short' | number;
  supersetWith?: Id;
  fromPhase?: 1 | 2 | 3;
  toPhase?: 1 | 2 | 3;
}

export interface Phase {
  n: 1 | 2 | 3;
  name: string;
  start: LocalDate;
  end: LocalDate;
  kcal: number;
  protein: number;
  fat: number;
  extraSetExerciseIds: string[];
}

export interface Deload {
  start: LocalDate;
  end: LocalDate;
  setsFactor: number;
  weightFactor: number;
}

export interface WorkoutSession {
  id: Id;
  date: LocalDate;
  workout: 'A' | 'B';
  startedAt: number;
  finishedAt?: number;
  isDeload: boolean;
  isCalibration: boolean;
  note?: string;
}

export interface SetLog {
  id: Id;
  sessionId: Id;
  exerciseId: string;
  slotId: Id;
  setIndex: number;
  kind: 'warmup' | 'work';
  weight: Kg100;
  reps: number;
  rir?: 0 | 1 | 2 | 3 | 4;
  doneAt: number;
}

export interface PoolSession {
  id: Id;
  date: LocalDate;
  minutes: number;
  meters?: number;
  feel?: 1 | 2 | 3 | 4 | 5;
  note?: string;
}

export interface BodyEntry {
  date: LocalDate;
  weight?: Kg100;
  waist?: number;
  neck?: number;
  steps?: number;
}

export interface ProgressPhoto {
  id: Id;
  date: LocalDate;
  pose: 'front' | 'side' | 'back';
  blob: Blob;
}

export interface Food {
  id: Id;
  name: string;
  aliases: string[];
  per100: { kcal: number; p: number; f: number; c: number };
  unitName?: string;
  unitGrams?: number;
  source: 'seed' | 'user' | 'recipe';
  approx: boolean;
  archived: boolean;
}

export interface Recipe {
  foodId: Id;
  items: { foodId: Id; grams: number }[];
  cookedWeight: number;
}

export interface FoodLog {
  id: Id;
  date: LocalDate;
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  foodId?: Id;
  grams?: number;
  quick?: { name: string; kcal: number; p: number };
  createdAt: number;
}

export interface Adjustment {
  id: Id;
  date: LocalDate;
  deltaKcal: number;
  reason: string;
}

export type Theme = 'light' | 'dark' | 'system';

export interface Settings {
  heightCm: number;
  startDate: LocalDate;
  startWeight: Kg100;
  targetWeight: Kg100;
  targetBodyFat: number;
  restLong: number;
  restShort: number;
  barWeight: Kg100;
  /** Блины на одну сторону, Kg100: 2,5 кг → 250. */
  plates: Kg100[];
  sound: boolean;
  theme: Theme;
  substitutions: Record<string, string>;
  lastBackupAt?: number;
}

/** Строка настроек в БД — единственная, id = 'main'. */
export interface SettingsRow extends Settings {
  id: 'main';
}

/** Служебные значения: состояние таймера, флаги первого запуска и т. п. */
export interface KvRow {
  key: string;
  value: unknown;
}
