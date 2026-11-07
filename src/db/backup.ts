// Бэкап и импорт — SPEC 8. JSON всех таблиц, кроме фото; фото — отдельно zip с JPEG.

import { z } from 'zod';
import { appToday } from '../app/clock';
import { db, SLOT_SEED_VERSION, type AppDB } from './db';
import { isSlotV1, migratePoolV1, migrateSessionsV1, migrateSetsV1, migrateSettingsV1, migrateSlotsV1, type SlotV1 } from './migrate';
import type { Food, PoolSession, ProgramSlot, SetLog, SettingsRow, WorkoutSession } from './types';

export const BACKUP_APP = 'training-pwa';
/** 2 — программа v2 (A/B/C по блокам, тип бассейна, пульс, лёгкие недели). Бэкап версии 1 принимается и мигрирует при импорте. */
export const BACKUP_VERSION = 2;

const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const int = z.number().int();
const phase = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const sauna = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);

const session = z.object({
  id: z.string(), date: localDate, workout: z.enum(['A', 'B', 'C']), block: phase.optional(), startedAt: z.number(), finishedAt: z.number().optional(),
  isDeload: z.boolean(), isCalibration: z.boolean(), note: z.string().optional(),
  cardio: z.object({ machine: z.enum(['treadmill', 'elliptical', 'bike']), minutes: int }).optional(), saunaRounds: sauna.optional(),
});
const set = z.object({
  id: z.string(), sessionId: z.string(), exerciseId: z.string(), slotId: z.string(), setIndex: int, kind: z.enum(['warmup', 'work']),
  weight: int, reps: int, rir: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(), doneAt: z.number(),
});
const pool = z.object({
  id: z.string(), date: localDate, type: z.enum(['technique', 'intervals', 'long']).optional(), minutes: int, meters: int.optional(),
  feel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(), saunaRounds: sauna.optional(), note: z.string().optional(),
});
const body = z.object({ date: localDate, weight: int.optional(), waist: int.optional(), neck: int.optional(), steps: int.optional(), restingHr: int.optional(),
  sleepMin: int.optional(), meditationMin: int.optional() });
const per100 = z.object({ kcal: int, p: int, f: int, c: int });
const food = z.object({
  id: z.string(), name: z.string(), aliases: z.array(z.string()), per100, unit: z.enum(['g', 'ml']).optional(), unitName: z.string().optional(), unitGrams: int.optional(),
  source: z.enum(['seed', 'user', 'recipe']), approx: z.boolean(), archived: z.boolean(),
  category: z.enum(['meat', 'dairy', 'grain', 'veg', 'fruit', 'fat', 'sweet', 'drink', 'dish']).optional(),
});
const recipe = z.object({ foodId: z.string(), items: z.array(z.object({ foodId: z.string(), grams: int })), cookedWeight: int });
const foodLog = z.object({
  id: z.string(), date: localDate, meal: z.enum(['breakfast', 'lunch', 'dinner', 'snack']), foodId: z.string().optional(), grams: int.optional(),
  quick: z.object({ name: z.string(), kcal: int, p: int }).optional(), createdAt: z.number(),
});
const adjustment = z.object({ id: z.string(), date: localDate, deltaKcal: int, reason: z.string() });
/** Слот v2; поля v1 (`rest`, обязательный `step`) тоже принимаются — импорт их мигрирует. */
const slot = z.object({
  id: z.string(), workout: z.enum(['A', 'B', 'C']), code: z.string().optional(), order: int, section: z.enum(['main', 'accessory']).optional(),
  block: phase.optional(), exerciseId: z.string(), altExerciseIds: z.array(z.string()),
  sets: int, repMin: int, repMax: int, step: z.number().optional(), restSec: int.optional(), rest: z.union([z.literal('long'), z.literal('short'), int]).optional(),
  supersetWith: z.string().optional(), fromPhase: phase.optional(), toPhase: phase.optional(),
});
const settings = z.object({
  id: z.literal('main'), name: z.string().optional(), heightCm: z.number(), startDate: localDate, startWeight: int, targetWeight: int, targetBodyFat: z.number(),
  restLong: int.optional(), restShort: int.optional(), barWeight: int, ezBarWeight: int.optional(), plates: z.array(int), sound: z.boolean(),
  theme: z.enum(['light', 'dark', 'system']), substitutions: z.record(z.string(), z.string()), substitutionsBlock: phase.optional(), lastBackupAt: z.number().optional(),
  phase3Mode: z.enum(['maintenance', 'deficit']).optional(), onboarded: z.boolean().optional(),
  schedule: z.object({ gym: z.array(int), pool: z.array(int), poolOptional: z.array(int) }).optional(),
  dayOverrides: z.record(z.string(), z.enum(['gym', 'pool', 'rest'])).optional(),
});
const kv = z.object({ key: z.string(), value: z.unknown() });
const exerciseNote = z.object({ exerciseId: z.string(), text: z.string(), updatedAt: z.number() });
const lightWeek = z.object({ id: z.string(), start: localDate, end: localDate, reason: z.literal('resting_hr') });

