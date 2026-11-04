import { describe, expect, it } from 'vitest';
import { SEED_FOODS } from '../data/foods';
import { DEFAULT_SETTINGS } from '../db/db';
import { avg7 } from '../domain/body';
import { addDays } from '../domain/dates';
import { dayTotals, dayTargets, nutritionInTarget } from '../domain/nutrition';
import { PROGRAM_START } from '../data/program';
import { generateSeed, SEED_DAYS } from './seedData';

describe('демо-данные', () => {
  const seed = generateSeed(DEFAULT_SETTINGS);
  it('8 недель зала с прогрессией и пробной тренировкой', () => {
    expect(seed.sessions.filter((s) => s.isCalibration)).toHaveLength(1);
    const real = seed.sessions.filter((s) => !s.isCalibration);
    expect(real.length).toBeGreaterThanOrEqual(22);
    const bench = seed.sets.filter((s) => s.exerciseId === 'bench_press').map((s) => s.weight);
    expect(Math.max(...bench)).toBeGreaterThan(Math.min(...bench));
  });
  it('тренд веса ≈ −0,55 кг/нед', () => {
    const a = avg7(seed.body, addDays(PROGRAM_START, 6))!;
    const b = avg7(seed.body, addDays(PROGRAM_START, SEED_DAYS - 1))!;
    const perWeek = (a - b) / ((SEED_DAYS - 7) / 7);
    expect(perWeek).toBeGreaterThan(40);
    expect(perWeek).toBeLessThan(70);
  });
  it('питание: около 85% дней в цели', () => {
    const foods = new Map(SEED_FOODS.map((f) => [f.id, f]));
    let ok = 0;
    for (let i = 0; i < SEED_DAYS; i++) {
      const d = addDays(PROGRAM_START, i);
      const total = dayTotals(seed.foodLog.filter((l) => l.date === d), foods).total;
      if (nutritionInTarget(total, dayTargets(d, [], {}))) ok++;
    }
    expect(ok / SEED_DAYS).toBeGreaterThan(0.7);
    expect(ok / SEED_DAYS).toBeLessThan(0.97);
  });
});
