import { describe, expect, it } from 'vitest';
import { EXERCISE_BY_ID, EXERCISES } from './exercises';
import { EXERCISES_V2 } from './exercisesV2';
import { SEED_FOODS } from './foods';
import { SEED_SLOTS, SLOT_CODES } from './program';

describe('seed-данные', () => {
  it('68 упражнений (19 + 49): 3 ключевых момента, 2 ошибки, мышцы и шаг у каждого; id уникальны', () => {
    expect(EXERCISES).toHaveLength(68);
    expect(EXERCISES_V2).toHaveLength(49);
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(68);
    for (const e of EXERCISES) {
      expect(e.cues, e.id).toHaveLength(3);
      expect(e.mistakes, e.id).toHaveLength(2);
      expect(e.muscles.primary.length, e.id).toBeGreaterThan(0);
      expect(e.defaultStep, e.id).toBeGreaterThan(0);
    }
    for (const e of EXERCISES_V2) expect(e.videoQuery, e.id).toMatch(/техника$/);
  });
  it('32 слота × 3 блока; все упражнения программы и замен существуют', () => {
    expect(SLOT_CODES.A.length + SLOT_CODES.B.length + SLOT_CODES.C.length).toBe(32);
    for (const s of SEED_SLOTS) {
      expect(EXERCISE_BY_ID[s.exerciseId], s.exerciseId).toBeDefined();
      for (const a of s.altExerciseIds) expect(EXERCISE_BY_ID[a], a).toBeDefined();
      if (s.supersetWith) expect(SEED_SLOTS.some((x) => x.block === s.block && x.code === s.supersetWith), s.id).toBe(true);
    }
    // Все 68 упражнений задействованы: в слотах или как замены.
    const used = new Set(SEED_SLOTS.flatMap((s) => [s.exerciseId, ...s.altExerciseIds]));
    expect(EXERCISES.filter((e) => !used.has(e.id)).map((e) => e.id)).toEqual([]);
  });
  it('тексты дословно из SPEC (выборочно)', () => {
    expect(EXERCISE_BY_ID.bench_press!.cues[1]).toBe('Гриф опускается на низ груди, локти под 45–70° к корпусу');
    expect(EXERCISE_BY_ID.lateral_raise!.mistakes).toEqual(['Раскачка корпусом', 'Подъём плеч к ушам']);
    expect(EXERCISE_BY_ID.lateral_raise!.name).toBe('Махи гантелями в стороны стоя');
    expect(EXERCISE_BY_ID.face_pull!.cues[2]).toBe('В конце разводишь концы каната и разворачиваешь кисти наружу');
    expect(EXERCISE_BY_ID.pullup_assisted).toMatchObject({ unit: 'assist_kg', defaultStep: 500 });
    expect(EXERCISE_BY_ID.biceps_curl).toMatchObject({ equipment: 'cable', defaultStep: 500, name: 'Сгибания на бицепс на блоке' });
    expect(EXERCISE_BY_ID.leg_press!.defaultStep).toBe(1000);
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
