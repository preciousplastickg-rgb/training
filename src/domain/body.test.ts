import { describe, expect, it } from 'vitest';
import type { BodyEntry } from '../db/types';
import { addDays } from './dates';
import { avg7, bodyFatPercent, forecastDate, leanMass, pathProgress, targetWeightFor } from './body';

const days = (from: string, weights: number[]): BodyEntry[] => weights.map((w, i) => ({ date: addDays(from, i), weight: w }));

describe('% жира, ВМС США', () => {
  it('талия 92, шея 38, рост 174,5 → ≈ 22,2', () => {
    expect(Math.abs(bodyFatPercent(920, 380, 174.5)! - 22.2)).toBeLessThanOrEqual(0.1); // точно 22,147
  });
  it('некорректные замеры → null', () => {
    expect(bodyFatPercent(380, 380, 174.5)).toBeNull();
  });
  it('сухая масса и цель при 15%', () => {
    expect(leanMass(8100, 25)).toBe(6075);
    expect(targetWeightFor(8100, 25, 15)).toBe(7147);
  });
});

describe('средний вес за 7 дней', () => {
  it('среднее последних 7 календарных дней', () => {
    const e = days('2026-11-09', [8100, 8080, 8060, 8040, 8020, 8000, 7980, 7960]);
    expect(avg7(e, '2026-11-15')).toBe(8040); // 9…15 ноября
    expect(avg7(e, '2026-11-16')).toBe(8020); // 10…16 ноября
  });
  it('пропуски дней: берутся только записи в окне', () => {
    const e: BodyEntry[] = [
      { date: '2026-11-01', weight: 9000 },
      { date: '2026-11-10', weight: 8100 },
      { date: '2026-11-12', weight: 8000 },
      { date: '2026-11-15', weight: 7900 },
    ];
    expect(avg7(e, '2026-11-15')).toBe(8000);
  });
  it('меньше 3 записей — мало данных', () => {
    expect(avg7(days('2026-11-09', [8100, 8080]), '2026-11-10')).toBeNull();
  });
  it('записи без веса (только замеры) не считаются', () => {
    const e: BodyEntry[] = [...days('2026-11-09', [8100, 8080]), { date: '2026-11-11', waist: 920 }];
    expect(avg7(e, '2026-11-11')).toBeNull();
  });
});

describe('прогноз и путь', () => {
  it('линейное снижение 0,1 кг/день → дата пересечения цели', () => {
    const e = days('2026-11-01', Array.from({ length: 30 }, (_, i) => 8100 - i * 10));
    const f = forecastDate(e, '2026-11-30', 7300);
    // среднее на 30.11 = 78,4 кг, снижение 0,1 кг/день → 54 дня
    expect(f).toBe('2027-01-23');
  });
  it('меньше 14 дней данных — нет прогноза', () => {
    expect(forecastDate(days('2026-11-01', [8100, 8090, 8080, 8070, 8060, 8050, 8040, 8030, 8020]), '2026-11-09', 7300)).toBeNull();
  });
  it('нет снижения — нет прогноза', () => {
    expect(forecastDate(days('2026-11-01', Array.from({ length: 25 }, () => 8100)), '2026-11-25', 7300)).toBeNull();
  });
  it('прогресс пути 0…100%', () => {
    expect(pathProgress(8100, 7300, 7690)).toBeCloseTo(0.5125);
    expect(pathProgress(8100, 7300, 8200)).toBe(0);
    expect(pathProgress(8100, 7300, 7200)).toBe(1);
  });
});
