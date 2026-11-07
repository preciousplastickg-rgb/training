// Прогресс · Питание и Режим — макет BDiscipline (REDESIGN 4): чёрная карточка «Выполнено / Серия»,
// тепловая карта вертикально (строка = неделя), «Питание в цели».

import { useMemo, useState } from 'react';
import { BarChart } from '../../components/charts/Charts';
import { Bar, Caps, Card, HeroCard } from '../../components/ui';
import { DEFAULT_SETTINGS } from '../../db/db';
import { PROGRAM_END, PROGRAM_START } from '../../data/program';
import { addDays, diffDays, weekStart } from '../../domain/dates';
import { bestStreak, dayStatuses, disciplineSummary, gymDone, type DayStatus } from '../../domain/discipline';
import { formatDayMonth, formatInt, pluralRu } from '../../domain/format';
import { nutritionStats } from '../../domain/nutrition';
import { dayTypeFor, gymDatesOf, planDays, planOptionsOf } from '../../domain/program';
import { useAdjustments, useAllFoodLog, useAllSets, useFoods, useLightWeeks, usePool, useSessions, useSettings, useSlots } from '../../hooks/useData';
import { useToday } from '../../hooks/useToday';

// ---------- Питание ----------

function useNutritionStats() {
  const today = useToday();
  const logs = useAllFoodLog();
  const foods = useFoods();
  const adjustments = useAdjustments();
  const settings = useSettings() ?? DEFAULT_SETTINGS;
  const sessions = useSessions();
  const pool = usePool();
  const lightWeeks = useLightWeeks();
  const map = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
  return useMemo(() => {
    const opts = planOptionsOf(settings, lightWeeks);
    return nutritionStats(logs, map, adjustments, settings, today, (d) => dayTypeFor(d, sessions, pool, opts));
  }, [logs, map, adjustments, settings, today, sessions, pool, lightWeeks]);
}

export function NutritionTab() {
  const data = useNutritionStats();
  if (!data) {
    return (
      <Card>
        <p className="py-6 text-center text-muted">Запиши еду — появится статистика по неделям</p>
      </Card>
    );
  }
  const weeks = data.weeks.slice(-12);
  return (
    <div className="flex flex-col gap-3">
      <Card className="rounded-[28px]!">
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 className="font-display text-[17px] font-bold">Калории</h2>
          <span className="text-[13px] text-muted">среднее за день по неделям</span>
        </div>
        <BarChart
          ariaLabel="Средние калории по неделям против цели"
          bars={weeks.map((w) => ({ label: formatDayMonth(w.start).split(' ')[0]!, value: w.value, ok: w.ok }))}
          target={weeks.map((w) => ({ value: w.target, label: String(w.target) }))}
          format={(v) => formatInt(v)}
        />
        <div className="mt-1 flex gap-4 text-xs font-semibold text-muted">
          <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded bg-progress" /> в цели ±10%</span>
          <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded bg-energy" /> мимо</span>
          <span className="flex items-center gap-1"><i className="h-0.5 w-4 border-t-2 border-dashed border-ink" /> цель</span>
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-2.5">
        <Card className="flex flex-col gap-1 rounded-3xl! p-3.5!">
          <Caps>Белок в цели</Caps>
          <span className="font-display text-[26px] leading-8 font-bold tabular-nums">{Math.round((data.proteinOk / Math.max(1, data.days)) * 100)}%</span>
          <span className="text-[13px] text-muted">
            {data.proteinOk} из {data.days} дней
          </span>
        </Card>
        <Card className="flex flex-col gap-1 rounded-3xl! p-3.5!">
          <Caps>Дни в цели</Caps>
          <span className="font-display text-[26px] leading-8 font-bold tabular-nums">{Math.round((data.inTarget / Math.max(1, data.days)) * 100)}%</span>
          <span className="text-[13px] text-muted">ккал ±10% и белок ≥ 90%</span>
        </Card>
      </div>
    </div>
  );
}

// ---------- Режим (дисциплина) ----------

const STATUS_BG: Record<DayStatus, string> = {
  gym: 'var(--ink)',
  pool: 'var(--protein)',
  rest: 'color-mix(in srgb, var(--ink) 16%, var(--surface))',
  missed: 'var(--energy)',
  moved: 'color-mix(in srgb, var(--ink) 8%, var(--surface))',
  pending: 'var(--track)',
  future: 'var(--track)',
};

const STATUS_TEXT: Record<DayStatus, string> = {
  gym: 'зал',
  pool: 'бассейн',
  rest: 'отдых',
  missed: 'пропуск',
  moved: 'перенесено',
  pending: 'сегодня',
  future: 'впереди',
};

const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

