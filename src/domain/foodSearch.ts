// Поиск продуктов, «Недавние» и «Частые» (SPEC 6.3).

import type { Food, FoodLog } from '../db/types';

export const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}%,. ]/gu, ' ').replace(/\s+/g, ' ').trim();

/**
 * Тот же свой продукт: название (регистр, «ё» и лишние пробелы не важны), единица и значения на 100 совпадают,
 * не из архива. Повторная быстрая запись берёт его, а не плодит копии. Значения отличаются — это другой продукт:
 * старый не трогаем, иначе пересчитаются прошлые дни.
 */
export function findSameUserFood(foods: readonly Food[], draft: Pick<Food, 'name' | 'unit' | 'per100'>): Food | undefined {
  const n = norm(draft.name);
  const unit = draft.unit ?? 'g';
  const same = (a: Food['per100'], b: Food['per100']) => a.kcal === b.kcal && a.p === b.p && a.f === b.f && a.c === b.c;
  return n ? foods.find((f) => f.source === 'user' && !f.archived && norm(f.name) === n && (f.unit ?? 'g') === unit && same(f.per100, draft.per100)) : undefined;
}

/** По названию и синонимам; сначала совпадения с начала слова, архивные — не показываем. */
export function searchFoods(foods: readonly Food[], query: string, limit = 30): Food[] {
  const q = norm(query);
  if (!q) return [];
  const words = q.split(' ');
  const scored: { f: Food; score: number }[] = [];
  for (const f of foods) {
    if (f.archived) continue;
    const hay = [norm(f.name), ...f.aliases.map(norm)];
    let score = 0;
    for (const w of words) {
      let best = 0;
      for (const h of hay) {
        if (h === w) best = Math.max(best, 4);
        else if (h.startsWith(w)) best = Math.max(best, 3);
        else if (h.split(' ').some((t) => t.startsWith(w))) best = Math.max(best, 2);
        else if (h.includes(w)) best = Math.max(best, 1);
      }
      if (best === 0) {
        score = 0;
        break;
      }
      score += best;
    }
    if (score > 0) scored.push({ f, score: score + (f.source === 'user' || f.source === 'recipe' ? 0.5 : 0) });
  }
  return scored.sort((a, b) => b.score - a.score || a.f.name.localeCompare(b.f.name, 'ru')).slice(0, limit).map((x) => x.f);
}

export function recentFoods(logs: readonly FoodLog[], foods: ReadonlyMap<string, Food>, limit = 10): Food[] {
  const seen = new Set<string>();
  const out: Food[] = [];
  for (const l of [...logs].sort((a, b) => b.createdAt - a.createdAt)) {
    if (!l.foodId || seen.has(l.foodId)) continue;
    const f = foods.get(l.foodId);
    if (!f || f.archived) continue;
    seen.add(l.foodId);
    out.push(f);
    if (out.length >= limit) break;
  }
  return out;
}

/** По числу записей. `exclude` — что уже показано в «Недавних»: иначе списки дублируют друг друга. */
export function frequentFoods(logs: readonly FoodLog[], foods: ReadonlyMap<string, Food>, limit = 10, exclude: ReadonlySet<string> = new Set()): Food[] {
  const count = new Map<string, number>();
  for (const l of logs) if (l.foodId) count.set(l.foodId, (count.get(l.foodId) ?? 0) + 1);
  return [...count.entries()]
    .sort((a, b) => b[1] - a[1])
    .filter(([id]) => !exclude.has(id))
    .map(([id]) => foods.get(id))
    .filter((f): f is Food => !!f && !f.archived)
    .slice(0, limit);
}

/** Приём пищи по времени суток — для «+ → Еда». */
export function mealByHour(hour: number): FoodLog['meal'] {
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}
