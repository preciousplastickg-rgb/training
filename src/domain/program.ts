// Программа v2: фазы, блоки, разгрузки, разгон, лёгкая неделя, «что сегодня» (SPEC 5.1),
// порядок A → B → C (SPEC 3.3) и состав тренировки (SPEC 3.4).

import {
  BLOCKS, CALIBRATION_DATE, DEFAULT_SCHEDULE, DELOADS, LIGHT_WEEK_ACCESSORY_SETS, PHASES, PROGRAM_END, PROGRAM_START, RAMP_UP,
  WORKOUT_ORDER, poolPlan, poolTypeFor, type PoolPlan,
} from '../data/program';
import { getExercise } from '../data/exercises';
import type {
  Block, BlockN, DayOverride, DayType, Deload, Exercise, LightWeek, LocalDate, Phase, PoolSession, ProgramSlot, RampUp, Section, Settings, WeekSchedule,
  Workout, WorkoutSession,
} from '../db/types';
import { addDays, diffDays, isBetween, isoWeekday } from './dates';

export function phaseFor(date: LocalDate): Phase | null {
  return PHASES.find((p) => isBetween(date, p.start, p.end)) ?? null;
}

export function deloadFor(date: LocalDate): Deload | null {
  return DELOADS.find((d) => isBetween(date, d.start, d.end)) ?? null;
}

/** Блок по дате (до конца своей разгрузки). До старта — 1, после конца — 3. */
export function blockFor(date: LocalDate): BlockN {
  if (date < PROGRAM_START) return 1;
  return BLOCKS.find((b) => isBetween(date, b.start, b.end))?.n ?? 3;
}

export function blockOf(date: LocalDate): (Block & { mainEnd: LocalDate }) | null {
  return BLOCKS.find((b) => isBetween(date, b.start, b.end)) ?? null;
}

export function rampUpFor(date: LocalDate): RampUp | null {
  return date >= PROGRAM_START && date <= RAMP_UP.end ? RAMP_UP : null;
}

export function lightWeekFor(date: LocalDate, lightWeeks: readonly LightWeek[] = []): LightWeek | null {
  return lightWeeks.find((w) => isBetween(date, w.start, w.end)) ?? null;
}

export interface PhaseWeek {
  phase: Phase;
  week: number;
  weeks: number;
}

/** «Фаза 2 · неделя 6 из 12». */
export function phaseWeek(date: LocalDate): PhaseWeek | null {
  const phase = phaseFor(date);
  if (!phase) return null;
  return {
    phase,
    week: Math.floor(diffDays(phase.start, date) / 7) + 1,
    weeks: Math.ceil((diffDays(phase.start, phase.end) + 1) / 7),
  };
}

export interface BlockWeek {
  block: BlockN;
  /** Неделя блока от его начала; в разгрузку после блока — та же нумерация, но `deload`. */
  week: number;
  /** Недель в блоке без разгрузки после него (блок 3 — с разгрузкой внутри). */
  weeks: number;
  deload: boolean;
}

/** «Блок 2 · неделя 3 из 6». */
export function blockWeek(date: LocalDate): BlockWeek | null {
  const b = blockOf(date);
  if (!b) return null;
  return {
    block: b.n,
    week: Math.floor(diffDays(b.start, date) / 7) + 1,
    weeks: Math.ceil((diffDays(b.start, b.mainEnd) + 1) / 7),
    deload: deloadFor(date) !== null,
  };
}

/** Строка над карточкой дня (SPEC 6.1): «Блок 2 · неделя 3 из 6 · фаза 2». */
export function programLine(date: LocalDate): string {
  const bw = blockWeek(date);
  const phase = phaseFor(date);
  if (!bw || !phase) return date < PROGRAM_START ? 'подготовка' : 'программа завершена';
  return `Блок ${bw.block} · ${bw.deload ? 'разгрузка' : `неделя ${bw.week} из ${bw.weeks}`} · фаза ${phase.n}`;
}

// ---------- Что сегодня ----------

export type DayKind = 'prep' | 'gym' | 'pool' | 'pool_optional' | 'rest' | 'finished';

