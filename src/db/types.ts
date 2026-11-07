// Модель данных — SPEC, раздел 4.
// Веса — Kg100 (кг × 100, целое). Калории — целые. БЖУ — × 10, целые. Сантиметры замеров — × 10.

import type { LocalDate } from '../domain/dates';
import type { Kg100 } from '../domain/format';

export type { LocalDate, Kg100 };
export type Id = string;

// Программа v2 (SPEC 3, 7 ноября 2026): три тренировки по кругу, три блока упражнений.
export type Workout = 'A' | 'B' | 'C';
export type BlockN = 1 | 2 | 3;
export type Section = 'main' | 'accessory';
/** Тип дня для калорий (SPEC 3.1, 5.6). */
export type DayType = 'gym' | 'pool' | 'rest';
export type PoolType = 'technique' | 'intervals' | 'long';
export type CardioMachine = 'treadmill' | 'elliptical' | 'bike';
export type SaunaRounds = 0 | 1 | 2 | 3;

export type Muscle =
  | 'chest' | 'front_delt' | 'side_delt' | 'rear_delt' | 'lats' | 'upper_back' | 'biceps'
  | 'triceps' | 'abs' | 'lower_back' | 'glutes' | 'quads' | 'hamstrings' | 'calves';

export interface Exercise {
  id: string;
  name: string;
  /** Короткое имя для чипов в режиме тренировки: «Жим лёжа». */
  short?: string;
  equipment: 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'bodyweight';
  /** assist_kg — противовес гравитрона: прогресс = уменьшение (SPEC 5.2 п. 8). */
  unit: 'kg' | 'seconds' | 'reps' | 'assist_kg';
  /** Шаг из каталога (SPEC 6.6): Kg100; для seconds/reps — секунды/повторы. */
  defaultStep: Kg100 | number;
  perSide: boolean;
  muscles: { primary: Muscle[]; secondary: Muscle[] };
  /** Роль мышцы в упражнении, 2–4 слова: вторая строка выноски на карте мышц («главная работа»). */
  muscleRoles?: Partial<Record<Muscle, string>>;
  cues: string[];
  mistakes: string[];
  setup?: string;
  videoQuery: string;
}

/** Одна строка = слот в одном блоке (SPEC 4). */
export interface ProgramSlot {
  id: Id;
  workout: Workout;
  /** 'A5a' — стабильный между блоками. */
  code: string;
  order: number;
  section: Section;
  block: BlockN;
  exerciseId: string;
  altExerciseIds: string[];
  sets: number;
  repMin: number;
  repMax: number;
  /** Не задан — exercise.defaultStep. */
  step?: Kg100 | number;
  /** 150 | 120 | 90 | 75 | 60 | 0. */
  restSec: number;
  /** code пары: 'A5b' для 'A5a'. */
  supersetWith?: string;
  fromPhase?: 1 | 2 | 3;
  toPhase?: 1 | 2 | 3;
}

/** Блок — до конца своей разгрузки (SPEC 3.2). */
export interface Block {
  n: BlockN;
  start: LocalDate;
  end: LocalDate;
}

export interface Phase {
  n: 1 | 2 | 3;
  name: string;
  start: LocalDate;
  end: LocalDate;
  /** Цели на день по типу дня (SPEC 3.1). */
  kcal: Record<DayType, number>;
  protein: number;
  fat: number;
  /** 0, в фазе 3 — 1: +1 подход во всех слотах accessory. */
  accessoryExtraSets: number;
}

/** Разгон: до `end` слоты `section` по `sets` подхода. */
export interface RampUp {
  end: LocalDate;
  section: 'accessory';
  sets: number;
}

export interface Deload {
  start: LocalDate;
  end: LocalDate;
  sets: number;
  weightFactor: number;
}

