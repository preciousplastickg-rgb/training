// Пульс в покое и лёгкая неделя — SPEC 5.9.
// Базовая линия — среднее за первые 7 дней с записью от старта программы; после каждой разгрузки —
// по 7 дням этой разгрузки. Сигнал: 3 дня подряд ≥ базовая + 5 → карточка; «Принять» → LightWeek на 7 дней
// с завтрашнего дня, повторно в течение 14 дней не показывать.

import { DELOADS, HR_BASELINE_DAYS, HR_SIGNAL_DAYS, HR_SIGNAL_DELTA, LIGHT_WEEK_COOLDOWN_DAYS, LIGHT_WEEK_DAYS, PROGRAM_START } from '../data/program';
import type { BodyEntry, LightWeek, LocalDate } from '../db/types';
import { addDays } from './dates';

const MIN_BASELINE_ENTRIES = 3;

const avg = (xs: readonly number[]) => Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;

/** Записи пульса по дате, от старых к новым. */
function hrEntries(body: readonly BodyEntry[]): { date: LocalDate; hr: number }[] {
  return body
    .filter((b): b is BodyEntry & { restingHr: number } => typeof b.restingHr === 'number' && b.restingHr > 0)
    .map((b) => ({ date: b.date, hr: b.restingHr }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Базовая линия на дату: после последней прошедшей разгрузки — среднее её 7 дней (если записей ≥ 3),
 * иначе среднее первых 7 дней с записью от старта программы. Меньше 3 записей — null.
 */
export function hrBaseline(body: readonly BodyEntry[], date: LocalDate): number | null {
  const entries = hrEntries(body);
  const lastDeload = [...DELOADS].reverse().find((d) => d.end < date);
  if (lastDeload) {
    const inDeload = entries.filter((e) => e.date >= lastDeload.start && e.date <= lastDeload.end);
    if (inDeload.length >= MIN_BASELINE_ENTRIES) return avg(inDeload.map((e) => e.hr));
  }
  const first = entries.filter((e) => e.date >= PROGRAM_START && e.date <= date).slice(0, HR_BASELINE_DAYS);
  if (first.length < MIN_BASELINE_ENTRIES) return null;
  return avg(first.map((e) => e.hr));
}

export interface LightWeekSignal {
  baseline: number;
  /** Пульс за 3 дня подряд, заканчивая `date`. */
  days: { date: LocalDate; hr: number }[];
}

/**
 * Карточка лёгкой недели: 3 дня подряд (по `date` включительно) пульс ≥ базовая + 5.
 * Не показывать во время лёгкой недели и 14 дней после принятия предыдущей.
 */
export function lightWeekSignal(body: readonly BodyEntry[], date: LocalDate, lightWeeks: readonly LightWeek[] = []): LightWeekSignal | null {
  // Принята в день start − 1: 14 дней с этого дня включительно — без карточки.
  if (lightWeeks.some((w) => date >= addDays(w.start, -1) && date <= addDays(w.start, LIGHT_WEEK_COOLDOWN_DAYS - 2))) return null;
  if (lightWeeks.some((w) => date >= w.start && date <= w.end)) return null;
  const baseline = hrBaseline(body, date);
  if (baseline === null) return null;
  const byDate = new Map(hrEntries(body).map((e) => [e.date, e.hr]));
  const days: LightWeekSignal['days'] = [];
  for (let i = HR_SIGNAL_DAYS - 1; i >= 0; i--) {
    const d = addDays(date, -i);
    const hr = byDate.get(d);
    if (hr === undefined || hr < baseline + HR_SIGNAL_DELTA) return null;
    days.push({ date: d, hr });
  }
  // Базовые 7 дней сами по себе не сигнал: сравниваем только дни после них.
  const firstDays = hrEntries(body).filter((e) => e.date >= PROGRAM_START).slice(0, HR_BASELINE_DAYS);
  if (firstDays.length && days[0]!.date <= firstDays[firstDays.length - 1]!.date && !DELOADS.some((d) => d.end < date)) return null;
  return { baseline, days };
}

/** «Принять» сегодня → лёгкая неделя с завтрашнего дня на 7 дней. */
export function lightWeekFrom(acceptedOn: LocalDate): Omit<LightWeek, 'id'> {
  return { start: addDays(acceptedOn, 1), end: addDays(acceptedOn, LIGHT_WEEK_DAYS), reason: 'resting_hr' };
}

/** Точки мини-графика пульса по дням и линия базовой линии (SPEC 6.4, Тело). */
export function hrSeries(body: readonly BodyEntry[], from: LocalDate, to: LocalDate): { date: LocalDate; hr: number | null }[] {
  const byDate = new Map(hrEntries(body).map((e) => [e.date, e.hr]));
  const out: { date: LocalDate; hr: number | null }[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push({ date: d, hr: byDate.get(d) ?? null });
  return out;
}
