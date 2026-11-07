// Прогресс · Разум: сон и медитация. Чёрный герой со средним сном и минутами медитации за неделю,
// карточки записи (степпер + «Записать») и графики за 14 дней. Данные — в записи дня (BodyEntry).

import { Brain, Moon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { BarChart } from '../../components/charts/Charts';
import { Caps, Card, Chip, HeroCard, Stepper } from '../../components/ui';
import { putBody } from '../../db/repo';
import type { BodyEntry } from '../../db/types';
import { addDays } from '../../domain/dates';
import { formatDayMonth, formatDuration, formatHours, parseDuration, pluralRu } from '../../domain/format';
import {
  avgSleep, bestMeditationStreak, meditationSeries, meditationStreak, meditationWeek, SLEEP_OK_MIN, SLEEP_TARGET_MIN, sleepSeries,
} from '../../domain/mind';
import { useBody } from '../../hooks/useData';
import { useToday } from '../../hooks/useToday';

const DAYS = 14;

export function MindTab() {
  const today = useToday();
  const body = useBody();
  const avg = avgSleep(body, today);
  const week = meditationWeek(body, today);
  const streak = meditationStreak(body, today);
  return (
    <div className="flex flex-col gap-3">
      <HeroCard className="grid grid-cols-2 gap-2.5 rounded-[30px]! px-[22px]! py-5!">
        <div className="flex flex-col gap-1">
          <Caps className="flex items-center gap-1.5 text-muted-on-ink!">
            <Moon size={13} aria-hidden /> Сон
          </Caps>
          <span className="font-display text-[32px] leading-9 font-bold text-primary tabular-nums">
            {avg !== null ? formatHours(avg) : '—'}
            <span className="font-sans text-[15px] font-normal text-muted-on-ink"> ч</span>
          </span>
          <span className="text-[13px] text-muted-on-ink">в среднем за 7 дней · норма 7–9</span>
        </div>
        <div className="flex flex-col gap-1">
          <Caps className="flex items-center gap-1.5 text-muted-on-ink!">
            <Brain size={13} aria-hidden /> Медитация
          </Caps>
          <span className="font-display text-[32px] leading-9 font-bold tabular-nums">
            {week.minutes}
            <span className="font-sans text-[15px] font-normal text-muted-on-ink"> мин</span>
          </span>
          <span className="text-[13px] text-muted-on-ink">
            за 7 дней · серия {streak} {pluralRu(streak, 'день', 'дня', 'дней')}
          </span>
        </div>
      </HeroCard>
      <SleepCard today={today} body={body} />
      <MeditationCard today={today} body={body} />
    </div>
  );
}

/** Кнопка записи: значение совпадает с записанным — «Записано», иначе лаймовая «Записать». */
function SaveButton({ saved, label, onSave }: { saved: boolean; label: string; onSave: () => void }) {
  return saved ? (
    <span className="flex h-14 items-center justify-center rounded-full bg-track text-[15px] font-extrabold text-muted" aria-label={`${label}: записано`}>
      Записано
    </span>
  ) : (
    <button type="button" onClick={onSave} aria-label={`${label}: записать`} className="h-14 rounded-full bg-primary text-[17px] font-extrabold text-on-primary active:scale-[0.98]">
      Записать
    </button>
  );
}

function dayLabels(from: string) {
  return (i: number) => String(Number(addDays(from, i).slice(8)));
}

// ---------- Сон ----------

function SleepCard({ today, body }: { today: string; body: BodyEntry[] }) {
  const recorded = body.find((b) => b.date === today)?.sleepMin;
  const last = [...body].filter((b) => b.sleepMin !== undefined).sort((a, b) => a.date.localeCompare(b.date)).pop()?.sleepMin;
  const [value, setValue] = useState(recorded ?? last ?? SLEEP_TARGET_MIN);
  useEffect(() => {
    if (recorded !== undefined) setValue(recorded);
  }, [recorded]);
  const from = addDays(today, -(DAYS - 1));
  const series = useMemo(() => sleepSeries(body, from, today), [body, from, today]);
  const label = dayLabels(from);
  const has = series.some((p) => p.min !== null);
  return (
    <Card className="flex flex-col gap-3 rounded-[28px]! p-5!">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display flex items-center gap-1.5 text-[17px] font-bold">
          <Moon size={16} className="text-protein" aria-hidden /> Сон
        </h2>
        <span className="text-[13px] text-muted">ночь на {formatDayMonth(today)}</span>
      </div>
      <Stepper
        label="Сон"
        value={formatDuration(value)}
        editValue={formatHours(value)}
        onDec={() => setValue((v) => Math.max(0, v - 15))}
        onInc={() => setValue((v) => Math.min(16 * 60, v + 15))}
        onEdit={(raw) => {
          // Руками: «7,5», «7:30», «7 30».
          const v = parseDuration(raw);
          if (v !== null) setValue(v);
        }}
      />
      <SaveButton saved={recorded === value} label="Сон" onSave={() => void putBody(today, { sleepMin: value })} />
      {has ? (
        <>
          <BarChart
            ariaLabel="Сон по дням за 2 недели против цели 8 часов"
            height={150}
            bars={series.map((p, i) => ({ label: label(i), value: p.min ?? 0, ok: (p.min ?? 0) >= SLEEP_OK_MIN }))}
            target={series.map(() => ({ value: SLEEP_TARGET_MIN, label: '8 ч' }))}
            format={formatHours}
          />
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-muted">
            <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded bg-progress" /> 7 ч и больше</span>
            <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded bg-energy" /> меньше 7 ч</span>
            <span className="flex items-center gap-1"><i className="h-0.5 w-4 border-t-2 border-dashed border-ink" /> 8 ч</span>
          </div>
        </>
      ) : (
        <p className="py-2 text-center text-sm text-muted">Записывай сон каждое утро — появится график за 2 недели</p>
      )}
    </Card>
  );
}

// ---------- Медитация ----------

const PRESETS = [5, 10, 15, 20];

function MeditationCard({ today, body }: { today: string; body: BodyEntry[] }) {
  const recorded = body.find((b) => b.date === today)?.meditationMin;
  const [value, setValue] = useState(recorded ?? 10);
  useEffect(() => {
    if (recorded !== undefined) setValue(recorded);
  }, [recorded]);
  const from = addDays(today, -(DAYS - 1));
  const series = useMemo(() => meditationSeries(body, from, today), [body, from, today]);
  const label = dayLabels(from);
  const has = series.some((p) => (p.min ?? 0) > 0);
  const streak = meditationStreak(body, today);
  const best = bestMeditationStreak(body);
  return (
    <Card className="flex flex-col gap-3 rounded-[28px]! p-5!">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display flex items-center gap-1.5 text-[17px] font-bold">
          <Brain size={16} className="text-fat" aria-hidden /> Медитация
        </h2>
        <span className="text-[13px] text-muted">сегодня, всего за день</span>
      </div>
      <Stepper
        label="Медитация"
        value={`${value} мин`}
        editValue={String(value)}
        onDec={() => setValue((v) => Math.max(0, v - 5))}
        onInc={() => setValue((v) => Math.min(600, v + 5))}
        onEdit={(raw) => {
          const v = Math.round(Number(raw.replace(',', '.').replace(/[^\d.]/g, '')));
          if (Number.isFinite(v) && v >= 0 && v <= 600) setValue(v);
        }}
      />
      <div className="grid grid-cols-4 gap-1.5">
        {PRESETS.map((m) => (
          <Chip key={m} active={value === m} onClick={() => setValue(m)} aria-label={`${m} минут`} className="justify-center">
            {m}
          </Chip>
        ))}
      </div>
      <SaveButton saved={recorded === value} label="Медитация" onSave={() => void putBody(today, { meditationMin: value })} />
      {has ? (
        <>
          <BarChart
            ariaLabel="Медитация по дням за 2 недели, минуты"
            height={130}
            bars={series.map((p, i) => ({ label: label(i), value: p.min ?? 0, ok: true }))}
            target={[]}
            format={String}
            okColor="var(--fat)"
          />
          <p className="text-[13px] text-muted">
            Серия <b className="text-ink">{streak} {pluralRu(streak, 'день', 'дня', 'дней')}</b> подряд · лучшая — {best}
          </p>
        </>
      ) : (
        <p className="py-2 text-center text-sm text-muted">Даже 5 минут в день — запиши, и здесь появится серия</p>
      )}
    </Card>
  );
}
