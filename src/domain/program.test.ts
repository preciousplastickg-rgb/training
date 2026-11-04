import { describe, expect, it } from 'vitest';
import { SEED_SLOTS } from '../data/program';
import type { WorkoutSession } from '../db/types';
import { estimateMinutes, nextWorkout, phaseWeek, planDays, planForDate, workoutPlan } from './program';

const settings = { substitutions: {}, restLong: 150, restShort: 90 };
const session = (date: string, workout: 'A' | 'B', finishedAt: number, extra: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id: date, date, workout, startedAt: finishedAt - 1, finishedAt, isDeload: false, isCalibration: false, ...extra,
});

describe('фазы', () => {
  it('«Фаза 2 · неделя 6 из 12»', () => {
    const pw = phaseWeek('2027-01-12');
    expect(pw?.phase.n).toBe(2);
    expect(pw?.week).toBe(6);
    expect(pw?.weeks).toBe(12);
  });
  it('фаза 1 — 4 недели, фаза 3 — 9', () => {
    expect(phaseWeek('2026-11-09')).toMatchObject({ week: 1, weeks: 4 });
    expect(phaseWeek('2027-04-30')).toMatchObject({ week: 9, weeks: 9 });
  });
});

describe('что сегодня', () => {
  const none = new Set<string>();
  it('до старта — подготовка, после конца — итог', () => {
    expect(planForDate('2026-11-06', none).kind).toBe('prep');
    expect(planForDate('2027-05-01', none).kind).toBe('finished');
  });
  it('обычная неделя: пн зал, вт бассейн, сб по желанию, вс отдых', () => {
    const gym = new Set(['2026-11-09', '2026-11-11', '2026-11-13']);
    const kinds = planDays('2026-11-15', gym).map((d) => d.kind);
    expect(kinds).toEqual(['gym', 'pool', 'gym', 'pool', 'gym', 'pool_optional', 'rest']);
  });
  it('пропуск пн → вт зал, бассейн по желанию; ср зал не предлагается; чт — зал', () => {
    const gym = new Set(['2026-11-10', '2026-11-12']);
    const days = planDays('2026-11-14', gym);
    expect(days[1]).toMatchObject({ kind: 'gym', makeup: true, pool: { optional: true } });
    expect(days[2]).toMatchObject({ kind: 'pool_optional', gymBlocked: true });
    expect(days[3]).toMatchObject({ kind: 'gym', makeup: true });
    expect(days[4]).toMatchObject({ kind: 'pool_optional', gymBlocked: true });
    expect(days[5]).toMatchObject({ kind: 'gym', makeup: true });
  });
  it('пропуск пт → сб зал; в воскресенье зал не переносится', () => {
    const gym = new Set(['2026-11-09', '2026-11-11']);
    const days = planDays('2026-11-16', gym);
    expect(days[5]).toMatchObject({ kind: 'gym', makeup: true });
    expect(days[6]?.kind).toBe('rest');
    expect(days[7]?.kind).toBe('gym');
  });
  it('разгрузка помечена', () => {
    expect(planForDate('2026-12-28', new Set()).isDeload).toBe(true);
  });
});

describe('чередование A/B', () => {
  it('нет тренировок → A; пробная не в счёт', () => {
    expect(nextWorkout([])).toBe('A');
    expect(nextWorkout([session('2026-11-06', 'A', 1, { isCalibration: true })])).toBe('A');
  });
  it('противоположная последней выполненной, пропуск не ломает', () => {
    const s = [session('2026-11-09', 'A', 10), session('2026-11-11', 'B', 20)];
    expect(nextWorkout(s)).toBe('A');
    // пропущена пятница — в понедельник всё равно A
    expect(nextWorkout(s)).toBe('A');
    expect(nextWorkout([...s, session('2026-11-16', 'A', 30)])).toBe('B');
  });
  it('незавершённая не в счёт', () => {
    expect(nextWorkout([session('2026-11-09', 'A', 10), { ...session('2026-11-11', 'B', 20), finishedAt: undefined }])).toBe('B');
  });
});

describe('состав тренировки', () => {
  it('фаза 1: гоблет-присед, фаза 2: штанга', () => {
    expect(workoutPlan('A', '2026-11-09', SEED_SLOTS, settings)[0]?.exercise.id).toBe('goblet_squat');
    expect(workoutPlan('A', '2026-12-07', SEED_SLOTS, settings)[0]?.exercise.id).toBe('barbell_squat');
  });
  it('фаза 3: +1 подход на плечи, спину, руки', () => {
    const plan = workoutPlan('B', '2027-03-03', SEED_SLOTS, settings);
    const sets = Object.fromEntries(plan.map((p) => [p.exercise.id, p.sets]));
    expect(sets).toMatchObject({ db_shoulder_press: 4, lat_pulldown: 4, biceps_curl: 4, barbell_rdl: 3 });
  });
  it('разгрузка: 3 → 2 подхода', () => {
    expect(workoutPlan('A', '2026-12-28', SEED_SLOTS, settings).every((p) => p.sets === 2)).toBe(true);
  });
  it('замена запоминается и берёт свой шаг', () => {
    const plan = workoutPlan('B', '2026-11-11', SEED_SLOTS, { ...settings, substitutions: { lat_pulldown: 'pullup' } });
    const p = plan.find((x) => x.slot.id === 'B3')!;
    expect(p.exercise.id).toBe('pullup');
    expect(p.step).toBe(2);
  });
  it('отдых: long 150, short 90, суперсет 60', () => {
    const plan = workoutPlan('B', '2026-11-11', SEED_SLOTS, settings);
    expect(plan.map((p) => p.restSeconds)).toEqual([150, 90, 90, 90, 90, 60, 60, 90]);
  });
  it('длительность ≈ 50–75 мин', () => {
    const m = estimateMinutes(workoutPlan('A', '2026-11-09', SEED_SLOTS, settings));
    expect(m).toBeGreaterThanOrEqual(45);
    expect(m).toBeLessThanOrEqual(80);
  });
});
