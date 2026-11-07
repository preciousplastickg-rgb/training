// Вкладка «Тренировка» — макет BWorkout (REDESIGN 4): чёрная карточка со списком упражнений и CTA,
// «Эта неделя» — 7 строк со статусом, ссылка «Календарь» → месячный вид (SPEC 6.9) в шторке, история.

import { ChevronRight, History, Play, Waves } from 'lucide-react';
import { useMemo, useState } from 'react';
import { navigate } from '../app/router';
import { unlockAudio } from '../app/sound';
import { ExerciseSheet } from '../components/ExerciseSheet';
import { ScreenHeader } from '../components/ScreenHeader';
import { Sheet } from '../components/Sheet';
import { Button, Caps, Card, HeroCard, SectionTitle } from '../components/ui';
import { DEFAULT_SETTINGS } from '../db/db';
import { startSession } from '../db/repo';
import type { PoolSession, WorkoutSession } from '../db/types';
import { calendarDays } from '../domain/calendar';
import { addDays, weekStart } from '../domain/dates';
import { gymDone } from '../domain/discipline';
import { formatDayMonth, formatKg, formatInt, NBSP } from '../domain/format';
import { suggestionFor } from '../domain/history';
import { deloadFor, estimateMinutes, gymDatesOf, nextWorkout, phaseWeek, planForDate, planOptionsOf, workoutPlan, type PlannedExercise } from '../domain/program';
import { volume } from '../domain/records';
import { monthStats, weekRows, type WeekRow } from '../domain/week';
import { PROGRAM_START } from '../data/program';
import { useActiveSession, useAllSets, useBody, usePool, useSessions, useSettings, useSlots } from '../hooks/useData';
import { useToday } from '../hooks/useToday';
import { EmptyState } from '../components/EmptyState';
import { CalendarCard } from './workout/CalendarCard';
import { HistorySheet, type HistoryItem } from './workout/HistorySheet';

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

