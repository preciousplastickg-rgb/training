import { describe, expect, it } from 'vitest';
import type { SetLog } from '../db/types';
import { e1rm, findRecords, repRecords, volume } from './records';

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
  it('рекорд веса на N повторов и e1RM', () => {
    const prior = [set('b', 6000, 10, 'p'), set('b', 6250, 6, 'p')];
    const hits = findRecords([set('b', 6500, 8), set('b', 6500, 7)], prior);
    expect(hits.map((h) => h.kind).sort()).toEqual(['e1rm', 'weight']);
    expect(hits.find((h) => h.kind === 'weight')?.reps).toBe(8);
    // прирост: на 8+ повторов лучшим был 60 → +5; e1RM — к прошлой лучшей оценке (60 × 10)
    expect(hits.find((h) => h.kind === 'weight')?.delta).toBe(500);
    expect(hits.find((h) => h.kind === 'e1rm')?.delta).toBe(e1rm(6500, 8)! - e1rm(6000, 10)!);
  });
  it('без улучшения — без рекорда; первая сессия — точка отсчёта', () => {
    expect(findRecords([set('b', 6000, 9)], [set('b', 6000, 10, 'p')])).toEqual([]);
    expect(findRecords([set('b', 6000, 9)], [])).toEqual([]);
  });
  it('таблица рекордов', () => {
    expect(repRecords([set('b', 6000, 10), set('b', 6500, 6)])).toEqual([{ reps: 6, weight: 6500 }, { reps: 10, weight: 6000 }]);
  });
});
