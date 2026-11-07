import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDB, DEFAULT_SETTINGS, SCHEMA_V1, SCHEMA_V2, ensureSettings, updateSettings } from './db';

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
    expect(names).toEqual(Object.keys(SCHEMA_V2).sort());
    expect(database.verno).toBe(2);
  });

  it('миграция v1 → v2: данные прошлой версии на месте, заметки пустые', async () => {
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
    expect(fresh.verno).toBe(2);
    expect(await fresh.sessions.get('s1')).toMatchObject({ workout: 'A' });
    expect(await fresh.body.get('2026-11-09')).toEqual({ date: '2026-11-09', weight: 8100 });
    expect(await fresh.exerciseNotes.count()).toBe(0);
    await fresh.exerciseNotes.put({ exerciseId: 'bench_press', text: 'хват 81 см', updatedAt: 1 });
    expect((await fresh.exerciseNotes.get('bench_press'))?.text).toBe('хват 81 см');
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
    await database.slots.update('A2', { sets: 4 });
    await seedIfNeeded(database);
    expect((await database.slots.get('A2'))?.sets).toBe(4);
  });
});
