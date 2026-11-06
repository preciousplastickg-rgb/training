// Прогресс · Сила — макет BProgressStrength (REDESIGN 4): лаймовая плашка «N рекордов»,
// список упражнений со спарклайном и лаймовой меткой прироста e1RM; ниже — нагрузка мышц за неделю (SPEC 6.4).

import { Dumbbell } from 'lucide-react';
import { useMemo, useState } from 'react';
import { MuscleMapPair, type MuscleColors } from '../../components/body/MuscleMap';
import { LineChart, Sparkline } from '../../components/charts/Charts';
import { EmptyState } from '../../components/EmptyState';
import { Sheet } from '../../components/Sheet';
import { Caps, Card } from '../../components/ui';
import { EXERCISES, MUSCLE_NAMES } from '../../data/exercises';
import { PROGRAM_START } from '../../data/program';
import { addDays, diffDays } from '../../domain/dates';
import { formatDayMonth, formatKg, formatScaled, pluralRu } from '../../domain/format';
import { sessionDates } from '../../domain/history';
import { ALL_MUSCLES, LOAD_COLORS, loadLevel, underloaded, weeklyLoad } from '../../domain/load';
import { e1rmSeries, recordCount, repRecords, workWeightSeries } from '../../domain/records';
import { useAllSets, useSessions } from '../../hooks/useData';
import { useToday } from '../../hooks/useToday';

const LEVEL_LABEL = ['0', '1–5', '6–9', '10–20', '> 20'];

