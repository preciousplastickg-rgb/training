import { describe, expect, it } from 'vitest';
import type { BodyEntry } from '../db/types';
import { avgSleep, bestMeditationStreak, meditationSeries, meditationStreak, meditationWeek, sleepSeries } from './mind';

const body: BodyEntry[] = [
  { date: '2027-01-08', sleepMin: 400, meditationMin: 10 },
  { date: '2027-01-09', meditationMin: 10 },
  { date: '2027-01-10', sleepMin: 480, meditationMin: 0 },
  { date: '2027-01-11', sleepMin: 450, meditationMin: 15, weight: 7900 },
  { date: '2027-01-12', sleepMin: 420, meditationMin: 10 },
  { date: '2027-01-13', weight: 7880 },
];

describe('сон', () => {
  it('ряд по дням: пропуски — null', () => {
    expect(sleepSeries(body, '2027-01-08', '2027-01-10').map((p) => p.min)).toEqual([400, null, 480]);
  });
  it('среднее за 7 дней — только по записанным ночам, целые минуты', () => {
    // 6–12 января: 400, 480, 450, 420 → 437,5 → 438
    expect(avgSleep(body, '2027-01-12')).toBe(438);
    expect(avgSleep(body, '2027-01-13')).toBe(438);
    expect(avgSleep(body, '2027-01-30')).toBeNull();
  });
});

describe('медитация', () => {
  it('ряд по дням: записанный ноль — 0, не записано — null', () => {
    expect(meditationSeries(body, '2027-01-09', '2027-01-13').map((p) => p.min)).toEqual([10, 0, 15, 10, null]);
  });
  it('серия: сегодня ещё не записано — считается со вчера; ноль прерывает', () => {
    expect(meditationStreak(body, '2027-01-12')).toBe(2);
    expect(meditationStreak(body, '2027-01-13')).toBe(2);
    expect(meditationStreak(body, '2027-01-14')).toBe(0);
    expect(meditationStreak(body, '2027-01-09')).toBe(2);
  });
  it('лучшая серия за всё время', () => {
    expect(bestMeditationStreak(body)).toBe(2);
    expect(bestMeditationStreak([])).toBe(0);
  });
  it('за 7 дней: минуты и дни', () => {
    expect(meditationWeek(body, '2027-01-13')).toEqual({ minutes: 45, days: 4 });
  });
});
