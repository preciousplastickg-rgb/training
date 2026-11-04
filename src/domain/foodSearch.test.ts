import { describe, expect, it } from 'vitest';
import { SEED_FOODS } from '../data/foods';
import type { FoodLog } from '../db/types';
import { frequentFoods, mealByHour, recentFoods, searchFoods } from './foodSearch';

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
  it('приём по времени', () => {
    expect(mealByHour(8)).toBe('breakfast');
    expect(mealByHour(13)).toBe('lunch');
    expect(mealByHour(19)).toBe('dinner');
    expect(mealByHour(23)).toBe('snack');
  });
});
