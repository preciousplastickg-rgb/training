// Полоса недели на «Сегодня» (REDESIGN 4): 7 кружков пн–вс — сделано (зал A/B, бассейн), сегодня, план.

import type { LocalDate, PoolSession, Settings, WorkoutSession } from '../db/types';
import { addDays, weekStart } from './dates';
import { POOL_MIN_MINUTES } from './discipline';
import { gymDatesOf, nextWorkout, planDays, planOptionsOf } from './program';

export type WeekDayState = 'gym_done' | 'pool_done' | 'gym_plan' | 'gym_missed' | 'pool_plan' | 'pool_optional' | 'rest';

export interface WeekDay {
  date: LocalDate;
  /** «Пн» … «Вс». */
  name: string;
  state: WeekDayState;
  /** A / B для зала, «≈» для бассейна, «·» для отдыха. */
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
): WeekDay[] {
  const start = weekStart(today);
  const end = addDays(start, 6);
  const finished = sessions.filter((s) => s.finishedAt !== undefined && !s.isCalibration);
  const byDate = new Map(finished.map((s) => [s.date, s]));
  const plans = new Map(planDays(end, gymDatesOf(sessions), today, planOptionsOf(settings)).map((p) => [p.date, p]));
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
      next = next === 'A' ? 'B' : 'A';
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
