import { describe, expect, it } from 'vitest';
import type { PoolSession, Workout, WorkoutSession } from '../db/types';
import type { SetLog } from '../db/types';
import { SEED_SLOTS } from '../data/program';
import { DEFAULT_SETTINGS } from '../db/db';
import { calendarDays } from './calendar';
import { formatInt } from './format';
import { planOptionsOf } from './program';
import { monthStats, nextGym, weekRows, weekStrip } from './week';

const session = (date: string, workout: Workout): WorkoutSession => ({
  id: date, date, workout, block: 1, startedAt: 1, finishedAt: 2, isDeload: false, isCalibration: false,
});
const pool = (date: string, minutes: number, meters?: number): PoolSession => ({ id: date, date, type: 'technique', minutes, ...(meters ? { meters } : {}) });

describe('полоса недели', () => {
  it('ср 13 января 2027: пн зал A сделан, вт бассейн сделан, ср сегодня B, пт C, сб бассейн, вс отдых', () => {
    const w = weekStrip('2027-01-13', [session('2027-01-11', 'A')], [pool('2027-01-12', 40)], {});
    expect(w.map((d) => d.name)).toEqual(['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']);
    expect(w[0]).toMatchObject({ state: 'gym_done', label: 'A', past: true });
    expect(w[1]).toMatchObject({ state: 'pool_done', label: '≈' });
    expect(w[2]).toMatchObject({ state: 'gym_plan', label: 'B', today: true });
    expect(w[3]).toMatchObject({ state: 'pool_plan', label: '≈' });
    expect(w[4]).toMatchObject({ state: 'gym_plan', label: 'C' });
    expect(w[5]).toMatchObject({ state: 'pool_plan' });
    expect(w[6]).toMatchObject({ state: 'rest', label: '·' });
  });
  it('своё расписание: зал вт/чт', () => {
    const w = weekStrip('2027-01-13', [], [], { schedule: { gym: [2, 4], pool: [], poolOptional: [] } });
    expect(w.filter((d) => d.state === 'gym_plan').map((d) => d.name)).toEqual(['Чт']);
    expect(w[1]).toMatchObject({ state: 'gym_missed', label: '–' });
  });
});

