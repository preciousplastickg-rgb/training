import { ChevronRight, Dumbbell, History, Info, Play, Waves } from 'lucide-react';
import { useMemo, useState } from 'react';
import { navigate } from '../app/router';
import { unlockAudio } from '../app/sound';
import { ExerciseSheet } from '../components/ExerciseSheet';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button, Card, Chip, SectionTitle } from '../components/ui';
import { DEFAULT_SETTINGS } from '../db/db';
import { startSession } from '../db/repo';
import type { PoolSession, WorkoutSession } from '../db/types';
import { formatDayMonth, formatKg, formatInt } from '../domain/format';
import { suggestionFor } from '../domain/history';
import { deloadFor, estimateMinutes, nextWorkout, phaseWeek, workoutPlan, type PlannedExercise } from '../domain/program';
import { volume } from '../domain/records';
import { PROGRAM_START } from '../data/program';
import { useActiveSession, useAllSets, usePool, useSessions, useSettings, useSlots } from '../hooks/useData';
import { useToday } from '../hooks/useToday';
import { EmptyState } from '../components/EmptyState';
import { CalendarCard } from './workout/CalendarCard';
import { HistorySheet, type HistoryItem } from './workout/HistorySheet';

export function WorkoutScreen() {
  const date = useToday();
  const settings = useSettings() ?? DEFAULT_SETTINGS;
  const slots = useSlots();
  const sessions = useSessions();
  const sets = useAllSets();
  const active = useActiveSession();
  const [info, setInfo] = useState<string | null>(null);
  const auto = nextWorkout(sessions);
  const [override, setOverride] = useState<'A' | 'B' | null>(null);
  const workout = override ?? auto;
  const beforeStart = date < PROGRAM_START;
  const isDeload = deloadFor(date) !== null;
  const plan = useMemo(() => workoutPlan(workout, date, slots, settings), [workout, date, slots, settings]);
  const pw = phaseWeek(date);

  const start = async (calibration: boolean) => {
    unlockAudio();
    await startSession({ workout, isDeload, isCalibration: calibration });
    navigate('session');
  };

  return (
    <>
      <ScreenHeader title="Тренировка" subtitle={pw ? `Фаза ${pw.phase.n} · ${pw.phase.name}` : beforeStart ? 'Подготовка' : 'Программа завершена'} />
      <div className="flex flex-col gap-4 px-4 pb-6">
        {active && (
          <Card onClick={() => navigate('session')} className="border-2 border-primary">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-on-primary">
                <Play size={22} aria-hidden />
              </span>
              <div className="flex-1">
                <p className="font-semibold">Тренировка {active.workout} идёт</p>
                <p className="text-sm text-muted">Продолжить с того же места</p>
              </div>
              <ChevronRight className="text-muted" aria-hidden />
            </div>
          </Card>
        )}

        {!active && slots.length > 0 && (
          <Card>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm text-muted">{override ? 'Выбрана вручную' : 'Следующая по чередованию'}</p>
                <h2 className="text-xl font-semibold">Тренировка {workout}</h2>
                <p className="text-sm text-muted">
                  {plan.length} упражнений · ≈ {estimateMinutes(plan)} мин{isDeload ? ' · разгрузка' : ''}
                </p>
              </div>
              <div className="flex gap-1" role="group" aria-label="Какую тренировку показать">
                {(['A', 'B'] as const).map((w) => (
                  <Chip key={w} active={workout === w} onClick={() => setOverride(w === auto ? null : w)} aria-label={`Тренировка ${w}`}>
                    {w}
                  </Chip>
                ))}
              </div>
            </div>
            <PlanList plan={plan} sets={sets} sessions={sessions} isDeload={isDeload} onInfo={setInfo} />
            <p className="mt-1 px-1 text-xs text-muted">Тап по упражнению — как делать. Подходы, повторы и шаги правятся в настройках.</p>
            {beforeStart ? (
              <div className="mt-3 flex flex-col gap-2">
                <Button size="lg" onClick={() => void start(true)}>
                  <Play size={20} aria-hidden /> Пробная тренировка: подбор веса
                </Button>
                <p className="text-center text-xs text-muted">Вес вводишь сам. Возьми такой, с которым легко сделаешь 12.</p>
              </div>
            ) : (
              <Button size="lg" className="mt-3 w-full" onClick={() => void start(false)}>
                <Play size={20} aria-hidden /> Начать
              </Button>
            )}
          </Card>
        )}

        <CalendarCard />

        <SessionHistory sessions={sessions} />
      </div>
      <ExerciseSheet exerciseId={info} onClose={() => setInfo(null)} />
    </>
  );
}

