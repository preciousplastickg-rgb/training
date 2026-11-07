// Разум: сон и медитация. Записи — в BodyEntry той же даты (sleepMin — ночь перед этим утром, meditationMin — за день).
// Норма сна взрослого — 7–9 часов; линия цели — 8 часов, как в подсказке лёгкой недели (SPEC 5.9).

import type { BodyEntry, LocalDate } from '../db/types';
import { addDays, diffDays } from './dates';

export const SLEEP_TARGET_MIN = 8 * 60;
/** Ниже — недосып: столбик графика другим цветом. */
export const SLEEP_OK_MIN = 7 * 60;

export interface MinutesPoint {
  date: LocalDate;
  min: number | null;
}

function series(body: readonly BodyEntry[], key: 'sleepMin' | 'meditationMin', from: LocalDate, to: LocalDate): MinutesPoint[] {
  const byDate = new Map(body.map((b) => [b.date, b[key]]));
  const out: MinutesPoint[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const v = byDate.get(d);
    out.push({ date: d, min: typeof v === 'number' ? v : null });
  }
  return out;
}

/** Сон по дням с `from` по `to` включительно; не записан — null. */
export const sleepSeries = (body: readonly BodyEntry[], from: LocalDate, to: LocalDate) => series(body, 'sleepMin', from, to);

/** Медитация по дням; не записана — null (0 — записан ноль). */
export const meditationSeries = (body: readonly BodyEntry[], from: LocalDate, to: LocalDate) => series(body, 'meditationMin', from, to);

/** Средний сон за 7 дней по `date` включительно — по записанным ночам, целые минуты. Нет записей — null. */
export function avgSleep(body: readonly BodyEntry[], date: LocalDate, days = 7): number | null {
  const xs = sleepSeries(body, addDays(date, -(days - 1)), date)
    .map((p) => p.min)
    .filter((m): m is number => m !== null && m > 0);
  if (!xs.length) return null;
  return Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
}

/**
 * Серия медитаций: дни подряд с медитацией > 0, заканчивая сегодня.
 * Сегодня ещё не записано — серия не прерывается и считается со вчера.
 */
export function meditationStreak(body: readonly BodyEntry[], today: LocalDate): number {
  const done = new Set(body.filter((b) => (b.meditationMin ?? 0) > 0).map((b) => b.date));
  let d = done.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (done.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

/** Лучшая серия медитаций за всё время. */
export function bestMeditationStreak(body: readonly BodyEntry[]): number {
  const dates = body
    .filter((b) => (b.meditationMin ?? 0) > 0)
    .map((b) => b.date)
    .sort();
  let best = 0;
  let run = 0;
  for (let i = 0; i < dates.length; i++) {
    run = i > 0 && diffDays(dates[i - 1]!, dates[i]!) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

/** Медитация за 7 дней по `date` включительно: сумма минут и число дней с медитацией. */
export function meditationWeek(body: readonly BodyEntry[], date: LocalDate): { minutes: number; days: number } {
  const xs = meditationSeries(body, addDays(date, -6), date).filter((p) => (p.min ?? 0) > 0);
  return { minutes: xs.reduce((a, p) => a + p.min!, 0), days: xs.length };
}
