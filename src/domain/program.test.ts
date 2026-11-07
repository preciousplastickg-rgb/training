import { describe, expect, it } from 'vitest';
import { SEED_SLOTS } from '../data/program';
import type { LightWeek, Workout, WorkoutSession } from '../db/types';
import {
  blockFor, blockWeek, dayTypeFor, estimateMinutes, isFirstInBlock, nextWorkout, phaseWeek, planDays, planForDate, programLine, supersetRole, workoutPlan,
} from './program';

const settings = { substitutions: {} };
const session = (date: string, workout: Workout, finishedAt: number, extra: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id: date, date, workout, block: blockFor(date), startedAt: finishedAt - 1, finishedAt, isDeload: false, isCalibration: false, ...extra,
});
const codeOf = (plan: ReturnType<typeof workoutPlan>, code: string) => plan.find((p) => p.slot.code === code)!;
const planOn = (workout: Workout, date: string, lightWeeks: LightWeek[] = []) => workoutPlan(workout, date, SEED_SLOTS, settings, { lightWeeks });

describe('фазы и блоки', () => {
  it('«Фаза 2 · неделя 6 из 12»', () => {
    const pw = phaseWeek('2027-01-12');
    expect(pw?.phase.n).toBe(2);
    expect(pw?.week).toBe(6);
    expect(pw?.weeks).toBe(12);
  });
  it('блок по дате: до конца своей разгрузки', () => {
    expect(blockFor('2026-11-09')).toBe(1);
    expect(blockFor('2027-01-03')).toBe(1);
    expect(blockFor('2027-01-04')).toBe(2);
    expect(blockFor('2027-02-21')).toBe(2);
    expect(blockFor('2027-02-22')).toBe(3);
    expect(blockFor('2027-04-30')).toBe(3);
  });
  it('строка над карточкой дня: «Блок 2 · неделя 3 из 6 · фаза 2», в разгрузку — «разгрузка»', () => {
    expect(programLine('2027-01-18')).toBe('Блок 2 · неделя 3 из 6 · фаза 2');
    expect(programLine('2026-11-09')).toBe('Блок 1 · неделя 1 из 7 · фаза 1');
    expect(programLine('2026-12-30')).toBe('Блок 1 · разгрузка · фаза 2');
    expect(blockWeek('2027-04-30')).toMatchObject({ block: 3, week: 10, weeks: 10 });
    expect(programLine('2026-11-01')).toBe('подготовка');
  });
});

