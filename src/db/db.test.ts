import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDB, DEFAULT_SETTINGS, SCHEMA_V1, SCHEMA_V2, SCHEMA_V3, ensureSettings, updateSettings } from './db';

let database: AppDB;

beforeEach(async () => {
  database = new AppDB(`test-${crypto.randomUUID()}`);
  await database.open();
});

afterEach(async () => {
  await database.delete();
});

describe('схема', () => {
  it('создаёт все таблицы', () => {
    const names = database.tables.map((t) => t.name).sort();
    expect(names).toEqual(Object.keys(SCHEMA_V3).sort());
    expect(database.verno).toBe(3);
  });

  it('миграция v1 → v3: данные прошлой версии на месте, заметки пустые', async () => {
    const name = `mig-${crypto.randomUUID()}`;
    class V1 extends Dexie {
      constructor() {
        super(name);
        this.version(1).stores(SCHEMA_V1);
      }
    }
    const old = new V1();
    await old.open();
    await old.table('sessions').add({ id: 's1', date: '2026-11-09', workout: 'A', startedAt: 1, finishedAt: 2, isDeload: false, isCalibration: false });
    await old.table('body').put({ date: '2026-11-09', weight: 8100 });
    old.close();

    const fresh = new AppDB(name);
    await fresh.open();
    expect(fresh.verno).toBe(3);
    expect(await fresh.sessions.get('s1')).toMatchObject({ workout: 'A', block: 1 });
    expect(await fresh.body.get('2026-11-09')).toEqual({ date: '2026-11-09', weight: 8100 });
    expect(await fresh.exerciseNotes.count()).toBe(0);
    await fresh.exerciseNotes.put({ exerciseId: 'bench_press', text: 'хват 81 см', updatedAt: 1 });
    expect((await fresh.exerciseNotes.get('bench_press'))?.text).toBe('хват 81 см');
    await fresh.delete();
  });

  it('миграция v2 → v3 (программа v2): слоты seed v2 с переносом правок, подходы перевязаны, бассейн с типом, настройки без restLong', async () => {
    const name = `mig2-${crypto.randomUUID()}`;
    class V2 extends Dexie {
      constructor() {
        super(name);
        this.version(1).stores(SCHEMA_V1);
        this.version(2).stores(SCHEMA_V2);
      }
    }
    const old = new V2();
    await old.open();
    await old.table('slots').bulkPut([
      { id: 'A2', workout: 'A', order: 2, exerciseId: 'bench_press', altExerciseIds: ['db_bench_press'], sets: 4, repMin: 6, repMax: 10, step: 250, rest: 'long' },
      { id: 'B6a', workout: 'B', order: 6, exerciseId: 'biceps_curl', altExerciseIds: [], sets: 3, repMin: 10, repMax: 15, step: 100, rest: 60, supersetWith: 'B6b' },
    ]);
    await old.table('sessions').bulkAdd([
      { id: 's1', date: '2026-11-09', workout: 'A', startedAt: 1, finishedAt: 2, isDeload: false, isCalibration: false },
      { id: 's2', date: '2026-11-11', workout: 'B', startedAt: 3, finishedAt: 4, isDeload: false, isCalibration: false },
    ]);
    await old.table('sets').bulkAdd([
      { id: 'x1', sessionId: 's1', exerciseId: 'bench_press', slotId: 'A2', setIndex: 0, kind: 'work', weight: 4500, reps: 10, doneAt: 2 },
      { id: 'x2', sessionId: 's2', exerciseId: 'biceps_curl', slotId: 'B6a', setIndex: 0, kind: 'work', weight: 800, reps: 12, doneAt: 4 },
    ]);
    await old.table('pool').bulkAdd([
      { id: 'p1', date: '2026-11-10', minutes: 30 }, // вт → техника
      { id: 'p2', date: '2026-11-14', minutes: 30 }, // сб → длинное
      { id: 'p3', date: '2026-11-13', minutes: 30 }, // пт → техника
    ]);
    await old.table('settings').put({
      id: 'main', heightCm: 174.5, startDate: '2026-11-09', startWeight: 8100, targetWeight: 7300, targetBodyFat: 15,
      restLong: 150, restShort: 90, barWeight: 2000, plates: [2500], sound: true, theme: 'light', substitutions: { lat_pulldown: 'pullup' },
      schedule: { gym: [1, 3, 5], pool: [2, 4], poolOptional: [6] },
    });
    await old.table('kv').put({ key: 'seed:slots', value: 1 });
    old.close();

    const fresh = new AppDB(name);
    await fresh.open();
    const { SEED_SLOTS } = await import('../data/program');
    const { seedIfNeeded } = await import('./repo');
    await seedIfNeeded(fresh);
    expect(await fresh.slots.count()).toBe(SEED_SLOTS.length);
    expect((await fresh.slots.get('b1-A2'))?.sets).toBe(4); // правка перенесена
    const b8a = await fresh.slots.get('b1-B8a');
    expect(b8a).toMatchObject({ exerciseId: 'biceps_curl', sets: 3 });
    expect(b8a?.step).toBeUndefined(); // шаг v1 (1 кг) — не правка, а старое оборудование
    expect(await fresh.sessions.get('s1')).toMatchObject({ block: 1, workout: 'A' });
    expect((await fresh.sets.get('x1'))?.slotId).toBe('b1-A2');
    expect((await fresh.sets.get('x2'))?.slotId).toBe('b1-B8a');
    expect((await fresh.pool.toArray()).map((p) => p.type).sort()).toEqual(['long', 'technique', 'technique']);
    const s = await fresh.settings.get('main');
    expect(s).toMatchObject({ ezBarWeight: 1000, substitutions: {}, schedule: { gym: [1, 3, 5], pool: [2, 4, 6], poolOptional: [] } });
    expect(s && 'restLong' in s).toBe(false);
    expect((await fresh.kv.get('seed:slots'))?.value).toBe(2);
    expect(await fresh.lightWeeks.count()).toBe(0);
    await fresh.delete();
  });

  it('индекс [exerciseId+doneAt] работает: последние подходы упражнения по времени', async () => {
    const base = { sessionId: 's1', slotId: 'a1', kind: 'work' as const, reps: 10 };
    await database.sets.bulkAdd([
      { ...base, id: '1', exerciseId: 'bench_press', setIndex: 0, weight: 6000, doneAt: 100 },
      { ...base, id: '2', exerciseId: 'bench_press', setIndex: 1, weight: 6250, doneAt: 300 },
      { ...base, id: '3', exerciseId: 'db_row', setIndex: 0, weight: 2000, doneAt: 200 },
    ]);
    const rows = await database.sets
      .where('[exerciseId+doneAt]')
      .between(['bench_press', 0], ['bench_press', Infinity])
      .reverse()
      .toArray();
    expect(rows.map((r) => r.weight)).toEqual([6250, 6000]);
  });

  it('multiEntry-индекс aliases ищет продукт по синониму', async () => {
    await database.foods.add({
      id: 'f1', name: 'Куриная грудка, сырая', aliases: ['грудка', 'курица'],
      per100: { kcal: 110, p: 230, f: 15, c: 0 }, source: 'seed', approx: false, archived: false,
    });
    const found = await database.foods.where('aliases').equals('курица').toArray();
    expect(found.map((f) => f.id)).toEqual(['f1']);
  });

  it('body — одна запись на дату', async () => {
    await database.body.put({ date: '2026-11-09', weight: 8100 });
    await database.body.put({ date: '2026-11-09', weight: 8080, waist: 920 });
    expect(await database.body.count()).toBe(1);
    expect(await database.body.get('2026-11-09')).toEqual({ date: '2026-11-09', weight: 8080, waist: 920 });
  });
});

