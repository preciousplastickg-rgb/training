import { ChevronLeft, ChevronRight, Waves } from 'lucide-react';
import { useMemo, useState } from 'react';
import { openSheet } from '../../app/uiStore';
import { Sheet } from '../../components/Sheet';
import { Button, Caps, Card, Chip } from '../../components/ui';
import { CALIBRATION_DATE, PROGRAM_END, REST_DAY_STEPS } from '../../data/program';
import { DEFAULT_SETTINGS, updateSettings } from '../../db/db';
import type { DayOverride } from '../../db/types';
import { calendarDays, type CalendarDay } from '../../domain/calendar';
import { HistorySheet, type HistoryItem } from './HistorySheet';
import { addDays, weekStart } from '../../domain/dates';
import { gymDone } from '../../domain/discipline';
import { formatInt, formatWeekdayDate } from '../../domain/format';
import { estimateMinutes, planOptionsOf, workoutPlan } from '../../domain/program';
import { volume } from '../../domain/records';
import { useAllSets, useBody, usePool, useSessions, useSettings, useSlots } from '../../hooks/useData';
import { useToday } from '../../hooks/useToday';

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const FEEL = ['тяжело', 'так себе', 'нормально', 'хорошо', 'отлично'];

const FIRST_MONTH = CALIBRATION_DATE.slice(0, 7);
const LAST_MONTH = PROGRAM_END.slice(0, 7);

function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const i = y * 12 + (m - 1) + n;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
}

