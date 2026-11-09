// Тело — SPEC 5.5: средний вес, % жира (ВМС США), сухая масса, прогноз, прогресс пути.

import type { BodyEntry, Kg100, LocalDate } from '../db/types';
import { addDays, diffDays } from './dates';

/** Среднее записей веса за 7 календарных дней по `date` включительно; минимум 3 записи. */
export function avg7(entries: readonly BodyEntry[], date: LocalDate): Kg100 | null {
  const from = addDays(date, -6);
  const ws = entries.filter((e) => e.weight !== undefined && e.date >= from && e.date <= date).map((e) => e.weight!);
  if (ws.length < 3) return null;
  return Math.round(ws.reduce((a, b) => a + b, 0) / ws.length);
}

/** % жира по формуле ВМС США. Талия и шея — см × 10, рост — см. Округление до 0,1. */
export function bodyFatPercent(waist10: number, neck10: number, heightCm: number): number | null {
  const diff = (waist10 - neck10) / 10;
  if (diff <= 0 || heightCm <= 0) return null;
  const v = 495 / (1.0324 - 0.19077 * Math.log10(diff) + 0.15456 * Math.log10(heightCm)) - 450;
  return Math.round(v * 10) / 10;
}

export function leanMass(weight: Kg100, bodyFat: number): Kg100 {
  return Math.round(weight * (1 - bodyFat / 100));
}

/** Целевой вес при сохранении сухой массы: сухая / (1 − цель%/100). Для 15% — сухая / 0,85. */
export function targetWeightFor(weight: Kg100, bodyFat: number, targetBodyFat: number): Kg100 {
  return Math.round(leanMass(weight, bodyFat) / (1 - targetBodyFat / 100));
}

/** (старт − среднее) / (старт − цель), от 0 до 1. */
export function pathProgress(start: Kg100, target: Kg100, current: Kg100): number {
  if (start === target) return 1;
  return Math.min(1, Math.max(0, (start - current) / (start - target)));
}

/**
 * Прогноз даты цели: линейная регрессия среднего веса за последние 21 день.
 * Меньше 14 дней со средним — null. Нет снижения — null.
 */
export function forecastDate(entries: readonly BodyEntry[], date: LocalDate, target: Kg100): LocalDate | null {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 20; i >= 0; i--) {
    const d = addDays(date, -i);
    const a = avg7(entries, d);
    if (a !== null) {
      xs.push(-i);
      ys.push(a);
    }
  }
  if (xs.length < 14) return null;
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) ** 2;
  }
  const slope = num / den;
  if (!(slope < 0)) return null;
  const intercept = my - slope * mx;
  if (intercept <= target) return date;
  const days = Math.ceil((target - intercept) / slope);
  return days > 3650 ? null : addDays(date, days);
}

/** Изменение среднего за неделю: avg7(date) − avg7(date − 7). */
export function weeklyChange(entries: readonly BodyEntry[], date: LocalDate): Kg100 | null {
  const now = avg7(entries, date);
  const before = avg7(entries, addDays(date, -7));
  return now === null || before === null ? null : now - before;
}

/** Последняя запись с полем до даты включительно. */
export function latestWith<K extends keyof BodyEntry>(entries: readonly BodyEntry[], key: K, date?: LocalDate): BodyEntry | null {
  let best: BodyEntry | null = null;
  for (const e of entries) {
    if (e[key] === undefined || (date && e.date > date)) continue;
    if (!best || e.date > best.date) best = e;
  }
  return best;
}

export function firstWith<K extends keyof BodyEntry>(entries: readonly BodyEntry[], key: K): BodyEntry | null {
  let best: BodyEntry | null = null;
  for (const e of entries) {
    if (e[key] === undefined) continue;
    if (!best || e.date < best.date) best = e;
  }
  return best;
}

/** % жира на дату по последним талии и шее. */
export function bodyFatAt(entries: readonly BodyEntry[], heightCm: number, date?: LocalDate): number | null {
  const e = latestWithBoth(entries, date);
  return e ? bodyFatPercent(e.waist!, e.neck!, heightCm) : null;
}

function latestWithBoth(entries: readonly BodyEntry[], date?: LocalDate): BodyEntry | null {
  let best: BodyEntry | null = null;
  for (const e of entries) {
    if (e.waist === undefined || e.neck === undefined || (date && e.date > date)) continue;
    if (!best || e.date > best.date) best = e;
  }
  return best;
}

export function firstBodyFat(entries: readonly BodyEntry[], heightCm: number): number | null {
  let best: BodyEntry | null = null;
  for (const e of entries) {
    if (e.waist === undefined || e.neck === undefined) continue;
    if (!best || e.date < best.date) best = e;
  }
  return best ? bodyFatPercent(best.waist!, best.neck!, heightCm) : null;
}

// ---------- обхваты в профиле (SPEC 6.5) ----------

export type GirthKey = 'waist' | 'neck' | 'shoulders' | 'wrist';
export const GIRTH_KEYS: readonly GirthKey[] = ['waist', 'neck', 'shoulders', 'wrist'];

/** Допустимые обхваты, см: вне диапазона — опечатка, значение не принимается. */
export const GIRTH_RANGE: Record<GirthKey, readonly [number, number]> = {
  waist: [50, 160],
  neck: [25, 60],
  shoulders: [70, 170],
  wrist: [12, 26],
};