export interface DayPlan {
  date: LocalDate;
  kind: DayKind;
  /** Бассейн для 'pool' и 'pool_optional', а также «по желанию» в день перенесённого зала. */
  pool?: PoolPlan & { optional: boolean };
  /** Зал перенесён со вчера. */
  makeup?: boolean;
  /** Зал по расписанию, но вчера уже был зал — сегодня не предлагаем. */
  gymBlocked?: boolean;
  /** День изменён вручную в календаре. */
  overridden?: boolean;
  isDeload: boolean;
  /** Лёгкая неделя по пульсу (SPEC 5.9). */
  lightWeek?: boolean;
}

/** Расписание недели, правки отдельных дней — из настроек; лёгкие недели — из БД. */
export interface PlanOptions {
  schedule?: WeekSchedule;
  overrides?: Record<LocalDate, DayOverride>;
  lightWeeks?: readonly LightWeek[];
}

export const planOptionsOf = (s: Pick<Settings, 'schedule' | 'dayOverrides'>, lightWeeks: readonly LightWeek[] = []): PlanOptions => ({
  schedule: s.schedule ?? DEFAULT_SCHEDULE,
  overrides: s.dayOverrides ?? {},
  lightWeeks,
});

/**
 * План дней с начала программы по `until` включительно.
 * `gymDates` — даты завершённых тренировок в зале (кроме пробной).
 * План дня зависит от вчерашнего: пропуск зала переносит его на сегодня, два зала подряд не предлагаются.
 * `projectFrom` — для взгляда вперёд: начиная с этой даты зал по плану считается сделанным.
 */
export function planDays(until: LocalDate, gymDates: ReadonlySet<LocalDate>, projectFrom?: LocalDate, opts: PlanOptions = {}): DayPlan[] {
  const out: DayPlan[] = [];
  // Проекция вперёд (календарь): с `projectFrom` считаем, что зал по плану состоится.
  const gyms = projectFrom ? new Set(gymDates) : gymDates;
  const schedule = opts.schedule ?? DEFAULT_SCHEDULE;
  const overrides = opts.overrides ?? {};
  const lightWeeks = opts.lightWeeks ?? [];
  let prev: DayPlan | null = null;
  for (let d = PROGRAM_START; d <= until && d <= PROGRAM_END; d = addDays(d, 1)) {
    const plan = planOneDay(d, prev, gyms, schedule, overrides[d], lightWeeks);
    if (projectFrom && d >= projectFrom && plan.kind === 'gym') (gyms as Set<LocalDate>).add(d);
    out.push(plan);
    prev = plan;
  }
  return out;
}

function planOneDay(
  date: LocalDate,
  prev: DayPlan | null,
  gymDates: ReadonlySet<LocalDate>,
  schedule: WeekSchedule,
  override: DayOverride | undefined,
  lightWeeks: readonly LightWeek[],
): DayPlan {
  const wd = isoWeekday(date);
  const isDeload = deloadFor(date) !== null;
  const lightWeek = lightWeekFor(date, lightWeeks) !== null;
  const flags = { isDeload, ...(lightWeek ? { lightWeek } : {}) };
  const gymYesterday = gymDates.has(addDays(date, -1));
  // Зал переносится, если вчера он был в плане (или был заблокирован), но не состоялся.
  // Явный «отдых» из календаря переноса не даёт: это осознанный пропуск.
  const carry = !gymYesterday && !prev?.overridden && (prev?.kind === 'gym' || prev?.gymBlocked === true);
  const gymDay = schedule.gym.includes(wd);
  const regularPool = schedule.pool.includes(wd);
  const optionalPool = schedule.poolOptional.includes(wd);
  const swim = (optional: boolean) => ({ ...poolPlan(date, poolTypeFor(wd), { deload: isDeload, lightWeek }), optional });

  // Правка дня из календаря — поверх расписания и правила «два зала подряд».
  if (override === 'gym') return { date, kind: 'gym', overridden: true, ...flags };
  if (override === 'pool') return { date, kind: 'pool', pool: swim(false), overridden: true, ...flags };
  if (override === 'rest') return { date, kind: 'rest', overridden: true, ...flags };

  if (gymYesterday && gymDay) {
    // Два зала подряд не предлагаем: зал уезжает на завтра. Сегодня — бассейн по желанию, если он есть в расписании, иначе отдых.
    if (regularPool || optionalPool) return { date, kind: 'pool_optional', pool: swim(true), gymBlocked: true, ...flags };
    return { date, kind: 'rest', gymBlocked: true, ...flags };
  }
  if (gymDay) return { date, kind: 'gym', ...flags };
  // Перенос — на любой день с бассейном (кроме воскресенья по умолчанию).
  if (carry && (regularPool || optionalPool)) {
    return { date, kind: 'gym', makeup: true, pool: swim(true), ...flags };
  }
  if (regularPool) return { date, kind: 'pool', pool: swim(false), ...flags };
  if (optionalPool) return { date, kind: 'pool_optional', pool: swim(true), ...flags };
  return { date, kind: 'rest', ...flags };
}

