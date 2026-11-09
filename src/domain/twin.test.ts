import { describe, expect, it } from 'vitest';
import manifestJson from '../../public/3d/manifest.json';
import type { BodyEntry } from '../db/types';
import { addDays } from './dates';
import {
  definitionFromBf, interpolate, leanFromBf, muscleFromLean, phaseAt, twinGoal, twinHistory, twinNow, twinStart,
  type ClipPhase, type TwinPerson,
} from './twin';

const META = { bfStart: 24.5, bfGoal: 15 };

// docs/TWIN-3D.md, раздел 9.
describe('двойник: морфы по % жира', () => {
  it('bf 24,5 → lean 0, definition 0,15', () => {
    expect(leanFromBf(24.5, META)).toBe(0);
    expect(definitionFromBf(24.5, META)).toBe(0.15);
  });
  it('bf 15 → lean 1, definition ≈ 0,79', () => {
    expect(leanFromBf(15, META)).toBe(1);
    expect(definitionFromBf(15, META)).toBeCloseTo(0.79, 2);
  });
  it('bf 12 → lean 1, definition 0,9', () => {
    expect(leanFromBf(12, META)).toBe(1);
    expect(definitionFromBf(12, META)).toBe(0.9);
  });
  it('bf 30 → lean 0, definition 0,15', () => {
    expect(leanFromBf(30, META)).toBe(0);
    expect(definitionFromBf(30, META)).toBe(0.15);
  });
});

describe('двойник: мышцы по сухой массе', () => {
  it('сухая масса +1,5 кг от старта → muscle 0,5', () => {
    expect(muscleFromLean(6150, 6000)).toBe(0.5);
  });
  it('сухая масса −1 кг от старта → muscle 0', () => {
    expect(muscleFromLean(5900, 6000)).toBe(0);
  });
});

describe('двойник: фаза клипа', () => {
  const manifest = manifestJson as unknown as { exercises: Record<string, { phases: ClipPhase[] }> };
  it('фаза при t = 2,9 с у bench_press — con', () => {
    expect(phaseAt(manifest.exercises.bench_press!.phases, 2.9)).toBe('con');
  });
  it('клип по кругу: t = 4,1 с — как 0,1 с', () => {
    expect(phaseAt(manifest.exercises.bench_press!.phases, 4.1)).toBe('ecc');
  });
});

describe('двойник: «Старт · Сейчас · Цель» и история', () => {
  const P: TwinPerson = { heightCm: 174.5, startDate: '2026-11-09', startWeight: 8000 };
  const day = (d: string, e: Partial<BodyEntry>): BodyEntry => ({ date: d, ...e });

  it('без замеров — bfStart, muscle 0', () => {
    const now = twinNow([], P, META, '2026-11-20');
    expect(now).toEqual({ bf: 24.5, lean: 0, definition: 0.15, muscle: 0 });
    expect(twinStart([], P, META).bf).toBe(24.5);
  });

  it('«Сейчас» — по последней паре талия/шея; «Цель» — bfGoal, muscle 0', () => {
    const e = [day('2026-11-09', { waist: 920, neck: 380 }), day('2026-11-30', { waist: 880, neck: 380 })];
    const now = twinNow(e, P, META, '2026-12-01');
    expect(now.bf).toBeLessThan(twinStart(e, P, META).bf);
    expect(twinGoal(META)).toEqual({ bf: 15, lean: 1, definition: expect.closeTo(0.79, 2), muscle: 0 });
  });

  it('недели без замеров — между соседними, первая неделя — со старта', () => {
    const e: BodyEntry[] = [];
    for (let i = 0; i < 7; i++) e.push(day(addDays('2026-11-09', i), { weight: 8000 }));
    e.push(day('2026-11-09', { waist: 940, neck: 380 }));
    for (let i = 0; i < 7; i++) e.push(day(addDays('2026-11-23', i), { weight: 7900 }));
    e.push(day('2026-11-23', { waist: 900, neck: 380 }));
    const h = twinHistory(e, P, META, '2026-11-25');
    expect(h.map((w) => w.week)).toEqual(['2026-11-09', '2026-11-16', '2026-11-23']);
    expect(h.map((w) => w.measured)).toEqual([true, false, true]);
    expect(h[1]!.body.bf).toBeCloseTo((h[0]!.body.bf + h[2]!.body.bf) / 2, 5);
  });

  it('interpolate: края — ближайшим, пусто — null', () => {
    expect(interpolate([null, 2, null, 4, null])).toEqual([2, 2, 3, 4, 4]);
    expect(interpolate([null, null])).toEqual([null, null]);
  });
});