describe('список недели', () => {
  const sessions = [{ ...session('2027-01-11', 'A'), startedAt: 0, finishedAt: 62 * 60000 }];
  const sets: SetLog[] = [
    { id: '1', sessionId: '2027-01-11', exerciseId: 'goblet_squat', slotId: 'a1', setIndex: 0, kind: 'work', weight: 6000, reps: 10, doneAt: 1 },
    { id: '2', sessionId: '2027-01-11', exerciseId: 'goblet_squat', slotId: 'a1', setIndex: 1, kind: 'work', weight: 4200, reps: 10, doneAt: 2 },
  ];
  it('сделано с длительностью и объёмом, сегодня, план, по желанию, отдых', () => {
    const rows = weekRows('2027-01-13', sessions, sets, [pool('2027-01-12', 40, 900)], SEED_SLOTS, DEFAULT_SETTINGS);
    expect(rows.map((r) => r.day)).toEqual([11, 12, 13, 14, 15, 16, 17]);
    expect(rows[0]).toMatchObject({ title: 'Тренировка A', sub: `62 мин · ${formatInt(1020)} кг`, status: 'done' });
    expect(rows[1]).toMatchObject({ title: 'Бассейн · техника', sub: '40 мин · 900 м', status: 'done' });
    expect(rows[2]).toMatchObject({ title: 'Тренировка B', status: 'today', today: true });
    expect(rows[2]!.sub).toMatch(/^\d+ упражнений$/);
    expect(rows[3]).toMatchObject({ title: 'Бассейн · интервалы', sub: '60 мин · по плану', status: 'plan' });
    expect(rows[4]).toMatchObject({ title: 'Тренировка C', status: 'plan' });
    expect(rows[5]).toMatchObject({ title: 'Бассейн · длинное плавание', sub: '60 мин · по плану', status: 'plan' });
    expect(rows[6]).toMatchObject({ title: 'Отдых', sub: `${formatInt(8000)} шагов`, status: 'rest' });
  });
  it('пропущенный зал и бассейн в прошлом — «пропуск»', () => {
    const rows = weekRows('2027-01-14', [], [], [], SEED_SLOTS, DEFAULT_SETTINGS);
    expect(rows[0]).toMatchObject({ title: 'Тренировка', status: 'missed', sub: 'перенесена на завтра' });
    expect(rows[1]).toMatchObject({ title: 'Тренировка', status: 'missed', sub: 'не состоялась' });
    // ср пропущена → чт зал переносом
    expect(rows[3]).toMatchObject({ title: 'Тренировка A', status: 'today' });
    expect(rows[3]!.sub).toMatch(/перенос/);
  });
  it('шаги за день отдыха — в строке; цель набрана — «сделано»', () => {
    const rows = (steps: number) => weekRows('2027-01-13', sessions, sets, [], SEED_SLOTS, DEFAULT_SETTINGS, [{ date: '2027-01-17', steps }]);
    expect(rows(8400)[6]).toMatchObject({ title: 'Отдых', sub: `${formatInt(8400)} из ${formatInt(8000)} шагов`, status: 'done' });
    expect(rows(3000)[6]).toMatchObject({ title: 'Отдых', sub: `${formatInt(3000)} из ${formatInt(8000)} шагов`, status: 'rest' });
  });
  it('ближайшие 7 дней — с сегодняшнего дня, а не с понедельника; буквы идут по кругу дальше', () => {
    const done = [session('2027-01-11', 'A'), session('2027-01-13', 'B')];
    const rows = weekRows('2027-01-15', done, [], [], SEED_SLOTS, DEFAULT_SETTINGS, [], [], '2027-01-15');
    expect(rows.map((r) => `${r.name} ${r.day}`)).toEqual(['Пт 15', 'Сб 16', 'Вс 17', 'Пн 18', 'Вт 19', 'Ср 20', 'Чт 21']);
    expect(rows[0]).toMatchObject({ title: 'Тренировка C', status: 'today', today: true, workout: 'C' });
    expect(rows[1]).toMatchObject({ title: 'Бассейн · длинное плавание', status: 'plan' });
    expect(rows[1]!.workout).toBeUndefined();
    expect(rows[2]).toMatchObject({ title: 'Отдых', status: 'rest' });
    expect(rows[3]).toMatchObject({ title: 'Тренировка A', status: 'plan', workout: 'A' });
    expect(rows[5]).toMatchObject({ title: 'Тренировка B', status: 'plan', workout: 'B' });
  });
  it('до старта — подготовка', () => {
    const rows = weekRows('2026-11-05', [], [], [], SEED_SLOTS, DEFAULT_SETTINGS);
    expect(rows[0]).toMatchObject({ title: 'Подготовка', status: 'prep' });
  });
});

describe('итог месяца и следующий зал', () => {
  it('зал и бассейн: сделано из плана до сегодня', () => {
    const sessions = [session('2027-01-11', 'A'), session('2027-01-06', 'B')];
    const today = '2027-01-13';
    const gym = sessions.map((s) => ({ date: s.date, ratio: 1 }));
    const days = calendarDays('2027-01-01', '2027-01-31', today, sessions, gym, [pool('2027-01-12', 40)], planOptionsOf(DEFAULT_SETTINGS));
    const m = monthStats(days, '2027-01', today);
    // Пропущенный зал переносится на завтра и считается там: пт 1 → сб 2, пн 4 → вт 5, пт 8 → сб 9 (пропуски);
    // ср 6 и пн 11 сделаны; ср 13 — сегодня, не в счёт. Бассейн: чт 7 пропущен, вт 12 сделан.
    expect(m).toEqual({ gymDone: 2, gymPlanned: 5, poolDone: 1, poolPlanned: 2 });
  });
  it('следующий зал после среды 13 января — пятница 15, буква по кругу', () => {
    expect(nextGym('2027-01-13', [session('2027-01-13', 'B')], {})).toEqual({ date: '2027-01-15', workout: 'C' });
    expect(nextGym('2027-01-15', [session('2027-01-15', 'C')], {})).toEqual({ date: '2027-01-18', workout: 'A' });
  });
});
