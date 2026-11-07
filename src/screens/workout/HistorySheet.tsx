// Запись истории: тренировка в зале (подходы по упражнениям) или бассейн. Отсюда же удаляется ошибочная запись.

import { Sheet } from '../../components/Sheet';
import { ConfirmDelete } from '../../components/ui';
import { getExercise } from '../../data/exercises';
import { CARDIO_NAMES, POOL_TYPE_NAMES } from '../../data/program';
import { deletePool, discardSession } from '../../db/repo';
import type { PoolSession, SetLog, WorkoutSession } from '../../db/types';
import { formatInt, formatKg, formatScaled, formatWeekdayDate, NBSP } from '../../domain/format';
import { sessionRecords, volume } from '../../domain/records';
import { useSessions } from '../../hooks/useData';

export interface HistoryItem {
  gym?: WorkoutSession;
  pool?: PoolSession;
}

const FEEL = ['тяжело', 'так себе', 'нормально', 'хорошо', 'отлично'];

function setText(ex: ReturnType<typeof getExercise>, s: SetLog): string {
  if (ex.unit === 'seconds') return `${s.reps}${NBSP}с`;
  if (ex.unit === 'assist_kg') return `−${formatKg(s.weight, false)}${NBSP}×${NBSP}${s.reps}`;
  if (ex.unit === 'reps' || s.weight === 0) return `${s.reps}`;
  return `${formatKg(s.weight, false)}${NBSP}×${NBSP}${s.reps}`;
}

export function HistorySheet({ item, sets, onClose }: { item: HistoryItem | null; sets: readonly SetLog[]; onClose: () => void }) {
  const sessions = useSessions();
  if (!item) return null;
  const { gym, pool } = item;
  if (pool) {
    return (
      <Sheet open title={`Бассейн · ${POOL_TYPE_NAMES[pool.type]}`} kicker={formatWeekdayDate(pool.date)} onClose={onClose}>
        <div className="flex flex-col gap-3 px-1 pb-2">
          <p className="text-lg">
            <b>{pool.minutes} мин</b>
            {pool.meters ? ` · ${formatInt(pool.meters)} м` : ''}
            {pool.feel ? ` · ${FEEL[pool.feel - 1]}` : ''}
            {pool.saunaRounds ? ` · сауна ${pool.saunaRounds}` : ''}
          </p>
          <ConfirmDelete label="Удалить запись" onConfirm={() => deletePool(pool.id).then(onClose)} />
        </div>
      </Sheet>
    );
  }
  if (!gym) return null;
  const mine = sets.filter((s) => s.sessionId === gym.id);
  const work = mine.filter((s) => s.kind === 'work');
  const minutes = Math.round(((gym.finishedAt ?? gym.startedAt) - gym.startedAt) / 60000);
  const order = [...new Set(mine.sort((a, b) => a.doneAt - b.doneAt).map((s) => s.exerciseId))];
  const records = sessionRecords(gym, sessions, sets);
  return (
    <Sheet open title={`Тренировка ${gym.workout}`} kicker={formatWeekdayDate(gym.date)} onClose={onClose}>
      <div className="flex flex-col gap-3 px-1 pb-2">
        <p className="text-sm text-muted">
          {minutes} мин · объём {formatInt(Math.round(volume(mine) / 100))}{NBSP}кг · {work.length} подходов
          {gym.isCalibration ? ' · подбор веса' : gym.isDeload ? ' · разгрузка' : ''}
          {gym.cardio ? ` · кардио ${gym.cardio.minutes} мин, ${CARDIO_NAMES[gym.cardio.machine].toLowerCase()}` : ''}
          {gym.saunaRounds ? ` · сауна ${gym.saunaRounds}` : ''}
        </p>
        {records.length > 0 && (
          <ul className="flex flex-col gap-2 rounded-[26px] bg-surface px-5 py-3.5" aria-label="Рекорды">
            {records.map((r) => (
              <li key={r.setId + r.kind} className="flex items-center gap-3">
                <span className="font-display flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-on-primary">PR</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-bold">{getExercise(r.exerciseId).name}</span>
                  <span className="text-[13px] text-muted tabular-nums">
                    {formatKg(r.weight, false)} × {r.reps} · {r.kind === 'e1rm' ? `e1RM ${formatScaled(r.e1rm ?? 0, 100, 1)}${NBSP}кг` : `лучший вес на ${r.reps}+`}
                  </span>
                </span>
                <span className="shrink-0 text-[15px] font-extrabold tabular-nums">+{formatKg(r.delta, false)}</span>
              </li>
            ))}
          </ul>
        )}
        <ul className="divide-y divide-line rounded-[26px] bg-surface px-5 py-1">
          {order.map((id) => {
            const ex = getExercise(id);
            const rows = work.filter((s) => s.exerciseId === id).sort((a, b) => a.setIndex - b.setIndex);
            return (
              <li key={id} className="py-2.5">
                <p className="text-[15px] font-bold">{ex.name}</p>
                <p className="text-sm text-muted tabular-nums">{rows.length ? rows.map((s) => setText(ex, s)).join(' · ') : 'только разминка'}</p>
              </li>
            );
          })}
          {order.length === 0 && <li className="py-2 text-sm text-muted">Подходов не записано</li>}
        </ul>
        <ConfirmDelete label="Удалить тренировку" note="Подходы пропадут из истории и прогрессии." onConfirm={() => discardSession(gym.id).then(onClose)} />
      </div>
    </Sheet>
  );
}