// SPEC 10, «Что сегодня и подходы» — обязательные тесты программы v2.
describe('что сегодня и подходы (SPEC 10)', () => {
  const none = new Set<string>();
  const lastC = [session('2026-11-20', 'C', 20)];
  it('2026-11-09, сессий нет: зал A, блок 1, фаза 1; A1 = goblet_squat; accessory по 2 подхода', () => {
    expect(planForDate('2026-11-09', none).kind).toBe('gym');
    expect(nextWorkout([])).toBe('A');
    expect(blockFor('2026-11-09')).toBe(1);
    expect(phaseWeek('2026-11-09')?.phase.n).toBe(1);
    const plan = planOn('A', '2026-11-09');
    expect(codeOf(plan, 'A1').exercise.id).toBe('goblet_squat');
    expect(plan.filter((p) => p.section === 'accessory').every((p) => p.sets === 2)).toBe(true);
    expect(plan.filter((p) => p.section === 'main').every((p) => p.sets === 3)).toBe(true);
  });
  it('2026-11-10: бассейн technique с планом ноября', () => {
    const p = planForDate('2026-11-10', new Set(['2026-11-09']));
    expect(p.kind).toBe('pool');
    expect(p.pool).toMatchObject({ type: 'technique', text: '12 × 50 м, отдых 30–45 с + 15 мин с доской на ноги', minutes: 60 });
  });
  it('2026-11-14: бассейн long; 2026-11-15: отдых', () => {
    const week = new Set(['2026-11-09', '2026-11-11', '2026-11-13']);
    expect(planForDate('2026-11-14', week)).toMatchObject({ kind: 'pool', pool: { type: 'long' } });
    expect(planForDate('2026-11-15', week).kind).toBe('rest');
  });
  it('2026-11-23, последняя сессия C: зал A; accessory по 3 подхода', () => {
    expect(nextWorkout(lastC)).toBe('A');
    const plan = planOn('A', '2026-11-23');
    expect(plan.filter((p) => p.section === 'accessory').every((p) => p.sets === 3)).toBe(true);
  });
  it('2026-12-07: A1 = barbell_squat', () => {
    expect(codeOf(planOn('A', '2026-12-07'), 'A1').exercise.id).toBe('barbell_squat');
    expect(planOn('A', '2026-12-07').filter((p) => p.slot.code === 'A1')).toHaveLength(1);
  });
  it('2026-12-28: разгрузка; упражнения блока 1; все слоты 2 подхода; бассейн «спокойно 45 минут»', () => {
    expect(planForDate('2026-12-28', none).isDeload).toBe(true);
    const plan = planOn('A', '2026-12-28');
    expect(plan.every((p) => p.slot.block === 1 && p.sets === 2)).toBe(true);
    expect(codeOf(plan, 'A3').exercise.id).toBe('db_row');
    expect(planForDate('2026-12-29', none).pool).toMatchObject({ minutes: 45, text: 'спокойно 45 минут' });
  });
  it('2027-01-04, последняя сессия C: зал A, блок 2; A3 = chest_supported_db_row', () => {
    expect(nextWorkout(lastC)).toBe('A');
    expect(blockFor('2027-01-04')).toBe(2);
    const plan = planOn('A', '2027-01-04');
    expect(codeOf(plan, 'A3').exercise.id).toBe('chest_supported_db_row');
    expect(plan.every((p) => p.slot.block === 2)).toBe(true);
    expect(isFirstInBlock('2027-01-04', lastC)).toBe(true);
  });
  it('2027-02-15: разгрузка; упражнения блока 2', () => {
    expect(planForDate('2027-02-15', none).isDeload).toBe(true);
    expect(planOn('B', '2027-02-15').every((p) => p.slot.block === 2 && p.sets === 2)).toBe(true);
  });
  it('2027-02-22: блок 3; A4 = back_extension, 3 × 10–15', () => {
    expect(blockFor('2027-02-22')).toBe(3);
    const a4 = codeOf(planOn('A', '2027-02-22'), 'A4');
    expect(a4.exercise.id).toBe('back_extension');
    expect([a4.sets, a4.slot.repMin, a4.slot.repMax]).toEqual([3, 10, 15]);
  });
  it('2027-03-01, последняя сессия C: фаза 3; A1–A4 по 3 подхода, A5a–A8 по 4', () => {
    expect(phaseWeek('2027-03-01')?.phase.n).toBe(3);
    expect(nextWorkout(lastC)).toBe('A');
    const plan = planOn('A', '2027-03-01');
    expect(plan.filter((p) => p.section === 'main').map((p) => p.sets)).toEqual([3, 3, 3, 3]);
    expect(plan.filter((p) => p.section === 'accessory').every((p) => p.sets === 4)).toBe(true);
    expect(plan.map((p) => p.slot.code)).toEqual(['A1', 'A2', 'A3', 'A4', 'A5a', 'A5b', 'A6a', 'A6b', 'A7', 'A8']);
  });
  it('2027-04-12: разгрузка; упражнения блока 3; все слоты 2 подхода', () => {
    expect(planForDate('2027-04-12', none).isDeload).toBe(true);
    const plan = planOn('C', '2027-04-12');
    expect(plan.every((p) => p.slot.block === 3 && p.sets === 2)).toBe(true);
    expect(codeOf(plan, 'C1').exercise.id).toBe('smith_squat');
  });
  it('лёгкая неделя: accessory по 2 подхода, main по 3', () => {
    const lw: LightWeek = { id: 'l', start: '2026-12-11', end: '2026-12-17', reason: 'resting_hr' };
    const plan = planOn('B', '2026-12-14', [lw]);
    expect(plan.filter((p) => p.section === 'accessory').every((p) => p.sets === 2)).toBe(true);
    expect(plan.filter((p) => p.section === 'main').every((p) => p.sets === 3)).toBe(true);
    expect(planForDate('2026-12-12', none, { lightWeeks: [lw] }).pool).toMatchObject({ type: 'long', minutes: 30, text: '30 мин спокойно' });
  });
});

