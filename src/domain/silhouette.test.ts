import { describe, expect, it } from 'vitest';
import type { SetLog, WorkoutSession } from '../db/types';
import { bodyFatPercent } from './body';
import { e1rmGrowth, factorsFrom, outlinePath, paramsFrom, rightHalf, START_FACTORS, targetWaist } from './silhouette';

describe('силуэт', () => {
  it('29 опорных точек правой половины', () => {
    expect(rightHalf(paramsFrom(START_FACTORS))).toHaveLength(29);
  });
  it('формулы SPEC: старт и цель', () => {
    expect(paramsFrom(START_FACTORS)).toMatchObject({ S: 62, A: 18, C: 50, W: 52, H: 48, T: 51, abs: 0 });
    const full = paramsFrom({ ...START_FACTORS, fWaist: 1, fUpper: 1, fLegs: 1, bodyFat: 15 });
    expect(full).toMatchObject({ S: 66, A: 23, C: 52, W: 39, H: 44, T: 49, abs: 1 });
  });
  it('все f ограничены 0…1', () => {
    expect(paramsFrom({ ...START_FACTORS, fWaist: 2, fUpper: -1, fLegs: 5 })).toMatchObject({ W: 39, S: 62, T: 44 + 3 + 2 });
  });
  it('пресс проступает по % жира: 20% — нет, 17,5% — наполовину', () => {
    expect(paramsFrom({ ...START_FACTORS, bodyFat: 20 }).abs).toBe(0);
    expect(paramsFrom({ ...START_FACTORS, bodyFat: 17.5 }).abs).toBe(0.5);
  });
  it('контур замкнут и симметричен', () => {
    const d = outlinePath(paramsFrom(START_FACTORS));
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
  });
  it('целевая талия даёт целевой % жира', () => {
    const w = targetWaist(380, 174.5, 15);
    expect(Math.abs(bodyFatPercent(w, 380, 174.5)! - 15)).toBeLessThanOrEqual(0.15);
  });
  it('силуэт меняется от замеров и e1RM', () => {
    const sess = (id: string, t: number): WorkoutSession => ({ id, date: `2026-11-${10 + t}`, workout: 'A', startedAt: t, finishedAt: t + 1, isDeload: false, isCalibration: false });
    const set = (sid: string, ex: string, w: number): SetLog => ({ id: sid + ex, sessionId: sid, exerciseId: ex, slotId: 'x', setIndex: 0, kind: 'work', weight: w, reps: 8, doneAt: 0 });
    const sessions = [sess('a', 1), sess('b', 2), sess('c', 3), sess('d', 4)];
    const sets = [set('a', 'bench_press', 6000), set('b', 'bench_press', 6000), set('c', 'bench_press', 6900), set('d', 'bench_press', 6900)];
    expect(e1rmGrowth(['bench_press'], sets, sessions)).toBeCloseTo(0.15);
    const body = [
      { date: '2026-11-09', waist: 920, neck: 380 },
      { date: '2026-12-20', waist: 860, neck: 380 },
    ];
    const f = factorsFrom(body, sets, sessions, 174.5, 15);
    expect(f.fWaist).toBeGreaterThan(0.3);
    expect(f.groups.chest).toBeCloseTo(0.5);
    const p = paramsFrom(f);
    expect(p.W).toBeLessThan(52);
  });
});
