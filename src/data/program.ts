// Программа v2 — SPEC 3 (план «До мая: 15% жира и рельеф», редакция от 7 ноября 2026).
// Веса и шаги — Kg100; для упражнений на время шаг в секундах, на повторы — в повторах.
// Блоки, фазы, разгрузки и разгон — константы; в БД из программы хранятся только слоты и каталог.

import type {
  Block, BlockN, CardioMachine, DayType, Deload, LocalDate, Phase, PoolType, ProgramSlot, RampUp, Section, WeekSchedule, Workout,
} from '../db/types';

export const CALIBRATION_DATE: LocalDate = '2026-11-06';
export const PROGRAM_START: LocalDate = '2026-11-09';
export const PROGRAM_END: LocalDate = '2027-04-30';

// ---------- Фазы и питание (SPEC 3.1) ----------

const DEFICIT_KCAL: Record<DayType, number> = { gym: 2300, pool: 2150, rest: 2050 };

export const PHASES: Phase[] = [
  { n: 1, name: 'Техника', start: '2026-11-09', end: '2026-12-06', kcal: DEFICIT_KCAL, protein: 155, fat: 65, accessoryExtraSets: 0 },
  { n: 2, name: 'Жиросжигание', start: '2026-12-07', end: '2027-02-28', kcal: DEFICIT_KCAL, protein: 155, fat: 65, accessoryExtraSets: 0 },
  { n: 3, name: 'Рельеф', start: '2027-03-01', end: '2027-04-30', kcal: DEFICIT_KCAL, protein: 155, fat: 65, accessoryExtraSets: 1 },
];

/** Фаза 3, выбор «поддержка»: ккал по типу дня. */
export const MAINTENANCE_KCAL_PHASE3: Record<DayType, number> = { gym: 2700, pool: 2550, rest: 2450 };
/** Новогодняя разгрузка — поддержка (SPEC 5.6). */
export const MAINTENANCE_KCAL_DELOAD = 2500;
export const MAINTENANCE_DELOAD = { start: '2026-12-28', end: '2027-01-03' } as const;
export const MIN_KCAL = 1800;

/** Разгон: до 2026-11-22 включительно дополнительный блок по 2 подхода. */
export const RAMP_UP: RampUp = { end: '2026-11-22', section: 'accessory', sets: 2 };

// ---------- Блоки и разгрузки (SPEC 3.2) ----------

/** Блок действует до конца своей разгрузки; `mainEnd` — последний день до разгрузки (для «неделя N из M»). */
export const BLOCKS: (Block & { mainEnd: LocalDate })[] = [
  { n: 1, start: '2026-11-09', end: '2027-01-03', mainEnd: '2026-12-27' },
  { n: 2, start: '2027-01-04', end: '2027-02-21', mainEnd: '2027-02-14' },
  { n: 3, start: '2027-02-22', end: '2027-04-30', mainEnd: '2027-04-30' },
];

export const DELOADS: Deload[] = [
  { start: '2026-12-28', end: '2027-01-03', sets: 2, weightFactor: 0.8 },
  { start: '2027-02-15', end: '2027-02-21', sets: 2, weightFactor: 0.8 },
  { start: '2027-04-12', end: '2027-04-18', sets: 2, weightFactor: 0.8 },
];

// ---------- Неделя (SPEC 3.3) ----------

export const WORKOUT_ORDER: Workout[] = ['A', 'B', 'C'];
export const WORKOUT_NAMES: Record<Workout, string> = { A: 'присед и жим лёжа', B: 'тяга и плечи', C: 'тренажёры' };

/** Пн/ср/пт зал, вт/чт/сб бассейн, вс отдых. */
export const DEFAULT_SCHEDULE: WeekSchedule = { gym: [1, 3, 5], pool: [2, 4, 6], poolOptional: [] };

/** Тип бассейна по дню недели (ISO): вт — техника, чт — интервалы, сб — длинное; остальные — техника. */
export function poolTypeFor(weekday: number): PoolType {
  if (weekday === 4) return 'intervals';
  if (weekday === 6) return 'long';
  return 'technique';
}

export const POOL_TYPE_NAMES: Record<PoolType, string> = { technique: 'техника', intervals: 'интервалы', long: 'длинное плавание' };

// ---------- Разминка и кардио (SPEC 3.5) ----------

