// Доступные веса снарядов (SPEC 5.2 п. 7), разминка (5.3) и калькулятор блинов (5.4). Всё в Kg100.

import type { Exercise, Kg100 } from '../db/types';

/** Гантели 2–32 кг через 2 кг; тяжелее — тоже через 2 кг. */
export const DUMBBELLS: Kg100[] = Array.from({ length: 25 }, (_, i) => (i + 1) * 200);

type Equipment = Exercise['equipment'];

function gridStep(eq: Equipment): number {
  if (eq === 'barbell') return 250;
  if (eq === 'dumbbell') return 200;
  if (eq === 'cable' || eq === 'machine') return 500;
  return 0;
}

export type RoundMode = 'nearest' | 'up' | 'down';

/** Округление до доступного веса: штанга 2,5 кг, гантели из ряда, блоки — плита 5 кг. */
export function roundWeight(eq: Equipment, w: Kg100, mode: RoundMode = 'nearest'): Kg100 {
  const step = gridStep(eq);
  if (step === 0) return Math.max(0, Math.round(w));
  const min = eq === 'dumbbell' ? DUMBBELLS[0]! : step;
  const q = w / step;
  const n = mode === 'up' ? Math.ceil(q - 1e-9) : mode === 'down' ? Math.floor(q + 1e-9) : Math.round(q);
  return Math.max(min, n * step);
}

/** Следующий доступный вес вверх/вниз — для степпера ±шаг. */
export function adjacentWeight(eq: Equipment, w: Kg100, dir: 1 | -1): Kg100 {
  const step = gridStep(eq) || 100;
  const r = roundWeight(eq, w, dir === 1 ? 'down' : 'up');
  const next = r + dir * step;
  return Math.max(eq === 'bodyweight' ? 0 : step, next);
}

/** Вес + шаг, округлённый вверх; всегда больше исходного. */
export function increaseWeight(eq: Equipment, base: Kg100, step: number): Kg100 {
  const w = roundWeight(eq, base + step, 'up');
  return w > base ? w : adjacentWeight(eq, base, 1);
}

/** Снижение до доли (0,9 при застое, 0,8 в разгрузку); при застое — строго меньше исходного. */
export function reduceWeight(eq: Equipment, base: Kg100, factor: number, strict = true): Kg100 {
  const w = roundWeight(eq, base * factor, 'nearest');
  if (strict && w >= base) return roundWeight(eq, base - 1, 'down');
  return w;
}

// ---------- Разминка ----------

export interface WarmupSet {
  weight: Kg100;
  reps: number;
}

/**
 * Для первого упражнения с долгим отдыхом: гриф × 10, 50% × 6, при рабочем ≥ 60 кг ещё 75% × 3.
 * Для гантелей вместо грифа — сразу 50% × 8. Подходы не тяжелее рабочего и без повторов веса.
 */
export function warmupSets(eq: Equipment, work: Kg100, barWeight: Kg100): WarmupSet[] {
  if (work <= 0) return [];
  const sets: WarmupSet[] = [];
  if (eq === 'barbell') {
    sets.push({ weight: barWeight, reps: 10 });
    sets.push({ weight: roundWeight(eq, work * 0.5), reps: 6 });
  } else {
    sets.push({ weight: roundWeight(eq, work * 0.5), reps: 8 });
  }
  if (work >= 6000) sets.push({ weight: roundWeight(eq, work * 0.75), reps: 3 });
  const seen = new Set<number>();
  return sets.filter((s) => {
    if (s.weight >= work || seen.has(s.weight)) return false;
    if (eq === 'barbell' && s.weight < barWeight) return false;
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
