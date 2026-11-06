import { describe, expect, it } from 'vitest';
import { EXERCISES } from '../data/exercises';
import { LABEL_H, layoutCallouts, mapViewFor, muscleCenter } from './muscleCallouts';

describe('карта мышц с выносками', () => {
  it('вид: где видно больше рабочих мышц; жим — спереди (грудь), румынская — сзади, присед — спереди', () => {
    expect(mapViewFor(['hamstrings', 'glutes'], ['lower_back'])).toBe('back');
    expect(mapViewFor(['chest', 'triceps'], ['front_delt'])).toBe('front');
    expect(mapViewFor(['chest'])).toBe('front');
    expect(mapViewFor(['abs'])).toBe('front');
    expect(mapViewFor(['quads', 'glutes'], ['abs'])).toBe('front');
    expect(mapViewFor(['lats', 'upper_back'], ['biceps', 'rear_delt'])).toBe('back');
  });

  it('центр группы — в правой половине карты, в пикселях 130 × 286', () => {
    const c = muscleCenter('back', 'hamstrings')!;
    expect(c.x).toBeGreaterThan(65);
    expect(c.x).toBeLessThan(130);
    expect(c.y).toBeGreaterThan(150);
    expect(c.y).toBeLessThan(220);
    expect(muscleCenter('back', 'chest')).toBeNull();
    expect(muscleCenter('front', 'biceps')).not.toBeNull();
  });

  it('у всех 19 упражнений: хотя бы одна основная с точкой, все мышцы учтены, подписи с шагом ≥ 38 и в пределах карты', () => {
    for (const e of EXERCISES) {
      const l = layoutCallouts(e.muscles.primary, e.muscles.secondary);
      const shown = l.callouts.map((c) => c.muscle);
      expect(shown.some((m) => e.muscles.primary.includes(m)), e.id).toBe(true);
      for (const m of [...e.muscles.primary, ...e.muscles.secondary]) {
        expect([...shown, ...l.hidden.map((h) => h.muscle)], `${e.id}: ${m}`).toContain(m);
      }
      for (let i = 1; i < l.callouts.length; i++) {
        expect(l.callouts[i]!.labelY - l.callouts[i - 1]!.labelY, e.id).toBeGreaterThanOrEqual(38);
      }
      for (const c of l.callouts) {
        expect(c.labelY).toBeGreaterThanOrEqual(0);
        expect(c.labelY + LABEL_H).toBeLessThanOrEqual(286);
      }
    }
  });

  it('тяга гантели: бицепс не виден сзади — в списке скрытых', () => {
    const row = EXERCISES.find((e) => e.id === 'db_row')!;
    const l = layoutCallouts(row.muscles.primary, row.muscles.secondary);
    expect(l.view).toBe('back');
    expect(l.hidden.map((h) => h.muscle)).toEqual(['biceps']);
  });

  it('роли мышц заполнены для всех 19 упражнений, 2–5 слов', () => {
    for (const e of EXERCISES) {
      for (const m of [...e.muscles.primary, ...e.muscles.secondary]) {
        const role = e.muscleRoles?.[m];
        expect(role, `${e.id}: ${m}`).toBeTruthy();
        const words = role!.split(/\s+/).length;
        expect(words, `${e.id}: ${m} — «${role}»`).toBeGreaterThanOrEqual(2);
        expect(words, `${e.id}: ${m} — «${role}»`).toBeLessThanOrEqual(5);
      }
    }
  });
});
