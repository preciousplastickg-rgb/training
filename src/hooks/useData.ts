// Живые запросы к БД для экранов. Данных у одного человека за полгода немного — читаем таблицы целиком.

import { db } from '../db/db';
import type { RestTimer } from '../db/repo';
import type {
  Adjustment, BodyEntry, Food, FoodLog, PoolSession, ProgramSlot, Recipe, SetLog, Settings, WorkoutSession,
} from '../db/types';
import { useLiveQuery } from '../db/useLiveQuery';

const EMPTY: never[] = [];

export const useSettings = (): Settings | undefined => useLiveQuery(() => db.settings.get('main'), []);
export const useSlots = (): ProgramSlot[] => useLiveQuery(() => db.slots.toArray(), [], EMPTY);
export const useSessions = (): WorkoutSession[] => useLiveQuery(() => db.sessions.orderBy('date').toArray(), [], EMPTY);
export const useAllSets = (): SetLog[] => useLiveQuery(() => db.sets.toArray(), [], EMPTY);
export const useSessionSets = (sessionId: string | undefined): SetLog[] =>
  useLiveQuery(() => (sessionId ? db.sets.where('sessionId').equals(sessionId).toArray() : []), [sessionId], EMPTY);
export const useBody = (): BodyEntry[] => useLiveQuery(() => db.body.orderBy('date').toArray(), [], EMPTY);
export const usePool = (): PoolSession[] => useLiveQuery(() => db.pool.orderBy('date').toArray(), [], EMPTY);
export const useAdjustments = (): Adjustment[] => useLiveQuery(() => db.adjustments.orderBy('date').toArray(), [], EMPTY);
export const useFoods = (): Food[] => useLiveQuery(() => db.foods.toArray(), [], EMPTY);
export const useRecipes = (): Recipe[] => useLiveQuery(() => db.recipes.toArray(), [], EMPTY);
export const useFoodLog = (date: string): FoodLog[] =>
  useLiveQuery(() => db.foodLog.where('date').equals(date).sortBy('createdAt'), [date], EMPTY);
export const useAllFoodLog = (): FoodLog[] => useLiveQuery(() => db.foodLog.toArray(), [], EMPTY);
export const useActiveSession = (): WorkoutSession | undefined | null =>
  useLiveQuery(
    async () => (await db.sessions.toArray()).filter((s) => s.finishedAt === undefined).sort((a, b) => b.startedAt - a.startedAt)[0] ?? null,
    [],
  );
export const useRestTimer = (): RestTimer | null =>
  useLiveQuery(async () => ((await db.kv.get('restTimer'))?.value as RestTimer | undefined) ?? null, [], null);
export const useKv = <T,>(key: string): T | undefined => useLiveQuery(async () => (await db.kv.get(key))?.value as T | undefined, [key]);
export const usePhotos = () => useLiveQuery(() => db.photos.orderBy('date').toArray(), [], EMPTY);
