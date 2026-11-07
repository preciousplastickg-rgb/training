import { describe, expect, it } from 'vitest';
import { SEED_FOODS } from '../data/foods';
import type { FoodLog } from '../db/types';
import { findSameUserFood, frequentFoods, mealByHour, recentFoods, searchFoods } from './foodSearch';
import { quickFoodDraft } from './nutrition';

const names = (q: string) => searchFoods(SEED_FOODS, q).map((f) => f.name);

describe('поиск продуктов', () => {
  it('по синониму: «курица» → куриная грудка первой из кур', () => {
    expect(names('курица')).toContain('Куриная грудка, сырая');
  });
  it('по началу названия и без учёта «ё»', () => {
    expect(names('грудка')[0]).toMatch(/грудка/i);
    expect(names('свекла')).toContain('Свёкла');
  });
  it('несколько слов — все должны совпасть', () => {
    expect(names('рис вар')).toEqual(['Рис варёный']);
  });
  it('пусто — пусто', () => {
    expect(searchFoods(SEED_FOODS, '  ')).toEqual([]);
  });
});

describe('недавние и частые', () => {
  const foods = new Map(SEED_FOODS.map((f) => [f.id, f]));
  const log = (foodId: string, t: number): FoodLog => ({ id: `${foodId}${t}`, date: '2026-11-10', meal: 'lunch', foodId, grams: 100, createdAt: t });
  const logs = [log('seed-001', 1), log('seed-005', 2), log('seed-001', 3), log('seed-011', 4), log('seed-001', 5)];
  it('недавние — по времени, без повторов', () => {
    expect(recentFoods(logs, foods).map((f) => f.id)).toEqual(['seed-001', 'seed-011', 'seed-005']);
  });
  it('частые — по числу записей', () => {
    expect(frequentFoods(logs, foods)[0]?.id).toBe('seed-001');
  });
  it('частые не повторяют недавние', () => {
    const recent = new Set(recentFoods(logs, foods).map((f) => f.id));
    expect(frequentFoods(logs, foods, 10, recent).some((f) => recent.has(f.id))).toBe(false);
  });
  it('приём по времени', () => {
    expect(mealByHour(8)).toBe('breakfast');
    expect(mealByHour(13)).toBe('lunch');
    expect(mealByHour(19)).toBe('dinner');
    expect(mealByHour(23)).toBe('snack');
  });
});

describe('быстрая запись → своя база', () => {
  const kefir = { ...quickFoodDraft({ name: 'Кефир 1%', unit: 'ml', per100: { kcal: 40, p: 30, f: 10, c: 40 } }), id: 'k' };
  it('черновик: на 100 мл, свой, напиток', () => {
    expect(kefir).toMatchObject({ name: 'Кефир 1%', unit: 'ml', source: 'user', category: 'drink', archived: false });
    expect(quickFoodDraft({ name: '  Плов   в кафе ', unit: 'g', per100: { kcal: 180, p: 60, f: 80, c: 220 } })).not.toHaveProperty('category');
  });
  it('тот же продукт — по названию без регистра, единице и значениям; другие значения — другой продукт', () => {
    expect(findSameUserFood([kefir], { name: 'кефир  1%', unit: 'ml', per100: kefir.per100 })?.id).toBe('k');
    expect(findSameUserFood([kefir], { name: 'Кефир 1%', unit: 'g', per100: kefir.per100 })).toBeUndefined();
    expect(findSameUserFood([kefir], { name: 'Кефир 1%', unit: 'ml', per100: { ...kefir.per100, kcal: 41 } })).toBeUndefined();
    expect(findSameUserFood([{ ...kefir, archived: true }], { name: 'Кефир 1%', unit: 'ml', per100: kefir.per100 })).toBeUndefined();
    expect(findSameUserFood([{ ...kefir, source: 'seed' }], { name: 'Кефир 1%', unit: 'ml', per100: kefir.per100 })).toBeUndefined();
  });
  it('новый продукт находится поиском', () => {
    const tan = { ...quickFoodDraft({ name: 'Тан газированный', unit: 'ml', per100: { kcal: 24, p: 11, f: 15, c: 10 } }), id: 't' };
    expect(searchFoods([...SEED_FOODS.map((f, i) => ({ ...f, id: String(i) })), tan], 'тан газ').map((f) => f.id)).toEqual(['t']);
  });
});