// SPEC 10, «Порядок A → B → C».
describe('порядок A → B → C (SPEC 10)', () => {
  it('пн 9 ноября A выполнена, ср 11 пропуск → чт 12: зал B, бассейн «по желанию»', () => {
    const sessions = [session('2026-11-09', 'A', 10)];
    const days = planDays('2026-11-12', new Set(['2026-11-09']));
    expect(days[2]).toMatchObject({ kind: 'gym' }); // ср — зал по плану, пропущен
    expect(days[3]).toMatchObject({ kind: 'gym', makeup: true, pool: { optional: true, type: 'intervals' } });
    expect(nextWorkout(sessions)).toBe('B');
  });
  it('то же + чт 12 B выполнена → пт 13: зал не предлагается; сб 14: зал C, бассейн «по желанию»', () => {
    const sessions = [session('2026-11-09', 'A', 10), session('2026-11-12', 'B', 20)];
    const days = planDays('2026-11-14', new Set(['2026-11-09', '2026-11-12']));
    expect(days[4]).toMatchObject({ kind: 'rest', gymBlocked: true });
    expect(days[5]).toMatchObject({ kind: 'gym', makeup: true, pool: { optional: true, type: 'long' } });
    expect(nextWorkout(sessions)).toBe('C');
  });
  it('то же + сб 14 C пропущена → вс — отдых; пн 16 — зал C, ср — A, пт — B', () => {
    const sessions = [session('2026-11-09', 'A', 10), session('2026-11-12', 'B', 20)];
    const days = planDays('2026-11-20', new Set(['2026-11-09', '2026-11-12']));
    expect(days[6]!.kind).toBe('rest');
    expect(days[7]!.kind).toBe('gym');
    expect(nextWorkout(sessions)).toBe('C');
    const mon = session('2026-11-16', 'C', 30);
    expect(nextWorkout([...sessions, mon])).toBe('A');
    expect(nextWorkout([...sessions, mon, session('2026-11-18', 'A', 40)])).toBe('B');
  });
  it('нет тренировок → A; пробная не в счёт; незавершённая не в счёт', () => {
    expect(nextWorkout([])).toBe('A');
    expect(nextWorkout([session('2026-11-06', 'A', 1, { isCalibration: true })])).toBe('A');
    expect(nextWorkout([session('2026-11-09', 'A', 10), { ...session('2026-11-11', 'B', 20), finishedAt: undefined }])).toBe('B');
  });
});

describe('что сегодня: прочее', () => {
  const none = new Set<string>();
  it('до старта — подготовка, после конца — итог', () => {
    expect(planForDate('2026-11-06', none).kind).toBe('prep');
    expect(planForDate('2027-05-01', none).kind).toBe('finished');
  });
  it('обычная неделя: пн зал, вт бассейн, ср зал, чт бассейн, пт зал, сб бассейн, вс отдых', () => {
    const gym = new Set(['2026-11-09', '2026-11-11', '2026-11-13']);
    const kinds = planDays('2026-11-15', gym).map((d) => d.kind);
    expect(kinds).toEqual(['gym', 'pool', 'gym', 'pool', 'gym', 'pool', 'rest']);
    expect(planDays('2026-11-15', gym).map((d) => d.pool?.type)).toEqual([undefined, 'technique', undefined, 'intervals', undefined, 'long', undefined]);
  });
  it('пропуск пт → сб зал; в воскресенье зал не переносится', () => {
    const gym = new Set(['2026-11-09', '2026-11-11']);
    const days = planDays('2026-11-16', gym);
    expect(days[5]).toMatchObject({ kind: 'gym', makeup: true });
    expect(days[6]?.kind).toBe('rest');
    expect(days[7]?.kind).toBe('gym');
  });
  it('тип дня для калорий: сессия → gym, бассейн → pool, по плану, воскресенье → rest', () => {
    expect(dayTypeFor('2026-11-10', [], [])).toBe('pool');
    expect(dayTypeFor('2026-11-10', [session('2026-11-10', 'A', 5)], [])).toBe('gym');
    expect(dayTypeFor('2026-11-15', [], [])).toBe('rest');
    expect(dayTypeFor('2026-11-15', [], [{ date: '2026-11-15' }])).toBe('pool');
    expect(dayTypeFor('2026-11-09', [], [])).toBe('gym');
  });
});

