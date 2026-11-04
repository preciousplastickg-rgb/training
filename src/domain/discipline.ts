// Дисциплина — SPEC 5.8.

import type { LocalDate, PoolSession } from '../db/types';
import type { DayPlan } from './program';

/** 'moved' — зал не состоялся, но перенесён на следующий день (одна тренировка — один пропуск). */
export type DayStatus = 'gym' | 'pool' | 'rest' | 'missed' | 'moved' | 'pending' | 'future';

export interface GymDone {
  date: LocalDate;
  /** Доля выполненных рабочих подходов от плана. */
  ratio: number;
}

export const GYM_MIN_RATIO = 0.8;
export const POOL_MIN_MINUTES = 20;

/**
 * Статус дня: зал выполнен (сессия завершена, ≥ 80% подходов), бассейн (≥ 20 мин), отдых, пропуск.
 * Сегодняшний невыполненный день — 'pending', а не пропуск.
 */
export function dayStatuses(
  plans: readonly DayPlan[],
  gym: readonly GymDone[],
  pool: readonly PoolSession[],
  today: LocalDate,
): Map<LocalDate, DayStatus> {
  const gymOk = new Set(gym.filter((g) => g.ratio >= GYM_MIN_RATIO).map((g) => g.date));
  const poolOk = new Set(pool.filter((p) => p.minutes >= POOL_MIN_MINUTES).map((p) => p.date));
  const out = new Map<LocalDate, DayStatus>();
  plans.forEach((p, i) => {
    if (p.date > today) {
      out.set(p.date, 'future');
      return;
    }
    let s: DayStatus;
    if (gymOk.has(p.date)) s = 'gym';
    else if (poolOk.has(p.date)) s = 'pool';
    else if (p.kind === 'gym' || p.kind === 'pool') {
      if (p.date === today) s = 'pending';
      else s = p.kind === 'gym' && plans[i + 1]?.makeup ? 'moved' : 'missed';
    } else s = 'rest';
    out.set(p.date, s);
  });
  return out;
}

export interface DisciplineSummary {
  planned: number;
  done: number;
  streak: number;
}

/**
 * «Выполнено N из M тренировок · серия K дней».
 * Тренировки — обязательные дни (зал и бассейн по плану) до сегодня.
 * Серия — дни подряд до сегодня без пропусков; отдых серию не ломает и входит в неё.
 */
export function disciplineSummary(plans: readonly DayPlan[], statuses: ReadonlyMap<LocalDate, DayStatus>): DisciplineSummary {
  let planned = 0;
  let done = 0;
  for (const p of plans) {
    const s = statuses.get(p.date);
    if (s === 'future' || s === 'pending' || s === 'moved') continue;
    if (p.kind === 'gym' || p.kind === 'pool') {
      planned++;
      if (s === 'gym' || s === 'pool') done++;
    } else if (s === 'gym' || s === 'pool') {
      // сделано сверх плана — тоже тренировка
      planned++;
      done++;
    }
  }
  let streak = 0;
  for (let i = plans.length - 1; i >= 0; i--) {
    const s = statuses.get(plans[i]!.date);
    if (s === 'future' || s === 'pending') continue;
    if (s === 'missed') break;
    if (s === 'moved') continue;
    streak++;
  }
  return { planned, done, streak };
}
