import { describe, expect, it } from 'vitest';
import type { WorkoutSession } from '../db/types';
import { calendarDays } from './calendar';

const session = (date: string, workout: 'A' | 'B', t: number): WorkoutSession => ({
  id: date, date, workout, block: 1, startedAt: t, finishedAt: t + 3_600_000, isDeload: false, isCalibration: false,
});

const brief = (days: ReturnType<typeof calendarDays>) =>
  days.map((d) => `${d.date.slice(8)} ${d.plan.kind}${d.workout ? ` ${d.workout}` : ''}${d.projected ? '?' : ''} ${d.status}`);

describe('календарь тренировок', () => {
  it('неделя без пропусков: пн/ср/пт зал A·B·C, вт/чт/сб бассейн, вс отдых', () => {
    const days = calendarDays('2026-11-09', '2026-11-15', '2026-11-09', [], [], []);
    expect(brief(days)).toEqual([
      '09 gym A? pending',
      '10 pool future',
      '11 gym B? future',
      '12 pool future',
      '13 gym C? future',
      '14 pool future',
      '15 rest future',
    ]);
    expect(days.map((d) => d.plan.pool?.type)).toEqual([undefined, 'technique', undefined, 'intervals', undefined, 'long', undefined]);
  });

  it('сделанная тренировка — по факту, дальше чередование от неё', () => {
    const s = [session('2026-11-09', 'B', 1)];
    const days = calendarDays('2026-11-09', '2026-11-13', '2026-11-11', s, [{ date: '2026-11-09', ratio: 1 }], [
      { id: 'p', date: '2026-11-10', type: 'technique', minutes: 40 },
    ]);
    expect(days[0]).toMatchObject({ workout: 'B', projected: false, status: 'gym', session: s[0] });
    expect(days[1]).toMatchObject({ status: 'pool', pool: [{ minutes: 40 }] });
    expect(days[2]).toMatchObject({ workout: 'C', projected: true, status: 'pending' });
    expect(days[4]).toMatchObject({ workout: 'A', projected: true });
  });

  it('пропуск сдвигает зал на завтра, буквы идут дальше без дырки', () => {
    const days = calendarDays('2026-11-09', '2026-11-13', '2026-11-10', [], [], []);
    expect(brief(days)).toEqual([
      '09 gym moved',
      '10 gym A? pending', // перенос с понедельника
      '11 rest future', // два зала подряд не предлагаем: в среду бассейна нет — отдых
      '12 gym B? future',
      '13 rest future',
    ]);
    expect(days[2]!.plan.gymBlocked).toBe(true);
    expect(days[1]!.plan.makeup).toBe(true);
  });

  it('разгрузочная неделя помечена, до старта программы — подготовка', () => {
    const days = calendarDays('2026-12-28', '2026-12-28', '2026-12-01', [], [], []);
    expect(days[0]!.plan).toMatchObject({ kind: 'gym', isDeload: true });
    const prep = calendarDays('2026-11-06', '2026-11-06', '2026-11-05', [], [], []);
    expect(prep[0]).toMatchObject({ plan: { kind: 'prep' }, status: 'future' });
  });
});