export const WARMUP_CHECKLIST = ['5 мин велотренажёр', '10 ягодичных мостов', '8 «птица-собака» на сторону', '15 разведений резинки'];
export const WARMUP_MINUTES = 10;

export const CARDIO_MINUTES = 15;
export const CARDIO_BY_WORKOUT: Record<Workout, CardioMachine> = { A: 'treadmill', B: 'elliptical', C: 'bike' };
export const CARDIO_NAMES: Record<CardioMachine, string> = { treadmill: 'Дорожка в горку', elliptical: 'Эллипс', bike: 'Велотренажёр' };
export const CARDIO_HINTS: Record<CardioMachine, string> = {
  treadmill: 'наклон 8–12%, 5–5,5 км/ч, пульс 120–135',
  elliptical: 'ровный темп, пульс 120–135',
  bike: 'ровный темп, пульс 120–135',
};

// ---------- Бассейн (SPEC 3.6) ----------

export interface PoolPlan {
  type: PoolType;
  minutes: number;
  text: string;
}

const POOL_TEXTS: Record<PoolType, [string, string, string]> = {
  technique: ['12 × 50 м, отдых 30–45 с + 15 мин с доской на ноги', '10 × 100 м, отдых 30 с + 10 мин с доской', '3 × 400 м, отдых 1 мин + 10 мин с доской'],
  intervals: ['16 × 25 м быстро, отдых 30 с + 15 мин спокойно', '12 × 50 м быстро, отдых 30 с + 15 мин спокойно', '8 × 100 м быстро, отдых 45 с + 15 мин спокойно'],
  long: ['5 мин плавания + 2 мин ходьбы в воде, всего 45 мин', '2 × 20 мин без остановки, пауза 2 мин', '40–45 мин без остановки'],
};

export const POOL_DELOAD: Omit<PoolPlan, 'type'> = { minutes: 45, text: 'спокойно 45 минут' };
export const POOL_LIGHT_WEEK: Omit<PoolPlan, 'type'> = { minutes: 30, text: '30 мин спокойно' };

/** План занятия: тип дня и период; в разгрузку — «спокойно 45 минут», в лёгкую неделю суббота — «30 мин спокойно». */
export function poolPlan(date: LocalDate, type: PoolType, opts: { deload?: boolean; lightWeek?: boolean } = {}): PoolPlan {
  if (opts.deload) return { type, ...POOL_DELOAD };
  if (opts.lightWeek && type === 'long') return { type, ...POOL_LIGHT_WEEK };
  const period = date <= '2026-11-30' ? 0 : date <= '2027-01-31' ? 1 : 2;
  const text = POOL_TEXTS[type][period];
  return { type, minutes: type === 'long' && period === 0 ? 45 : 60, text };
}

export const REST_DAY_STEPS = 8000;

// ---------- Сауна (SPEC 3.7) ----------

export const SAUNA_HINT = '2–3 захода по 10–15 минут, между ними прохладный душ и 250–300 мл воды';

// ---------- Пульс в покое и лёгкая неделя (SPEC 5.9) ----------

export const HR_BASELINE_DAYS = 7;
export const HR_SIGNAL_DELTA = 5;
export const HR_SIGNAL_DAYS = 3;
export const LIGHT_WEEK_DAYS = 7;
export const LIGHT_WEEK_COOLDOWN_DAYS = 14;
export const LIGHT_WEEK_ACCESSORY_SETS = 2;
export const LIGHT_WEEK_TEXT = 'Пульс выше обычного 3 дня. Лёгкая неделя: субботний бассейн 30 минут спокойно, дополнительный блок 2 подхода, сон 8 часов';

// ---------- Тренировки (SPEC 3.4) ----------

interface Row {
  code: string;
  section: Section;
  sets: number;
  reps: [number, number];
  rest: number;
  /** Упражнение в блоках 1, 2, 3. */
  ex: [string, string, string];
  alt?: string;
  supersetWith?: string;
  /** Поправки отдельного блока: повторы и отдых. */
  perBlock?: Partial<Record<BlockN, { reps?: [number, number]; rest?: number }>>;
}

