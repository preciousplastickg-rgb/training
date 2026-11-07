// IndexedDB через Dexie. Любое изменение схемы — новая db.version(n) с миграцией
// и тестом на данных прошлой версии (см. CLAUDE.md).

import Dexie, { type EntityTable, type Table } from 'dexie';
import { migratePoolV1, migrateSessionsV1, migrateSetsV1, migrateSettingsV1, migrateSlotsV1, type SlotV1 } from './migrate';
import type {
  Adjustment, BodyEntry, Exercise, ExerciseNote, Food, FoodLog, KvRow, LightWeek, PoolSession, ProgramSlot,
  ProgressPhoto, Recipe, SetLog, Settings, SettingsRow, WorkoutSession,
} from './types';

export const DB_NAME = 'training-pwa';

/** Индексы схемы v1. Таблицы из SPEC 4 + программа, рецепты, настройки и служебный kv. */
export const SCHEMA_V1 = {
  sessions: 'id, date',
  sets: 'id, sessionId, exerciseId, [exerciseId+doneAt]',
  pool: 'id, date',
  body: 'date',
  photos: 'id, date',
  foods: 'id, name, *aliases, source',
  foodLog: 'id, date, foodId',
  adjustments: 'id, date',
  recipes: 'foodId',
  exercises: 'id',
  slots: 'id, workout',
  settings: 'id',
  kv: 'key',
} as const;

/** v2: заметки к упражнениям — одна на упражнение. Остальные таблицы без изменений. */
export const SCHEMA_V2 = { ...SCHEMA_V1, exerciseNotes: 'exerciseId' } as const;

/** v3 (программа v2, 7 ноября 2026): лёгкие недели по пульсу, индекс workout у сессий. */
export const SCHEMA_V3 = { ...SCHEMA_V2, sessions: 'id, date, workout', lightWeeks: 'id, start' } as const;

/** Версия seed-программы в kv 'seed:slots': 2 — программа v2 (A, B, C по блокам). */
export const SLOT_SEED_VERSION = 2;

export class AppDB extends Dexie {
  sessions!: EntityTable<WorkoutSession, 'id'>;
  sets!: EntityTable<SetLog, 'id'>;
  pool!: EntityTable<PoolSession, 'id'>;
  body!: Table<BodyEntry, string>;
  photos!: EntityTable<ProgressPhoto, 'id'>;
  foods!: EntityTable<Food, 'id'>;
  foodLog!: EntityTable<FoodLog, 'id'>;
  adjustments!: EntityTable<Adjustment, 'id'>;
  recipes!: Table<Recipe, string>;
  exercises!: EntityTable<Exercise, 'id'>;
  slots!: EntityTable<ProgramSlot, 'id'>;
  settings!: Table<SettingsRow, 'main'>;
  kv!: Table<KvRow, string>;
  exerciseNotes!: Table<ExerciseNote, string>;
  lightWeeks!: EntityTable<LightWeek, 'id'>;

  constructor(name: string = DB_NAME) {
    super(name);
    this.version(1).stores(SCHEMA_V1);
    this.version(2).stores(SCHEMA_V2);
    this.version(3)
      .stores(SCHEMA_V3)
      .upgrade(async (tx) => {
        // Программа v2 (SPEC 4, «Миграция v2 → v3»): сессии получают блок 1, бассейн — тип по дню недели,
        // слоты перезаписываются seed v2 с переносом правок, подходы перевязываются к слотам блока 1.
        const slotsT = tx.table<ProgramSlot | SlotV1, string>('slots');
        const { slots, slotIdMap } = migrateSlotsV1(await slotsT.toArray());
        await slotsT.clear();
        await slotsT.bulkPut(slots);
        const sessionsT = tx.table<WorkoutSession, string>('sessions');
        await sessionsT.bulkPut(migrateSessionsV1(await sessionsT.toArray()));
        const setsT = tx.table<SetLog, string>('sets');
        await setsT.bulkPut(migrateSetsV1(await setsT.toArray(), slotIdMap));
        const poolT = tx.table<PoolSession, string>('pool');
        await poolT.bulkPut(migratePoolV1(await poolT.toArray()));
        const settingsT = tx.table<SettingsRow, 'main'>('settings');
        const row = await settingsT.get('main');
        if (row) await settingsT.put(migrateSettingsV1(row) as SettingsRow);
        await tx.table<KvRow, string>('kv').put({ key: 'seed:slots', value: SLOT_SEED_VERSION });
      });
  }
}

export const db = new AppDB();

export const DEFAULT_SETTINGS: Settings = {
  heightCm: 174.5,
  startDate: '2026-11-09',
  startWeight: 8100,
  targetWeight: 7300,
  targetBodyFat: 15,
  barWeight: 2000,
  ezBarWeight: 1000,
  plates: [2500, 2000, 1500, 1000, 500, 250, 125],
  sound: true,
  theme: 'light',
  substitutions: {},
};

/** Возвращает настройки, при первом запуске записывает значения по умолчанию. */
export async function ensureSettings(database: AppDB = db): Promise<Settings> {
  return database.transaction('rw', database.settings, async () => {
    const row = await database.settings.get('main');
    if (row) return row;
    const fresh: SettingsRow = { id: 'main', ...DEFAULT_SETTINGS };
    await database.settings.add(fresh);
    return fresh;
  });
}

export async function updateSettings(patch: Partial<Settings>, database: AppDB = db): Promise<void> {
  await database.transaction('rw', database.settings, async () => {
    const row = (await database.settings.get('main')) ?? { id: 'main' as const, ...DEFAULT_SETTINGS };
    await database.settings.put({ ...row, ...patch });
  });
}
