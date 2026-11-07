// Рекорды и сила — SPEC 5.7.

import type { Kg100, SetLog, WorkoutSession } from '../db/types';

/** e1RM по Эпли: вес × (1 + повторы / 30). Только подходы до 12 повторов. */
export function e1rm(weight: Kg100, reps: number): Kg100 | null {
  if (reps < 1 || reps > 12 || weight <= 0) return null;
  return Math.round(weight * (1 + reps / 30));
}

/** Объём = Σ вес × повторы рабочих подходов, Kg100 × повт. */
export function volume(sets: readonly Pick<SetLog, 'kind' | 'weight' | 'reps'>[]): number {
  return sets.filter((s) => s.kind === 'work').reduce((a, s) => a + s.weight * s.reps, 0);
}

export interface RecordHit {
  setId: string;
  exerciseId: string;
  weight: Kg100;
  reps: number;
  kind: 'weight' | 'e1rm';
  e1rm: Kg100 | null;
  /** Прирост к прошлому лучшему, Kg100: для «вес» — к весу на столько же повторов, для e1RM — к прошлой оценке. */
  delta: Kg100;
}

/**
 * Рекорды в подходах сессии против всей истории до неё:
 * «вес» — больший вес на N или больше повторов, чем когда-либо (если на столько повторов уже что-то делали);
 * «e1rm» — новая лучшая оценка. На упражнение — не больше одного рекорда за сессию: вес нагляднее, иначе e1RM.
 * Иначе при двойной прогрессии каждая тренировка давала бы по два «рекорда» на упражнение и счётчик терял смысл.
 */
export function findRecords(
  session: readonly SetLog[],
  prior: readonly SetLog[],
): RecordHit[] {
  const hits: RecordHit[] = [];
  const work = session.filter((s) => s.kind === 'work' && s.weight > 0);
  const byEx = new Map<string, SetLog[]>();
  for (const s of work) byEx.set(s.exerciseId, [...(byEx.get(s.exerciseId) ?? []), s]);

  for (const [exerciseId, sets] of byEx) {
    const hist = prior.filter((p) => p.exerciseId === exerciseId && p.kind === 'work' && p.weight > 0);
    if (hist.length === 0) continue; // первая сессия упражнения — не рекорд, а точка отсчёта
    const bestE1 = Math.max(0, ...hist.map((h) => e1rm(h.weight, h.reps) ?? 0));
    let bestWeightHit: RecordHit | null = null;
    let bestE1Hit: RecordHit | null = null;
    for (const s of sets) {
      // Новый максимум повторов без истории на столько повторов — не рекорд веса (его учтёт e1RM).
      const prevAtReps = Math.max(0, ...hist.filter((h) => h.reps >= s.reps).map((h) => h.weight));
      if (prevAtReps > 0 && s.weight > prevAtReps && (!bestWeightHit || s.weight > bestWeightHit.weight)) {
        bestWeightHit = { setId: s.id, exerciseId, weight: s.weight, reps: s.reps, kind: 'weight', e1rm: e1rm(s.weight, s.reps), delta: s.weight - prevAtReps };
      }
      const e = e1rm(s.weight, s.reps);
      if (e !== null && e > bestE1 && (!bestE1Hit || e > (bestE1Hit.e1rm ?? 0))) {
        bestE1Hit = { setId: s.id, exerciseId, weight: s.weight, reps: s.reps, kind: 'e1rm', e1rm: e, delta: e - bestE1 };
      }
    }
    const hit = bestWeightHit ?? bestE1Hit;
    if (hit) hits.push(hit);
  }
  return hits;
}

/** Рекорды завершённой тренировки относительно всех тренировок, завершённых раньше неё. */
export function sessionRecords(session: WorkoutSession, sessions: readonly WorkoutSession[], sets: readonly SetLog[]): RecordHit[] {
  const before = new Set(sessions.filter((s) => s.finishedAt !== undefined && s.startedAt < session.startedAt).map((s) => s.id));
  return findRecords(
    sets.filter((s) => s.sessionId === session.id),
    sets.filter((s) => before.has(s.sessionId)),
  );
}

/** Лучший e1RM каждой сессии упражнения — точки графика силы. */
export function e1rmSeries(sets: readonly SetLog[], sessionDate: ReadonlyMap<string, string>) {
  const best = new Map<string, number>();
  for (const s of sets) {
    if (s.kind !== 'work') continue;
    const e = e1rm(s.weight, s.reps);
    if (e === null) continue;
    best.set(s.sessionId, Math.max(best.get(s.sessionId) ?? 0, e));
  }
  return [...best.entries()]
    .map(([sid, value]) => ({ date: sessionDate.get(sid) ?? '', value }))
    .filter((p) => p.date)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Рабочий вес (максимум) каждой сессии. */
export function workWeightSeries(sets: readonly SetLog[], sessionDate: ReadonlyMap<string, string>) {
  const best = new Map<string, number>();
  for (const s of sets) {
    if (s.kind !== 'work') continue;
    best.set(s.sessionId, Math.max(best.get(s.sessionId) ?? 0, s.weight));
  }
  return [...best.entries()]
    .map(([sid, value]) => ({ date: sessionDate.get(sid) ?? '', value }))
    .filter((p) => p.date)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Таблица рекордов: для каждого сделанного числа повторов — лучший вес на столько или больше повторов. */
export function repRecords(sets: readonly SetLog[]): { reps: number; weight: Kg100 }[] {
  const work = sets.filter((s) => s.kind === 'work' && s.weight > 0);
  const reps = [...new Set(work.map((s) => s.reps))].filter((r) => r <= 15).sort((a, b) => a - b);
  return reps.map((r) => ({ reps: r, weight: Math.max(...work.filter((s) => s.reps >= r).map((s) => s.weight)) }));
}

/** Сколько рекордов поставлено за всё время: каждая завершённая сессия против истории до неё. */
export function recordCount(sets: readonly SetLog[], sessions: readonly WorkoutSession[]): number {
  const done = sessions.filter((s) => s.finishedAt !== undefined).sort((a, b) => a.startedAt - b.startedAt);
  let n = 0;
  let prior: SetLog[] = [];
  for (const s of done) {
    const mine = sets.filter((x) => x.sessionId === s.id);
    n += findRecords(mine, prior).length;
    prior = prior.concat(mine);
  }
  return n;
}
