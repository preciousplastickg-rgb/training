// Миграция данных v1 (программа A/B) → v2 (A/B/C по блокам) — SPEC 4, «Миграция v2 → v3».
// Чистые функции над массивами: их зовут и апгрейд Dexie, и импорт старого бэкапа.

import { DEFAULT_SCHEDULE, SEED_SLOTS, poolTypeFor } from '../data/program';
import { isoWeekday } from '../domain/dates';
import type { PoolSession, ProgramSlot, Settings, SetLog, WorkoutSession } from './types';

/** Слот программы v1: без блока и кода, отдых — 'long' | 'short' | секунды. */
export interface SlotV1 {
  id: string;
  workout: 'A' | 'B';
  order: number;
  exerciseId: string;
  altExerciseIds: string[];
  sets: number;
  repMin: number;
  repMax: number;
  step: number;
  rest: 'long' | 'short' | number;
  supersetWith?: string;
  fromPhase?: 1 | 2 | 3;
  toPhase?: 1 | 2 | 3;
}

/** Шаги v1 по id слота: шаг переносится в v2 только если пользователь его менял. */
const V1_STEPS: Record<string, number> = {
  A1g: 200, A1b: 500, A2: 250, A3: 200, A4: 200, A5: 100, A6: 10,
  B1: 500, B2: 200, B3: 500, B4: 200, B5: 200, B6a: 100, B6b: 500, B7: 2,
};

const OLD_DEFAULT_SCHEDULE = { gym: [1, 3, 5], pool: [2, 4], poolOptional: [6] };

export function isSlotV1(s: object): s is SlotV1 {
  const o = s as Partial<ProgramSlot>;
  return typeof o.block !== 'number' || typeof o.code !== 'string';
}

/**
 * Слоты: seed v2 целиком; правки v1 (подходы, повторы, шаг) переносятся в слот блока 1 с тем же
 * workout + exerciseId. Возвращает и соответствие старых id новым — для SetLog.slotId.
 */
export function migrateSlotsV1(old: readonly (SlotV1 | ProgramSlot)[]): { slots: ProgramSlot[]; slotIdMap: Map<string, string> } {
  const slots = SEED_SLOTS.map((s) => ({ ...s, altExerciseIds: [...s.altExerciseIds] }));
  const slotIdMap = new Map<string, string>();
  for (const o of old) {
    if (!isSlotV1(o)) continue;
    const target = slots.find((s) => s.block === 1 && s.workout === o.workout && s.exerciseId === o.exerciseId);
    if (!target) continue;
    slotIdMap.set(o.id, target.id);
    const seed = SEED_SLOTS.find((s) => s.id === target.id)!;
    if (o.sets !== seed.sets) target.sets = o.sets;
    if (o.repMin !== seed.repMin) target.repMin = o.repMin;
    if (o.repMax !== seed.repMax) target.repMax = o.repMax;
    const v1Step = V1_STEPS[o.id];
    if (v1Step !== undefined && o.step !== v1Step) target.step = o.step;
  }
  return { slots, slotIdMap };
}

export function migrateSessionsV1(sessions: readonly (Partial<WorkoutSession> & { id: string })[]): WorkoutSession[] {
  return sessions.map((s) => ({ ...(s as WorkoutSession), block: s.block ?? 1 }));
}

export function migrateSetsV1(sets: readonly SetLog[], slotIdMap: ReadonlyMap<string, string>): SetLog[] {
  return sets.map((s) => (slotIdMap.has(s.slotId) ? { ...s, slotId: slotIdMap.get(s.slotId)! } : s));
}

/** Тип бассейна — по дню недели даты: вт → техника, чт → интервалы, сб → длинное, иначе техника. */
export function migratePoolV1(pool: readonly (Partial<PoolSession> & { id: string; date: string })[]): PoolSession[] {
  return pool.map((p) => ({ ...(p as PoolSession), type: p.type ?? poolTypeFor(isoWeekday(p.date)) }));
}

type SettingsV1 = Partial<Settings> & { restLong?: number; restShort?: number };

/** restLong / restShort убраны, ezBarWeight 10 кг, замены очищены (ключ теперь — code), расписание по умолчанию — бассейн вт/чт/сб. */
export function migrateSettingsV1<T extends SettingsV1>(row: T): Omit<T, 'restLong' | 'restShort'> & Pick<Settings, 'ezBarWeight' | 'substitutions'> {
  const { restLong: _l, restShort: _s, ...rest } = row;
  const out = { ...rest, ezBarWeight: row.ezBarWeight ?? 1000, substitutions: {} as Record<string, string> };
  delete (out as Partial<Settings>).substitutionsBlock;
  if (row.schedule && JSON.stringify(row.schedule) === JSON.stringify(OLD_DEFAULT_SCHEDULE)) out.schedule = DEFAULT_SCHEDULE;
  return out;
}