export function DisciplineTab() {
  const today = useToday();
  const sessions = useSessions();
  const sets = useAllSets();
  const pool = usePool();
  const slots = useSlots();
  const settings = useSettings() ?? DEFAULT_SETTINGS;
  const lightWeeks = useLightWeeks();
  const nutrition = useNutritionStats();
  const { plans, statuses, summary, best } = useMemo(() => {
    const plans = planDays(PROGRAM_END, gymDatesOf(sessions), undefined, planOptionsOf(settings, lightWeeks));
    const gym = gymDone(sessions, sets, slots, settings, lightWeeks);
    const statuses = dayStatuses(plans, gym, pool, today);
    return { plans, statuses, summary: disciplineSummary(plans, statuses), best: bestStreak(plans, statuses) };
  }, [sessions, sets, pool, slots, settings, today, lightWeeks]);
  const [picked, setPicked] = useState<string | null>(null);

  const startMonday = weekStart(PROGRAM_START);
  const weeks = Math.ceil((diffDays(startMonday, PROGRAM_END) + 1) / 7);
  const planByDate = new Map(plans.map((p) => [p.date, p]));
  const pct = summary.planned ? Math.round((summary.done / summary.planned) * 100) : 0;
  const pickedStatus = picked ? (statuses.get(picked) ?? 'future') : null;

  return (
    <div className="flex flex-col gap-3">
      <HeroCard className="grid grid-cols-2 gap-2.5 rounded-[30px]! px-[22px]! py-5!">
        <div className="flex flex-col gap-1">
          <Caps className="text-muted-on-ink!">Выполнено</Caps>
          <span className="font-display text-[32px] leading-9 font-bold text-primary tabular-nums">
            {summary.done}
            <span className="font-sans text-[15px] font-normal text-muted-on-ink"> / {summary.planned}</span>
          </span>
          <span className="text-[13px] text-muted-on-ink">{pct}% тренировок · зал и бассейн по плану</span>
        </div>
        <div className="flex flex-col gap-1">
          <Caps className="text-muted-on-ink!">Серия</Caps>
          <span className="font-display text-[32px] leading-9 font-bold tabular-nums">
            {summary.streak}
            <span className="font-sans text-[15px] font-normal text-muted-on-ink"> {pluralRu(summary.streak, 'день', 'дня', 'дней')}</span>
          </span>
          <span className="text-[13px] text-muted-on-ink">лучшая — {best}</span>
        </div>
      </HeroCard>

      <Card className="flex flex-col gap-3 rounded-[28px]! px-4! py-[18px]!">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="font-display text-base font-bold">
            {formatDayMonth(PROGRAM_START).replace(/ (\S{3})\S*$/, ' $1')} → {formatDayMonth(PROGRAM_END).replace(/ (\S{3})\S*$/, ' $1')}
          </h2>
          <span className="text-[13px] text-muted">{weeks} недель</span>
        </div>
        <div
          className="grid justify-center gap-1"
          style={{ gridTemplateColumns: '40px repeat(7, 20px)' }}
          role="img"
          aria-label="Тепловая карта дисциплины"
          onClick={(e) => {
            // Клетки 20 × 18 с зазором 4 меньше пальца: тап мимо клетки берёт ближайшую.
            let cell: Element | null = (e.target as HTMLElement).closest('[data-date]');
            if (!cell) {
              let best = 24;
              for (const c of e.currentTarget.querySelectorAll('[data-date]')) {
                const r = c.getBoundingClientRect();
                const dist = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
                if (dist < best) {
                  best = dist;
                  cell = c;
                }
              }
            }
            const d = cell?.getAttribute('data-date') ?? null;
            setPicked((p) => (d && d !== p ? d : null));
          }}
        >
          {['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((h, i) => (
            <span key={i} className="text-center text-[11px] font-bold text-muted">
              {h}
            </span>
          ))}
          {Array.from({ length: weeks }, (_, w) => {
            const monday = addDays(startMonday, w * 7);
            let label = '';
            for (let d = 0; d < 7; d++) {
              const date = addDays(monday, d);
              if (date <= PROGRAM_END && (date.endsWith('-01') || (w === 0 && d === 0))) label = MONTHS_SHORT[Number(date.slice(5, 7)) - 1]!;
            }
            return [
              <span key={`m${w}`} className="text-[11px] leading-[18px] font-bold text-muted">
                {label}
              </span>,
              ...Array.from({ length: 7 }, (_, d) => {
                const date = addDays(monday, d);
                const plan = planByDate.get(date);
                if (!plan) return <span key={date} />;
                const s = statuses.get(date) ?? 'future';
                const isToday = date === today;
                return (
                  <span
                    key={date}
                    data-date={date}
                    role="button"
                    tabIndex={-1}
                    aria-label={`${formatDayMonth(date)}: ${STATUS_TEXT[s]}`}
                    className="h-[18px] rounded-full"
                    style={{
                      background: isToday ? 'var(--ink)' : STATUS_BG[s],
                      boxShadow: isToday ? 'inset 0 0 0 3px var(--lime)' : picked === date ? 'inset 0 0 0 2px var(--energy)' : undefined,
                    }}
                  />
                );
              }),
            ];
          })}
        </div>
        <p className="min-h-5 px-1 text-sm" role="status">
          {picked && pickedStatus ? (
            <>
              <b>{formatDayMonth(picked)}</b> · {STATUS_TEXT[pickedStatus]}
            </>
          ) : (
            <span className="text-xs text-muted">Тап по клетке — что было в этот день</span>
          )}
        </p>
        <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 px-1 text-xs font-semibold text-muted">
          {(['gym', 'pool', 'rest', 'missed'] as const).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <i className="h-3 w-3 rounded" style={{ background: STATUS_BG[s] }} /> {STATUS_TEXT[s]}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <i className="h-3 w-3 rounded" style={{ background: 'var(--ink)', boxShadow: 'inset 0 0 0 2px var(--lime)' }} /> сегодня
          </span>
        </div>
      </Card>

      {nutrition && (
        <Card className="flex flex-col gap-2 rounded-[26px]! px-5! py-4!">
          <div className="flex justify-between">
            <span className="text-[15px] font-extrabold">Питание в цели</span>
            <span className="font-display text-[15px] font-bold tabular-nums">
              {nutrition.inTarget} / {nutrition.days}
            </span>
          </div>
          <Bar value={nutrition.inTarget / Math.max(1, nutrition.days)} height={10} color="var(--ink)" label="Дни питания в цели" />
          <span className="text-[13px] text-muted">ккал ±10% и белок ≥ 90%</span>
        </Card>
      )}
    </div>
  );
}
