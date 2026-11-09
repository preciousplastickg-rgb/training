// 3D-двойник — docs/TWIN-3D.md, раздел 4: тело по данным пользователя. Чистые функции, UI только вызывает их.
//
// bf — % жира по ВМС США (SPEC 5.5) по последней паре талия/шея; нет замеров — bfStart из манифеста.
// lean = clamp((bfStart − bf) / (bfStart − bfGoal), 0, 1); definition = clamp((bfStart − bf) / 12, 0,15, 0,9).
// muscle = clamp((сухая масса сейчас − на старте) / 3 кг, 0, 1); сухая масса — по 7-дневным средним (SPEC 5.5).

import type { BodyEntry, Kg100, LocalDate } from '../db/types';
import { avg7, bodyFatAt, bodyFatPercent, firstBodyFat, latestWith, leanMass } from './body';
import { addDays, diffDays, weekStart } from './dates';

export interface TwinMeta {
  bfStart: number;
  bfGoal: number;
}

/** Параметры двойника: % жира и веса морфов `lean`, `muscle`, сила рельефа `definition` (material.normalScale). */
export interface TwinBody {
  bf: number;
  lean: number;
  definition: number;
  muscle: number;
}

/** +3 кг сухой массы = морф `muscle` целиком, Kg100. */
export const MUSCLE_FULL: Kg100 = 300;

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

export function leanFromBf(bf: number, meta: TwinMeta): number {
  if (meta.bfStart === meta.bfGoal) return bf <= meta.bfGoal ? 1 : 0;
  return clamp((meta.bfStart - bf) / (meta.bfStart - meta.bfGoal), 0, 1);
}

export function definitionFromBf(bf: number, meta: TwinMeta): number {
  return clamp((meta.bfStart - bf) / 12, 0.15, 0.9);
}

/** Сухая масса сейчас против старта, Kg100 → 0..1. */
export function muscleFromLean(leanNow: Kg100, leanStart: Kg100): number {
  return clamp((leanNow - leanStart) / MUSCLE_FULL, 0, 1);
}

export function twinBody(bf: number, muscle: number, meta: TwinMeta): TwinBody {
  return { bf, lean: leanFromBf(bf, meta), definition: definitionFromBf(bf, meta), muscle: clamp(muscle, 0, 1) };
}

export interface TwinPerson {
  heightCm: number;
  startDate: LocalDate;
  startWeight: Kg100;
}

/** Сухая масса на дату: средний вес за 7 дней × (1 − % жира). Нет среднего или замеров — null. */
export function leanAt(entries: readonly BodyEntry[], heightCm: number, date: LocalDate): Kg100 | null {
  const w = avg7(entries, date);
  const bf = bodyFatAt(entries, heightCm, date);
  return w !== null && bf !== null ? leanMass(w, bf) : null;
}

/** «Старт» — на Settings.startDate: % жира по замеру на эту дату или первому после неё, иначе bfStart. */
export function twinStart(entries: readonly BodyEntry[], p: TwinPerson, meta: TwinMeta): TwinBody {
  const bf = bodyFatAt(entries, p.heightCm, p.startDate) ?? firstBodyFat(entries, p.heightCm) ?? meta.bfStart;
  return twinBody(bf, 0, meta);
}

/** Сухая масса «Старта»: средний вес на startDate (иначе стартовый вес) × (1 − % жира старта). */
export function startLean(entries: readonly BodyEntry[], p: TwinPerson): Kg100 | null {
  const bf = bodyFatAt(entries, p.heightCm, p.startDate) ?? firstBodyFat(entries, p.heightCm);
  if (bf === null) return null;
  return leanMass(avg7(entries, p.startDate) ?? p.startWeight, bf);
}

/** «Сейчас»: % жира по последней паре талия/шея; muscle — по сухой массе против старта. */
export function twinNow(entries: readonly BodyEntry[], p: TwinPerson, meta: TwinMeta, date: LocalDate): TwinBody {
  const bf = bodyFatAt(entries, p.heightCm, date) ?? meta.bfStart;
  const now = leanAt(entries, p.heightCm, date);
  const start = startLean(entries, p);
  return twinBody(bf, now !== null && start !== null ? muscleFromLean(now, start) : 0, meta);
}

/** «Цель»: bf = bfGoal, muscle = 0. */
export function twinGoal(meta: TwinMeta): TwinBody {
  return twinBody(meta.bfGoal, 0, meta);
}