export function WorkoutScreen() {
  const date = useToday();
  const settings = useSettings() ?? DEFAULT_SETTINGS;
  const slots = useSlots();
  const sessions = useSessions();
  const sets = useAllSets();
  const pool = usePool();
  const body = useBody();
  const active = useActiveSession();
  const [info, setInfo] = useState<string | null>(null);
  // null — закрыт, '' — открыт на текущем месяце, дата — открыт сразу на этом дне.
  const [calendar, setCalendar] = useState<string | null>(null);
  const auto = nextWorkout(sessions);
  const [override, setOverride] = useState<'A' | 'B' | null>(null);
  const workout = override ?? auto;
  const beforeStart = date < PROGRAM_START;
  const isDeload = deloadFor(date) !== null;
  const plan = useMemo(() => workoutPlan(workout, date, slots, settings), [workout, date, slots, settings]);
  const pw = phaseWeek(date);
  const dayPlan = planForDate(date, gymDatesOf(sessions), planOptionsOf(settings));
  const doneToday = sessions.some((s) => s.date === date && s.finishedAt !== undefined && !s.isCalibration);

  const week = useMemo(() => weekRows(date, sessions, sets, pool, slots, settings, body), [date, sessions, sets, pool, slots, settings, body]);
  const month = date.slice(0, 7);
  const stats = useMemo(() => {
    const [y, m] = month.split('-').map(Number) as [number, number];
    const first = `${month}-01`;
    const end = addDays(m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`, -1);
    const days = calendarDays(weekStart(first), end, date, sessions, gymDone(sessions, sets, slots, settings), pool, planOptionsOf(settings));
    return monthStats(days, month, date);
  }, [month, date, sessions, sets, slots, settings, pool]);

  const start = async (calibration: boolean) => {
    unlockAudio();
    await startSession({ workout, isDeload, isCalibration: calibration });
    navigate('session');
  };

  const kicker = beforeStart ? 'Подбор веса' : dayPlan.kind === 'gym' && !doneToday ? (isDeload ? 'Сегодня · разгрузка' : 'Сегодня') : isDeload ? 'Следующая · разгрузка' : 'Следующая';

  return (
    <>
      <ScreenHeader title="Тренировка" subtitle={pw ? `Фаза ${pw.phase.n} · ${pw.phase.name}` : beforeStart ? 'Подготовка' : 'Программа завершена'} />
      <div className="flex flex-col gap-3 px-4 pb-6">
        {active && (
          <HeroCard className="flex flex-col gap-4 rounded-[30px]! px-5! pt-[22px]! pb-5!">
            <div className="flex flex-col gap-1.5">
              <Caps className="text-primary!">{active.date < date ? 'Не завершена' : 'Идёт'}</Caps>
              <h2 className="font-display text-[30px] leading-9 font-bold">Тренировка {active.workout}</h2>
              <p className="text-[15px] text-muted-on-ink">{active.date < date ? `Начата ${formatDayMonth(active.date)}` : 'Продолжить с того же места'}</p>
            </div>
            <Button size="lg" className="w-full" onClick={() => navigate('session')}>
              Продолжить <Play size={18} fill="currentColor" aria-hidden />
            </Button>
          </HeroCard>
        )}

        {!active && slots.length > 0 && (
          <HeroCard className="flex flex-col gap-1.5 rounded-[30px]! px-5! pt-[22px]! pb-5!">
            <div className="mb-2.5 flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <Caps className="text-primary!">{kicker}</Caps>
                <span className="text-sm whitespace-nowrap text-muted-on-ink">≈ {estimateMinutes(plan)} мин</span>
              </div>
              <h2 className="font-display text-[30px] leading-9 font-bold">Тренировка {workout}</h2>
            </div>
            <PlanList plan={plan} sets={sets} sessions={sessions} isDeload={isDeload} calibration={beforeStart} onInfo={setInfo} />
            {beforeStart ? (
              <div className="mt-3.5 flex flex-col gap-2">
                <Button size="lg" className="w-full" onClick={() => void start(true)}>
                  Пробная тренировка: подбор веса
                </Button>
                <p className="text-center text-[13px] text-muted-on-ink">Вес вводишь сам. Возьми такой, с которым легко сделаешь 12.</p>
              </div>
            ) : (
              <Button size="lg" className="mt-3.5 w-full" onClick={() => void start(false)}>
                Начать
              </Button>
            )}
            <button
              type="button"
              onClick={() => setOverride(override ? null : auto === 'A' ? 'B' : 'A')}
              className="mt-1 min-h-11 text-sm font-bold text-muted-on-ink underline underline-offset-2"
            >
              {override ? `Вернуть тренировку ${auto}` : `Показать тренировку ${auto === 'A' ? 'B' : 'A'}`}
            </button>
          </HeroCard>
        )}

        <div className="flex items-baseline justify-between px-1.5 pt-2.5">
          <h2 className="font-display text-lg font-bold">Эта неделя</h2>
          <button type="button" onClick={() => setCalendar('')} className="min-h-11 text-sm font-bold underline underline-offset-2">
            Календарь
          </button>
        </div>
        <WeekList rows={week} onPick={(d) => setCalendar(d)} />
        {(stats.gymPlanned > 0 || stats.poolPlanned > 0) && (
          <p className="px-1.5 text-sm text-muted">
            {MONTHS[Number(month.slice(5)) - 1]}: зал {stats.gymDone} из {stats.gymPlanned} · бассейн {stats.poolDone} из {stats.poolPlanned}
          </p>
        )}

        <SessionHistory sessions={sessions} />
      </div>
      <ExerciseSheet exerciseId={info} onClose={() => setInfo(null)} />
      <Sheet open={calendar !== null} title="Календарь" kicker="Зал, бассейн и отдых по дням" onClose={() => setCalendar(null)}>
        <CalendarCard initialDate={calendar || null} />
      </Sheet>
    </>
  );
}

export function setsLabel(p: PlannedExercise): string {
  const { repMin, repMax } = p.slot;
  const unit = p.exercise.unit === 'seconds' ? ' с' : '';
  const side = p.exercise.perSide ? (p.exercise.id === 'db_row' ? ' на руку' : ' на ногу') : '';
  return `${p.sets} × ${repMin}–${repMax}${unit}${side}`;
}

/** Строки упражнений в чёрной карточке: номер лаймом, название, рабочий вес, подходы × повторы. Тап — «Как делать». */
function PlanList({
  plan, sets, sessions, isDeload, calibration, onInfo,
}: {
  plan: PlannedExercise[];
  sets: ReturnType<typeof useAllSets>;
  sessions: WorkoutSession[];
  isDeload: boolean;
  calibration: boolean;
  onInfo: (id: string) => void;
}) {
  return (
    <ul className="flex flex-col">
      {plan.map((p, i) => {
        const s = suggestionFor(p, sets, sessions, { isDeload, isCalibration: calibration });
        const value =
          p.exercise.unit === 'kg'
            ? s.weight === null
              ? 'подбери'
              : formatKg(s.weight)
            : p.exercise.unit === 'seconds'
              ? `${s.targets[0]}${NBSP}с`
              : `${s.targets[0]} раз`;
        const range = `${p.sets} × ${p.slot.repMin}–${p.slot.repMax}${p.exercise.unit === 'seconds' ? ' с' : ''}`;
        return (
          <li key={p.slot.id}>
            <button
              type="button"
              onClick={() => onInfo(p.exercise.id)}
              aria-label={`${p.exercise.name}: как делать`}
              className="flex min-h-[46px] w-full items-center gap-3 border-t border-[#26282C] py-1.5 text-left active:opacity-70"
            >
              <span className="font-display w-[22px] shrink-0 text-[13px] font-semibold text-primary tabular-nums">{String(i + 1).padStart(2, '0')}</span>
              <span className="min-w-0 flex-1 text-[15px] leading-5 font-semibold">{p.exercise.name}</span>
              <span className="text-[15px] font-extrabold tabular-nums">{value}</span>
              <span className="shrink-0 text-right text-[13px] whitespace-nowrap text-muted-on-ink tabular-nums">{range}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

const PILL: Record<WeekRow['status'], { text: string; cls: string }> = {
  done: { text: 'сделано', cls: 'bg-track text-ink' },
  today: { text: 'сегодня', cls: 'bg-primary text-on-primary' },
  plan: { text: 'план', cls: 'text-muted' },
  optional: { text: 'по желанию', cls: 'text-muted' },
  rest: { text: 'отдых', cls: 'text-muted' },
  missed: { text: 'пропуск', cls: 'bg-energy text-white' },
  prep: { text: 'до старта', cls: 'text-muted' },
  finished: { text: 'финиш', cls: 'text-muted' },
};

/** «Эта неделя»: 7 строк по 60 px — день, что сделано или по плану, статус-таблетка; сегодня — на лаймовой подложке. Тап — день в календаре. */
function WeekList({ rows, onPick }: { rows: WeekRow[]; onPick: (date: string) => void }) {
  return (
    <Card className="overflow-hidden p-0!">
      <ol aria-label="Эта неделя">
        {rows.map((r) => {
          const pill = PILL[r.status];
          return (
            <li key={r.date} className="border-t border-line first:border-t-0" aria-current={r.today ? 'date' : undefined}>
              <button
                type="button"
                onClick={() => onPick(r.date)}
                className="flex min-h-[60px] w-full items-center gap-3.5 px-[18px] text-left active:opacity-70"
                style={r.today ? { background: 'color-mix(in srgb, var(--lime) 18%, var(--surface))' } : undefined}
              >
                <span className="flex w-[34px] flex-col">
                  <span className="text-xs font-bold text-muted">{r.name}</span>
                  <span className="font-display text-[17px] font-bold tabular-nums">{r.day}</span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-bold">{r.title}</span>
                  {r.sub && <span className="truncate text-[13px] text-muted">{r.sub}</span>}
                </span>
                <span className={`rounded-full px-2.5 py-[5px] text-xs font-extrabold whitespace-nowrap ${pill.cls}`}>{pill.text}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </Card>
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
  // Дата — заголовком, вид записи — второй строкой: «30 декабря · Тренировка A» в одну строку не помещается.
  const row = (title: string, sub: React.ReactNode, label: string, right: React.ReactNode, onClick: () => void) => (
    <button type="button" onClick={onClick} aria-label={`${title} · ${label}`} className="flex min-h-14 w-full items-center justify-between gap-3 py-1.5 text-left active:opacity-70">
      <span className="flex min-w-0 flex-col">
        <b className="text-[15px] leading-5">{title}</b>
        <span className="flex items-center gap-1.5 text-[13px] leading-[18px] text-muted">{sub}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1 text-sm whitespace-nowrap text-muted tabular-nums">
        {right}
        <ChevronRight size={16} aria-hidden />
      </span>
    </button>
  );
  return (
    <section className="mt-2">
      <SectionTitle>История</SectionTitle>
      {items.length === 0 ? (
        <EmptyState icon={History} text="Заверши первую тренировку или запиши бассейн — они появятся здесь" />
      ) : (
        <Card className="px-5! py-1!">
          <ul className="divide-y divide-line">
            {items.map(({ gym: s, pool: p }) => {
              if (p) {
                return (
                  <li key={p.id}>
                    {row(
                      formatDayMonth(p.date),
                      <>
                        Бассейн <Waves size={14} className="text-protein" aria-hidden />
                      </>,
                      'Бассейн',
                      <>{p.minutes} мин{p.meters ? ` · ${formatInt(p.meters)} м` : ''}</>,
                      () => setOpen({ pool: p }),
                    )}
                  </li>
                );
              }
              const v = volume(sets.filter((x) => x.sessionId === s!.id));
              const min = Math.round(((s!.finishedAt ?? s!.startedAt) - s!.startedAt) / 60000);
              const kind = `Тренировка ${s!.workout}${s!.isCalibration ? ' · подбор веса' : s!.isDeload ? ' · разгрузка' : ''}`;
              return (
                <li key={s!.id}>
                  {row(
                    formatDayMonth(s!.date),
                    kind,
                    kind,
                    <>{min} мин · {formatInt(Math.round(v / 100))} кг</>,
                    () => setOpen({ gym: s! }),
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <HistorySheet item={open} sets={sets} onClose={() => setOpen(null)} />
    </section>
  );
}
