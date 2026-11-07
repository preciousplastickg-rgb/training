import { describe, expect, it } from 'vitest';
import type { Adjustment, BodyEntry, Food, FoodLog } from '../db/types';
import { addDays } from './dates';
import { carbsFor, chickenGrams, dayTargets, dayTotals, nutritionInTarget, nutritionStats, portion, recipePer100, weeklyAdjustment } from './nutrition';

const chicken: Food = { id: 'c', name: 'Куриная грудка', aliases: [], per100: { kcal: 110, p: 230, f: 15, c: 0 }, source: 'seed', approx: false, archived: false };
const rice: Food = { id: 'r', name: 'Рис', aliases: [], per100: { kcal: 360, p: 70, f: 6, c: 790 }, source: 'seed', approx: false, archived: false };
const foods = new Map([[chicken.id, chicken], [rice.id, rice]]);
const log = (meal: FoodLog['meal'], foodId: string, grams: number): FoodLog => ({ id: `${foodId}${grams}`, date: '2026-11-10', meal, foodId, grams, createdAt: 0 });

describe('итоги дня', () => {
  it('порция: grams / 100 × per100', () => {
    expect(portion(chicken, 200)).toEqual({ kcal: 220, p: 460, f: 30, c: 0 });
    expect(portion(rice, 75)).toEqual({ kcal: 270, p: 53, f: 5, c: 593 });
  });
  it('сумма по приёмам и быстрым записям совпадает с ручным расчётом', () => {
    const logs: FoodLog[] = [
      log('lunch', 'c', 200),
      log('lunch', 'r', 75),
      { id: 'q', date: '2026-11-10', meal: 'dinner', quick: { name: 'Плов в кафе', kcal: 700, p: 250 }, createdAt: 0 },
    ];
    const t = dayTotals(logs, foods);
    expect(t.byMeal.lunch).toEqual({ kcal: 490, p: 513, f: 35, c: 593 });
    expect(t.total.kcal).toBe(220 + 270 + 700);
    expect(t.total.p).toBe(460 + 53 + 250);
    expect(t.byMeal.breakfast.kcal).toBe(0);
  });
  it('своё блюдо → на 100 г готового', () => {
    const per = recipePer100({ items: [{ foodId: 'c', grams: 500 }, { foodId: 'r', grams: 200 }], cookedWeight: 1000 }, foods);
    expect(per.kcal).toBe(Math.round((550 + 720) / 10));
  });
});

describe('цели дня', () => {
  const adj = (date: string, deltaKcal: number): Adjustment => ({ id: date, date, deltaKcal, reason: '' });
  it('фаза 1: 2 050 / 155 / 65, углеводы по формуле', () => {
    const t = dayTargets('2026-11-10', [], {});
    expect(t).toMatchObject({ kcal: 2050, protein: 155, fat: 65 });
    expect(t.carbs).toBe(carbsFor(2050, 155, 65));
    expect(t.carbs).toBe(211);
  });
  it('+ принятые корректировки, не раньше их даты', () => {
    const a = [adj('2026-11-23', -150), adj('2026-12-07', -150)];
    expect(dayTargets('2026-11-22', a, {}).kcal).toBe(2050);
    expect(dayTargets('2026-11-30', a, {}).kcal).toBe(1900);
    expect(dayTargets('2026-12-10', a, {}).kcal).toBe(1800);
  });
  it('нижняя граница 1 800', () => {
    expect(dayTargets('2027-01-20', [adj('2026-11-23', -600)], {}).kcal).toBe(1800);
  });
  it('новогодняя разгрузка — поддержка 2 500', () => {
    expect(dayTargets('2026-12-31', [adj('2026-11-23', -150)], {})).toMatchObject({ kcal: 2500, maintenance: true });
  });
  it('фаза 3 «поддержка» — 2 400 без корректировок фазы 2', () => {
    expect(dayTargets('2027-03-10', [adj('2026-11-23', -150)], { phase3Mode: 'maintenance' }).kcal).toBe(2400);
    expect(dayTargets('2027-03-10', [adj('2026-11-23', -150)], {}).kcal).toBe(1900);
  });
  it('в цели: ±10% калорий и белок ≥ 90%', () => {
    expect(nutritionInTarget({ kcal: 1900, p: 1400, f: 0, c: 0 }, { kcal: 2050, protein: 155 })).toBe(true);
    expect(nutritionInTarget({ kcal: 1800, p: 1400, f: 0, c: 0 }, { kcal: 2050, protein: 155 })).toBe(false);
    expect(nutritionInTarget({ kcal: 2050, p: 1390, f: 0, c: 0 }, { kcal: 2050, protein: 155 })).toBe(false);
  });
});

