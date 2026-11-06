// Календарь тренировок: план на каждый день с проекцией вперёд и факт (SPEC 3.2, 5.1, 5.8).

import { PROGRAM_END, PROGRAM_START } from '../data/program';
import type { LocalDate, PoolSession, WorkoutSession } from '../db/types';
import { addDays } from './dates';
import { dayStatuses, POOL_MIN_MINUTES, type DayStatus, type GymDone } from './discipline';
import { gymDatesOf, nextWorkout, planDays, type DayPlan, type PlanOptions } from './program';

export interface CalendarDay {
  date: LocalDate;
  plan: DayPlan;
  status: DayStatus;
  /** Тренировка в зале: сделанная или ожидаемая по чередованию. */
  workout?: 'A' | 'B';
  /** Буква ожидаемая (если ходить по плану), а не по сделанной тренировке. */
  projected: boolean;
  /** Завершённая тренировка в этот день (последняя, если их несколько). */
  session?: WorkoutSession;
  pool: PoolSession[];
}

/**
 * Дни с `from` по `to` включительно.
 * Будущие залы — по плану, будто ходишь без пропусков; буквы A/B чередуются от следующей по очереди.
 * Пропуск сдвигает и дни, и буквы — календарь пересчитывается от фактических тренировок.
 */
export function calendarDays(
  from: LocalDate,
  to: LocalDate,
  today: LocalDate,
  sessions: readonly WorkoutSession[],
  gym: readonly GymDone[],
  pool: readonly PoolSession[],
  opts: PlanOptions = {},
): CalendarDay[] {
  const finished = sessions.filter((s) => s.finishedAt !== undefined).sort((a, b) => (a.finishedAt ?? 0) - (b.finishedAt ?? 0));
  const sessionByDate = new Map(finished.map((s) => [s.date, s]));
  const plans = planDays(to < PROGRAM_END ? to : PROGRAM_END, gymDatesOf(sessions), today, opts);
  const planByDate = new Map(plans.map((p) => [p.date, p]));
  const statuses = dayStatuses(plans, gym, pool, today);

  // Буквы на будущее: от сегодняшнего дня, если зал сегодня ещё не сделан.
  const letters = new Map<LocalDate, 'A' | 'B'>();
  let next = nextWorkout(sessions);
  for (const p of plans) {
    if (p.date < today || p.kind !== 'gym' || sessionByDate.has(p.date)) continue;
    letters.set(p.date, next);
    next = next === 'A' ? 'B' : 'A';
  }

  const out: CalendarDay[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const session = sessionByDate.get(d);
    const dayPool = pool.filter((x) => x.date === d);
    const plan: DayPlan =
      planByDate.get(d) ?? { date: d, kind: d < PROGRAM_START ? 'prep' : 'finished', isDeload: false };
    let status = statuses.get(d);
    if (!status) {
      // До старта и после конца программы плана нет: только факт.
      if (session) status = 'gym';
      else if (dayPool.some((x) => x.minutes >= POOL_MIN_MINUTES)) status = 'pool';
      else status = d > today ? 'future' : 'rest';
    }
    const projected = !session && letters.has(d);
    out.push({
      date: d,
      plan,
      status,
      workout: session?.workout ?? letters.get(d),
      projected,
      ...(session ? { session } : {}),
      pool: dayPool,
    });
  }
  return out;
}
