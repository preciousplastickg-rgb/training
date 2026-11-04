import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDB, DEFAULT_SETTINGS, SCHEMA_V1, ensureSettings, updateSettings } from './db';

let database: AppDB;

beforeEach(async () => {
  database = new AppDB(`test-${crypto.randomUUID()}`);
  await database.open();
});

afterEach(async () => {
  await database.delete();
});

describe('схема v1', () => {
  it('создаёт все таблицы', () => {
    const names = database.tables.map((t) => t.name).sort();
    expect(names).toEqual(Object.keys(SCHEMA_V1).sort());
    expect(database.verno).toBe(1);
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
