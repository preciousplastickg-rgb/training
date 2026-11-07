import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './db';
import { generateSeed } from '../dev/seedData';
import { crc32, exportBackup, makeZip, parseBackup, replaceAll } from './backup';
import { AppDB } from './db';
import { seedIfNeeded } from './repo';
import { SEED_SLOTS } from '../data/program';

let a: AppDB;
let b: AppDB;
beforeEach(async () => {
  a = new AppDB(`a-${crypto.randomUUID()}`);
  b = new AppDB(`b-${crypto.randomUUID()}`);
  await Promise.all([a.open(), b.open()]);
});
afterEach(async () => {
  await Promise.all([a.delete(), b.delete()]);
});

describe('бэкап', () => {
  it('экспорт → удалить → импорт: всё на месте', async () => {
    await seedIfNeeded(a);
    const seed = generateSeed(DEFAULT_SETTINGS);
    await a.sessions.bulkAdd(seed.sessions);
    await a.sets.bulkAdd(seed.sets);
    await a.body.bulkAdd(seed.body);
    await a.foodLog.bulkAdd(seed.foodLog);
    await a.pool.bulkAdd(seed.pool);
    await a.kv.put({ key: 'restTimer', value: { endsAt: 1 } });
    await a.slots.update('b1-A2', { sets: 4 });
    await a.exerciseNotes.put({ exerciseId: 'bench_press', text: 'хват 81 см', updatedAt: 1 });
    await a.lightWeeks.add({ id: 'lw', start: '2026-12-11', end: '2026-12-17', reason: 'resting_hr' });
    await a.body.put({ date: '2027-02-01', sleepMin: 450, meditationMin: 15 });
    await a.foods.add({ id: 'my-ayran', name: 'Айран домашний', aliases: [], per100: { kcal: 40, p: 25, f: 15, c: 30 }, unit: 'ml', source: 'user', approx: false, archived: false, category: 'drink' });

    const json = JSON.stringify(await exportBackup(a));
    const parsed = parseBackup(json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.counts.sessions).toBe(seed.sessions.length);

    await seedIfNeeded(b); // «новая установка»
    await replaceAll(parsed.backup, b);
    await seedIfNeeded(b); // повторный старт не затирает импорт
    expect(await b.sets.count()).toBe(seed.sets.length);
    expect(await b.foodLog.count()).toBe(seed.foodLog.length);
    expect(await b.body.get('2026-11-09')).toEqual(await a.body.get('2026-11-09'));
    expect((await b.slots.get('b1-A2'))?.sets).toBe(4);
    expect(await b.lightWeeks.count()).toBe(1);
    expect((await b.pool.toArray()).every((p) => !!p.type)).toBe(true);
    expect(await b.kv.get('restTimer')).toBeUndefined();
    expect(await b.foods.count()).toBe(await a.foods.count());
    expect((await b.exerciseNotes.get('bench_press'))?.text).toBe('хват 81 см');
    // сон, медитация и продукт в миллилитрах переживают бэкап
    expect(await b.body.get('2027-02-01')).toEqual({ date: '2027-02-01', sleepMin: 450, meditationMin: 15 });
    expect((await b.foods.get('my-ayran'))?.unit).toBe('ml');
  });

  it('бэкап прошлой версии без заметок принимается', () => {
    const empty = { sessions: [], sets: [], pool: [], body: [], foods: [], foodLog: [], adjustments: [], recipes: [], slots: [], settings: [], kv: [] };
    const r = parseBackup(JSON.stringify({ app: 'training-pwa', version: 1, exportedAt: 1, tables: empty }));
    expect(r.ok).toBe(true);
  });

  it('бэкап версии 1 (программа A/B) мигрирует при импорте: блок 1, тип бассейна, слоты v2 с правкой', async () => {
    const v1 = {
      app: 'training-pwa', version: 1, exportedAt: 1,
      tables: {
        sessions: [{ id: 's1', date: '2026-11-09', workout: 'A', startedAt: 1, finishedAt: 2, isDeload: false, isCalibration: false }],
        sets: [{ id: 'x1', sessionId: 's1', exerciseId: 'bench_press', slotId: 'A2', setIndex: 0, kind: 'work', weight: 4500, reps: 10, doneAt: 2 }],
        pool: [{ id: 'p1', date: '2026-11-12', minutes: 30 }],
        body: [], foods: [], foodLog: [], adjustments: [], recipes: [],
        slots: [{ id: 'A2', workout: 'A', order: 2, exerciseId: 'bench_press', altExerciseIds: ['db_bench_press'], sets: 4, repMin: 6, repMax: 10, step: 250, rest: 'long' }],
        settings: [{ id: 'main', heightCm: 174.5, startDate: '2026-11-09', startWeight: 8100, targetWeight: 7300, targetBodyFat: 15, restLong: 150, restShort: 90, barWeight: 2000, plates: [2500], sound: true, theme: 'light', substitutions: { lat_pulldown: 'pullup' } }],
        kv: [],
      },
    };
    const r = parseBackup(JSON.stringify(v1));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    await replaceAll(r.backup, b);
    expect(await b.sessions.get('s1')).toMatchObject({ block: 1, workout: 'A' });
    expect((await b.sets.get('x1'))?.slotId).toBe('b1-A2');
    expect((await b.pool.get('p1'))?.type).toBe('intervals');
    expect(await b.slots.count()).toBe(SEED_SLOTS.length);
    expect((await b.slots.get('b1-A2'))?.sets).toBe(4);
    const s = await b.settings.get('main');
    expect(s).toMatchObject({ ezBarWeight: 1000, substitutions: {} });
    expect(s && 'restLong' in s).toBe(false);
  });

  it('чужой файл не принимается', () => {
    expect(parseBackup('не json').ok).toBe(false);
    expect(parseBackup('{"app":"other"}').ok).toBe(false);
    const r = parseBackup(JSON.stringify({ app: 'training-pwa', version: 1, exportedAt: 1, tables: { sessions: [{ id: 1 }] } }));
    expect(r.ok).toBe(false);
  });
});

describe('zip', () => {
  it('crc32 стандартный', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
  it('структура: локальные заголовки, центральный каталог, конец', async () => {
    const zip = makeZip([{ name: 'a.jpg', data: new Uint8Array([1, 2, 3]) }, { name: 'б.jpg', data: new Uint8Array([4]) }]);
    const buf = new Uint8Array(await zip.arrayBuffer());
    const dv = new DataView(buf.buffer);
    expect(dv.getUint32(0, true)).toBe(0x04034b50);
    const end = buf.length - 22;
    expect(dv.getUint32(end, true)).toBe(0x06054b50);
    expect(dv.getUint16(end + 10, true)).toBe(2);
    expect(dv.getUint32(dv.getUint32(end + 16, true), true)).toBe(0x02014b50);
  });
});
