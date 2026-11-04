// Силуэт прогресса — SPEC 6.7.3. Параметры считаются из замеров и силы, а не из общего процента.

import type { BodyEntry, SetLog, WorkoutSession } from '../db/types';
import { bodyFatPercent } from './body';
import { e1rm } from './records';

export interface SilhouetteParams {
  S: number; A: number; C: number; W: number; H: number; T: number;
  /** Рост силы групп, 0…1 от цели +30% — для окраски мышц-накладок. */
  groups: { delts: number; chest: number; biceps: number; forearms: number; quads: number; calves: number };
  /** Прозрачность пресса и косых: (20 − % жира) / 5. */
  abs: number;
}

export interface SilhouetteFactors {
  fWaist: number;
  fUpper: number;
  fLegs: number;
  groups: SilhouetteParams['groups'];
  bodyFat: number | null;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function paramsFrom(f: SilhouetteFactors): SilhouetteParams {
  const W = 52 - 13 * clamp01(f.fWaist);
  const H = 48 - 4 * clamp01(f.fWaist);
  const u = clamp01(f.fUpper);
  return {
    S: 62 + 4 * u,
    A: 18 + 5 * u,
    C: 50 + 2 * u,
    W,
    H,
    T: H + 3 + 2 * clamp01(f.fLegs),
    groups: f.groups,
    abs: f.bodyFat === null ? 0 : clamp01((20 - f.bodyFat) / 5),
  };
}

/** Талия (см × 10), при которой % жира по ВМС США равен цели при той же шее. */
export function targetWaist(neck10: number, heightCm: number, targetBodyFat: number): number {
  const logDiff = (1.0324 + 0.15456 * Math.log10(heightCm) - 495 / (targetBodyFat + 450)) / 0.19077;
  return Math.round((10 ** logDiff) * 10 + neck10);
}

const UPPER = [['bench_press', 'db_bench_press'], ['db_shoulder_press'], ['lat_pulldown', 'pullup']];
const LEGS = [['barbell_squat', 'goblet_squat'], ['barbell_rdl']];

/** Рост лучшего e1RM: среднее последних 2 сессий против первых 2. null — мало данных. */
export function e1rmGrowth(exerciseIds: string[], sets: readonly SetLog[], sessions: readonly WorkoutSession[]): number | null {
  const ok = new Map(sessions.filter((s) => s.finishedAt !== undefined && !s.isDeload && !s.isCalibration).map((s) => [s.id, s.startedAt]));
  for (const id of exerciseIds) {
    const best = new Map<string, number>();
    for (const s of sets) {
      if (s.exerciseId !== id || s.kind !== 'work' || !ok.has(s.sessionId)) continue;
      const e = e1rm(s.weight, s.reps);
      if (e !== null) best.set(s.sessionId, Math.max(best.get(s.sessionId) ?? 0, e));
    }
    const series = [...best.entries()].sort((a, b) => ok.get(a[0])! - ok.get(b[0])!).map(([, v]) => v);
    if (series.length < 2) continue;
    const head = series.slice(0, 2);
    const tail = series.slice(-2);
    const start = head.reduce((a, b) => a + b, 0) / head.length;
    const now = tail.reduce((a, b) => a + b, 0) / tail.length;
    return start > 0 ? now / start - 1 : null;
  }
  return null;
}

const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
};

export function factorsFrom(
  body: readonly BodyEntry[],
  sets: readonly SetLog[],
  sessions: readonly WorkoutSession[],
  heightCm: number,
  targetBodyFat: number,
): SilhouetteFactors {
  const measured = body.filter((b) => b.waist !== undefined).sort((a, b) => a.date.localeCompare(b.date));
  const first = measured[0];
  const last = measured[measured.length - 1];
  let fWaist = 0;
  let bodyFat: number | null = null;
  if (first && last) {
    const neck = last.neck ?? first.neck;
    if (neck) {
      const goal = targetWaist(neck, heightCm, targetBodyFat);
      if (first.waist! > goal) fWaist = (first.waist! - last.waist!) / (first.waist! - goal);
      bodyFat = bodyFatPercent(last.waist!, neck, heightCm);
    }
  }
  const g = (ids: string[]) => clamp01((e1rmGrowth(ids, sets, sessions) ?? 0) / 0.3);
  const upper = avg(UPPER.map((ids) => e1rmGrowth(ids, sets, sessions)));
  const legs = avg(LEGS.map((ids) => e1rmGrowth(ids, sets, sessions)));
  return {
    fWaist: clamp01(fWaist),
    fUpper: clamp01(upper / 0.3),
    fLegs: clamp01(legs / 0.3),
    bodyFat,
    groups: {
      delts: g(['db_shoulder_press']),
      chest: g(['bench_press', 'db_bench_press', 'incline_db_press']),
      biceps: g(['biceps_curl']),
      forearms: g(['lat_pulldown', 'db_row']),
      quads: g(['barbell_squat', 'goblet_squat', 'bulgarian_split_squat']),
      calves: clamp01(legs / 0.3),
    },
  };
}