export function setsLabel(p: PlannedExercise): string {
  const { repMin, repMax } = p.slot;
  const unit = p.exercise.unit === 'seconds' ? ' с' : '';
  const side = p.exercise.perSide ? (p.exercise.id === 'db_row' ? ' на руку' : ' на ногу') : '';
  return `${p.sets} × ${repMin}–${repMax}${unit}${side}`;
}

function PlanList({
  plan, sets, sessions, isDeload, onInfo,
}: {
  plan: PlannedExercise[];
  sets: ReturnType<typeof useAllSets>;
  sessions: WorkoutSession[];
  isDeload: boolean;
  onInfo: (id: string) => void;
}) {
  return (
    <ul className="mt-3 flex flex-col gap-1">
      {plan.map((p) => {
        const s = suggestionFor(p, sets, sessions, { isDeload, isCalibration: false });
        const target =
          p.exercise.unit !== 'kg' ? setsLabel(p) : s.weight === null ? `${setsLabel(p)} · вес подберёшь` : `${formatKg(s.weight)} · ${setsLabel(p)}`;
        return (
          <li key={p.slot.id}>
            <button type="button" onClick={() => onInfo(p.exercise.id)} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-1 text-left active:bg-track">
              <Dumbbell size={18} className="shrink-0 text-muted" aria-hidden />
              <span className="flex-1">
                <span className="block text-[15px] font-medium">{p.exercise.name}</span>
                <span className="block text-sm text-muted">
                  {target} · отдых {p.restSeconds} с{p.slot.supersetWith ? ' · суперсет' : ''}
                </span>
              </span>
              <Info size={18} className="text-muted" aria-label="Как делать" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** История: зал и бассейн вместе, последние записи сверху. Тап — подробности и удаление. */
function SessionHistory({ sessions }: { sessions: WorkoutSession[] }) {
  const sets = useAllSets();
  const pool = usePool();
  const [open, setOpen] = useState<HistoryItem | null>(null);
  type Item = { date: string; at: number; gym?: WorkoutSession; pool?: PoolSession };
  const items: Item[] = [
    ...sessions.filter((s) => s.finishedAt !== undefined).map((s) => ({ date: s.date, at: s.finishedAt!, gym: s })),
    ...pool.map((p) => ({ date: p.date, at: 0, pool: p })),
  ]
    .sort((a, b) => (a.date === b.date ? b.at - a.at : a.date < b.date ? 1 : -1))
    .slice(0, 12);
  const row = (main: React.ReactNode, right: React.ReactNode, onClick: () => void) => (
    <button type="button" onClick={onClick} className="flex min-h-12 w-full items-center justify-between gap-3 py-1 text-left text-sm active:bg-track">
      <span className="min-w-0">{main}</span>
      <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-muted">
        {right}
        <ChevronRight size={16} aria-hidden />
      </span>
    </button>
  );
  return (
    <section>
      <SectionTitle>История</SectionTitle>
      {items.length === 0 ? (
        <EmptyState icon={History} text="Заверши первую тренировку или запиши бассейн — они появятся здесь" />
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {items.map(({ gym: s, pool: p }) => {
              if (p) {
                return (
                  <li key={p.id}>
                    {row(
                      <span className="flex items-center gap-1.5">
                        <b>{formatDayMonth(p.date)}</b> · Бассейн <Waves size={14} className="text-protein" aria-hidden />
                      </span>,
                      <>{p.minutes} мин{p.meters ? ` · ${formatInt(p.meters)} м` : ''}</>,
                      () => setOpen({ pool: p }),
                    )}
                  </li>
                );
              }
              const v = volume(sets.filter((x) => x.sessionId === s!.id));
              const min = Math.round(((s!.finishedAt ?? s!.startedAt) - s!.startedAt) / 60000);
              return (
                <li key={s!.id}>
                  {row(
                    <>
                      <b>{formatDayMonth(s!.date)}</b> · Тренировка {s!.workout}
                      {(s!.isCalibration || s!.isDeload) && <span className="block text-xs text-muted">{s!.isCalibration ? 'подбор веса' : 'разгрузка'}</span>}
                    </>,
                    <>{min} мин · {formatInt(Math.round(v / 100))} кг</>,
                    () => setOpen({ gym: s! }),
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-muted">Тап по записи — подходы и удаление ошибочной тренировки.</p>
        </Card>
      )}
      <HistorySheet item={open} sets={sets} onClose={() => setOpen(null)} />
    </section>
  );
}