export interface Girth {
  /** См × 10. */
  value: number;
  date: LocalDate;
}

/** Последний замер каждого обхвата на дату (не позже `date`). */
export function latestGirths(entries: readonly BodyEntry[], date: LocalDate): Record<GirthKey, Girth | null> {
  const out = {} as Record<GirthKey, Girth | null>;
  for (const k of GIRTH_KEYS) {
    const e = latestWith(entries, k, date);
    out[k] = e ? { value: e[k]!, date: e.date } : null;
  }
  return out;
}

/** «92,5» / «92.5» / «92 см» → 925 (см × 10, до 0,1 см) в диапазоне обхвата; иначе null. */
export function parseGirth(input: string, key: GirthKey): number | null {
  const s = input.replace(/см/i, '').replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const v = Math.round(Number(s) * 10);
  const [min, max] = GIRTH_RANGE[key];
  return v >= min * 10 && v <= max * 10 ? v : null;
}

export interface BodyComposition {
  /** Средний вес за 7 дней, иначе последний записанный. */
  weight: Kg100 | null;
  /** % жира по последним талии и шее и разница с первым замером. */
  fat: number | null;
  fatDelta: number | null;
  /** Сухая масса («мышцы») и разница со стартом, Kg100. */
  lean: Kg100 | null;
  leanDelta: Kg100 | null;
  /** Талия, см × 10, и разница с первым замером. */
  waist: number | null;
  waistDelta: number | null;
}

/** Состав тела на дату: то, что показывают «Прогресс · Тело» и карточка тела на «Сегодня». */
export function bodyComposition(entries: readonly BodyEntry[], heightCm: number, startWeight: Kg100, date: LocalDate): BodyComposition {
  const weight = avg7(entries, date) ?? latestWith(entries, 'weight', date)?.weight ?? null;
  const fat = bodyFatAt(entries, heightCm, date);
  const fat0 = firstBodyFat(entries, heightCm);
  const waist = latestWith(entries, 'waist', date)?.waist ?? null;
  const waist0 = firstWith(entries, 'waist')?.waist ?? null;
  const lean = weight !== null && fat !== null ? leanMass(weight, fat) : null;
  const lean0 = fat0 !== null ? leanMass(firstWith(entries, 'weight')?.weight ?? startWeight, fat0) : null;
  return {
    weight,
    fat,
    fatDelta: fat !== null && fat0 !== null ? Math.round((fat - fat0) * 10) / 10 : null,
    lean,
    leanDelta: lean !== null && lean0 !== null ? lean - lean0 : null,
    waist,
    waistDelta: waist !== null && waist0 !== null ? waist - waist0 : null,
  };
}

/** Ряд для графика: вес по дням и среднее за 7 дней. */
export function weightSeries(entries: readonly BodyEntry[], from: LocalDate, to: LocalDate) {
  const byDate = new Map(entries.filter((e) => e.weight !== undefined).map((e) => [e.date, e.weight!]));
  const out: { date: LocalDate; weight: Kg100 | null; avg: Kg100 | null }[] = [];
  const n = diffDays(from, to);
  for (let i = 0; i <= n; i++) {
    const d = addDays(from, i);
    out.push({ date: d, weight: byDate.get(d) ?? null, avg: avg7(entries, d) });
  }
  return out;
}

/** Цель как ориентир: «≈ 72 кг» — округление до целого (SPEC 5.5). */
export function roundTargetKg(kg100: Kg100): Kg100 {
  return Math.round(kg100 / 100) * 100;
}

export interface TargetRefinement {
  /** Дата замера талии и шеи на контрольной точке. */
  measuredAt: LocalDate;
  bodyFat: number;
  /** Новая цель от текущего среднего веса (точная, Kg100). */
  newTarget: Kg100;
  oldTarget: Kg100;
}

/**
 * Уточнение цели на контрольной точке (SPEC 5.5, REDESIGN 6): талия и шея записаны в окне
 * [точка, точка + 14 дней] → цель от среднего веса на дату замера (нет среднего — вес записи,
 * иначе последний вес) и нового % жира. Разница с текущей целью < 0,5 кг — ничего не предлагать.
 * `dismissedAt` — дата замера, для которого выбрали «Оставить».
 */
export function targetRefinement(
  entries: readonly BodyEntry[],
  checkpoints: readonly { date: LocalDate }[],
  settings: { heightCm: number; targetWeight: Kg100; targetBodyFat: number; startDate: LocalDate },
  date: LocalDate,
  dismissedAt?: LocalDate,
): TargetRefinement | null {
  const cp = [...checkpoints].filter((c) => c.date <= date).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  if (!cp) return null;
  const windowEnd = addDays(cp.date, 14);
  const e = latestWithBoth(entries, date < windowEnd ? date : windowEnd);
  if (!e || e.date < cp.date || e.date <= settings.startDate) return null;
  if (dismissedAt === e.date) return null;
  const fat = bodyFatPercent(e.waist!, e.neck!, settings.heightCm);
  if (fat === null) return null;
  const weight = avg7(entries, e.date) ?? e.weight ?? latestWith(entries, 'weight', e.date)?.weight;
  if (weight === undefined) return null;
  const newTarget = targetWeightFor(weight, fat, settings.targetBodyFat);
  if (Math.abs(newTarget - settings.targetWeight) < 50) return null;
  return { measuredAt: e.date, bodyFat: fat, newTarget, oldTarget: settings.targetWeight };
}