describe('корректировка калорий (SPEC 5.6)', () => {
  /** Вес с постоянным снижением `perWeek` (Kg100) с 9 ноября. */
  const seed = (perWeek: number, days = 60): BodyEntry[] =>
    Array.from({ length: days }, (_, i) => ({ date: addDays('2026-11-09', i), weight: Math.round(8100 - (perWeek * i) / 7) }));

  it('раньше 3-й недели — не проверяем', () => {
    expect(weeklyAdjustment('2026-11-16', seed(20), {}, 2050)).toBeNull();
  });
  it('снижение 0,2 кг/нед → «убрать 150 ккал»', () => {
    const c = weeklyAdjustment('2026-11-30', seed(20), {}, 2050)!;
    expect(c.kind).toBe('cut');
    expect(c.deltaKcal).toBe(-150);
    expect(c.text).toBe('Снижение 0,2 кг/нед — меньше плана. Убрать 150 ккал в день?');
  });
  it('0,5 кг/нед → ничего', () => {
    expect(weeklyAdjustment('2026-11-30', seed(50), {}, 2050)).toBeNull();
  });
  it('0,9 кг/нед (между 0,8 и 1,0) → ничего', () => {
    expect(weeklyAdjustment('2026-11-30', seed(90), {}, 2050)).toBeNull();
  });
  it('1,2 кг/нед → «добавить 150 ккал»', () => {
    const c = weeklyAdjustment('2026-11-30', seed(120), {}, 2050)!;
    expect(c.kind).toBe('add');
    expect(c.text).toBe('Снижение 1,2 кг/нед — слишком быстро, теряются мышцы. Добавить 150 ккал?');
  });
  it('карточка держится всю неделю: среда смотрит на понедельник', () => {
    expect(weeklyAdjustment('2026-12-02', seed(20), {}, 2050)?.weekOf).toBe('2026-11-30');
  });
  it('не предлагаем опуститься ниже 1 800', () => {
    expect(weeklyAdjustment('2026-11-30', seed(20), {}, 1900)).toBeNull();
  });
  it('сила падает 2 недели в 2 базовых → «Сила падает»', () => {
    const fall = [
      { date: '2026-11-11', weight: 6000 },
      { date: '2026-11-18', weight: 5750 },
      { date: '2026-11-25', weight: 5500 },
    ];
    const c = weeklyAdjustment('2026-11-30', seed(50), { bench_press: fall, barbell_rdl: fall }, 2050)!;
    expect(c.kind).toBe('strength');
    expect(c.text).toBe('Сила падает. Проверь сон и белок. Добавить 150 ккал?');
  });
  it('новогодняя поддержка в окне — без корректировок', () => {
    expect(weeklyAdjustment('2027-01-04', seed(20, 70), {}, 2050)).toBeNull();
    expect(weeklyAdjustment('2027-01-18', seed(20, 80), {}, 2050)).toBeNull();
    expect(weeklyAdjustment('2027-01-25', seed(20, 80), {}, 2050)?.kind).toBe('cut');
  });
});

describe('подсказки и статистика питания', () => {
  it('курица: 60 г белка ≈ 200 г грудки', () => {
    expect(chickenGrams(60)).toBe(200);
    expect(chickenGrams(3)).toBe(10);
    expect(chickenGrams(0)).toBe(0);
  });
  it('недели и дни в цели', () => {
    // пн 9 ноября: 700 г грудки + 200 г риса = 770 + 720 = 1 490 ккал, белок 161 + 14 = 175 г → белок ок, ккал мимо
    const logs = [log('lunch', 'c', 700), log('dinner', 'r', 200)].map((l) => ({ ...l, date: '2026-11-09' }));
    const s = nutritionStats(logs, foods, [], { phase3Mode: 'deficit' }, '2026-11-10')!;
    expect(s.weeks).toHaveLength(1);
    expect(s.weeks[0]).toMatchObject({ start: '2026-11-09', value: 1490, target: 2050, ok: false });
    expect(s).toMatchObject({ days: 1, proteinOk: 1, inTarget: 0 });
    expect(nutritionStats([], foods, [], { phase3Mode: 'deficit' }, '2026-11-10')).toBeNull();
    // две недели спустя без записей — пустые недели в график не попадают
    expect(nutritionStats(logs, foods, [], { phase3Mode: 'deficit' }, '2026-11-24')!.weeks.map((w) => w.start)).toEqual(['2026-11-09']);
  });
});