const A: Row[] = [
  { code: 'A1', section: 'main', sets: 3, reps: [6, 10], rest: 150, ex: ['barbell_squat', 'barbell_squat', 'barbell_squat'] },
  { code: 'A2', section: 'main', sets: 3, reps: [6, 10], rest: 150, ex: ['bench_press', 'bench_press', 'bench_press'], alt: 'db_bench_press' },
  { code: 'A3', section: 'main', sets: 3, reps: [8, 12], rest: 120, ex: ['db_row', 'chest_supported_db_row', 'tbar_row_chest'] },
  { code: 'A4', section: 'main', sets: 3, reps: [8, 12], rest: 120, ex: ['db_rdl', 'hip_thrust', 'back_extension'], perBlock: { 3: { reps: [10, 15] } } },
  { code: 'A5a', section: 'accessory', sets: 3, reps: [12, 20], rest: 0, ex: ['lateral_raise', 'cable_lateral_raise', 'seated_db_lateral_raise'], supersetWith: 'A5b' },
  { code: 'A5b', section: 'accessory', sets: 3, reps: [15, 20], rest: 75, ex: ['face_pull', 'face_pull', 'reverse_pec_deck'], supersetWith: 'A5a' },
  { code: 'A6a', section: 'accessory', sets: 3, reps: [10, 12], rest: 0, ex: ['hammer_curl', 'ez_curl', 'preacher_curl'], supersetWith: 'A6b' },
  { code: 'A6b', section: 'accessory', sets: 3, reps: [10, 15], rest: 75, ex: ['overhead_cable_extension', 'overhead_db_extension', 'overhead_cable_extension'], supersetWith: 'A6a' },
  { code: 'A7', section: 'accessory', sets: 3, reps: [12, 15], rest: 60, ex: ['standing_calf_raise', 'leg_press_calf_raise', 'standing_calf_raise'] },
  { code: 'A8', section: 'accessory', sets: 3, reps: [30, 60], rest: 60, ex: ['plank', 'ab_wheel', 'side_plank'], perBlock: { 2: { reps: [6, 12] }, 3: { reps: [30, 45] } } },
];

const B: Row[] = [
  { code: 'B1', section: 'main', sets: 3, reps: [6, 10], rest: 150, ex: ['barbell_rdl', 'barbell_rdl', 'barbell_rdl'] },
  { code: 'B2', section: 'main', sets: 3, reps: [8, 12], rest: 120, ex: ['db_shoulder_press', 'barbell_ohp', 'machine_shoulder_press'], perBlock: { 2: { rest: 150 } } },
  { code: 'B3', section: 'main', sets: 3, reps: [8, 12], rest: 120, ex: ['lat_pulldown', 'close_grip_pulldown', 'pullup'], alt: 'pullup_assisted' },
  { code: 'B4', section: 'main', sets: 3, reps: [8, 12], rest: 120, ex: ['bulgarian_split_squat', 'reverse_lunge', 'db_step_up'], alt: 'leg_press' },
  { code: 'B5', section: 'main', sets: 3, reps: [8, 12], rest: 120, ex: ['incline_db_press', 'incline_barbell_press', 'incline_db_press'], perBlock: { 2: { rest: 150 } } },
  { code: 'B6', section: 'accessory', sets: 3, reps: [10, 12], rest: 90, ex: ['seated_cable_row', 'single_arm_cable_row', 'wide_cable_row'] },
  { code: 'B7a', section: 'accessory', sets: 3, reps: [12, 20], rest: 0, ex: ['cable_lateral_raise', 'machine_lateral_raise', 'cable_lateral_raise'], supersetWith: 'B7b' },
  { code: 'B7b', section: 'accessory', sets: 3, reps: [15, 20], rest: 75, ex: ['bent_over_rear_delt_raise', 'reverse_pec_deck', 'face_pull'], supersetWith: 'B7a' },
  { code: 'B8a', section: 'accessory', sets: 3, reps: [10, 15], rest: 0, ex: ['biceps_curl', 'rope_hammer_curl', 'incline_db_curl'], supersetWith: 'B8b' },
  { code: 'B8b', section: 'accessory', sets: 3, reps: [10, 15], rest: 75, ex: ['triceps_pushdown', 'straight_bar_pushdown', 'triceps_pushdown'], supersetWith: 'B8a' },
  { code: 'B9', section: 'accessory', sets: 3, reps: [10, 15], rest: 60, ex: ['hanging_leg_raise', 'captains_chair_knee_raise', 'hanging_leg_raise'], alt: 'cable_crunch' },
];

