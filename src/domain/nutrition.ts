// Питание — SPEC 5.6: порции, итоги дня, цели дня, корректировки калорий.

import {
  MAINTENANCE_DELOAD, MAINTENANCE_KCAL_DELOAD, MAINTENANCE_KCAL_PHASE3, MIN_KCAL, PHASES, PROGRAM_START,
} from '../data/program';
import type { Adjustment, BodyEntry, Food, FoodLog, Kg100, LocalDate, Recipe, Settings } from '../db/types';
import { avg7 } from './body';
import { addDays, isBetween, weekStart } from './dates';
import { formatScaled, NBSP } from './format';
import { phaseFor } from './program';

/** Калории — целые, p/f/c — граммы × 10. */
export interface Macros {
  kcal: number;
  p: number;
  f: number;
  c: number;
}

export const ZERO: Macros = { kcal: 0, p: 0, f: 0, c: 0 };

export function addMacros(a: Macros, b: Macros): Macros {
  return { kcal: a.kcal + b.kcal, p: a.p + b.p, f: a.f + b.f, c: a.c + b.c };
}

/** grams / 100 × per100, округление до целых. */
export function portion(food: Pick<Food, 'per100'>, grams: number): Macros {
  const k = (v: number) => Math.round((v * grams) / 100);
  return { kcal: k(food.per100.kcal), p: k(food.per100.p), f: k(food.per100.f), c: k(food.per100.c) };
}

export function logMacros(log: FoodLog, foods: ReadonlyMap<string, Food>): Macros {
  if (log.quick) return { kcal: log.quick.kcal, p: log.quick.p, f: 0, c: 0 };
  const food = log.foodId ? foods.get(log.foodId) : undefined;
  if (!food || !log.grams) return ZERO;
  return portion(food, log.grams);
}

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type Meal = (typeof MEALS)[number];
export const MEAL_NAMES: Record<Meal, string> = { breakfast: 'Завтрак', lunch: 'Обед', dinner: 'Ужин', snack: 'Перекус' };

export function dayTotals(logs: readonly FoodLog[], foods: ReadonlyMap<string, Food>) {
  const byMeal: Record<Meal, Macros> = { breakfast: ZERO, lunch: ZERO, dinner: ZERO, snack: ZERO };
  let total = ZERO;
  for (const log of logs) {
    const m = logMacros(log, foods);
    byMeal[log.meal] = addMacros(byMeal[log.meal], m);
    total = addMacros(total, m);
  }
  return { total, byMeal };
}

/** Углеводы, г = (ккал − белок × 4 − жиры × 9) / 4. */
export function carbsFor(kcal: number, protein: number, fat: number): number {
  return Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
}

export interface DayTargets {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  maintenance: boolean;
}

/**
 * Цели дня = цели фазы + принятые корректировки (не ниже 1 800).
 * Новогодняя разгрузка — поддержка ≈ 2 500. Фаза 3: «поддержка» — 2 400 + корректировки с начала фазы 3,
 * «дефицит» (по умолчанию) — продолжение фазы 2.
 */
export function dayTargets(
  date: LocalDate,
  adjustments: readonly Adjustment[],
  settings: Pick<Settings, 'phase3Mode'>,
): DayTargets {
  const phase = phaseFor(date) ?? (date < PROGRAM_START ? PHASES[0]! : PHASES[2]!);
  const { protein, fat } = phase;
  if (isBetween(date, MAINTENANCE_DELOAD.start, MAINTENANCE_DELOAD.end)) {
    return { kcal: MAINTENANCE_KCAL_DELOAD, protein, fat, carbs: carbsFor(MAINTENANCE_KCAL_DELOAD, protein, fat), maintenance: true };
  }
  const p3 = PHASES[2]!;
  const maintenance = phase.n === 3 && settings.phase3Mode === 'maintenance';
  const base = maintenance ? MAINTENANCE_KCAL_PHASE3 : phase.kcal;
  const delta = adjustments
    .filter((a) => a.date <= date && (!maintenance || a.date >= p3.start))
    .reduce((s, a) => s + a.deltaKcal, 0);
  const kcal = Math.max(MIN_KCAL, base + delta);
  return { kcal, protein, fat, carbs: carbsFor(kcal, protein, fat), maintenance };
}