/** Календарь тренировок: какой день зал A или B, бассейн, отдых; прошедшие — по факту. */
export function CalendarCard({ initialDate }: { initialDate?: string | null } = {}) {
  const today = useToday();
  const sessions = useSessions();
  const sets = useAllSets();
  const slots = useSlots();
  const pool = usePool();
  const settings = useSettings() ?? DEFAULT_SETTINGS;
  const clamp = (m: string) => (m < FIRST_MONTH ? FIRST_MONTH : m > LAST_MONTH ? LAST_MONTH : m);
  // Открыт тапом по дню недели — сразу этот день.
  const [month, setMonth] = useState(() => clamp((initialDate || today).slice(0, 7)));
  const [selected, setSelected] = useState<string | null>(initialDate || null);

  const first = `${month}-01`;
  const last = addDays(`${shiftMonth(month, 1)}-01`, -1);
  const gridStart = weekStart(first);
  const gridEnd = addDays(weekStart(last), 6);
  const days = useMemo(
    () => calendarDays(gridStart, gridEnd, today, sessions, gymDone(sessions, sets, slots, settings), pool, planOptionsOf(settings)),
    [gridStart, gridEnd, today, sessions, sets, slots, settings, pool],
  );
  const inMonth = days.filter((d) => d.date.startsWith(month));
  const gymCount = inMonth.filter((d) => d.status === 'gym').length;
  const poolCount = inMonth.filter((d) => d.status === 'pool').length;
  const day = days.find((d) => d.date === selected) ?? null;

  return (
    <Card>
      <div className="-mx-2 -mt-2 flex items-center">
        <button type="button" aria-label="Предыдущий месяц" disabled={month <= FIRST_MONTH} onClick={() => setMonth((m) => shiftMonth(m, -1))} className="flex h-11 w-11 items-center justify-center rounded-full active:bg-track disabled:opacity-30">
          <ChevronLeft size={22} />
        </button>
        <div className="flex-1 text-center">
          <h2 className="font-semibold">
            {MONTHS[Number(month.slice(5)) - 1]} {month.slice(0, 4)}
          </h2>
          <p className="text-xs text-muted">
            {gymCount || poolCount ? `Сделано: зал ${gymCount} · бассейн ${poolCount}` : 'Календарь тренировок'}
          </p>
        </div>
        <button type="button" aria-label="Следующий месяц" disabled={month >= LAST_MONTH} onClick={() => setMonth((m) => shiftMonth(m, 1))} className="flex h-11 w-11 items-center justify-center rounded-full active:bg-track disabled:opacity-30">
          <ChevronRight size={22} />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-7 text-center text-[11px] text-muted" aria-hidden>
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-y-1">
        {days.map((d) => (
          <DayCell key={d.date} d={d} today={today} outside={!d.date.startsWith(month)} onClick={() => setSelected(d.date)} />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
        <span className="flex items-center gap-1">
          <Mark kind="done">A</Mark> сделано
        </span>
        <span className="flex items-center gap-1">
          <Mark kind="plan">B</Mark> зал по плану
        </span>
        <span className="flex items-center gap-1">
          <Waves size={13} className="text-protein" aria-hidden /> бассейн
        </span>
        <span className="flex items-center gap-1">
          <i className="h-2 w-2 rounded-full bg-energy" /> пропуск
        </span>
        <span>→ перенос</span>
        <span>↓ разгрузка</span>
      </div>
      <p className="mt-1 text-[11px] text-muted">Впереди — если ходить по плану. Пропуск сдвигает зал на день, чередование A/B продолжается.</p>

      <DaySheet day={day} today={today} onClose={() => setSelected(null)} />
    </Card>
  );
}

function Mark({ kind, children }: { kind: 'done' | 'plan' | 'today'; children: React.ReactNode }) {
  const cls = kind === 'done' ? 'bg-primary text-on-primary' : 'bg-surface-2 text-ink';
  return <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-[11px] font-semibold ${cls}`}>{children}</span>;
}

function describe(d: CalendarDay): string {
  const parts: string[] = [];
  if (d.workout) parts.push(`зал ${d.workout}${d.projected ? ' по плану' : ''}`);
  if (d.pool.length) parts.push('бассейн');
  else if (d.plan.kind === 'pool') parts.push('бассейн по плану');
  else if (d.plan.kind === 'pool_optional') parts.push('бассейн по желанию');
  if (!parts.length) parts.push(d.plan.kind === 'rest' ? 'отдых' : '');
  if (d.status === 'missed') parts.push('пропуск');
  if (d.status === 'moved') parts.push('перенесено');
  if (d.plan.isDeload) parts.push('разгрузка');
  return parts.filter(Boolean).join(', ');
}

function DayCell({ d, today, outside, onClick }: { d: CalendarDay; today: string; outside: boolean; onClick: () => void }) {
  const isToday = d.date === today;
  const done = d.status === 'gym' || d.status === 'pool';
  const missed = d.status === 'missed';
  const poolDone = d.pool.length > 0;
  const poolPlanned = d.plan.kind === 'pool' || d.plan.kind === 'pool_optional';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${formatWeekdayDate(d.date)}: ${describe(d)}`}
      aria-current={isToday ? 'date' : undefined}
      className={`relative flex min-h-12 flex-col items-center justify-start gap-0.5 rounded-xl pt-1 active:bg-track ${outside ? 'opacity-35' : ''} ${isToday ? 'ring-2 ring-ink ring-inset' : ''}`}
    >
      <span className={`text-[13px] leading-none tabular-nums ${isToday ? 'font-semibold' : done ? 'text-ink' : 'text-muted'}`}>{Number(d.date.slice(8))}</span>
      <span className="flex h-5 items-center gap-0.5">
        {d.workout && (
          <Mark kind={d.session ? 'done' : 'plan'}>
            {d.workout}
            {d.plan.isDeload ? '↓' : ''}
          </Mark>
        )}
        {d.status === 'moved' && (
          <span className="text-[13px] text-muted" aria-hidden>
            →
          </span>
        )}
        {(poolDone || (poolPlanned && !d.workout)) && (
          <Waves
            size={15}
            aria-hidden
            className={poolDone ? 'text-protein' : d.plan.kind === 'pool' ? 'text-protein opacity-50' : 'text-muted opacity-50'}
            strokeWidth={poolDone ? 2.4 : 1.8}
          />
        )}
      </span>
      {missed && <i className="absolute top-1 right-1.5 h-1.5 w-1.5 rounded-full bg-energy" aria-hidden />}
    </button>
  );
}

const OVERRIDES: { v: DayOverride | 'auto'; label: string }[] = [
  { v: 'auto', label: 'По расписанию' },
  { v: 'gym', label: 'Зал' },
  { v: 'pool', label: 'Бассейн' },
  { v: 'rest', label: 'Отдых' },
];

function DaySheet({ day, today, onClose }: { day: CalendarDay | null; today: string; onClose: () => void }) {
  const sets = useAllSets();
  const slots = useSlots();
  const settings = useSettings() ?? DEFAULT_SETTINGS;
  const body = useBody();
  const [details, setDetails] = useState<HistoryItem | null>(null);
  if (!day) return null;
  const { plan } = day;
  const steps = body.find((b) => b.date === day.date)?.steps;
  const past = day.date <= today;
  const planned = day.workout && !day.session ? workoutPlan(day.workout, day.date, slots, settings) : [];
  const editable = day.date >= today && plan.kind !== 'prep' && plan.kind !== 'finished';
  const override = settings.dayOverrides?.[day.date] ?? 'auto';
  const setOverride = (v: DayOverride | 'auto') => {
    const next = { ...(settings.dayOverrides ?? {}) };
    if (v === 'auto') delete next[day.date];
    else next[day.date] = v;
    void updateSettings({ dayOverrides: next });
  };

  return (
    <Sheet open title={formatWeekdayDate(day.date)} onClose={onClose}>
      <div className="flex flex-col gap-3 px-1 pb-2">
        {editable && (
          <section>
            <Caps className="mb-2">Что в этот день</Caps>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="План на день">
              {OVERRIDES.map((o) => (
                <Chip key={o.v} active={override === o.v} onClick={() => setOverride(o.v)} role="radio" aria-checked={override === o.v}>
                  {o.label}
                </Chip>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted">Расписание на всю неделю — в настройках. Буквы A/B чередуются сами.</p>
          </section>
        )}
        <section className="rounded-[22px] bg-surface p-4">
          <Caps>План{plan.overridden ? ' · изменён вручную' : ''}</Caps>
          {plan.kind === 'gym' && day.workout && (
            <>
              <p className="mt-1 font-semibold">
                Тренировка {day.workout}
                {planned.length ? ` · ${planned.length} упражнений · ≈ ${estimateMinutes(planned)} мин` : ''}
              </p>
              <p className="text-sm text-muted">
                {[day.projected ? 'по чередованию' : '', plan.isDeload ? 'разгрузка: 2 подхода, вес × 0,8' : '', plan.makeup ? 'перенос с прошлого дня' : '']
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {planned.length > 0 && (
                <ul className="mt-2 text-sm">
                  {planned.map((p) => (
                    <li key={p.slot.id} className="py-0.5">
                      {p.exercise.name}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {plan.kind === 'gym' && !day.workout && <p className="mt-1 font-semibold">Зал</p>}
          {plan.pool && (
            <p className={plan.kind === 'gym' ? 'mt-2 text-sm' : 'mt-1 font-semibold'}>
              Бассейн{plan.pool.optional ? ' по желанию' : ''}: {plan.pool.text}
            </p>
          )}
          {plan.gymBlocked && <p className="text-sm text-muted">Зал переехал на завтра: вчера уже был зал.</p>}
          {plan.kind === 'rest' && <p className="mt-1 font-semibold">Отдых · {formatInt(REST_DAY_STEPS)} шагов</p>}
          {plan.kind === 'prep' && <p className="mt-1 font-semibold">Подготовка: пробная тренировка и стартовые замеры</p>}
          {plan.kind === 'finished' && <p className="mt-1 font-semibold">Программа завершена</p>}
        </section>

        {past && (
          <section className="rounded-[22px] bg-surface p-4">
            <Caps>Сделано</Caps>
            {day.session && (
              <button type="button" onClick={() => setDetails({ gym: day.session })} className="mt-1 flex min-h-11 w-full items-center gap-2 text-left">
                <span className="flex-1">
                  <b>Тренировка {day.session.workout}</b>
                  {day.session.isCalibration ? ' · подбор веса' : day.session.isDeload ? ' · разгрузка' : ''}
                  <span className="block text-sm text-muted">
                    {Math.round(((day.session.finishedAt ?? day.session.startedAt) - day.session.startedAt) / 60000)} мин ·{' '}
                    {formatInt(Math.round(volume(sets.filter((x) => x.sessionId === day.session!.id)) / 100))} кг
                  </span>
                </span>
                <ChevronRight size={16} className="text-muted" aria-hidden />
              </button>
            )}
            {day.pool.map((p) => (
              <button key={p.id} type="button" onClick={() => setDetails({ pool: p })} className="mt-1 flex min-h-11 w-full items-center gap-2 text-left">
                <span className="flex-1">
                  <b>Бассейн</b>
                  <span className="block text-sm text-muted">
                    {[`${p.minutes} мин`, p.meters ? `${formatInt(p.meters)} м` : '', p.feel ? FEEL[p.feel - 1] : ''].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <ChevronRight size={16} className="text-muted" aria-hidden />
              </button>
            ))}
            {steps ? (
              <p className="mt-1 flex min-h-11 items-center gap-1">
                <b>{formatInt(steps)} шагов</b>
                {plan.kind === 'rest' && <span className="text-sm text-muted">· цель {formatInt(REST_DAY_STEPS)}</span>}
              </p>
            ) : null}
            {(day.session || day.pool.length > 0) && <p className="mt-1 text-xs text-muted">Тап по записи — подробности и удаление.</p>}
            {!day.session && day.pool.length === 0 && !steps && (
              <p className="mt-1 text-sm text-muted">
                {day.status === 'missed' ? 'Пропущено.' : day.status === 'moved' ? 'Не состоялось — перенесено на следующий день.' : day.status === 'pending' ? 'Пока ничего — день ещё идёт.' : 'Ничего не записано.'}
              </p>
            )}
          </section>
        )}

        {past && (
          <Button
            variant="secondary"
            onClick={() => {
              onClose();
              openSheet('pool', { date: day.date === today ? undefined : day.date });
            }}
          >
            <Waves size={18} aria-hidden /> Записать бассейн{day.date === today ? '' : ' за этот день'}
          </Button>
        )}
      </div>
      <HistorySheet item={details} sets={sets} onClose={() => setDetails(null)} />
    </Sheet>
  );
}