const C: Row[] = [
  { code: 'C1', section: 'main', sets: 3, reps: [10, 15], rest: 120, ex: ['leg_press', 'hack_squat', 'smith_squat'] },
  { code: 'C2', section: 'main', sets: 3, reps: [8, 12], rest: 120, ex: ['machine_chest_press', 'db_bench_press', 'dip'], alt: 'dip_assisted' },
  { code: 'C3', section: 'main', sets: 3, reps: [6, 10], rest: 120, ex: ['pullup_assisted', 'chinup_assisted', 'neutral_pulldown'], perBlock: { 3: { reps: [8, 12] } } },
  { code: 'C4', section: 'main', sets: 3, reps: [10, 15], rest: 90, ex: ['lying_leg_curl', 'seated_leg_curl', 'lying_leg_curl'] },
  { code: 'C5', section: 'accessory', sets: 3, reps: [12, 15], rest: 60, ex: ['leg_extension', 'leg_extension', 'leg_extension'] },
  { code: 'C6a', section: 'accessory', sets: 3, reps: [12, 20], rest: 0, ex: ['machine_lateral_raise', 'seated_db_lateral_raise', 'machine_lateral_raise'], supersetWith: 'C6b' },
  { code: 'C6b', section: 'accessory', sets: 3, reps: [15, 20], rest: 75, ex: ['reverse_pec_deck', 'prone_rear_delt_raise', 'cable_rear_delt_fly'], supersetWith: 'C6a' },
  { code: 'C7a', section: 'accessory', sets: 3, reps: [10, 12], rest: 0, ex: ['preacher_curl', 'spider_curl', 'hammer_curl'], supersetWith: 'C7b' },
  { code: 'C7b', section: 'accessory', sets: 3, reps: [10, 12], rest: 75, ex: ['ez_skullcrusher', 'reverse_grip_pushdown', 'ez_skullcrusher'], supersetWith: 'C7a' },
  { code: 'C8', section: 'accessory', sets: 3, reps: [12, 15], rest: 60, ex: ['seated_calf_raise', 'seated_calf_raise', 'seated_calf_raise'] },
  { code: 'C9', section: 'accessory', sets: 3, reps: [10, 15], rest: 60, ex: ['cable_crunch', 'cable_crunch', 'cable_crunch'] },
];

const ROWS: Record<Workout, Row[]> = { A, B, C };

/** id слота: `b<блок>-<code>`; A1 в блоке 1 — две строки `b1-A1g` (фаза 1) и `b1-A1b` (с фазы 2). */
export const slotId = (block: BlockN, code: string): string => `b${block}-${code}`;

function buildSlots(): ProgramSlot[] {
  const out: ProgramSlot[] = [];
  for (const workout of WORKOUT_ORDER) {
    ROWS[workout].forEach((r, i) => {
      for (const block of [1, 2, 3] as BlockN[]) {
        const over = r.perBlock?.[block] ?? {};
        const [repMin, repMax] = over.reps ?? r.reps;
        const base: Omit<ProgramSlot, 'id' | 'exerciseId'> = {
          workout, code: r.code, order: i + 1, section: r.section, block,
          altExerciseIds: r.alt ? [r.alt] : [], sets: r.sets, repMin, repMax, restSec: over.rest ?? r.rest,
          ...(r.supersetWith ? { supersetWith: r.supersetWith } : {}),
        };
        if (r.code === 'A1' && block === 1) {
          out.push({ ...base, id: 'b1-A1g', exerciseId: 'goblet_squat', toPhase: 1 });
          out.push({ ...base, id: 'b1-A1b', exerciseId: 'barbell_squat', fromPhase: 2 });
        } else {
          out.push({ ...base, id: slotId(block, r.code), exerciseId: r.ex[block - 1]! });
        }
      }
    });
  }
  return out;
}

export const SEED_SLOTS: ProgramSlot[] = buildSlots();

/** Число кодов слотов в тренировке (без учёта двух строк A1 блока 1). */
export const SLOT_CODES: Record<Workout, string[]> = { A: A.map((r) => r.code), B: B.map((r) => r.code), C: C.map((r) => r.code) };

export const NEW_BLOCK_BANNER = 'Новые упражнения: подбор веса. Бери вес с запасом 3 повтора';

// ---------- Контрольные точки (SPEC 3.8) ----------

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