export function StrengthTab() {
  const today = useToday();
  const sets = useAllSets();
  const sessions = useSessions();
  const [open, setOpen] = useState<string | null>(null);
  // Разгрузки — плановые 80%: в графике силы они выглядели бы как откат (−19%), поэтому без них.
  const dates = useMemo(() => sessionDates(sessions.filter((s) => !s.isCalibration && !s.isDeload)), [sessions]);
  const records = useMemo(() => recordCount(sets, sessions), [sets, sessions]);
  const load = useMemo(() => weeklyLoad(sets, sessions, today), [sets, sessions, today]);
  const colors: MuscleColors = Object.fromEntries(ALL_MUSCLES.map((m) => [m, LOAD_COLORS[loadLevel(load[m])]]));
  const weak = underloaded(load);
  const over = ALL_MUSCLES.filter((m) => loadLevel(load[m]) === 4);
  const anyLoad = ALL_MUSCLES.some((m) => load[m] > 0);

  const list = EXERCISES.map((e) => {
    const mine = sets.filter((s) => s.exerciseId === e.id && s.kind === 'work' && dates.has(s.sessionId));
    const series = e1rmSeries(mine, dates);
    // Последний рабочий подход: лучший вес последней сессии.
    const lastDate = series[series.length - 1]?.date;
    const lastSets = lastDate ? mine.filter((s) => dates.get(s.sessionId) === lastDate) : [];
    const top = lastSets.sort((a, b) => b.weight - a.weight || b.reps - a.reps)[0];
    return { e, series, top, lastDate };
  }).filter((x) => x.series.length > 0);

  return (
    <div className="flex flex-col gap-3">
      <section className="flex items-center gap-4 rounded-[30px] bg-primary p-5 text-on-primary">
        <span className="font-display text-[52px] leading-[56px] font-bold tabular-nums">{records}</span>
        <span className="flex flex-col">
          <span className="text-[17px] font-extrabold">
            {pluralRu(records, 'рекорд', 'рекорда', 'рекордов')} с {formatDayMonth(PROGRAM_START)}
          </span>
          <span className="text-sm font-semibold text-[#3E4A12]">{records > 0 ? 'сила растёт на дефиците — так и надо' : 'первые тренировки — точка отсчёта'}</span>
        </span>
      </section>

      <Card className="overflow-hidden rounded-[28px]! p-0!">
        <div className="flex justify-between px-[18px] pt-3.5 pb-2">
          <Caps>Упражнение</Caps>
          <Caps>e1RM · с начала</Caps>
        </div>
        {list.length === 0 ? (
          <div className="px-4 pb-4">
            <EmptyState icon={Dumbbell} text="Заверши тренировку — появятся графики силы" />
          </div>
        ) : (
          <ul>
            {list.map(({ e, series, top, lastDate }) => {
              const first = series[0]!.value;
              const last = series[series.length - 1]!.value;
              const delta = last - first;
              return (
                <li key={e.id}>
                  <button type="button" onClick={() => setOpen(e.id)} className="flex min-h-[70px] w-full items-center gap-3 border-t border-line px-[18px] text-left active:bg-track">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[15px] font-extrabold">{e.name}</span>
                      <span className="text-[13px] text-muted tabular-nums">
                        {top ? `${formatKg(top.weight, false)} × ${top.reps} · ` : ''}
                        {lastDate === today ? 'сегодня' : formatDayMonth(lastDate!)}
                      </span>
                    </span>
                    <Sparkline values={series.map((p) => p.value)} width={72} height={30} color="var(--ink)" label={`e1RM: ${e.name}`} />
                    <span className="flex w-[62px] flex-col items-end gap-0.5">
                      <span className="font-display text-[15px] font-bold tabular-nums">{formatScaled(last, 100, 1)}</span>
                      <span className={`rounded-full px-1.5 py-px text-xs font-extrabold tabular-nums ${delta >= 0 ? 'bg-primary text-on-primary' : 'bg-track text-muted'}`}>
                        {delta >= 0 ? '+' : '−'}
                        {formatScaled(Math.abs(delta), 100, 1)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="rounded-[28px]!">
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 className="font-display text-[17px] font-bold">Нагрузка</h2>
          <span className="text-[13px] text-muted">рабочие подходы за 7 дней</span>
        </div>
        <MuscleMapPair colors={colors} legend={false} width={120} />
        <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] font-semibold text-muted">
          {LOAD_COLORS.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              <i className="h-3 w-3 rounded" style={{ background: c }} /> {LEVEL_LABEL[i]}
              {i === 4 ? ' перебор' : ''}
            </span>
          ))}
        </div>
        {anyLoad ? (
          <>
            <p className="mt-3 text-sm">
              Недогружены: <b>{weak.map((m) => `${MUSCLE_NAMES[m].toLowerCase()} (${fmtSets(load[m])})`).join(', ')}</b>
            </p>
            {over.length > 0 && <p className="mt-1 text-sm text-warn">Перебор: {over.map((m) => MUSCLE_NAMES[m].toLowerCase()).join(', ')}</p>}
          </>
        ) : (
          <p className="mt-3 text-center text-sm text-muted">За последние 7 дней тренировок не было — карта заполнится после первой</p>
        )}
        <p className="mt-1 text-xs text-muted">Основная мышца — 1 подход, помогающая — 0,5.</p>
      </Card>
      {open && <ExerciseDetail id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

const fmtSets = (n: number) => formatScaled(Math.round(n * 10), 10, 1);

function ExerciseDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const sets = useAllSets();
  const sessions = useSessions();
  const ex = EXERCISES.find((e) => e.id === id)!;
  const dates = sessionDates(sessions.filter((s) => !s.isCalibration));
  const mine = sets.filter((s) => s.exerciseId === id && dates.has(s.sessionId));
  const e1 = e1rmSeries(mine, dates);
  const ww = workWeightSeries(mine, dates);
  const from = ww[0]?.date ?? e1[0]?.date ?? '';
  const n = from ? diffDays(from, ww[ww.length - 1]?.date ?? from) : 0;
  const recs = repRecords(mine);
  return (
    <Sheet open title={ex.name} kicker="Сила" onClose={onClose}>
      <div className="flex flex-col gap-3 pb-2">
        <Card className="rounded-[26px]!">
          {from && (
            <LineChart
              ariaLabel={`Рабочий вес и e1RM: ${ex.name}`}
              series={[
                { label: 'Рабочий вес', kind: 'line', color: 'var(--ink)', points: ww.map((p) => ({ x: diffDays(from, p.date), y: p.value })) },
                { label: 'e1RM', kind: 'line', color: 'var(--energy)', width: 2, points: e1.map((p) => ({ x: diffDays(from, p.date), y: p.value })) },
              ]}
              xLabels={[0, n].map((x) => ({ x, label: formatDayMonth(addDays(from, x)) }))}
              yFormat={(v) => formatScaled(v, 100, 0)}
            />
          )}
          <div className="mt-1 flex gap-4 text-xs font-semibold text-muted">
            <span className="flex items-center gap-1"><i className="h-0.5 w-4 bg-ink" /> рабочий вес</span>
            <span className="flex items-center gap-1"><i className="h-0.5 w-4 bg-energy" /> e1RM (Эпли)</span>
          </div>
        </Card>
        <Card className="rounded-[26px]! py-1!">
          <div className="flex justify-between py-2.5">
            <Caps>Повторы</Caps>
            <Caps>Лучший вес</Caps>
          </div>
          {recs.map((r) => (
            <div key={r.reps} className="flex min-h-12 items-center justify-between border-t border-line text-[15px]">
              <span className="text-muted">{r.reps}+</span>
              <span className="font-extrabold tabular-nums">{formatKg(r.weight)}</span>
            </div>
          ))}
        </Card>
      </div>
    </Sheet>
  );
}
