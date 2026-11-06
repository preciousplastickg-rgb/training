import { describe, expect, it } from 'vitest';
import type { PoolSession, WorkoutSession } from '../db/types';
import { weekStrip } from './week';

const session = (date: string, workout: 'A' | 'B'): WorkoutSession => ({
  id: date, date, workout, startedAt: 1, finishedAt: 2, isDeload: false, isCalibration: false,
});
const pool = (date: string, minutes: number): PoolSession => ({ id: date, date, minutes });

describe('полоса недели', () => {
  it('ср 13 января 2027: пн зал A сделан, вт бассейн сделан, ср сегодня B, пт A, сб по желанию, вс отдых', () => {
    const w = weekStrip('2027-01-13', [session('2027-01-11', 'A')], [pool('2027-01-12', 40)], {});
    expect(w.map((d) => d.name)).toEqual(['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']);
    expect(w[0]).toMatchObject({ state: 'gym_done', label: 'A', past: true });
    expect(w[1]).toMatchObject({ state: 'pool_done', label: '≈' });
    expect(w[2]).toMatchObject({ state: 'gym_plan', label: 'B', today: true });
    expect(w[3]).toMatchObject({ state: 'pool_plan', label: '≈' });
    expect(w[4]).toMatchObject({ state: 'gym_plan', label: 'A' });
    expect(w[5]).toMatchObject({ state: 'pool_optional' });
    expect(w[6]).toMatchObject({ state: 'rest', label: '·' });
  });
  it('своё расписание: зал вт/чт', () => {
    const w = weekStrip('2027-01-13', [], [], { schedule: { gym: [2, 4], pool: [], poolOptional: [] } });
    expect(w.filter((d) => d.state === 'gym_plan').map((d) => d.name)).toEqual(['Чт']);
    expect(w[1]).toMatchObject({ state: 'gym_missed', label: '–' });
  });
});
