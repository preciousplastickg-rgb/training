// История по таблицам sessions/sets в памяти: для прогрессии, рекордов и графиков.

import type { LocalDate, SetLog, WorkoutSession } from '../db/types';
import type { HistoryEntry } from './progression';
import { suggest, type Suggestion } from './progression';
import { volume } from './records';
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

/** Базовые упражнения для правила «сила падает» (SPEC 5.6). */
export const BASE_LIFTS = ['goblet_squat', 'barbell_squat', 'bench_press', 'barbell_rdl', 'db_row', 'lat_pulldown', 'db_shoulder_press'];

/** Рабочий вес (максимум) базовых упражнений по датам, без разгрузок и пробной. */
export function strengthSeries(sets: readonly SetLog[], sessions: readonly WorkoutSession[], ids: readonly string[] = BASE_LIFTS) {
  const ok = new Map(sessions.filter((s) => s.finishedAt !== undefined && !s.isDeload && !s.isCalibration).map((s) => [s.id, s.date]));
  const out: Record<string, { date: LocalDate; weight: number }[]> = {};
  const best = new Map<string, number>();
  for (const s of sets) {
    if (s.kind !== 'work' || !ids.includes(s.exerciseId) || !ok.has(s.sessionId)) continue;
    const key = `${s.exerciseId}|${s.sessionId}`;
    best.set(key, Math.max(best.get(key) ?? 0, s.weight));
  }
  for (const [key, weight] of best) {
    const [ex, sid] = key.split('|') as [string, string];
    (out[ex] ??= []).push({ date: ok.get(sid)!, weight });
  }
  for (const v of Object.values(out)) v.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

/**
 * Объём последних `n` завершённых тренировок того же типа (A или B), включая текущую, от старых к новым —
 * столбики на итоге. Пробная не в счёт.
 */
export function recentVolumes(
  session: Pick<WorkoutSession, 'id' | 'workout' | 'startedAt'>,
  sessions: readonly WorkoutSession[],
  sets: readonly Pick<SetLog, 'sessionId' | 'kind' | 'weight' | 'reps'>[],
  n = 5,
): { id: string; volume: number; current: boolean }[] {
  const same = sessions
    .filter((s) => s.workout === session.workout && !s.isCalibration && (s.id === session.id || (s.finishedAt !== undefined && s.startedAt < session.startedAt)))
    .sort((a, b) => a.startedAt - b.startedAt)
    .slice(-n);
  return same.map((s) => ({ id: s.id, volume: volume(sets.filter((x) => x.sessionId === s.id)), current: s.id === session.id }));
}
