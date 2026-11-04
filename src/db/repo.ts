// Операции с данными, которые вызывает UI. Логика расчётов — в src/domain.

import { SEED_FOODS } from '../data/foods';
import { SEED_SLOTS } from '../data/program';
import { appToday as today } from '../app/clock';
import type { HistoryEntry } from '../domain/progression';
import { db, ensureSettings, updateSettings, type AppDB } from './db';
import type {
  Adjustment, BodyEntry, Food, FoodLog, LocalDate, PoolSession, ProgramSlot, Recipe, SetLog, WorkoutSession,
} from './types';

const uid = () => crypto.randomUUID();

// ---------- Seed ----------

/** Программа и база продуктов при первом запуске. Повторный запуск ничего не меняет. */
export async function seedIfNeeded(database: AppDB = db): Promise<void> {
  await ensureSettings(database);
  await database.transaction('rw', database.slots, database.foods, database.kv, async () => {
    if (!(await database.kv.get('seed:slots'))) {
      await database.slots.bulkPut(SEED_SLOTS);
      await database.kv.put({ key: 'seed:slots', value: 1 });
    }
    if (!(await database.kv.get('seed:foods'))) {
      const existing = new Set(await database.foods.toCollection().primaryKeys());
      await database.foods.bulkAdd(SEED_FOODS.filter((f) => !existing.has(f.id)));
      await database.kv.put({ key: 'seed:foods', value: 1 });
    }
  });
}

export async function resetProgram(database: AppDB = db): Promise<void> {
  await database.transaction('rw', database.slots, async () => {
    await database.slots.clear();
    await database.slots.bulkPut(SEED_SLOTS);
  });
}

export async function updateSlot(id: string, patch: Partial<ProgramSlot>): Promise<void> {
  await db.slots.update(id, patch);
}

// ---------- KV ----------

export async function kvGet<T>(key: string): Promise<T | undefined> {
  return (await db.kv.get(key))?.value as T | undefined;
}
export async function kvSet(key: string, value: unknown): Promise<void> {
  await db.kv.put({ key, value });
}
export async function kvDel(key: string): Promise<void> {
  await db.kv.delete(key);
}

// ---------- Тренировки ----------

export interface RestTimer {
  sessionId: string;
  startedAt: number;
  endsAt: number;
  /** Полная длительность, с — для кольца. */
  total: number;
}

export async function activeSession(): Promise<WorkoutSession | undefined> {
  const all = await db.sessions.toArray();
  return all.filter((s) => s.finishedAt === undefined).sort((a, b) => b.startedAt - a.startedAt)[0];
}

export async function startSession(input: Pick<WorkoutSession, 'workout' | 'isDeload' | 'isCalibration'>): Promise<string> {
  const existing = await activeSession();
  if (existing) return existing.id;
  const id = uid();
  await db.sessions.add({ id, date: today(), startedAt: Date.now(), ...input });
  return id;
}

/** Подход пишется в БД сразу — незавершённая тренировка переживает закрытие приложения. */
export async function logSet(set: Omit<SetLog, 'id' | 'doneAt'>): Promise<string> {
  const id = uid();
  await db.sets.add({ ...set, id, doneAt: Date.now() });
  return id;
}

export async function updateSet(id: string, patch: Partial<SetLog>): Promise<void> {
  await db.sets.update(id, patch);
}

export async function deleteSet(id: string): Promise<void> {
  await db.sets.delete(id);
}

export async function finishSession(id: string, note?: string): Promise<void> {
  await db.sessions.update(id, { finishedAt: Date.now(), ...(note ? { note } : {}) });
  await kvDel('restTimer');
}

/** Отменить тренировку целиком: сессия и её подходы удаляются. */
export async function discardSession(id: string): Promise<void> {
  await db.transaction('rw', db.sessions, db.sets, db.kv, async () => {
    await db.sets.where('sessionId').equals(id).delete();
    await db.sessions.delete(id);
    await db.kv.delete('restTimer');
  });
}

export async function startRest(sessionId: string, seconds: number): Promise<void> {
  const now = Date.now();
  await kvSet('restTimer', { sessionId, startedAt: now, endsAt: now + seconds * 1000, total: seconds } satisfies RestTimer);
}

export async function extendRest(by: number): Promise<void> {
  const t = await kvGet<RestTimer>('restTimer');
  if (!t) return;
  const now = Date.now();
  const endsAt = Math.max(t.endsAt, now) + by * 1000;
  await kvSet('restTimer', { ...t, endsAt, total: Math.round((endsAt - t.startedAt) / 1000) });
}

