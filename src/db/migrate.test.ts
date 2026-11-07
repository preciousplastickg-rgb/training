import { describe, expect, it } from 'vitest';
import { SEED_SLOTS } from '../data/program';
import { migratePoolV1, migrateSessionsV1, migrateSetsV1, migrateSettingsV1, migrateSlotsV1, type SlotV1 } from './migrate';

const v1 = (id: string, workout: 'A' | 'B', exerciseId: string, extra: Partial<SlotV1> = {}): SlotV1 => ({
  id, workout, order: 1, exerciseId, altExerciseIds: [], sets: 3, repMin: 8, repMax: 12, step: 200, rest: 'short', ...extra,
});

describe('миграция программы v1 → v2 (SPEC 4)', () => {
  it('слоты: seed v2 целиком, правки v1 переносятся в слот блока 1 по workout + exerciseId', () => {
    const { slots, slotIdMap } = migrateSlotsV1([
      v1('A3', 'A', 'db_row', { sets: 4, repMax: 15 }),
      v1('A1g', 'A', 'goblet_squat', { step: 250 }),
      v1('A1b', 'A', 'barbell_squat', { step: 500 }),
      v1('B6b', 'B', 'triceps_pushdown', { step: 500 }),
    ]);
    expect(slots).toHaveLength(SEED_SLOTS.length);
    expect(slots.find((s) => s.id === 'b1-A3')).toMatchObject({ sets: 4, repMax: 15, repMin: 8 });
    expect(slots.find((s) => s.id === 'b1-A1g')?.step).toBe(250); // шаг изменён пользователем
    expect(slots.find((s) => s.id === 'b1-A1b')?.step).toBeUndefined(); // шаг v1 по умолчанию
    expect(slots.find((s) => s.id === 'b2-A3')).toMatchObject({ sets: 3, repMax: 12, exerciseId: 'chest_supported_db_row' });
    expect([...slotIdMap.entries()]).toEqual([['A3', 'b1-A3'], ['A1g', 'b1-A1g'], ['A1b', 'b1-A1b'], ['B6b', 'b1-B8b']]);
  });
  it('слоты v2 во входе — не трогаются, seed без изменений', () => {
    const { slots } = migrateSlotsV1(SEED_SLOTS);
    expect(slots).toEqual(SEED_SLOTS);
  });
  it('сессии: block = 1, буква остаётся; подходы: slotId по соответствию, незнакомый — как есть', () => {
    expect(migrateSessionsV1([{ id: 's', workout: 'B' }])).toEqual([{ id: 's', workout: 'B', block: 1 }]);
    const map = new Map([['A3', 'b1-A3']]);
    const sets = migrateSetsV1(
      [
        { id: '1', sessionId: 's', exerciseId: 'db_row', slotId: 'A3', setIndex: 0, kind: 'work', weight: 1600, reps: 10, doneAt: 1 },
        { id: '2', sessionId: 's', exerciseId: 'x', slotId: 'zzz', setIndex: 0, kind: 'work', weight: 0, reps: 10, doneAt: 1 },
      ],
      map,
    );
    expect(sets.map((s) => s.slotId)).toEqual(['b1-A3', 'zzz']);
  });
  it('бассейн: тип по дню недели — вт техника, чт интервалы, сб длинное, иначе техника', () => {
    const out = migratePoolV1([
      { id: 'a', date: '2026-11-10' }, { id: 'b', date: '2026-11-12' }, { id: 'c', date: '2026-11-14' }, { id: 'd', date: '2026-11-13' },
      { id: 'e', date: '2026-11-15', type: 'long' },
    ]);
    expect(out.map((p) => p.type)).toEqual(['technique', 'intervals', 'long', 'technique', 'long']);
  });
  it('настройки: без restLong/restShort, ezBarWeight 10 кг, замены очищены, старое расписание → новое по умолчанию', () => {
    const s = migrateSettingsV1({
      heightCm: 174.5, restLong: 150, restShort: 90, substitutions: { lat_pulldown: 'pullup' },
      schedule: { gym: [1, 3, 5], pool: [2, 4], poolOptional: [6] },
    });
    expect(s).toEqual({ heightCm: 174.5, ezBarWeight: 1000, substitutions: {}, schedule: { gym: [1, 3, 5], pool: [2, 4, 6], poolOptional: [] } });
    const custom = migrateSettingsV1({ schedule: { gym: [2, 4], pool: [1], poolOptional: [] } });
    expect(custom.schedule).toEqual({ gym: [2, 4], pool: [1], poolOptional: [] });
  });
});