export interface WorkoutSession {
  id: Id;
  date: LocalDate;
  workout: Workout;
  block: BlockN;
  startedAt: number;
  finishedAt?: number;
  isDeload: boolean;
  isCalibration: boolean;
  /** Кардио после дополнительного блока (SPEC 3.5). */
  cardio?: { machine: CardioMachine; minutes: number };
  /** Заходы в сауну (SPEC 3.7). */
  saunaRounds?: SaunaRounds;
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
  type: PoolType;
  minutes: number;
  meters?: number;
  feel?: 1 | 2 | 3 | 4 | 5;
  saunaRounds?: SaunaRounds;
  note?: string;
}

export interface BodyEntry {
  date: LocalDate;
  weight?: Kg100;
  waist?: number;
  neck?: number;
  steps?: number;
  /** Пульс в покое, удары в минуту, утром лёжа (SPEC 5.9). */
  restingHr?: number;
  /** Сон за ночь, которая закончилась утром этой даты, минуты. */
  sleepMin?: number;
  /** Медитация за день, минуты (сумма за все подходы). */
  meditationMin?: number;
}

/** Лёгкая неделя по пульсу (SPEC 5.9): слоты accessory по 2 подхода, субботний бассейн 30 мин спокойно. */
export interface LightWeek {
  id: Id;
  start: LocalDate;
  end: LocalDate;
  reason: 'resting_hr';
}

/** Своя заметка к упражнению: «наклон скамьи 30°, сиденье 4». Одна на упражнение (схема v2). */
export interface ExerciseNote {
  exerciseId: string;
  text: string;
  updatedAt: number;
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
  /** В чём меряется: граммы (по умолчанию) или миллилитры. per100 — на 100 г или на 100 мл, FoodLog.grams — в этих же единицах. */
  unit?: FoodUnit;
  unitName?: string;
  unitGrams?: number;
  source: 'seed' | 'user' | 'recipe';
  approx: boolean;
  archived: boolean;
  /** Раздел каталога — для просмотра без поиска. */
  category?: FoodCategory;
}

export type FoodUnit = 'g' | 'ml';

export type FoodCategory = 'meat' | 'dairy' | 'grain' | 'veg' | 'fruit' | 'fat' | 'sweet' | 'drink' | 'dish';

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
  /** Граммы или миллилитры — по Food.unit. */
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
  /** Имя для приветствия на «Сегодня» (редизайн B); нет — «Привет!». */
  name?: string;
  heightCm: number;
  startDate: LocalDate;
  startWeight: Kg100;
  targetWeight: Kg100;
  targetBodyFat: number;
  barWeight: Kg100;
  /** Гриф EZ, Kg100 — для калькулятора блинов EZ-упражнений (SPEC 5.4). */
  ezBarWeight: Kg100;
  /** Блины на одну сторону, Kg100: 2,5 кг → 250. */
  plates: Kg100[];
  sound: boolean;
  theme: Theme;
  /** code слота → exerciseId замены; действует в блоке `substitutionsBlock`, при смене блока сбрасывается. */
  substitutions: Record<string, string>;
  substitutionsBlock?: BlockN;
  lastBackupAt?: number;
  /** Калории фазы 3: выбор в начале фазы (SPEC 3.1). Не задано — дефицит, как в фазе 2. */
  phase3Mode?: 'maintenance' | 'deficit';
  /** Первый запуск пройден (SPEC 6.8). */
  onboarded?: boolean;
  /** Расписание недели; не задано — пн/ср/пт зал, вт/чт/сб бассейн (SPEC 3.3). */
  schedule?: WeekSchedule;
  /** Правки плана на отдельные даты из календаря. */
  dayOverrides?: Record<LocalDate, DayOverride>;
}

/** Дни недели ISO: 1 — понедельник … 7 — воскресенье. Остальные дни — отдых. */
export interface WeekSchedule {
  gym: number[];
  pool: number[];
  poolOptional: number[];
}

export type DayOverride = 'gym' | 'pool' | 'rest';

/** Строка настроек в БД — единственная, id = 'main'. */
export interface SettingsRow extends Settings {
  id: 'main';
}

/** Служебные значения: состояние таймера, флаги первого запуска и т. п. */
export interface KvRow {
  key: string;
  value: unknown;
}