export async function stopRest(): Promise<void> {
  await kvDel('restTimer');
}

/** История упражнения для прогрессии: завершённые сессии, рабочие подходы, от старых к новым. */
export async function exerciseHistory(exerciseId: string, excludeSessionId?: string): Promise<HistoryEntry[]> {
  const sets = await db.sets.where('[exerciseId+doneAt]').between([exerciseId, 0], [exerciseId, Infinity]).toArray();
  const ids = [...new Set(sets.map((s) => s.sessionId))].filter((id) => id !== excludeSessionId);
  const sessions = (await db.sessions.bulkGet(ids)).filter((s): s is WorkoutSession => !!s && s.finishedAt !== undefined);
  return sessions
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((s) => ({
      date: s.date,
      isDeload: s.isDeload,
      isCalibration: s.isCalibration,
      sets: sets
        .filter((x) => x.sessionId === s.id && x.kind === 'work')
        .sort((a, b) => a.setIndex - b.setIndex)
        .map((x) => ({ weight: x.weight, reps: x.reps })),
    }));
}

// ---------- Бассейн и тело ----------

export async function addPool(p: Omit<PoolSession, 'id'>): Promise<void> {
  await db.pool.add({ ...p, id: uid() });
}

export async function deletePool(id: string): Promise<void> {
  await db.pool.delete(id);
}

/** Одна запись на дату: новые поля дописываются к существующим. */
export async function putBody(date: LocalDate, patch: Omit<Partial<BodyEntry>, 'date'>): Promise<void> {
  await db.transaction('rw', db.body, async () => {
    const prev = (await db.body.get(date)) ?? { date };
    await db.body.put({ ...prev, ...patch, date });
  });
}

// ---------- Питание ----------

export async function addFoodLog(entry: Omit<FoodLog, 'id' | 'createdAt'>): Promise<void> {
  await db.foodLog.add({ ...entry, id: uid(), createdAt: Date.now() });
}

export async function updateFoodLog(id: string, patch: Partial<FoodLog>): Promise<void> {
  await db.foodLog.update(id, patch);
}

export async function deleteFoodLog(id: string): Promise<FoodLog | undefined> {
  const prev = await db.foodLog.get(id);
  await db.foodLog.delete(id);
  return prev;
}

export async function restoreFoodLog(entry: FoodLog): Promise<void> {
  await db.foodLog.put(entry);
}

/** «Повторить вчерашний завтрак»: копия приёма пищи с другого дня. */
export async function copyMeal(from: LocalDate, meal: FoodLog['meal'], to: LocalDate, toMeal: FoodLog['meal'] = meal): Promise<number> {
  const src = (await db.foodLog.where('date').equals(from).toArray()).filter((l) => l.meal === meal);
  const now = Date.now();
  await db.foodLog.bulkAdd(src.map((l, i) => ({ ...l, id: uid(), date: to, meal: toMeal, createdAt: now + i })));
  return src.length;
}

export async function saveFood(food: Omit<Food, 'id'> & { id?: string }): Promise<string> {
  const id = food.id ?? uid();
  await db.foods.put({ ...food, id });
  return id;
}

export async function saveRecipe(food: Omit<Food, 'id' | 'source'> & { id?: string }, recipe: Omit<Recipe, 'foodId'>): Promise<string> {
  const id = food.id ?? uid();
  await db.transaction('rw', db.foods, db.recipes, async () => {
    await db.foods.put({ ...food, id, source: 'recipe' });
    await db.recipes.put({ ...recipe, foodId: id });
  });
  return id;
}

// ---------- Корректировки ----------

export async function applyAdjustment(date: LocalDate, deltaKcal: number, reason: string): Promise<void> {
  await db.adjustments.add({ id: uid(), date, deltaKcal, reason } satisfies Adjustment);
}

export async function dismissAdjustment(weekOf: LocalDate): Promise<void> {
  await kvSet(`adjDismissed:${weekOf}`, Date.now());
}

export async function setPhase3Mode(mode: 'maintenance' | 'deficit'): Promise<void> {
  await updateSettings({ phase3Mode: mode });
}

// ---------- Фото ----------

/** Ужать до 1080 px по длинной стороне, JPEG 0,8 (SPEC 8). */
export async function compressPhoto(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1080 / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/jpeg', 0.8));
}

export async function addPhoto(date: LocalDate, pose: 'front' | 'side' | 'back', file: Blob): Promise<void> {
  const blob = await compressPhoto(file);
  await db.photos.add({ id: uid(), date, pose, blob });
}

export async function deletePhoto(id: string): Promise<void> {
  await db.photos.delete(id);
}

