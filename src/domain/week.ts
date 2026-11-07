// Полоса недели на «Сегодня» (REDESIGN 4): 7 кружков пн–вс — сделано (зал A/B/C, бассейн), сегодня, план.

import { POOL_TYPE_NAMES, PROGRAM_END, PROGRAM_START, REST_DAY_STEPS } from '../data/program';
import type { BodyEntry, LightWeek, LocalDate, PoolSession, ProgramSlot, SetLog, Settings, Workout, WorkoutSession } from '../db/types';
import type { CalendarDay } from './calendar';
import { addDays, weekStart } from './dates';
import { POOL_MIN_MINUTES } from './discipline';
import { formatInt } from './format';
import { gymDatesOf, nextWorkout, planDays, planOptionsOf, workoutAfter, workoutPlan } from './program';
import { volume } from './records';

export type WeekDayState = 'gym_done' | 'pool_done' | 'gym_plan' | 'gym_missed' | 'pool_plan' | 'pool_optional' | 'rest';

export interface WeekDay {
  date: LocalDate;
  /** «Пн» … «Вс». */
  name: string;
  state: WeekDayState;
  /** A / B / C для зала, «≈» для бассейна, «·» для отдыха. */
  label: string;
  today: boolean;
  past: boolean;
}

const NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export function weekStrip(
  today: LocalDate,
  sessions: readonly WorkoutSession[],
  pool: readonly PoolSession[],
  settings: Pick<Settings, 'schedule' | 'dayOverrides'>,
  lightWeeks: readonly LightWeek[] = [],
): WeekDay[] {
  const start = weekStart(today);
  const end = addDays(start, 6);
  const finished = sessions.filter((s) => s.finishedAt !== undefined && !s.isCalibration);
  const byDate = new Map(finished.map((s) => [s.date, s]));
  const plans = new Map(planDays(end, gymDatesOf(sessions), today, planOptionsOf(settings, lightWeeks)).map((p) => [p.date, p]));
  let next = nextWorkout(sessions);
  const out: WeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    const s = byDate.get(d);
    const poolMin = pool.filter((p) => p.date === d).reduce((a, p) => a + p.minutes, 0);
    const plan = plans.get(d);
    let state: WeekDayState = 'rest';
    let label = '·';
    if (s) {
      state = 'gym_done';
      label = s.workout;
    } else if (poolMin >= POOL_MIN_MINUTES) {
      state = 'pool_done';
      label = '≈';
    } else if (plan?.kind === 'gym' && d >= today) {
      state = 'gym_plan';
      label = next;
      next = workoutAfter(next);
    } else if (plan?.kind === 'pool' || plan?.kind === 'pool_optional') {
      state = plan.kind === 'pool' ? 'pool_plan' : 'pool_optional';
      label = '≈';
    } else if (plan?.kind === 'gym') {
      // Пропущенный зал в прошлом: буква не известна.
      state = 'gym_missed';
      label = '–';
    }
    out.push({ date: d, name: NAMES[i]!, state, label, today: d === today, past: d < today });
  }
  return out;
}

// ---------- Список недели на вкладке «Тренировка» (макет BWorkout) ----------

export type WeekRowStatus = 'done' | 'today' | 'plan' | 'optional' | 'rest' | 'missed' | 'prep' | 'finished';

export interface WeekRow {
  date: LocalDate;
  name: string;
  /** Число месяца. */
  day: number;
  /** «Тренировка A», «Бассейн · техника», «Отдых». */
  title: string;
  /** «62 мин · 6 420 кг», «10 упражнений», «60 мин · по плану», «по желанию», «8 000 шагов», «8 400 из 8 000 шагов». */
  sub: string;
  status: WeekRowStatus;
  today: boolean;
}

const poolTitle = (type: PoolSession['type'] | undefined) => (type ? `Бассейн · ${POOL_TYPE_NAMES[type]}` : 'Бассейн');

