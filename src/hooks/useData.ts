// Живые запросы к БД для экранов. Данных у одного человека за полгода немного — читаем таблицы целиком.

import { useMemo } from 'react';
import { db } from '../db/db';
import type { RestTimer } from '../db/repo';
import type {
  Adjustment, BodyEntry, ExerciseNote, Food, FoodLog, PoolSession, ProgramSlot, Recipe, SetLog, Settings, WorkoutSession,
} from '../db/types';
import { prefetch, useLiveQuery } from '../db/useLiveQuery';

const EMPTY: never[] = [];

// Запросы целых таблиц — с ключом кэша и прогревом при старте (см. useLiveQuery).
const Q = {
  settings: () => db.settings.get('main'),
  slots: () => db.slots.toArray(),
  sessions: () => db.sessions.orderBy('date').toArray(),
  sets: () => db.sets.toArray(),
  body: () => db.body.orderBy('date').toArray(),
  pool: () => db.pool.orderBy('date').toArray(),
  adjustments: () => db.adjustments.orderBy('date').toArray(),
  foods: () => db.foods.toArray(),
  recipes: () => db.recipes.toArray(),
  foodLog: () => db.foodLog.toArray(),
  exerciseNotes: () => db.exerciseNotes.toArray(),
};

/** Прочитать все таблицы до первого экрана — экраны открываются сразу с данными. */
export const prefetchData = (): Promise<unknown> =>
  Promise.all(Object.entries(Q).map(([k, q]) => prefetch<unknown>(k, q as () => Promise<unknown>)));

export const useSettings = (): Settings | undefined => useLiveQuery<Settings | undefined>(Q.settings, [], undefined, 'settings');
export const useSlots = (): ProgramSlot[] => useLiveQuery(Q.slots, [], EMPTY, 'slots');
export const useSessions = (): WorkoutSession[] => useLiveQuery(Q.sessions, [], EMPTY, 'sessions');
export const useAllSets = (): SetLog[] => useLiveQuery(Q.sets, [], EMPTY, 'sets');
export const useSessionSets = (sessionId: string | undefined): SetLog[] =>
  useLiveQuery(() => (sessionId ? db.sets.where('sessionId').equals(sessionId).toArray() : []), [sessionId], EMPTY);
export const useBody = (): BodyEntry[] => useLiveQuery(Q.body, [], EMPTY, 'body');
export const usePool = (): PoolSession[] => useLiveQuery(Q.pool, [], EMPTY, 'pool');
export const useAdjustments = (): Adjustment[] => useLiveQuery(Q.adjustments, [], EMPTY, 'adjustments');
export const useFoods = (): Food[] => useLiveQuery(Q.foods, [], EMPTY, 'foods');
export const useRecipes = (): Recipe[] => useLiveQuery(Q.recipes, [], EMPTY, 'recipes');
export const useAllFoodLog = (): FoodLog[] => useLiveQuery(Q.foodLog, [], EMPTY, 'foodLog');
export const useExerciseNotes = (): ExerciseNote[] => useLiveQuery(Q.exerciseNotes, [], EMPTY, 'exerciseNotes');
/** Дневник за день — из общего кэша дневника: при переключении дня нет пустого кадра. */
export const useFoodLog = (date: string): FoodLog[] => {
  const all = useAllFoodLog();
  return useMemo(() => all.filter((l) => l.date === date).sort((a, b) => a.createdAt - b.createdAt), [all, date]);
};
export const useActiveSession = (): WorkoutSession | undefined | null =>
  useLiveQuery(
    async () => (await db.sessions.toArray()).filter((s) => s.finishedAt === undefined).sort((a, b) => b.startedAt - a.startedAt)[0] ?? null,
    [],
  );
export const useRestTimer = (): RestTimer | null =>
  useLiveQuery(async () => ((await db.kv.get('restTimer'))?.value as RestTimer | undefined) ?? null, [], null);
export const useKv = <T,>(key: string): T | undefined => useLiveQuery(async () => (await db.kv.get(key))?.value as T | undefined, [key]);
export const usePhotos = () => useLiveQuery(() => db.photos.orderBy('date').toArray(), [], EMPTY);