/** План на конкретный день (в том числе до старта и после конца программы). */
export function planForDate(date: LocalDate, gymDates: ReadonlySet<LocalDate>, opts: PlanOptions = {}): DayPlan {
  if (date < PROGRAM_START) return { date, kind: 'prep', isDeload: false };
  if (date > PROGRAM_END) return { date, kind: 'finished', isDeload: false };
  const plans = planDays(date, gymDates, undefined, opts);
  return plans[plans.length - 1]!;
}

export function isCalibrationDay(date: LocalDate): boolean {
  return date === CALIBRATION_DATE;
}

/** По кругу: A → B → C → A. */
export function workoutAfter(w: Workout): Workout {
  return WORKOUT_ORDER[(WORKOUT_ORDER.indexOf(w) + 1) % WORKOUT_ORDER.length]!;
}

/** Следующая тренировка — после последней завершённой (пробная не в счёт); нет ни одной — A. */
export function nextWorkout(sessions: readonly WorkoutSession[]): Workout {
  const done = sessions
    .filter((s) => s.finishedAt !== undefined && !s.isCalibration)
    .sort((a, b) => (a.finishedAt ?? 0) - (b.finishedAt ?? 0));
  const last = done[done.length - 1];
  if (!last) return 'A';
  return workoutAfter(last.workout);
}

/** Даты завершённых тренировок в зале (кроме пробной). */
export function gymDatesOf(sessions: readonly WorkoutSession[]): Set<LocalDate> {
  return new Set(sessions.filter((s) => s.finishedAt !== undefined && !s.isCalibration).map((s) => s.date));
}

/** Тип дня для калорий (SPEC 5.6): сессия зала → gym, бассейн → pool, иначе по расписанию недели (3.3) с правками дней. */
export function dayTypeFor(
  date: LocalDate,
  sessions: readonly Pick<WorkoutSession, 'date' | 'finishedAt'>[],
  pool: readonly Pick<PoolSession, 'date'>[],
  opts: PlanOptions = {},
): DayType {
  if (sessions.some((s) => s.date === date && s.finishedAt !== undefined)) return 'gym';
  if (pool.some((p) => p.date === date)) return 'pool';
  if (date < PROGRAM_START || date > PROGRAM_END) return 'rest';
  const override = opts.overrides?.[date];
  if (override) return override === 'rest' ? 'rest' : override;
  const schedule = opts.schedule ?? DEFAULT_SCHEDULE;
  const wd = isoWeekday(date);
  if (schedule.gym.includes(wd)) return 'gym';
  if (schedule.pool.includes(wd) || schedule.poolOptional.includes(wd)) return 'pool';
  return 'rest';
}

// ---------- Состав тренировки ----------

export interface PlannedExercise {
  slot: ProgramSlot;
  exercise: Exercise;
  section: Section;
  /** Подходов с учётом фазы 3, разгона, лёгкой недели и разгрузки. */
  sets: number;
  /** Подходов без разгрузки и разгона (для правила «все подходы на максимуме»). */
  normalSets: number;
  /** Шаг для выбранного упражнения (у замены свой). */
  step: number;
  restSeconds: number;
}