export interface TwinWeek {
  /** Понедельник недели. */
  week: LocalDate;
  body: TwinBody;
  /** true — в неделе были замеры; false — значение интерполировано между соседними неделями. */
  measured: boolean;
}

/**
 * История для ползунка «Прогресс → Тело»: по неделям со старта до `date`, из средних за неделю
 * (средний вес, средние талия и шея → % жира, сухая масса). Неделя без замеров — линейно между соседними;
 * до первого замера — как первый, после последнего — как последний; совсем без замеров — bfStart.
 */
export function twinHistory(entries: readonly BodyEntry[], p: TwinPerson, meta: TwinMeta, date: LocalDate): TwinWeek[] {
  const first = weekStart(p.startDate);
  const last = weekStart(date);
  const n = Math.floor(diffDays(first, last) / 7) + 1;
  if (n <= 0) return [];
  const bfs: (number | null)[] = [];
  const weights: (number | null)[] = [];
  for (let i = 0; i < n; i++) {
    const from = addDays(first, i * 7);
    const to = addDays(from, 6);
    const wk = entries.filter((e) => e.date >= from && e.date <= to);
    const ws = wk.filter((e) => e.weight !== undefined).map((e) => e.weight!);
    const pairs = wk.filter((e) => e.waist !== undefined && e.neck !== undefined);
    const waist = pairs.length ? pairs.reduce((a, e) => a + e.waist!, 0) / pairs.length : null;
    const neck = pairs.length ? pairs.reduce((a, e) => a + e.neck!, 0) / pairs.length : null;
    bfs.push(waist !== null && neck !== null ? bodyFatPercent(waist, neck, p.heightCm) : null);
    weights.push(ws.length ? ws.reduce((a, b) => a + b, 0) / ws.length : null);
  }
  const bfI = interpolate(bfs);
  const wI = interpolate(weights);
  const leanStart = startLean(entries, p);
  return bfI.map((bf, i) => {
    const b = bf ?? meta.bfStart;
    const lean = bf !== null && wI[i] !== null ? leanMass(Math.round(wI[i]!), bf) : null;
    const muscle = lean !== null && leanStart !== null ? muscleFromLean(lean, leanStart) : 0;
    return { week: addDays(first, i * 7), body: twinBody(b, muscle, meta), measured: bfs[i] !== null };
  });
}

/** Пропуски — линейно между соседними известными значениями; края — ближайшим известным. Без значений — null. */
export function interpolate(values: readonly (number | null)[]): (number | null)[] {
  const known = values.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0);
  if (!known.length) return values.map(() => null);
  return values.map((v, i) => {
    if (v !== null) return v;
    const prev = [...known].reverse().find((k) => k < i);
    const next = known.find((k) => k > i);
    if (prev === undefined) return values[next!]!;
    if (next === undefined) return values[prev]!;
    const t = (i - prev) / (next - prev);
    return values[prev]! + (values[next]! - values[prev]!) * t;
  });
}

/** Последний вес на дату — для подписи карточки, если нет 7-дневного среднего. */
export function weightNow(entries: readonly BodyEntry[], date: LocalDate): Kg100 | null {
  return avg7(entries, date) ?? latestWith(entries, 'weight', date)?.weight ?? null;
}

// ---------- Фазы клипа (manifest.json → exercises.<id>.phases) ----------

export type PhaseKind = 'ecc' | 'hold' | 'con' | 'top';

export interface ClipPhase {
  t0: number;
  t1: number;
  kind: PhaseKind;
}

/** Фаза клипа в момент t (с); клип идёт по кругу — t по модулю длины клипа. */
export function phaseAt(phases: readonly ClipPhase[], t: number): PhaseKind | null {
  if (!phases.length) return null;
  const dur = phases[phases.length - 1]!.t1;
  const tt = dur > 0 ? ((t % dur) + dur) % dur : t;
  for (const p of phases) if (tt >= p.t0 && tt < p.t1) return p.kind;
  return phases[phases.length - 1]!.kind;
}

/** Множитель основных зон по фазе (docs/TWIN-3D.md, 5); значения — из muscles.json → highlight.phase. */
export const PHASE_GAIN: Record<PhaseKind, number> = { con: 1.0, hold: 0.8, ecc: 0.65, top: 0.5 };