export const backupSchema = z.object({
  app: z.literal(BACKUP_APP),
  version: z.union([z.literal(1), z.literal(2)]),
  exportedAt: z.number(),
  tables: z.object({
    sessions: z.array(session),
    sets: z.array(set),
    pool: z.array(pool),
    body: z.array(body),
    foods: z.array(food),
    foodLog: z.array(foodLog),
    adjustments: z.array(adjustment),
    recipes: z.array(recipe),
    slots: z.array(slot),
    settings: z.array(settings),
    kv: z.array(kv),
    /** Появились со схемой v2: бэкап без них — старый, но годный. */
    exerciseNotes: z.array(exerciseNote).optional(),
    /** Со схемы v3. */
    lightWeeks: z.array(lightWeek).optional(),
  }),
});

export type Backup = z.infer<typeof backupSchema>;
export type TableName = keyof Backup['tables'];

/** Служебные ключи, которые не переносим (таймер отдыха, состояние анимаций). */
const KV_SKIP = new Set(['restTimer', 'silhouette:last']);

export async function exportBackup(database: AppDB = db): Promise<Backup> {
  const [sessions, sets, pool, bodyT, foods, foodLogT, adjustments, recipes, slots, settingsT, kvT, exerciseNotes, lightWeeks] = await Promise.all([
    database.sessions.toArray(), database.sets.toArray(), database.pool.toArray(), database.body.toArray(),
    database.foods.toArray(), database.foodLog.toArray(), database.adjustments.toArray(), database.recipes.toArray(),
    database.slots.toArray(), database.settings.toArray(), database.kv.toArray(), database.exerciseNotes.toArray(), database.lightWeeks.toArray(),
  ]);
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    tables: {
      sessions, sets, pool, body: bodyT, foods, foodLog: foodLogT, adjustments, recipes, slots,
      settings: settingsT, kv: kvT.filter((r) => !KV_SKIP.has(r.key)), exerciseNotes, lightWeeks,
    } as Backup['tables'],
  };
}

export type ParseResult = { ok: true; backup: Backup; counts: Record<TableName, number> } | { ok: false; error: string };

export function parseBackup(text: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Файл не похож на JSON' };
  }
  const r = backupSchema.safeParse(json);
  if (!r.success) {
    const issue = r.error.issues[0];
    return { ok: false, error: `Файл не похож на бэкап приложения${issue ? `: ${issue.path.join('.')} — ${issue.message}` : ''}` };
  }
  const counts = Object.fromEntries(Object.entries(r.data.tables).map(([k, v]) => [k, v.length])) as Record<TableName, number>;
  return { ok: true, backup: r.data, counts };
}

