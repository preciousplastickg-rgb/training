// IndexedDB через Dexie. Любое изменение схемы — новая db.version(n) с миграцией
// и тестом на данных прошлой версии (см. CLAUDE.md).

import Dexie, { type EntityTable, type Table } from 'dexie';
import type {
  Adjustment, BodyEntry, Exercise, ExerciseNote, Food, FoodLog, KvRow, PoolSession, ProgramSlot,
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

  constructor(name: string = DB_NAME) {
    super(name);
    this.version(1).stores(SCHEMA_V1);
    this.version(2).stores(SCHEMA_V2);
  }
}

export const db = new AppDB();

export const DEFAULT_SETTINGS: Settings = {
  heightCm: 174.5,
  startDate: '2026-11-09',
  startWeight: 8100,
  targetWeight: 7300,
  targetBodyFat: 15,
  restLong: 150,
  restShort: 90,
  barWeight: 2000,
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