export const START_FACTORS: SilhouetteFactors = {
  fWaist: 0, fUpper: 0, fLegs: 0, bodyFat: null,
  groups: { delts: 0, chest: 0, biceps: 0, forearms: 0, quads: 0, calves: 0 },
};

// ---------- Контур ----------

export const SIL_W = 130;
export const SIL_H = 262;
const CX = SIL_W / 2;

export type P = [number, number];

/** 29 опорных точек правой половины (сверху вниз по внешнему контуру и обратно к паху). */
export function rightHalf(p: Pick<SilhouetteParams, 'S' | 'A' | 'C' | 'W' | 'H' | 'T'>): P[] {
  const s = p.S / 2;
  const a = p.A;
  // Руки слегка отведены: смещение наружу растёт книзу.
  const off = (y: number) => (y - 52) * 0.2;
  return [
    [0, 4],
    [11, 14],
    [9.5, 30],
    [7, 40],
    [s * 0.55, 46],
    [s, 52],
    [s + a * 0.38 + off(62), 62],
    [s + a * 0.42 + off(82), 82],
    [s + a * 0.36 + off(104), 104],
    [s + a * 0.34 + off(124), 124],
    [s + a * 0.2 + off(142), 142],
    [s + a * 0.05 + off(156), 156],
    [s - a * 0.32 + off(144), 144],
    [s - a * 0.42 + off(124), 124],
    [s - a * 0.5 + off(104), 104],
    [p.C / 2, 70],
    [p.C / 2 - 1, 84],
    [p.W / 2, 112],
    [p.H / 2, 134],
    [p.T / 2, 152],
    [p.T / 2 - 2.5, 176],
    [p.H / 2 - 6.5, 202],
    [p.H / 2 - 5, 222],
    [p.H / 2 - 10.5, 246],
    [p.H / 2 - 8, 256],
    [5, 256],
    [5.5, 244],
    [4.5, 200],
    [0, 160],
  ].map(([x, y]) => [x!, y!] as P);
}

/** Полный контур: правая половина + зеркало левой, Catmull-Rom → кубические Безье. */
export function outlinePath(p: Pick<SilhouetteParams, 'S' | 'A' | 'C' | 'W' | 'H' | 'T'>): string {
  const right = rightHalf(p).map(([x, y]) => [CX + x, y] as P);
  const left = rightHalf(p)
    .slice(1, -1)
    .reverse()
    .map(([x, y]) => [CX - x, y] as P);
  return catmullRom([...right, ...left], true);
}

export function catmullRom(pts: P[], closed: boolean): string {
  const n = pts.length;
  const at = (i: number) => pts[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))]!;
  const r = (v: number) => Math.round(v * 100) / 100;
  let d = `M${r(pts[0]![0])} ${r(pts[0]![1])}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const c1: P = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: P = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${r(c1[0])} ${r(c1[1])} ${r(c2[0])} ${r(c2[1])} ${r(p2[0])} ${r(p2[1])}`;
  }
  return closed ? `${d}Z` : d;
}

export function lerpParams(a: SilhouetteParams, b: SilhouetteParams, t: number): SilhouetteParams {
  const l = (x: number, y: number) => x + (y - x) * t;
  const groups = Object.fromEntries(
    Object.keys(a.groups).map((k) => [k, l(a.groups[k as keyof typeof a.groups], b.groups[k as keyof typeof b.groups])]),
  ) as SilhouetteParams['groups'];
  return { S: l(a.S, b.S), A: l(a.A, b.A), C: l(a.C, b.C), W: l(a.W, b.W), H: l(a.H, b.H), T: l(a.T, b.T), abs: l(a.abs, b.abs), groups };
}
