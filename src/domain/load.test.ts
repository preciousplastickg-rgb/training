import { describe, expect, it } from 'vitest';
import type { SetLog, WorkoutSession } from '../db/types';
import { loadLevel, underloaded, weeklyLoad } from './load';

const sess = (id: string, date: string): WorkoutSession => ({ id, date, workout: 'A', block: 1, startedAt: 0, finishedAt: 1, isDeload: false, isCalibration: false });
const set = (sessionId: string, exerciseId: string): SetLog => ({ id: Math.random().toString(), sessionId, exerciseId, slotId: 'x', setIndex: 0, kind: 'work', weight: 1000, reps: 10, doneAt: 0 });

describe('нагрузка за неделю', () => {
  it('основная = 1 подход, помогающая = 0,5; старше 7 дней — не в счёт', () => {
    const sessions = [sess('a', '2026-11-16'), sess('old', '2026-11-01')];
    const sets = [set('a', 'bench_press'), set('a', 'bench_press'), set('old', 'bench_press')];
    const l = weeklyLoad(sets, sessions, '2026-11-18');
    expect(l.chest).toBe(2);
    expect(l.triceps).toBe(2);
    expect(l.front_delt).toBe(1);
  });
  it('уровни 0 · 1–5 · 6–9 · 10–20 · > 20', () => {
    expect([0, 1, 5, 6, 9, 10, 20, 21].map(loadLevel)).toEqual([0, 1, 1, 2, 2, 3, 3, 4]);
  });
  it('3 самые недогруженные', () => {
    const l = weeklyLoad([set('a', 'bench_press')], [sess('a', '2026-11-16')], '2026-11-18');
    expect(underloaded(l)).toHaveLength(3);
    expect(underloaded(l)).not.toContain('chest');
  });
});