/** 7 строк текущей недели: что сделано (с длительностью и объёмом), что сегодня, что по плану. */
export function weekRows(
  today: LocalDate,
  sessions: readonly WorkoutSession[],
  sets: readonly SetLog[],
  pool: readonly PoolSession[],
  slots: readonly ProgramSlot[],
  settings: Settings,
  body: readonly BodyEntry[] = [],
  lightWeeks: readonly LightWeek[] = [],
): WeekRow[] {
  const strip = weekStrip(today, sessions, pool, settings, lightWeeks);
  const end = addDays(weekStart(today), 6);
  const plans = new Map(planDays(end, gymDatesOf(sessions), today, planOptionsOf(settings, lightWeeks)).map((p) => [p.date, p]));
  const finished = sessions.filter((s) => s.finishedAt !== undefined && !s.isCalibration);
  return strip.map((d) => {
    const day = Number(d.date.slice(8));
    const base = { date: d.date, name: d.name, day, today: d.today };
    const plan = plans.get(d.date);
    switch (d.state) {
      case 'gym_done': {
        const s = finished.find((x) => x.date === d.date)!;
        const min = Math.round(((s.finishedAt ?? s.startedAt) - s.startedAt) / 60000);
        const vol = volume(sets.filter((x) => x.sessionId === s.id));
        return { ...base, title: `Тренировка ${s.workout}`, sub: `${min} мин · ${formatInt(Math.round(vol / 100))} кг${s.isDeload ? ' · разгрузка' : ''}`, status: 'done' };
      }
      case 'pool_done': {
        const mine = pool.filter((p) => p.date === d.date);
        const min = mine.reduce((a, p) => a + p.minutes, 0);
        const m = mine.reduce((a, p) => a + (p.meters ?? 0), 0);
        return { ...base, title: poolTitle(mine[0]?.type), sub: `${min} мин${m ? ` · ${formatInt(m)} м` : ''}`, status: 'done' };
      }
      case 'gym_plan': {
        const n = workoutPlan(d.label as Workout, d.date, slots, settings, { lightWeeks }).length;
        const sub = `${n} упражнений${plan?.isDeload ? ' · разгрузка' : ''}${plan?.lightWeek ? ' · лёгкая неделя' : ''}${plan?.makeup ? ' · перенос' : ''}`;
        return { ...base, title: `Тренировка ${d.label}`, sub, status: d.today ? 'today' : 'plan' };
      }
      case 'gym_missed':
        return { ...base, title: 'Тренировка', sub: plans.get(addDays(d.date, 1))?.makeup ? 'перенесена на завтра' : 'не состоялась', status: 'missed' };
      case 'pool_plan':
        // Полный план («10 × 100 м, отдых 30 с…») в строку не помещается — он в шторке записи.
        return {
          ...base, title: poolTitle(plan?.pool?.type), sub: d.past ? 'не состоялся' : `${plan?.pool?.minutes ?? 0} мин · по плану`,
          status: d.past ? 'missed' : d.today ? 'today' : 'plan',
        };
      case 'pool_optional':
        return { ...base, title: poolTitle(plan?.pool?.type), sub: plan?.gymBlocked ? 'по желанию · зал перенесён' : 'по желанию', status: 'optional' };
      default:
        if (d.date < PROGRAM_START) return { ...base, title: 'Подготовка', sub: 'пробная тренировка и замеры', status: 'prep' };
        if (d.date > PROGRAM_END) return { ...base, title: 'Программа завершена', sub: '', status: 'finished' };
        {
          // Шаги за день отдыха — в строке; цель набрана → «сделано».
          const steps = body.find((b) => b.date === d.date)?.steps;
          const moved = plan?.gymBlocked ? ' · зал перенесён' : '';
          if (steps) return { ...base, title: 'Отдых', sub: `${formatInt(steps)} из ${formatInt(REST_DAY_STEPS)} шагов${moved}`, status: steps >= REST_DAY_STEPS ? 'done' : 'rest' };
          return { ...base, title: 'Отдых', sub: `${formatInt(REST_DAY_STEPS)} шагов${moved}`, status: 'rest' };
        }
    }
  });
}

export interface MonthStats {
  gymDone: number;
  gymPlanned: number;
  poolDone: number;
  poolPlanned: number;
}

/**
 * «Январь: зал 5 из 6 · бассейн 4 из 4» — по дням месяца до сегодня, тем же правилом, что дисциплина (SPEC 5.8):
 * перенесённый и сегодняшний невыполненный день не в счёт; сделанное сверх плана увеличивает план.
 */
export function monthStats(days: readonly CalendarDay[], month: string, today: LocalDate): MonthStats {
  const out: MonthStats = { gymDone: 0, gymPlanned: 0, poolDone: 0, poolPlanned: 0 };
  for (const d of days) {
    if (!d.date.startsWith(month) || d.date > today) continue;
    if (d.status === 'future' || d.status === 'pending' || d.status === 'moved') continue;
    const poolDone = d.pool.some((p) => p.minutes >= POOL_MIN_MINUTES);
    if (d.plan.kind === 'gym' || d.status === 'gym') {
      out.gymPlanned++;
      if (d.status === 'gym') out.gymDone++;
    }
    if (d.plan.kind === 'pool' || poolDone) {
      out.poolPlanned++;
      if (poolDone) out.poolDone++;
    }
  }
  return out;
}

/** Ближайший зал после `after`: дата и буква по кругу. */
export function nextGym(
  after: LocalDate,
  sessions: readonly WorkoutSession[],
  settings: Pick<Settings, 'schedule' | 'dayOverrides'>,
  lightWeeks: readonly LightWeek[] = [],
): { date: LocalDate; workout: Workout } | null {
  const from = addDays(after, 1);
  const plans = planDays(addDays(after, 14), gymDatesOf(sessions), from, planOptionsOf(settings, lightWeeks));
  const p = plans.find((x) => x.date >= from && x.kind === 'gym');
  return p ? { date: p.date, workout: nextWorkout(sessions) } : null;
}