/** Таблицы к записи: бэкап версии 1 (программа A/B) мигрирует так же, как база при обновлении. */
export function tablesToWrite(backup: Backup): {
  sessions: WorkoutSession[]; sets: SetLog[]; pool: PoolSession[]; slots: ProgramSlot[]; settings: SettingsRow[];
} {
  const t = backup.tables;
  if (backup.version >= 2 && t.slots.every((s) => !isSlotV1(s))) {
    return { sessions: t.sessions as WorkoutSession[], sets: t.sets, pool: t.pool as PoolSession[], slots: t.slots as ProgramSlot[], settings: t.settings as SettingsRow[] };
  }
  const { slots, slotIdMap } = migrateSlotsV1(t.slots as (SlotV1 | ProgramSlot)[]);
  return {
    sessions: migrateSessionsV1(t.sessions as WorkoutSession[]),
    sets: migrateSetsV1(t.sets, slotIdMap),
    pool: migratePoolV1(t.pool as PoolSession[]),
    slots,
    settings: t.settings.map((row) => migrateSettingsV1(row as SettingsRow) as SettingsRow),
  };
}

/** «Заменить всё»: все таблицы, кроме фото, очищаются и заполняются из бэкапа. */
export async function replaceAll(backup: Backup, database: AppDB = db): Promise<void> {
  const t = backup.tables;
  const w = tablesToWrite(backup);
  await database.transaction(
    'rw',
    [
      database.sessions, database.sets, database.pool, database.body, database.foods, database.foodLog, database.adjustments, database.recipes,
      database.slots, database.settings, database.kv, database.exerciseNotes, database.lightWeeks,
    ],
    async () => {
      await Promise.all([
        database.sessions.clear(), database.sets.clear(), database.pool.clear(), database.body.clear(), database.foods.clear(),
        database.foodLog.clear(), database.adjustments.clear(), database.recipes.clear(), database.slots.clear(), database.settings.clear(), database.kv.clear(),
        database.exerciseNotes.clear(), database.lightWeeks.clear(),
      ]);
      await database.sessions.bulkAdd(w.sessions);
      await database.sets.bulkAdd(w.sets);
      await database.pool.bulkAdd(w.pool);
      await database.body.bulkAdd(t.body);
      await database.foods.bulkAdd(t.foods as Food[]);
      await database.foodLog.bulkAdd(t.foodLog);
      await database.adjustments.bulkAdd(t.adjustments);
      await database.recipes.bulkAdd(t.recipes);
      await database.slots.bulkAdd(w.slots);
      await database.settings.bulkAdd(w.settings);
      await database.kv.bulkAdd(t.kv.filter((r) => r.key !== 'seed:slots').map((r) => ({ key: r.key, value: r.value })));
      await database.exerciseNotes.bulkAdd(t.exerciseNotes ?? []);
      await database.lightWeeks.bulkAdd(t.lightWeeks ?? []);
      // seed не должен перезаписать импортированные программу и продукты
      await database.kv.put({ key: 'seed:slots', value: SLOT_SEED_VERSION });
      await database.kv.put({ key: 'seed:foods', value: 1 });
    },
  );
}

export function backupFileName(date: string = appToday()): string {
  return `fitness-backup-${date}.json`;
}

// ---------- Отдача файла ----------

/** «Сохранить в Файлы» через navigator.share; если нельзя — обычная загрузка. */
export async function shareOrDownload(blob: Blob, name: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return 'shared';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}

// ---------- Zip (STORE, без сжатия) ----------

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Минимальный zip: файлы без сжатия (JPEG и так сжат). */
export function makeZip(files: { name: string; data: Uint8Array }[]): Blob {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8 имена
    local.setUint16(8, 0, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, f.data.length, true);
    local.setUint32(22, f.data.length, true);
    local.setUint16(26, name.length, true);
    parts.push(new Uint8Array(local.buffer), name, f.data);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, f.data.length, true);
    cd.setUint32(24, f.data.length, true);
    cd.setUint16(28, name.length, true);
    cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), name);
    offset += 30 + name.length + f.data.length;
  }
  const cdSize = central.reduce((a, b) => a + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)] as BlobPart[], { type: 'application/zip' });
}

export async function exportPhotosZip(database: AppDB = db): Promise<Blob | null> {
  const photos = await database.photos.orderBy('date').toArray();
  if (photos.length === 0) return null;
  const files = await Promise.all(
    photos.map(async (p, i) => ({ name: `${p.date}-${p.pose}-${i + 1}.jpg`, data: new Uint8Array(await p.blob.arrayBuffer()) })),
  );
  return makeZip(files);
}
