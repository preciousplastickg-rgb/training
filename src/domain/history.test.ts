import { describe, expect, it } from 'vitest';
import type { SetLog, WorkoutSession } from '../db/types';
import { recentVolumes } from './history';

const session = (id: string, workout: 'A' | 'B', startedAt: number, finished = true): WorkoutSession => ({
  id, date: '2027-01-01', workout, block: 1, startedAt, ...(finished ? { finishedAt: startedAt + 1 } : {}), isDeload: false, isCalibration: false,
});
const set = (sessionId: string, weight: number, reps: number): SetLog => ({
  id: `${sessionId}-${weight}`, sessionId, exerciseId: 'x', slotId: 'x', setIndex: 0, kind: 'work', weight, reps, doneAt: 1,
});

describe('объёмы последних тренировок', () => {
  it('того же типа, включая текущую, от старых к новым, не больше n', () => {
    const sessions = [session('b1', 'B', 1), session('a1', 'A', 2), session('b2', 'B', 3), session('b3', 'B', 4), session('b4', 'B', 5), session('b5', 'B', 6), session('b6', 'B', 7, false)];
    const sets = [set('b1', 1000, 10), set('b6', 2000, 10), set('a1', 9000, 10)];
    const v = recentVolumes(sessions[6]!, sessions, sets, 5);
    expect(v.map((x) => x.id)).toEqual(['b2', 'b3', 'b4', 'b5', 'b6']);
    expect(v[4]).toEqual({ id: 'b6', volume: 20000, current: true });
    expect(recentVolumes(sessions[0]!, sessions, sets)).toEqual([{ id: 'b1', volume: 10000, current: true }]);
  });
});