describe('своё расписание и правки дней', () => {
  const none = new Set<string>();
  it('зал вт/чт/сб, бассейн пн/ср: план следует расписанию, тип бассейна — по дню недели', () => {
    const schedule = { gym: [2, 4, 6], pool: [1, 3], poolOptional: [] };
    const days = planDays('2026-11-15', none, '2026-11-09', { schedule });
    expect(days.map((d) => d.kind)).toEqual(['pool', 'gym', 'pool', 'gym', 'rest', 'gym', 'rest']);
    expect(days[0]!.pool?.type).toBe('technique');
  });
  it('правка «отдых» на день зала — пропуск без переноса на завтра', () => {
    const days = planDays('2026-11-10', none, undefined, { overrides: { '2026-11-09': 'rest' } });
    expect(days[0]).toMatchObject({ kind: 'rest', overridden: true });
    expect(days[1]!.kind).toBe('pool');
    expect(days[1]!.makeup).toBeUndefined();
  });
  it('правка «зал» на вторник — зал, даже если вчера был зал', () => {
    const plan = planForDate('2026-11-10', new Set(['2026-11-09']), { overrides: { '2026-11-10': 'gym' } });
    expect(plan).toMatchObject({ kind: 'gym', overridden: true });
  });
});

describe('состав тренировки', () => {
  it('32 слота в каждом блоке, A1 блока 1 — две строки по фазе', () => {
    for (const b of [1, 2, 3]) expect(new Set(SEED_SLOTS.filter((s) => s.block === b).map((s) => s.code)).size).toBe(32);
    expect(SEED_SLOTS).toHaveLength(97);
    expect(planOn('A', '2026-11-09')).toHaveLength(10);
    expect(planOn('B', '2026-11-09')).toHaveLength(11);
    expect(planOn('C', '2026-11-09')).toHaveLength(11);
  });
  it('замена по code действует только в своём блоке и берёт шаг замены', () => {
    const plan = workoutPlan('B', '2026-11-11', SEED_SLOTS, { substitutions: { B3: 'pullup_assisted' }, substitutionsBlock: 1 });
    const p = codeOf(plan, 'B3');
    expect(p.exercise.id).toBe('pullup_assisted');
    expect(p.step).toBe(500);
    const other = workoutPlan('B', '2027-01-06', SEED_SLOTS, { substitutions: { B3: 'pullup_assisted' }, substitutionsBlock: 1 });
    expect(codeOf(other, 'B3').exercise.id).toBe('close_grip_pulldown');
  });
  it('отдых — секунды слота; суперсет: после a 0 с, после b — 75', () => {
    const plan = planOn('A', '2026-11-09');
    expect(plan.map((p) => p.restSeconds)).toEqual([150, 150, 120, 120, 0, 75, 0, 75, 60, 60]);
    expect(supersetRole(plan, 4)).toBe('lead');
    expect(supersetRole(plan, 5)).toBe('follow');
    expect(supersetRole(plan, 0)).toBeNull();
    expect(plan.map((p) => p.step)).toEqual([200, 250, 200, 200, 100, 500, 200, 500, 500, 10]);
  });
  it('длительность ≈ 60–100 мин с разминкой и кардио', () => {
    const m = estimateMinutes(planOn('A', '2026-11-23'));
    expect(m).toBeGreaterThanOrEqual(60);
    expect(m).toBeLessThanOrEqual(100);
  });
});
