import { describe, expect, it } from 'vitest';
import { bestStreak, dayStatuses, disciplineSummary } from './discipline';
import { planDays } from './program';

describe('дисциплина', () => {
  const gym = new Set(['2026-11-09', '2026-11-11']);
  const plans = planDays('2026-11-16', gym);
  const statuses = dayStatuses(
    plans,
    [{ date: '2026-11-09', ratio: 1 }, { date: '2026-11-11', ratio: 0.5 }],
    [{ id: 'p', date: '2026-11-10', minutes: 30 }, { id: 'q', date: '2026-11-12', minutes: 15 }],
    '2026-11-16',
  );
  it('зал ≥ 80% подходов, бассейн ≥ 20 мин, иначе пропуск', () => {
    expect(statuses.get('2026-11-09')).toBe('gym');
    expect(statuses.get('2026-11-10')).toBe('pool');
    expect(statuses.get('2026-11-11')).toBe('missed'); // 50% подходов
    expect(statuses.get('2026-11-12')).toBe('missed'); // 15 мин
    expect(statuses.get('2026-11-13')).toBe('moved'); // пт → перенесено на сб
    expect(statuses.get('2026-11-14')).toBe('missed');
    expect(statuses.get('2026-11-15')).toBe('rest');
    expect(statuses.get('2026-11-16')).toBe('pending'); // сегодня, ещё не сделано
  });
  it('счётчик и серия: отдых серию не ломает', () => {
    const s = disciplineSummary(plans, statuses);
    expect(s.planned).toBe(5); // пн, вт, ср, чт и пт→сб как одна
    expect(s.done).toBe(2);
    expect(s.streak).toBe(1); // вс-отдых после пропуска в сб
  });
  it('лучшая серия: пн, вт — два дня до первого пропуска', () => {
    expect(bestStreak(plans, statuses)).toBe(2);
  });
});
