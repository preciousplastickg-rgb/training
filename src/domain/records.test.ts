import { describe, expect, it } from 'vitest';
import type { SetLog } from '../db/types';
import { e1rm, findRecords, recordCount, repRecords, sessionRecords, volume } from './records';

let n = 0;
const set = (exerciseId: string, weight: number, reps: number, sessionId = 's', kind: SetLog['kind'] = 'work'): SetLog => ({
  id: String(++n), sessionId, exerciseId, slotId: 'x', setIndex: 0, kind, weight, reps, doneAt: n,
});

describe('сила', () => {
  it('e1RM по Эпли, до 12 повторов', () => {
    expect(e1rm(6000, 10)).toBe(8000);
    expect(e1rm(6000, 13)).toBeNull();
  });
  it('объём — только рабочие подходы', () => {
    expect(volume([set('b', 6000, 10), set('b', 6000, 8), set('b', 2000, 10, 's', 'warmup')])).toBe(6000 * 18);
  });
  it('один рекорд на упражнение: вес на N повторов, иначе e1RM', () => {
    const prior = [set('b', 6000, 10, 'p'), set('b', 6250, 6, 'p')];
    // 65 × 8 бьёт и вес на 8+ (было 60), и e1RM — считается один рекорд, веса: прирост +5
    const hits = findRecords([set('b', 6500, 8), set('b', 6500, 7)], prior);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ kind: 'weight', reps: 8, delta: 500 });
    // 60 × 11: на 11 повторов истории нет — это не рекорд веса, а новая оценка e1RM (к 60 × 10)
    const e1 = findRecords([set('b', 6000, 11)], prior);
    expect(e1).toHaveLength(1);
    expect(e1[0]).toMatchObject({ kind: 'e1rm', delta: e1rm(6000, 11)! - e1rm(6000, 10)! });
  });
  it('без улучшения — без рекорда; первая сессия — точка отсчёта', () => {
    expect(findRecords([set('b', 6000, 9)], [set('b', 6000, 10, 'p')])).toEqual([]);
    expect(findRecords([set('b', 6000, 9)], [])).toEqual([]);
  });
  it('таблица рекордов', () => {
    expect(repRecords([set('b', 6000, 10), set('b', 6500, 6)])).toEqual([{ reps: 6, weight: 6500 }, { reps: 10, weight: 6000 }]);
  });
});

describe('счётчик рекордов', () => {
  const sess = (id: string, startedAt: number) => ({ id, date: '2026-11-09', workout: 'A' as const, startedAt, finishedAt: startedAt + 1, isDeload: false, isCalibration: false });
  it('первая сессия — точка отсчёта, дальше не больше одного рекорда на упражнение за сессию', () => {
    const sets = [set('b', 6000, 10, 's1'), set('b', 6250, 10, 's2'), set('b', 6250, 10, 's3')];
    const sessions = [sess('s1', 1), sess('s2', 2), sess('s3', 3)];
    // s2: вес 62,5 на 10+ и e1RM выше — один рекорд; s3 — повтор, без рекордов
    expect(recordCount(sets, sessions)).toBe(1);
    expect(sessionRecords(sessions[1]!, sessions, sets)).toHaveLength(1);
    expect(sessionRecords(sessions[0]!, sessions, sets)).toEqual([]);
    expect(sessionRecords(sessions[2]!, sessions, sets)).toEqual([]);
  });
});
