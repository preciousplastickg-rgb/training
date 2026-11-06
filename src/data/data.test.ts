import { describe, expect, it } from 'vitest';
import { EXERCISE_BY_ID, EXERCISES } from './exercises';
import { SEED_FOODS } from './foods';
import { ALT_STEP, SEED_SLOTS } from './program';

describe('seed-данные', () => {
  it('19 упражнений: 3 ключевых момента и 2 ошибки у каждого', () => {
    expect(EXERCISES).toHaveLength(19);
    for (const e of EXERCISES) {
      expect(e.cues, e.id).toHaveLength(3);
      expect(e.mistakes, e.id).toHaveLength(2);
      expect(e.muscles.primary.length, e.id).toBeGreaterThan(0);
    }
  });
  it('все упражнения программы и замен существуют, у замен есть шаг', () => {
    for (const s of SEED_SLOTS) {
      expect(EXERCISE_BY_ID[s.exerciseId], s.exerciseId).toBeDefined();
      for (const a of s.altExerciseIds) {
        expect(EXERCISE_BY_ID[a], a).toBeDefined();
        expect(ALT_STEP[a], a).toBeDefined();
      }
    }
  });
  it('тексты дословно из SPEC (выборочно)', () => {
    expect(EXERCISE_BY_ID.bench_press!.cues[1]).toBe('Гриф опускается на низ груди, локти под 45–70° к корпусу');
    expect(EXERCISE_BY_ID.lateral_raise!.mistakes).toEqual(['Раскачка корпусом', 'Подъём плеч к ушам']);
  });
  it('база продуктов: 150+ позиций с разделами, БЖУ × 10 целые, блюда ≈', () => {
    expect(SEED_FOODS.length).toBeGreaterThanOrEqual(150);
    expect(SEED_FOODS.length).toBeLessThanOrEqual(250);
    for (const f of SEED_FOODS) {
      for (const v of Object.values(f.per100)) expect(Number.isInteger(v), f.name).toBe(true);
      expect(f.category, f.name).toBeDefined();
    }
    expect(SEED_FOODS.filter((f) => f.category === 'dish').length).toBeGreaterThanOrEqual(40);
    const egg = SEED_FOODS.find((f) => f.name === 'Яйцо куриное')!;
    expect(egg.per100).toEqual({ kcal: 155, p: 126, f: 106, c: 11 });
    expect(egg.unitGrams).toBe(55);
    expect(SEED_FOODS.find((f) => f.name === 'Плов')!.approx).toBe(true);
    expect(new Set(SEED_FOODS.map((f) => f.id)).size).toBe(SEED_FOODS.length);
  });
});
