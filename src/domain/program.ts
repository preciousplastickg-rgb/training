// Фазы, разгрузки, «что сегодня» (SPEC 5.1), чередование A/B (SPEC 3.2) и состав тренировки.

import {
  CALIBRATION_DATE, DELOADS, PHASES, PROGRAM_END, PROGRAM_START, REST_SUPERSET, ALT_STEP, poolPlan,
  type PoolPlan,
} from '../data/program';
import { getExercise } from '../data/exercises';
import type { Deload, Exercise, LocalDate, Phase, ProgramSlot, Settings, WorkoutSession } from '../db/types';
import { addDays, diffDays, isBetween, isoWeekday } from './dates';

export function phaseFor(date: LocalDate): Phase | null {
  return PHASES.find((p) => isBetween(date, p.start, p.end)) ?? null;
}

export function deloadFor(date: LocalDate): Deload | null {
  return DELOADS.find((d) => isBetween(date, d.start, d.end)) ?? null;
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
  isDeload: boolean;
}

const GYM_DAYS = new Set([1, 3, 5]);

/**
 * План дней с начала программы по `until` включительно.
 * `gymDates` — даты завершённых тренировок в зале (кроме пробной).
 * План дня зависит от вчерашнего: пропуск зала переносит его на сегодня, два зала подряд не предлагаются.
 * `projectFrom` — для взгляда вперёд: начиная с этой даты зал по плану считается сделанным.
 */
export function planDays(until: LocalDate, gymDates: ReadonlySet<LocalDate>, projectFrom?: LocalDate): DayPlan[] {
  const out: DayPlan[] = [];
  // Проекция вперёд (календарь): с `projectFrom` считаем, что зал по плану состоится.
  const gyms = projectFrom ? new Set(gymDates) : gymDates;
  let prev: DayPlan | null = null;
  for (let d = PROGRAM_START; d <= until && d <= PROGRAM_END; d = addDays(d, 1)) {
    const plan = planOneDay(d, prev, gyms);
    if (projectFrom && d >= projectFrom && plan.kind === 'gym') (gyms as Set<LocalDate>).add(d);
    out.push(plan);
    prev = plan;
  }
  return out;
}

function planOneDay(date: LocalDate, prev: DayPlan | null, gymDates: ReadonlySet<LocalDate>): DayPlan {
  const wd = isoWeekday(date);
  const isDeload = deloadFor(date) !== null;
  const gymYesterday = gymDates.has(addDays(date, -1));
  // Зал переносится, если вчера он был в плане (или был заблокирован), но не состоялся.
  const carry = !gymYesterday && (prev?.kind === 'gym' || prev?.gymBlocked === true);
  const regularPool = wd === 2 || wd === 4;

  if (gymYesterday && GYM_DAYS.has(wd)) {
    // Два зала подряд не предлагаем: зал уезжает на завтра, сегодня — бассейн по желанию.
    return { date, kind: 'pool_optional', pool: { ...poolPlan(date, true), optional: true }, gymBlocked: true, isDeload };
  }
  if (GYM_DAYS.has(wd)) return { date, kind: 'gym', isDeload };
  if (carry && wd !== 7) {
    return {
      date, kind: 'gym', makeup: true, isDeload,
      pool: regularPool || wd === 6 ? { ...poolPlan(date, true), optional: true } : undefined,
    };
  }
  if (regularPool) return { date, kind: 'pool', pool: { ...poolPlan(date, false), optional: false }, isDeload };
  if (wd === 6) return { date, kind: 'pool_optional', pool: { ...poolPlan(date, true), optional: true }, isDeload };
  return { date, kind: 'rest', isDeload };
}

/** План на конкретный день (в том числе до старта и после конца программы). */
export function planForDate(date: LocalDate, gymDates: ReadonlySet<LocalDate>): DayPlan {
  if (date < PROGRAM_START) return { date, kind: 'prep', isDeload: false };
  if (date > PROGRAM_END) return { date, kind: 'finished', isDeload: false };
  const plans = planDays(date, gymDates);
  return plans[plans.length - 1]!;
}