/** Питание в цели: калории ±10% и белок ≥ 90% (SPEC 5.8). */
export function nutritionInTarget(total: Macros, t: Pick<DayTargets, 'kcal' | 'protein'>): boolean {
  return Math.abs(total.kcal - t.kcal) <= t.kcal * 0.1 && total.p >= t.protein * 10 * 0.9;
}

/** Своё блюдо: состав и вес готового → значения на 100 г. */
export function recipePer100(recipe: Pick<Recipe, 'items' | 'cookedWeight'>, foods: ReadonlyMap<string, Food>): Macros {
  let total = ZERO;
  for (const it of recipe.items) {
    const f = foods.get(it.foodId);
    if (f) total = addMacros(total, portion(f, it.grams));
  }
  if (recipe.cookedWeight <= 0) return ZERO;
  const k = (v: number) => Math.round((v * 100) / recipe.cookedWeight);
  return { kcal: k(total.kcal), p: k(total.p), f: k(total.f), c: k(total.c) };
}

// ---------- Корректировки ----------

export type AdjustmentKind = 'cut' | 'add' | 'strength';

export interface AdjustmentCard {
  /** Понедельник, к которому относится проверка. */
  weekOf: LocalDate;
  kind: AdjustmentKind;
  deltaKcal: number;
  /** Снижение в неделю, Kg100 (может быть отрицательным — набор). */
  weeklyLoss: Kg100 | null;
  text: string;
}

export const ADJUST_STEP = 150;

/** Рабочий вес базового упражнения по датам (максимум сессии, без разгрузок). */
export type StrengthSeries = Record<string, { date: LocalDate; weight: Kg100 }[]>;

/** Падает ли рабочий вес 2 недели подряд: максимум недели W0 < W1 < W2. */
function strengthFalling(series: StrengthSeries, monday: LocalDate): number {
  let count = 0;
  for (const points of Object.values(series)) {
    const weekMax = (k: number) => {
      const from = addDays(monday, -7 * (k + 1));
      const to = addDays(monday, -7 * k - 1);
      const ws = points.filter((p) => p.date >= from && p.date <= to).map((p) => p.weight);
      return ws.length ? Math.max(...ws) : null;
    };
    const w0 = weekMax(0);
    const w1 = weekMax(1);
    const w2 = weekMax(2);
    if (w0 !== null && w1 !== null && w2 !== null && w0 < w1 && w1 < w2) count++;
  }
  return count;
}

/**
 * Проверка раз в неделю по понедельникам, начиная с 3-й недели.
 * Средний вес за 7 дней (по воскресенье) против такого же двумя неделями раньше, ÷ 2.
 * Окна, задевшие новогоднюю разгрузку (поддержку), не оцениваются.
 */
export function weeklyAdjustment(
  today: LocalDate,
  body: readonly BodyEntry[],
  strength: StrengthSeries,
  currentKcal: number,
): AdjustmentCard | null {
  const monday = weekStart(today);
  if (monday < addDays(PROGRAM_START, 14)) return null;
  const windowStart = addDays(monday, -21);
  if (MAINTENANCE_DELOAD.start <= addDays(monday, 6) && MAINTENANCE_DELOAD.end >= windowStart) return null;

  const falling = strengthFalling(strength, monday);
  const sunday = addDays(monday, -1);
  const now = avg7(body, sunday);
  const before = avg7(body, addDays(sunday, -14));
  const weeklyLoss = now !== null && before !== null ? Math.round((before - now) / 2) : null;

  if (falling >= 2) {
    return { weekOf: monday, kind: 'strength', deltaKcal: ADJUST_STEP, weeklyLoss, text: 'Сила падает. Проверь сон и белок. Добавить 150 ккал?' };
  }
  if (weeklyLoss === null) return null;
  const loss = formatScaled(weeklyLoss, 100, 1);
  if (weeklyLoss < 30) {
    if (currentKcal - ADJUST_STEP < MIN_KCAL) return null;
    return {
      weekOf: monday, kind: 'cut', deltaKcal: -ADJUST_STEP, weeklyLoss,
      text: `Снижение ${loss}${NBSP}кг/нед — меньше плана. Убрать 150${NBSP}ккал в день?`,
    };
  }
  if (weeklyLoss > 100) {
    return {
      weekOf: monday, kind: 'add', deltaKcal: ADJUST_STEP, weeklyLoss,
      text: `Снижение ${loss}${NBSP}кг/нед — слишком быстро, теряются мышцы. Добавить 150${NBSP}ккал?`,
    };
  }
  return null;
}
