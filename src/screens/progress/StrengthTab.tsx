import { ChevronRight, Dumbbell } from 'lucide-react';
import { useMemo, useState } from 'react';
import { MuscleMapPair, type MuscleColors } from '../../components/body/MuscleMap';
import { LineChart, Sparkline } from '../../components/charts/Charts';
import { EmptyState } from '../../components/EmptyState';
import { Sheet } from '../../components/Sheet';
import { Card, SectionTitle } from '../../components/ui';
import { EXERCISES, MUSCLE_NAMES } from '../../data/exercises';
import { addDays, diffDays } from '../../domain/dates';
import { formatDayMonth, formatKg, formatScaled } from '../../domain/format';
import { sessionDates } from '../../domain/history';
import { ALL_MUSCLES, LOAD_COLORS, loadLevel, underloaded, weeklyLoad } from '../../domain/load';
import { e1rmSeries, repRecords, workWeightSeries } from '../../domain/records';
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
  const load = useMemo(() => weeklyLoad(sets, sessions, today), [sets, sessions, today]);
  const colors: MuscleColors = Object.fromEntries(ALL_MUSCLES.map((m) => [m, LOAD_COLORS[loadLevel(load[m])]]));
  const weak = underloaded(load);
  const over = ALL_MUSCLES.filter((m) => loadLevel(load[m]) === 4);

  const list = EXERCISES.map((e) => ({ e, series: e1rmSeries(sets.filter((s) => s.exerciseId === e.id), dates) })).filter((x) => x.series.length > 0);

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <SectionTitle>Нагрузка за неделю</SectionTitle>
        <MuscleMapPair colors={colors} legend={false} width={120} />
        <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-muted">
          {LOAD_COLORS.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              <i className="h-3 w-3 rounded" style={{ background: c }} /> {LEVEL_LABEL[i]}
              {i === 4 ? ' перебор' : ''}
            </span>
          ))}
        </div>
        <p className="mt-3 text-sm">
          Недогружены: <b>{weak.map((m) => `${MUSCLE_NAMES[m].toLowerCase()} (${fmtSets(load[m])})`).join(', ')}</b>
        </p>
        {over.length > 0 && <p className="mt-1 text-sm text-warn">Перебор: {over.map((m) => MUSCLE_NAMES[m].toLowerCase()).join(', ')}</p>}
        <p className="mt-1 text-xs text-muted">Рабочие подходы за 7 дней: основная мышца — 1, помогающая — 0,5.</p>
      </Card>

      <Card>
        <SectionTitle>Сила · e1RM</SectionTitle>
        {list.length === 0 ? (
          <EmptyState icon={Dumbbell} text="Заверши тренировку — появятся графики силы" />
        ) : (
          <ul className="divide-y divide-line">
            {list.map(({ e, series }) => {
              const best = Math.max(...series.map((p) => p.value));
              const first = series[0]!.value;
              const growth = Math.round(((series[series.length - 1]!.value - first) / first) * 100);
              return (
                <li key={e.id}>
                  <button type="button" onClick={() => setOpen(e.id)} className="flex min-h-14 w-full items-center gap-3 py-1 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{e.name}</span>
                      <span className="block text-xs text-muted">
                        лучший {formatScaled(best, 100, 1)} кг · {growth >= 0 ? '+' : ''}
                        {growth}%
                      </span>
                    </span>
                    <Sparkline values={series.map((p) => p.value)} width={64} label={`e1RM: ${e.name}`} />
                    <ChevronRight size={18} className="text-muted" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
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
    <Sheet open title={ex.name} onClose={onClose}>
      <div className="max-h-[75dvh] overflow-y-auto overscroll-contain px-2 pb-2">
        {from && (
          <LineChart
            ariaLabel={`Рабочий вес и e1RM: ${ex.name}`}
            series={[
              { label: 'Рабочий вес', kind: 'line', color: 'var(--accent)', points: ww.map((p) => ({ x: diffDays(from, p.date), y: p.value })) },
              { label: 'e1RM', kind: 'line', color: 'var(--energy)', width: 2, points: e1.map((p) => ({ x: diffDays(from, p.date), y: p.value })) },
            ]}
            xLabels={[0, n].map((x) => ({ x, label: formatDayMonth(addDays(from, x)) }))}
            yFormat={(v) => formatScaled(v, 100, 0)}
          />
        )}
        <div className="mt-1 flex gap-4 text-xs text-muted">
          <span className="flex items-center gap-1"><i className="h-0.5 w-4 bg-accent" /> рабочий вес</span>
          <span className="flex items-center gap-1"><i className="h-0.5 w-4 bg-energy" /> e1RM (Эпли)</span>
        </div>
        <h3 className="mt-4 mb-2 text-sm font-semibold text-muted">Рекорды</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted">
              <th className="py-1 font-normal">Повторы</th>
              <th className="py-1 font-normal">Лучший вес</th>
            </tr>
          </thead>
          <tbody>
            {recs.map((r) => (
              <tr key={r.reps} className="border-t border-line">
                <td className="py-2">{r.reps}+</td>
                <td className="py-2 font-semibold tabular-nums">{formatKg(r.weight)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Sheet>
  );
}

