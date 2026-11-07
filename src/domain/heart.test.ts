import { describe, expect, it } from 'vitest';
import type { BodyEntry, LightWeek } from '../db/types';
import { addDays } from './dates';
import { hrBaseline, hrSeries, lightWeekFrom, lightWeekSignal } from './heart';
import { lightWeekFor, workoutPlan } from './program';
import { planForDate } from './program';
import { SEED_SLOTS } from '../data/program';

/** Пульс 58 первые 7 дней от старта, потом по списку `then`. */
const body = (baseline: number, then: number[]): BodyEntry[] => [
  ...Array.from({ length: 7 }, (_, i) => ({ date: addDays('2026-11-09', i), restingHr: baseline })),
  ...then.map((hr, i) => ({ date: addDays('2026-11-16', i), restingHr: hr })),
];

// SPEC 10, «Пульс» — обязательные тесты.
describe('пульс в покое и лёгкая неделя (SPEC 5.9)', () => {
  it('базовая линия — среднее первых 7 дней с записью', () => {
    expect(hrBaseline(body(58, []), '2026-11-20')).toBe(58);
    expect(hrBaseline([{ date: '2026-11-09', restingHr: 60 }, { date: '2026-11-10', restingHr: 56 }], '2026-11-12')).toBeNull();
    expect(hrBaseline([{ date: '2026-11-09', restingHr: 60 }, { date: '2026-11-11', restingHr: 56 }, { date: '2026-11-12', restingHr: 58 }], '2026-11-12')).toBe(58);
  });
  it('базовая 58; следующие 3 дня 64, 63, 65 → карточка лёгкой недели', () => {
    const s = lightWeekSignal(body(58, [64, 63, 65]), '2026-11-18');
    expect(s).not.toBeNull();
    expect(s!.baseline).toBe(58);
    expect(s!.days.map((d) => d.hr)).toEqual([64, 63, 65]);
  });
  it('базовая 58; следующие 3 дня 64, 62, 65 → карточки нет', () => {
    expect(lightWeekSignal(body(58, [64, 62, 65]), '2026-11-18')).toBeNull();
  });
  it('нет записи в один из трёх дней — карточки нет', () => {
    const b = body(58, [64, 63]);
    expect(lightWeekSignal(b, '2026-11-18')).toBeNull();
  });
  it('лёгкая неделя принята 2026-12-10 → действует 2026-12-11 – 2026-12-17: accessory по 2 подхода; бассейн сб 12 декабря — 30 мин спокойно', () => {
    const lw: LightWeek = { id: 'lw', ...lightWeekFrom('2026-12-10') };
    expect(lw).toMatchObject({ start: '2026-12-11', end: '2026-12-17', reason: 'resting_hr' });
    expect(lightWeekFor('2026-12-10', [lw])).toBeNull();
    expect(lightWeekFor('2026-12-11', [lw])).toBe(lw);
    expect(lightWeekFor('2026-12-17', [lw])).toBe(lw);
    expect(lightWeekFor('2026-12-18', [lw])).toBeNull();
    const plan = workoutPlan('A', '2026-12-14', SEED_SLOTS, { substitutions: {} }, { lightWeeks: [lw] });
    expect(plan.filter((p) => p.section === 'accessory').every((p) => p.sets === 2)).toBe(true);
    expect(plan.filter((p) => p.section === 'main').every((p) => p.sets === 3)).toBe(true);
    const sat = planForDate('2026-12-12', new Set(['2026-12-07', '2026-12-09', '2026-12-11']), { lightWeeks: [lw] });
    expect(sat.pool).toMatchObject({ type: 'long', minutes: 30, text: '30 мин спокойно' });
    expect(sat.lightWeek).toBe(true);
  });
  it('повторно в течение 14 дней после принятия карточку не показывать', () => {
    const lw: LightWeek = { id: 'lw', ...lightWeekFrom('2026-11-18') };
    const b = body(58, [64, 63, 65, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66]);
    expect(lightWeekSignal(b, '2026-11-25', [lw])).toBeNull();
    expect(lightWeekSignal(b, '2026-12-01', [lw])).toBeNull();
    expect(lightWeekSignal(b, '2026-12-02', [lw])).not.toBeNull();
  });
  it('после разгрузки базовая линия — среднее 7 дней разгрузки', () => {
    const b = [...body(58, []), ...Array.from({ length: 7 }, (_, i) => ({ date: addDays('2026-12-28', i), restingHr: 54 }))];
    expect(hrBaseline(b, '2027-01-10')).toBe(54);
    expect(hrBaseline(b, '2026-12-30')).toBe(58);
  });
  it('ряд для мини-графика: по дню, без записи — null', () => {
    const s = hrSeries([{ date: '2026-11-10', restingHr: 57 }], '2026-11-09', '2026-11-11');
    expect(s.map((p) => p.hr)).toEqual([null, 57, null]);
  });
});
