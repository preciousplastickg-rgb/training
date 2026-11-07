// Доступные веса снарядов (SPEC 5.2 п. 7), разминка (5.3) и калькулятор блинов (5.4). Всё в Kg100.
// Округление — по оборудованию: штанга и EZ — 2,5 кг; гантели — ряд; блоки, тренажёры с плитами и
// противовес гравитрона — 5 кг; блин у гиперэкстензии — 2,5 кг. Шаг прогрессии приходит отдельно
// (`ProgramSlot.step` или `Exercise.defaultStep`): у жима ногами он 10 кг при округлении 5.

import type { Exercise, Kg100, Settings } from '../db/types';

/** Гантели 2–50 кг через 2 кг. */
export const DUMBBELLS: Kg100[] = Array.from({ length: 25 }, (_, i) => (i + 1) * 200);

type Equipment = Exercise['equipment'];
/** Оборудование строкой (как в SPEC 5.2) или упражнение целиком — для единицы `assist_kg` и блина у гиперэкстензии. */
export type EqLike = Equipment | Pick<Exercise, 'equipment' | 'unit'>;

const norm = (eq: EqLike): Pick<Exercise, 'equipment' | 'unit'> => (typeof eq === 'string' ? { equipment: eq, unit: 'kg' } : eq);

function gridStep(eqLike: EqLike): number {
  const { equipment, unit } = norm(eqLike);
  if (unit === 'assist_kg') return 500;
  if (unit !== 'kg') return 0;
  if (equipment === 'barbell') return 250;
  if (equipment === 'dumbbell') return 200;
  if (equipment === 'cable' || equipment === 'machine') return 500;
  // bodyweight с весом (гиперэкстензия с блином): блины по 2,5 кг, старт с 0
  return 250;
}

export type RoundMode = 'nearest' | 'up' | 'down';

/** Округление до доступного веса. Противовес и блин у гиперэкстензии могут быть 0. */
export function roundWeight(eqLike: EqLike, w: Kg100, mode: RoundMode = 'nearest'): Kg100 {
  const ex = norm(eqLike);
  const step = gridStep(ex);
  if (step === 0) return Math.max(0, Math.round(w));
  const min = ex.equipment === 'dumbbell' ? DUMBBELLS[0]! : ex.unit === 'assist_kg' || ex.equipment === 'bodyweight' ? 0 : step;
  const q = w / step;
  const n = mode === 'up' ? Math.ceil(q - 1e-9) : mode === 'down' ? Math.floor(q + 1e-9) : Math.round(q);
  return Math.max(min, n * step);
}

/** Следующий доступный вес вверх/вниз — для степпера ±шаг. */
export function adjacentWeight(eqLike: EqLike, w: Kg100, dir: 1 | -1): Kg100 {
  const ex = norm(eqLike);
  const step = gridStep(ex) || 100;
  const r = roundWeight(ex, w, dir === 1 ? 'down' : 'up');
  const next = r + dir * step;
  const min = ex.equipment === 'bodyweight' || ex.unit === 'assist_kg' ? 0 : step;
  return Math.max(min, next);
}

/** Вес + шаг, округлённый вверх; всегда больше исходного. */
export function increaseWeight(eqLike: EqLike, base: Kg100, step: number): Kg100 {
  const w = roundWeight(eqLike, base + step, 'up');
  return w > base ? w : adjacentWeight(eqLike, base, 1);
}

/** Снижение до доли (0,9 при застое, 0,8 в разгрузку); при застое — строго меньше исходного. */
export function reduceWeight(eqLike: EqLike, base: Kg100, factor: number, strict = true): Kg100 {
  const w = roundWeight(eqLike, base * factor, 'nearest');
  if (strict && w >= base) return roundWeight(eqLike, base - 1, 'down');
  return w;
}

// ---------- Разминка ----------

export interface WarmupSet {
  weight: Kg100;
  reps: number;
}

/**
 * Для первого упражнения тренировки и базовых со штангой: гриф × 10, 50% × 6, при рабочем ≥ 60 кг ещё 75% × 3.
 * Без штанги вместо грифа — сразу 50% × 8. Подходы не тяжелее рабочего и без повторов веса.
 */
export function warmupSets(eqLike: EqLike, work: Kg100, barWeight: Kg100): WarmupSet[] {
  const ex = norm(eqLike);
  if (work <= 0 || ex.unit !== 'kg') return [];
  const sets: WarmupSet[] = [];
  if (ex.equipment === 'barbell') {
    sets.push({ weight: barWeight, reps: 10 });
    sets.push({ weight: roundWeight(ex, work * 0.5), reps: 6 });
  } else {
    sets.push({ weight: roundWeight(ex, work * 0.5), reps: 8 });
  }
  if (work >= 6000) sets.push({ weight: roundWeight(ex, work * 0.75), reps: 3 });
  const seen = new Set<number>();
  return sets.filter((s) => {
    if (s.weight >= work || seen.has(s.weight) || s.weight <= 0) return false;
    if (ex.equipment === 'barbell' && s.weight < barWeight) return false;
    seen.add(s.weight);
    return true;
  });
}

// ---------- Блины ----------

export interface PlateLoad {
  perSide: Kg100[];
  /** Сколько не удалось набрать на сторону (0 — точно). */
  remainder: Kg100;
}

/** 62,5 кг при грифе 20 → на сторону [20, 1,25]. Жадно от тяжёлых к лёгким. */
export function platesPerSide(total: Kg100, barWeight: Kg100, plates: readonly Kg100[]): PlateLoad | null {
  if (total < barWeight) return null;
  let side = (total - barWeight) / 2;
  const sorted = [...plates].sort((a, b) => b - a);
  const perSide: Kg100[] = [];
  for (const p of sorted) {
    while (side >= p - 1e-9) {
      perSide.push(p);
      side -= p;
    }
  }
  return { perSide, remainder: Math.round(side * 2) };
}

/** Упражнения с грифом EZ: калькулятор считает от `ezBarWeight` (SPEC 5.4). */
export const EZ_BAR_EXERCISES = new Set(['ez_curl', 'preacher_curl', 'ez_skullcrusher']);

/** Вес грифа для калькулятора: штанга — `barWeight`, EZ — `ezBarWeight`, тренажёры и блоки — null (калькулятора нет). */
export function barWeightFor(ex: Pick<Exercise, 'id' | 'equipment'>, settings: Pick<Settings, 'barWeight' | 'ezBarWeight'>): Kg100 | null {
  if (ex.equipment !== 'barbell') return null;
  return EZ_BAR_EXERCISES.has(ex.id) ? settings.ezBarWeight : settings.barWeight;
}
