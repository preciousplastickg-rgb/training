// 3D-двойник — docs/TWIN-3D.md, раздел 4: тело по данным пользователя. Чистые функции, UI только вызывает их.
//
// bf — % жира по ВМС США (SPEC 5.5) по последней паре талия/шея; нет замеров — bfStart из манифеста.
// lean = clamp((bfStart − bf) / (bfStart − bfGoal), 0, 1); definition = clamp((bfStart − bf) / 12, 0,15, 0,9).
// muscle = clamp((сухая масса сейчас − на старте) / 3 кг, 0, 1); сухая масса — по 7-дневным средним (SPEC 5.5).
// shape — местные пропорции по обхватам (шея, плечи, запястье, талия вне диапазона морфа), TWIN-3D 4.

import type { BodyEntry, Kg100, LocalDate } from '../db/types';
import { avg7, bodyFatAt, bodyFatPercent, firstBodyFat, firstWith, latestWith, leanMass, type GirthKey } from './body';
import { addDays, diffDays, weekStart } from './dates';

export interface TwinMeta {
  bfStart: number;
  bfGoal: number;
}

/** Параметры двойника: % жира и веса морфов `lean`, `muscle`, сила рельефа `definition` (material.normalScale), пропорции. */
export interface TwinBody {
  bf: number;
  lean: number;
  definition: number;
  muscle: number;
  /** Нет — модель как есть (нагрузка за неделю). */
  shape?: TwinShape;
}

/**
 * Местные пропорции двойника — во сколько раз толще модели шея, плечи (дельты и верх груди), предплечья с запястьями
 * и живот. 1 — модель как есть. Движок утолщает кожу вокруг костей этих частей (TWIN-3D 4).
 */
export interface TwinShape {
  neck: number;
  shoulders: number;
  wrist: number;
  waist: number;
}

export const SHAPE_NEUTRAL: TwinShape = { neck: 1, shoulders: 1, wrist: 1, waist: 1 };

/** Обхваты, при которых модель «как есть», — доля роста у среднего мужчины (ANSUR II, округлено). */
export const GIRTH_PER_HEIGHT = { neck: 0.226, shoulders: 0.666, wrist: 0.1 } as const;

/** Пределы множителей: дальше модель ломается, а замер скорее опечатка. */
export const SHAPE_RANGE: Record<keyof TwinShape, readonly [number, number]> = {
  neck: [0.85, 1.2],
  shoulders: [0.85, 1.25],
  wrist: [0.85, 1.2],
  waist: [0.85, 1.3],
};

/** Обхваты на дату, см × 10; нет замера — null. */
export type Girths = Record<GirthKey, number | null>;

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

export function twinBody(bf: number, muscle: number, meta: TwinMeta, shape?: TwinShape): TwinBody {
  const b: TwinBody = { bf, lean: leanFromBf(bf, meta), definition: definitionFromBf(bf, meta), muscle: clamp(muscle, 0, 1) };
  return shape ? { ...b, shape } : b;
}

/** Талия, при которой по формуле ВМС США выходит `bf` при этих шее и росте, см × 10 (обратная к SPEC 5.5). */
export function waistForBf(bf: number, neck10: number, heightCm: number): number {
  const log = (1.0324 + 0.15456 * Math.log10(heightCm) - 495 / (bf + 450)) / 0.19077;
  return neck10 + 10 ** log * 10;
}

/**
 * Пропорции по обхватам. Шея, плечи, запястье — замер к обхвату среднего мужчины того же роста. Талию целиком
 * передаёт морф `lean` через % жира, пока % жира между bfGoal и bfStart; за этими пределами морф упирается,
 * и живот дальше меняет множитель `waist` — замер к талии, при которой % жира как раз на пределе.
 */
export function twinShape(g: Girths, heightCm: number, meta: TwinMeta): TwinShape {
  const ratio = (k: 'neck' | 'shoulders' | 'wrist') => {
    const v = g[k];
    return v === null ? 1 : clamp(v / 10 / (GIRTH_PER_HEIGHT[k] * heightCm), ...SHAPE_RANGE[k]);
  };
  let waist = 1;
  if (g.waist !== null && g.neck !== null) {
    const bf = bodyFatPercent(g.waist, g.neck, heightCm);
    const edge = bf === null ? null : bf > meta.bfStart ? meta.bfStart : bf < meta.bfGoal ? meta.bfGoal : null;
    if (edge !== null) waist = clamp(g.waist / waistForBf(edge, g.neck, heightCm), ...SHAPE_RANGE.waist);
  }
  return { neck: ratio('neck'), shoulders: ratio('shoulders'), wrist: ratio('wrist'), waist };
}