export function isCalibrationDay(date: LocalDate): boolean {
  return date === CALIBRATION_DATE;
}

/** Следующая тренировка — противоположная последней завершённой (пробная не в счёт). */
export function nextWorkout(sessions: readonly WorkoutSession[]): 'A' | 'B' {
  const done = sessions
    .filter((s) => s.finishedAt !== undefined && !s.isCalibration)
    .sort((a, b) => (a.finishedAt ?? 0) - (b.finishedAt ?? 0));
  const last = done[done.length - 1];
  if (!last) return 'A';
  return last.workout === 'A' ? 'B' : 'A';
}

/** Даты завершённых тренировок в зале (кроме пробной). */
export function gymDatesOf(sessions: readonly WorkoutSession[]): Set<LocalDate> {
  return new Set(sessions.filter((s) => s.finishedAt !== undefined && !s.isCalibration).map((s) => s.date));
}

// ---------- Состав тренировки ----------

export interface PlannedExercise {
  slot: ProgramSlot;
  exercise: Exercise;
  /** Подходов с учётом фазы 3 и разгрузки. */
  sets: number;
  /** Подходов без разгрузки (для правила «все подходы на максимуме»). */
  normalSets: number;
  /** Шаг для выбранного упражнения (у замены свой). */
  step: number;
  restSeconds: number;
}

/** Слоты тренировки на дату: фаза, замены, +1 подход в фазе 3, подходы × 0,67 в разгрузку. */
export function workoutPlan(
  workout: 'A' | 'B',
  date: LocalDate,
  slots: readonly ProgramSlot[],
  settings: Pick<Settings, 'substitutions' | 'restLong' | 'restShort'>,
): PlannedExercise[] {
  const phaseN = phaseFor(date)?.n ?? 1;
  const phase = PHASES.find((p) => p.n === phaseN)!;
  const deload = deloadFor(date);
  return slots
    .filter((s) => s.workout === workout)
    .filter((s) => (s.fromPhase ?? 1) <= phaseN && phaseN <= (s.toPhase ?? 3))
    .sort((a, b) => a.order - b.order)
    .map((slot) => {
      const sub = settings.substitutions[slot.exerciseId];
      const exerciseId = sub && slot.altExerciseIds.includes(sub) ? sub : slot.exerciseId;
      const normalSets = slot.sets + (phase.extraSetExerciseIds.includes(slot.exerciseId) ? 1 : 0);
      const sets = deload ? Math.max(1, Math.round(normalSets * deload.setsFactor)) : normalSets;
      return {
        slot,
        exercise: getExercise(exerciseId),
        sets,
        normalSets,
        step: exerciseId === slot.exerciseId ? slot.step : (ALT_STEP[exerciseId] ?? slot.step),
        restSeconds: restSeconds(slot, settings),
      };
    });
}

export function restSeconds(slot: ProgramSlot, settings: Pick<Settings, 'restLong' | 'restShort'>): number {
  if (typeof slot.rest === 'number') return slot.rest;
  return slot.rest === 'long' ? settings.restLong : settings.restShort;
}

/** Роль в суперсете: после подхода «первого» — сразу к партнёру, после «второго» — отдых. */
export function supersetRole(plan: readonly PlannedExercise[], index: number): 'lead' | 'follow' | null {
  const p = plan[index];
  if (!p?.slot.supersetWith) return null;
  const partner = plan.find((x) => x.slot.id === p.slot.supersetWith);
  if (!partner) return null;
  return p.slot.order < partner.slot.order ? 'lead' : 'follow';
}

/** Оценка длительности: ~45 с на подход + отдых, плюс 5 минут на разминку и переходы. */
export function estimateMinutes(plan: readonly PlannedExercise[]): number {
  let seconds = 300;
  plan.forEach((p, i) => {
    const rest = supersetRole(plan, i) === 'lead' ? 0 : p.restSeconds;
    seconds += p.sets * (45 + rest) * (p.exercise.perSide ? 1.6 : 1);
  });
  return Math.round(seconds / 60 / 5) * 5;
}

export { REST_SUPERSET };
