import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './db';
import { generateSeed } from '../dev/seedData';
import { crc32, exportBackup, makeZip, parseBackup, replaceAll } from './backup';
import { AppDB } from './db';
import { seedIfNeeded } from './repo';

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
    await a.slots.update('A2', { sets: 4 });

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
    expect((await b.slots.get('A2'))?.sets).toBe(4);
    expect(await b.kv.get('restTimer')).toBeUndefined();
    expect(await b.foods.count()).toBe(await a.foods.count());
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