const GIRTH_KEYS: readonly GirthKey[] = ['waist', 'neck', 'shoulders', 'wrist'];

/** Последний замер каждого обхвата на дату, без даты — первый замер (старт до замеров). */
export function girthsAt(entries: readonly BodyEntry[], date: LocalDate | null): Girths {
  const out = {} as Girths;
  for (const k of GIRTH_KEYS) out[k] = (date === null ? firstWith(entries, k) : latestWith(entries, k, date))?.[k] ?? null;
  return out;
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

/** «Старт» — на Settings.startDate: % жира и обхваты по замерам на эту дату или первым после неё, иначе bfStart. */
export function twinStart(entries: readonly BodyEntry[], p: TwinPerson, meta: TwinMeta): TwinBody {
  const bf = bodyFatAt(entries, p.heightCm, p.startDate) ?? firstBodyFat(entries, p.heightCm) ?? meta.bfStart;
  const at = girthsAt(entries, p.startDate);
  const first = girthsAt(entries, null);
  const g = Object.fromEntries(GIRTH_KEYS.map((k) => [k, at[k] ?? first[k]])) as Girths;
  return twinBody(bf, 0, meta, twinShape(g, p.heightCm, meta));
}

/** Сухая масса «Старта»: средний вес на startDate (иначе стартовый вес) × (1 − % жира старта). */
export function startLean(entries: readonly BodyEntry[], p: TwinPerson): Kg100 | null {
  const bf = bodyFatAt(entries, p.heightCm, p.startDate) ?? firstBodyFat(entries, p.heightCm);
  if (bf === null) return null;
  return leanMass(avg7(entries, p.startDate) ?? p.startWeight, bf);
}

/** «Сейчас»: % жира по последним талии и шее; muscle — по сухой массе против старта; пропорции — по последним обхватам. */
export function twinNow(entries: readonly BodyEntry[], p: TwinPerson, meta: TwinMeta, date: LocalDate): TwinBody {
  const bf = bodyFatAt(entries, p.heightCm, date) ?? meta.bfStart;
  const now = leanAt(entries, p.heightCm, date);
  const start = startLean(entries, p);
  const shape = twinShape(girthsAt(entries, date), p.heightCm, meta);
  return twinBody(bf, now !== null && start !== null ? muscleFromLean(now, start) : 0, meta, shape);
}

/** «Цель»: bf = bfGoal, muscle = 0; шея, плечи и запястье — как сейчас (`shape`), живот — по морфу. */
export function twinGoal(meta: TwinMeta, shape?: TwinShape): TwinBody {
  return twinBody(meta.bfGoal, 0, meta, shape ? { ...shape, waist: 1 } : undefined);
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
  const shapes: TwinShape[] = [];
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  for (let i = 0; i < n; i++) {
    const from = addDays(first, i * 7);
    const to = addDays(from, 6);
    const wk = entries.filter((e) => e.date >= from && e.date <= to);
    const waist = avg(wk.filter((e) => e.waist !== undefined).map((e) => e.waist!));
    // шея меняется медленно: нет в этой неделе — последняя до конца недели (профиль пишет обхваты по одному)
    const neck = avg(wk.filter((e) => e.neck !== undefined).map((e) => e.neck!)) ?? latestWith(entries, 'neck', to)?.neck ?? null;
    bfs.push(waist !== null && neck !== null ? bodyFatPercent(waist, neck, p.heightCm) : null);
    weights.push(avg(wk.filter((e) => e.weight !== undefined).map((e) => e.weight!)));
    shapes.push(twinShape(girthsAt(entries, to), p.heightCm, meta));
  }
  const bfI = interpolate(bfs);
  const wI = interpolate(weights);
  const leanStart = startLean(entries, p);
  return bfI.map((bf, i) => {
    const b = bf ?? meta.bfStart;
    const lean = bf !== null && wI[i] !== null ? leanMass(Math.round(wI[i]!), bf) : null;
    const muscle = lean !== null && leanStart !== null ? muscleFromLean(lean, leanStart) : 0;
    return { week: addDays(first, i * 7), body: twinBody(b, muscle, meta, shapes[i]), measured: bfs[i] !== null };
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
