// Демо-данные для разработки (SPEC 10): 8 недель тренировок с реалистичной прогрессией,
// вес с шумом ±0,6 кг и трендом −0,55 кг/нед, питание с 85% дней в цели, 2 пропуска.
// Детерминированно (свой ГПСЧ) — одинаковый результат при каждом запуске.

import { SEED_FOODS } from '../data/foods';
import { CALIBRATION_DATE, PROGRAM_START, SEED_SLOTS } from '../data/program';
import type { BodyEntry, FoodLog, PoolSession, SetLog, Settings, WorkoutSession } from '../db/types';
import { addDays } from '../domain/dates';
import { suggestionFor } from '../domain/history';
import { dayTargets } from '../domain/nutrition';
import { gymDatesOf, nextWorkout, planDays, workoutPlan } from '../domain/program';

export const SEED_DAYS = 56;
export const SEED_TODAY = addDays(PROGRAM_START, SEED_DAYS); // понедельник 4 января 2027
/** Пропущенные дни зала (индексы дней от старта). */
const MISSED = new Set([16, 37]);

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Стартовые веса после пробной тренировки, Kg100. */
const START_WEIGHT: Record<string, number> = {
  goblet_squat: 1600, barbell_squat: 4000, bench_press: 4500, db_row: 1600, db_rdl: 1400, lateral_raise: 600,
  barbell_rdl: 4000, db_shoulder_press: 1200, lat_pulldown: 3500, bulgarian_split_squat: 800, incline_db_press: 1200,
  biceps_curl: 800, triceps_pushdown: 2000, cable_crunch: 2000,
};

export interface SeedResult {
  sessions: WorkoutSession[];
  sets: SetLog[];
  pool: PoolSession[];
  body: BodyEntry[];
  foodLog: FoodLog[];
}

export function generateSeed(settings: Pick<Settings, 'substitutions' | 'restLong' | 'restShort' | 'phase3Mode'>): SeedResult {
  const rand = rng(20261109);
  const sessions: WorkoutSession[] = [];
  const sets: SetLog[] = [];
  const pool: PoolSession[] = [];
  const body: BodyEntry[] = [];
  const foodLog: FoodLog[] = [];
  let n = 0;
  const id = (p: string) => `${p}-${++n}`;
  const ts = (date: string, hour: number) => new Date(`${date}T${String(hour).padStart(2, '0')}:00:00+06:00`).getTime();

  const doSession = (date: string, workout: 'A' | 'B', isCalibration: boolean, isDeload: boolean) => {
    const sid = id('s');
    const startedAt = ts(date, 18);
    const sess: WorkoutSession = { id: sid, date, workout, startedAt, isDeload, isCalibration };
    const plan = workoutPlan(workout, date, SEED_SLOTS, settings);
    let t = startedAt + 5 * 60_000;
    for (const p of plan) {
      const sug = suggestionFor(p, sets, sessions, { sessionId: sid, isDeload, isCalibration });
      const ex = p.exercise;
      const w = ex.unit !== 'kg' ? 0 : (sug.weight ?? START_WEIGHT[ex.id] ?? 1000);
      for (let i = 0; i < p.sets; i++) {
        const target = sug.targets[i] ?? p.slot.repMin;
        // Чаще всего делает цель или +1; иногда (усталость к последнему подходу) — на 1 меньше.
        const r = rand();
        const delta = isCalibration ? 2 : r < 0.18 && i === p.sets - 1 ? -1 : r > 0.55 ? 1 : 0;
        const step = ex.unit === 'seconds' ? 5 : 1;
        const reps = Math.max(1, Math.min(ex.unit === 'kg' ? p.slot.repMax : target + 10, target + delta * step));
        t += (45 + p.restSeconds) * 1000;
        sets.push({ id: id('x'), sessionId: sid, exerciseId: ex.id, slotId: p.slot.id, setIndex: i, kind: 'work', weight: w, reps, doneAt: t });
      }
    }
    sess.finishedAt = t + 3 * 60_000;
    sessions.push(sess);
  };

  doSession(CALIBRATION_DATE, 'A', true, false);

  for (let i = 0; i < SEED_DAYS; i++) {
    const date = addDays(PROGRAM_START, i);
    const plan = planDays(date, gymDatesOf(sessions)).at(-1)!;
    if (plan.kind === 'gym' && !MISSED.has(i)) doSession(date, nextWorkout(sessions), false, plan.isDeload);
    if (plan.kind === 'pool' || (plan.kind === 'pool_optional' && rand() < 0.5)) {
      const minutes = plan.pool!.minutes + Math.round((rand() - 0.5) * 6);
      pool.push({ id: id('p'), date, minutes, meters: Math.round(minutes * 32), feel: (3 + Math.floor(rand() * 3)) as 3 | 4 | 5 });
    }

    // Вес: тренд −0,55 кг/нед, шум ±0,6 кг; ~10% дней без записи.
    const entry: BodyEntry = { date };
    if (rand() > 0.1) entry.weight = Math.round(8100 - (55 * i) / 7 + (rand() - 0.5) * 120);
    if (i % 7 === 0) {
      entry.waist = Math.round(920 - (3.5 * i) / 7);
      entry.neck = 380;
    }
    if (rand() > 0.3) entry.steps = 6000 + Math.round(rand() * 6000);
    if (Object.keys(entry).length > 1) body.push(entry);

    // Питание: 85% дней в цели.
    const t = dayTargets(date, [], settings);
    const inTarget = rand() < 0.85;
    const f = inTarget ? 0.93 + rand() * 0.12 : rand() < 0.5 ? 0.76 : 1.18;
    const scale = (t.kcal * f) / 2028;
    const day: [FoodLog['meal'], string, number][] = [
      ['breakfast', 'Овсянка, сухая', 80], ['breakfast', 'Яйцо куриное', 110],
      ['lunch', 'Куриная грудка, сырая', 250], ['lunch', 'Рис белый, сухой', 80],
      ['dinner', 'Говядина постная, сырая', 200], ['dinner', 'Гречка, сухая', 70], ['dinner', 'Масло растительное', 10],
      ['snack', 'Творог 5%', 200], ['snack', 'Банан', 120],
    ];
    day.forEach(([meal, name, grams], k) => {
      const food = SEED_FOODS.find((x) => x.name === name)!;
      foodLog.push({ id: id('f'), date, meal, foodId: food.id, grams: Math.round(grams * scale), createdAt: ts(date, 8) + k * 1000 });
    });
  }
  return { sessions, sets, pool, body, foodLog };
}