/** Активная замена слота: по code, только в том блоке, где она сделана (SPEC 3.4). */
export function substitutionFor(slot: Pick<ProgramSlot, 'code' | 'block' | 'altExerciseIds'>, settings: Pick<Settings, 'substitutions' | 'substitutionsBlock'>): string | null {
  if ((settings.substitutionsBlock ?? slot.block) !== slot.block) return null;
  const sub = settings.substitutions[slot.code];
  return sub && slot.altExerciseIds.includes(sub) ? sub : null;
}

/** Подходы слота (SPEC 5.1 п. 8). */
export function slotSets(slot: Pick<ProgramSlot, 'sets' | 'section'>, ctx: { phase: Phase; deload: Deload | null; rampUp: RampUp | null; lightWeek: boolean }): { sets: number; normalSets: number } {
  const accessory = slot.section === 'accessory';
  const normalSets = slot.sets + (accessory ? ctx.phase.accessoryExtraSets : 0);
  if (ctx.deload) return { sets: ctx.deload.sets, normalSets };
  if (accessory && ctx.rampUp) return { sets: ctx.rampUp.sets, normalSets };
  if (accessory && ctx.lightWeek) return { sets: LIGHT_WEEK_ACCESSORY_SETS, normalSets };
  return { sets: normalSets, normalSets };
}

/** Слоты тренировки на дату: блок, фаза (A1), замены, подходы по правилу 5.1 п. 8, отдых слота. */
export function workoutPlan(
  workout: Workout,
  date: LocalDate,
  slots: readonly ProgramSlot[],
  settings: Pick<Settings, 'substitutions' | 'substitutionsBlock'>,
  ctx: { lightWeeks?: readonly LightWeek[] } = {},
): PlannedExercise[] {
  const phaseN = phaseFor(date)?.n ?? (date < PROGRAM_START ? 1 : 3);
  const phase = PHASES.find((p) => p.n === phaseN)!;
  const block = blockFor(date);
  const setsCtx = { phase, deload: deloadFor(date), rampUp: rampUpFor(date), lightWeek: lightWeekFor(date, ctx.lightWeeks) !== null };
  return slots
    .filter((s) => s.workout === workout && s.block === block)
    .filter((s) => (s.fromPhase ?? 1) <= phaseN && phaseN <= (s.toPhase ?? 3))
    .sort((a, b) => a.order - b.order)
    .map((slot) => {
      const exerciseId = substitutionFor(slot, settings) ?? slot.exerciseId;
      const exercise = getExercise(exerciseId);
      const { sets, normalSets } = slotSets(slot, setsCtx);
      return {
        slot,
        exercise,
        section: slot.section,
        sets,
        normalSets,
        step: exerciseId === slot.exerciseId ? (slot.step ?? exercise.defaultStep) : exercise.defaultStep,
        restSeconds: slot.restSec,
      };
    });
}

/** Роль в суперсете: после подхода «первого» — сразу к партнёру, после «второго» — отдых партнёра. */
export function supersetRole(plan: readonly PlannedExercise[], index: number): 'lead' | 'follow' | null {
  const p = plan[index];
  if (!p?.slot.supersetWith) return null;
  const partner = plan.find((x) => x.slot.code === p.slot.supersetWith);
  if (!partner) return null;
  return p.slot.order < partner.slot.order ? 'lead' : 'follow';
}

/** Первая тренировка нового блока: ни одной завершённой тренировки в этом блоке (SPEC 6.2, баннер). */
export function isFirstInBlock(date: LocalDate, sessions: readonly WorkoutSession[]): boolean {
  if (date < PROGRAM_START) return false;
  const block = blockFor(date);
  return !sessions.some((s) => s.finishedAt !== undefined && !s.isCalibration && s.block === block && s.date < date);
}

/** Оценка длительности: разминка 10 мин, ~45 с на подход + отдых, кардио 15 мин. */
export function estimateMinutes(plan: readonly PlannedExercise[], opts: { cardio?: boolean } = {}): number {
  let seconds = 600;
  plan.forEach((p, i) => {
    const rest = supersetRole(plan, i) === 'lead' ? 0 : p.restSeconds;
    seconds += p.sets * (45 + rest) * (p.exercise.perSide ? 1.6 : 1);
  });
  if (opts.cardio !== false) seconds += 900;
  return Math.round(seconds / 60 / 5) * 5;
}
