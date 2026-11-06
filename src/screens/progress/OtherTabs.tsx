import { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart } from '../../components/charts/Charts';
import { Card, SectionTitle } from '../../components/ui';
import { DEFAULT_SETTINGS } from '../../db/db';
import { PROGRAM_END, PROGRAM_START } from '../../data/program';
import { addDays, diffDays, isoWeekday, weekStart } from '../../domain/dates';
import { dayStatuses, disciplineSummary, gymDone, type DayStatus } from '../../domain/discipline';
import { formatDayMonth, formatInt } from '../../domain/format';
import { dayTargets, dayTotals, nutritionInTarget } from '../../domain/nutrition';
import { gymDatesOf, planDays } from '../../domain/program';
import { useAdjustments, useAllFoodLog, useAllSets, useFoods, usePool, useSessions, useSettings, useSlots } from '../../hooks/useData';
import { useToday } from '../../hooks/useToday';

// ---------- Питание ----------

export function NutritionTab() {
  const today = useToday();
  const logs = useAllFoodLog();
  const foods = useFoods();
  const adjustments = useAdjustments();
  const settings = useSettings() ?? DEFAULT_SETTINGS;
  const map = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
  const data = useMemo(() => {
    const byDate = new Map<string, typeof logs>();
    for (const l of logs) byDate.set(l.date, [...(byDate.get(l.date) ?? []), l]);
    const first = [...byDate.keys()].sort()[0];
    if (!first) return null;
    const weeks: { label: string; value: number; target: number; ok: boolean }[] = [];
    let proteinOk = 0;
    let inTarget = 0;
    let days = 0;
    for (let w = weekStart(first < PROGRAM_START ? first : PROGRAM_START); w <= today; w = addDays(w, 7)) {
      let sum = 0;
      let tsum = 0;
      let n = 0;
      for (let i = 0; i < 7; i++) {
        const d = addDays(w, i);
        if (d > today) break;
        const dl = byDate.get(d);
        if (!dl) continue;
        const total = dayTotals(dl, map).total;
        const t = dayTargets(d, adjustments, settings);
        sum += total.kcal;
        tsum += t.kcal;
        n++;
        days++;
        if (total.p >= t.protein * 9) proteinOk++;
        if (nutritionInTarget(total, t)) inTarget++;
      }
      const value = n ? Math.round(sum / n) : 0;
      const target = n ? Math.round(tsum / n) : dayTargets(w, adjustments, settings).kcal;
      weeks.push({ label: formatDayMonth(w).split(' ')[0]!, value, target, ok: n > 0 && Math.abs(value - target) <= target * 0.1 });
    }
    return { weeks: weeks.slice(-12), proteinOk, inTarget, days };
  }, [logs, map, adjustments, settings, today]);

  if (!data) return <Card><p className="py-6 text-center text-muted">Запиши еду — появится статистика по неделям</p></Card>;
  return (
    <div className="flex flex-col gap-3">
      <Card>
        <SectionTitle>Средние калории по неделям</SectionTitle>
        <BarChart
          ariaLabel="Средние калории по неделям против цели"
          bars={data.weeks.map((w) => ({ label: w.label, value: w.value, ok: w.ok }))}
          target={data.weeks.map((w) => ({ value: w.target, label: String(w.target) }))}
          format={(v) => formatInt(v)}
        />
        <div className="mt-1 flex gap-4 text-xs text-muted">
          <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded bg-progress" /> в цели ±10%</span>
          <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded bg-energy" /> мимо</span>
          <span className="flex items-center gap-1"><i className="h-0.5 w-4 border-t-2 border-dashed border-ink" /> цель</span>
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-2">
        <Card>
          <p className="text-xs text-muted">Белок в цели</p>
          <p className="text-2xl font-semibold tabular-nums text-protein">{Math.round((data.proteinOk / Math.max(1, data.days)) * 100)}%</p>
          <p className="text-xs text-muted">{data.proteinOk} из {data.days} дней</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Дни в цели</p>
          <p className="text-2xl font-semibold tabular-nums text-accent">{Math.round((data.inTarget / Math.max(1, data.days)) * 100)}%</p>
          <p className="text-xs text-muted">ккал ±10% и белок ≥ 90%</p>
        </Card>
      </div>
    </div>
  );
}

// ---------- Дисциплина ----------

const STATUS_COLOR: Record<DayStatus, string> = {
  gym: 'var(--progress)',
  pool: 'var(--protein)',
  rest: 'var(--load-1)',
  missed: 'var(--energy)',
  moved: 'var(--surface-2)',
  pending: 'var(--track)',
  future: 'var(--track)',
};