describe('настройки', () => {
  it('при первом запуске пишутся значения по умолчанию, повторно не перезаписываются', async () => {
    expect(await ensureSettings(database)).toMatchObject(DEFAULT_SETTINGS);
    await updateSettings({ theme: 'dark' }, database);
    expect((await ensureSettings(database)).theme).toBe('dark');
    expect(await database.settings.count()).toBe(1);
  });

  it('веса в настройках — целые Kg100', () => {
    const { startWeight, targetWeight, barWeight, plates } = DEFAULT_SETTINGS;
    for (const w of [startWeight, targetWeight, barWeight, ...plates]) expect(Number.isInteger(w)).toBe(true);
  });
});

describe('seed', () => {
  it('программа и база продуктов пишутся один раз', async () => {
    const { seedIfNeeded } = await import('./repo');
    const { SEED_SLOTS } = await import('../data/program');
    await seedIfNeeded(database);
    await seedIfNeeded(database);
    expect(await database.slots.count()).toBe(SEED_SLOTS.length);
    const foods = await database.foods.count();
    expect(foods).toBeGreaterThanOrEqual(150);
    expect(foods).toBeLessThanOrEqual(250);
  });
  it('обновление базы: новые блюда дописываются, разделы проставляются, правка пользователя остаётся', async () => {
    const { seedIfNeeded, FOOD_SEED_VERSION } = await import('./repo');
    const { SEED_FOODS } = await import('../data/foods');
    // «Старый телефон»: первые 150 позиций без раздела, одна — с правкой пользователя
    const old = SEED_FOODS.slice(0, 150).map(({ category: _c, ...f }) => f);
    old[0] = { ...old[0]!, name: 'Грудка (моя правка)' };
    await database.foods.bulkAdd(old);
    await database.kv.put({ key: 'seed:foods', value: 1 });
    await seedIfNeeded(database);
    expect(await database.foods.count()).toBe(SEED_FOODS.length);
    expect((await database.foods.get('seed-001'))).toMatchObject({ name: 'Грудка (моя правка)', category: 'meat' });
    expect((await database.kv.get('seed:foods'))?.value).toBe(FOOD_SEED_VERSION);
  });
  it('пользовательская правка слота не затирается повторным seed', async () => {
    const { seedIfNeeded } = await import('./repo');
    await seedIfNeeded(database);
    await database.slots.update('b1-A2', { sets: 4 });
    await seedIfNeeded(database);
    expect((await database.slots.get('b1-A2'))?.sets).toBe(4);
  });
});
