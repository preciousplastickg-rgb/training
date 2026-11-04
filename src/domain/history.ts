// История по таблицам sessions/sets в памяти: для прогрессии, рекордов и графиков.

import type { LocalDate, SetLog, WorkoutSession } from '../db/types';
import type { HistoryEntry } from './progression';
import { suggest, type Suggestion } from './progression';
import type { PlannedExercise } from './program';

/** Завершённые сессии упражнения, от старых к новым, только рабочие подходы. */
export function historyFor(
  exerciseId: string,
  sets: readonly SetLog[],
  sessions: readonly WorkoutSession[],
  excludeSessionId?: string,
): HistoryEntry[] {
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const groups = new Map<string, SetLog[]>();
  for (const s of sets) {
    if (s.exerciseId !== exerciseId || s.kind !== 'work' || s.sessionId === excludeSessionId) continue;
    const sess = byId.get(s.sessionId);
    if (!sess || sess.finishedAt === undefined) continue;
    groups.set(s.sessionId, [...(groups.get(s.sessionId) ?? []), s]);
  }
  return [...groups.entries()]
    .map(([sid, xs]) => ({ sess: byId.get(sid)!, xs }))
    .sort((a, b) => a.sess.startedAt - b.sess.startedAt)
    .map(({ sess, xs }) => ({
      date: sess.date,
      isDeload: sess.isDeload,
      isCalibration: sess.isCalibration,
      sets: xs.sort((a, b) => a.setIndex - b.setIndex).map((x) => ({ weight: x.weight, reps: x.reps })),
    }));
}

export function suggestionFor(
  p: PlannedExercise,
  sets: readonly SetLog[],
  sessions: readonly WorkoutSession[],
  ctx: { sessionId?: string; isDeload: boolean; isCalibration: boolean },
): Suggestion {
  return suggest({
    exercise: p.exercise,
    sets: p.sets,
    normalSets: p.normalSets,
    repMin: p.slot.repMin,
    repMax: p.slot.repMax,
    step: p.step,
    history: historyFor(p.exercise.id, sets, sessions, ctx.sessionId),
    isDeload: ctx.isDeload,
    isCalibration: ctx.isCalibration,
  });
}

/** Подходы прошлой завершённой сессии упражнения — «прошлый раз» под строками. */
export function lastSessionSets(exerciseId: string, sets: readonly SetLog[], sessions: readonly WorkoutSession[], excludeSessionId?: string) {
  const h = historyFor(exerciseId, sets, sessions, excludeSessionId);
  return h[h.length - 1] ?? null;
}

/** Даты сессий по id — для графиков. */
export function sessionDates(sessions: readonly WorkoutSession[]): Map<string, LocalDate> {
  return new Map(sessions.filter((s) => s.finishedAt !== undefined).map((s) => [s.id, s.date]));
}