export function DisciplineTab() {
  const today = useToday();
  const sessions = useSessions();
  const sets = useAllSets();
  const pool = usePool();
  const slots = useSlots();
  const settings = useSettings() ?? DEFAULT_SETTINGS;
  const { plans, statuses, summary } = useMemo(() => {
    const plans = planDays(PROGRAM_END, gymDatesOf(sessions));
    const gym = gymDone(sessions, sets, slots, settings);
    const statuses = dayStatuses(plans, gym, pool, today);
    return { plans, statuses, summary: disciplineSummary(plans, statuses) };
  }, [sessions, sets, pool, slots, settings, today]);

  const startMonday = weekStart(PROGRAM_START);
  const weeks = Math.ceil((diffDays(startMonday, PROGRAM_END) + 1) / 7);
  const CELL = 12;
  const GAP = 3;
  const left = 18;
  const top = 16;
  const [picked, setPicked] = useState<string | null>(null);
  // Карта шире экрана: открываем её на текущей неделе, а не на ноябре.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const w = Math.floor(Math.max(0, diffDays(startMonday, today)) / 7);
    el.scrollLeft = Math.max(0, left + (w + 1) * (CELL + GAP) - el.clientWidth);
  }, [today, startMonday]);
  const pickedStatus = picked ? (statuses.get(picked) ?? 'future') : null;
  const months: { x: number; label: string }[] = [];
  for (let w = 0; w < weeks; w++) {
    const d = addDays(startMonday, w * 7);
    const prev = addDays(d, -7);
    if (w === 0 || d.slice(5, 7) !== prev.slice(5, 7)) months.push({ x: left + w * (CELL + GAP), label: formatDayMonth(addDays(d, 6)).split(' ')[1]!.slice(0, 3) });
  }
  return (
    <div className="flex flex-col gap-3">
      <Card>
        <p className="text-lg font-semibold">
          Выполнено {summary.done} из {summary.planned} тренировок · серия {summary.streak} {plural(summary.streak)}
        </p>
        <div ref={scrollRef} className="mt-3 overflow-x-auto pb-1">
          <svg
            width={left + weeks * (CELL + GAP)}
            height={top + 7 * (CELL + GAP)}
            role="img"
            aria-label="Тепловая карта дисциплины"
            onClick={(e) => {
              const d = (e.target as SVGElement).getAttribute('data-date');
              setPicked((p) => (d && d !== p ? d : null));
            }}
          >
            {months.map((m) => (
              <text key={m.x} x={m.x} y={10} fontSize={10} fill="var(--muted)">
                {m.label}
              </text>
            ))}
            {['пн', '', 'ср', '', 'пт', '', 'вс'].map((d, i) => (
              <text key={i} x={0} y={top + i * (CELL + GAP) + 10} fontSize={9} fill="var(--muted)">
                {d}
              </text>
            ))}
            {plans.map((p) => {
              const w = Math.floor(diffDays(startMonday, p.date) / 7);
              const row = isoWeekday(p.date) - 1;
              const s = statuses.get(p.date) ?? 'future';
              return (
                <rect
                  key={p.date}
                  data-date={p.date}
                  x={left + w * (CELL + GAP)}
                  y={top + row * (CELL + GAP)}
                  width={CELL}
                  height={CELL}
                  rx={3}
                  fill={STATUS_COLOR[s]}
                  opacity={s === 'future' ? 0.5 : 1}
                  stroke={p.date === today || p.date === picked ? 'var(--ink)' : undefined}
                  strokeWidth={p.date === picked ? 2 : p.date === today ? 1.5 : undefined}
                >
                  <title>{`${formatDayMonth(p.date)}: ${STATUS_TEXT[s]}`}</title>
                </rect>
              );
            })}
          </svg>
        </div>
        <p className="mt-1 min-h-5 text-sm" role="status">
          {picked && pickedStatus ? (
            <>
              <b>{formatDayMonth(picked)}</b> · {STATUS_TEXT[pickedStatus]}
            </>
          ) : (
            <span className="text-xs text-muted">Тап по клетке — что было в этот день</span>
          )}
        </p>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
          {(['gym', 'pool', 'rest', 'missed', 'moved'] as const).map((s) => (
            <span key={s} className="flex items-center gap-1">
              <i className="h-3 w-3 rounded" style={{ background: STATUS_COLOR[s] }} /> {STATUS_TEXT[s]}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}

const STATUS_TEXT: Record<DayStatus, string> = {
  gym: 'зал',
  pool: 'бассейн',
  rest: 'отдых',
  missed: 'пропуск',
  moved: 'перенесено',
  pending: 'сегодня',
  future: 'впереди',
};

function plural(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'день';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'дня';
  return 'дней';
}
