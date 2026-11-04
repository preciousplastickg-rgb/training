// Правила корректировки калорий (SPEC 5.6) на демо-весах из npm run seed.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../db/db';
import type { BodyEntry } from '../db/types';
import { generateSeed } from '../dev/seedData';
import { diffDays } from './dates';
import { strengthSeries } from './history';
import { weeklyAdjustment } from './nutrition';

const seed = generateSeed(DEFAULT_SETTINGS);
/** Пересобрать вес с другим темпом (кг/нед), сохранив шум seed. */
const retrend = (perWeek: number): BodyEntry[] =>
  seed.body.map((b) => {
    if (b.weight === undefined) return b;
    const days = diffDays('2026-11-09', b.date);
    return { ...b, weight: Math.round(b.weight + (55 * days) / 7 - (perWeek * 100 * days) / 7) };
  });

describe('корректировки на seed-весах', () => {
  const strength = strengthSeries(seed.sets, seed.sessions);
  const mondays = ['2026-11-23', '2026-11-30', '2026-12-07', '2026-12-14', '2026-12-21'];

  it('тренд seed −0,55 кг/нед — в плане, карточек нет', () => {
    for (const m of mondays) expect(weeklyAdjustment(m, seed.body, strength, 2050), m).toBeNull();
  });
  it('медленно (−0,15 кг/нед) — «убрать 150 ккал»', () => {
    const body = retrend(0.15);
    const cards = mondays.map((m) => weeklyAdjustment(m, body, strength, 2050));
    expect(cards.filter((c) => c?.kind === 'cut').length).toBeGreaterThanOrEqual(4);
  });
  it('быстро (−1,3 кг/нед) — «добавить 150 ккал»', () => {
    const body = retrend(1.3);
    const cards = mondays.map((m) => weeklyAdjustment(m, body, strength, 2050));
    expect(cards.filter((c) => c?.kind === 'add').length).toBeGreaterThanOrEqual(4);
  });
  it('в seed сила растёт — карточки «сила падает» нет', () => {
    expect(mondays.map((m) => weeklyAdjustment(m, seed.body, strength, 2050)?.kind)).not.toContain('strength');
  });
});
