// «Сегодня» — SPEC 6.1 в редизайне B (docs/design/b/BToday.dc.html, REDESIGN 4).

import { Check, ChevronRight, CloudDownload, Minus, Play, Plus, SlidersHorizontal, Trash2, Waves } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { navigate } from '../app/router';
import { unlockAudio } from '../app/sound';
import { openSheet } from '../app/uiStore';
import { ScreenHeader } from '../components/ScreenHeader';
import { Sheet } from '../components/Sheet';
import { Bar, Button, Caps, Card, HeroCard } from '../components/ui';
import { CALIBRATION_DATE, CHECKPOINTS, PROGRAM_START, REST_DAY_STEPS } from '../data/program';
import { DEFAULT_SETTINGS, updateSettings } from '../db/db';
import { applyAdjustment, discardSession, dismissAdjustment, finishSession, kvSet, putBody, setPhase3Mode, startSession } from '../db/repo';
import type { BodyEntry, Settings, WorkoutSession } from '../db/types';
import { avg7, forecastDate, pathProgress, roundTargetKg, targetRefinement, weeklyChange } from '../domain/body';
import { diffDays } from '../domain/dates';
import { formatDayMonth, formatInt, formatKg, formatScaled, formatWeekdayDate, parseKg } from '../domain/format';
import { strengthSeries, suggestionFor } from '../domain/history';
import { dayTargets, dayTotals, weeklyAdjustment } from '../domain/nutrition';
import { estimateMinutes, gymDatesOf, nextWorkout, phaseWeek, planForDate, planOptionsOf, workoutPlan } from '../domain/program';
import { weekStrip, type WeekDay } from '../domain/week';
import {
  useActiveSession, useAdjustments, useAllSets, useBody, useFoodLog, useFoods, useKv, usePool, useSessions, useSettings, useSlots,
} from '../hooks/useData';
import { useToday } from '../hooks/useToday';

export function TodayScreen() {
  const date = useToday();
  const settings = useSettings() ?? DEFAULT_SETTINGS;
  const body = useBody();
  const name = settings.name?.trim();
  return (
    <>
      <ScreenHeader
        title={name ? `Привет, ${name}` : 'Привет!'}
        subtitle={formatWeekdayDate(date)}
        action={
          <button
            type="button"
            aria-label="Настройки"
            onClick={() => navigate('settings')}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface text-ink active:bg-track"
          >
            <SlidersHorizontal size={20} aria-hidden />
          </button>
        }
      />
      <div className="flex flex-col gap-3 px-4 pb-6">
        <DayHero date={date} settings={settings} />
        <PathCard date={date} settings={settings} body={body} />
        <NutritionTiles date={date} settings={settings} />
        <WeightRow date={date} body={body} fallback={settings.startWeight} />
        <Hints date={date} settings={settings} body={body} />
      </div>
    </>
  );
}

// ---------- Герой дня ----------

function Badge({ children }: { children: string }) {
  return <span className="caps rounded-full bg-primary px-2.5 py-1.5 text-on-primary">{children}</span>;
}

function phaseLine(date: string): string {
  const pw = phaseWeek(date);
  if (pw) return `фаза ${pw.phase.n} · неделя ${pw.week} из ${pw.weeks}`;
  return date < PROGRAM_START ? `старт ${formatDayMonth(PROGRAM_START)}` : 'программа завершена';
}

function DayHero({ date, settings }: { date: string; settings: Settings }) {
  const sessions = useSessions();
  const pool = usePool();
  const slots = useSlots();
  const sets = useAllSets();
  const active = useActiveSession();
  const plan = planForDate(date, gymDatesOf(sessions), planOptionsOf(settings));
  const workout = nextWorkout(sessions);
  const doneToday = sessions.find((s) => s.date === date && s.finishedAt !== undefined && !s.isCalibration);
  const poolToday = pool.filter((p) => p.date === date).reduce((a, p) => a + p.minutes, 0);
  const wp = workoutPlan(workout, date, slots, settings);
  const week = useMemo(() => weekStrip(date, sessions, pool, settings), [date, sessions, pool, settings]);

  const start = async (calibration: boolean) => {
    unlockAudio();
    await startSession({ workout, isDeload: plan.isDeload, isCalibration: calibration });
    navigate('session');
  };

  // Чем начинается тренировка: первое упражнение и его рабочий вес.
  const first = wp[0];
  const firstText = (() => {
    if (!first) return '';
    const s = suggestionFor(first, sets, sessions, { isDeload: plan.isDeload, isCalibration: false });
    const name = (first.exercise.short ?? first.exercise.name).toLowerCase();
    return s.weight ? ` · первым ${name}, ${formatKg(s.weight)}` : ` · первым ${name}`;
  })();

  let badge = 'Отдых';
  let title = 'Отдых';
  let text = `Цель — ${formatInt(REST_DAY_STEPS)} шагов`;
  let cta: React.ReactNode = null;
  let extra: React.ReactNode = null;

  if (active) {
    const stale = active.date < date;
    badge = stale ? 'Не завершена' : 'Идёт';
    title = `Тренировка ${active.workout}`;
    text = stale ? `Начата ${formatDayMonth(active.date)}. Завершить и сохранить сделанное?` : 'Незавершённая тренировка сохранена';
    cta = stale ? (
      <div className="flex gap-2">
        <Button size="lg" className="flex-1" onClick={() => void finishSession(active.id)}>
          <Check size={20} aria-hidden /> Завершить
        </Button>
        <Button size="lg" variant="dark" onClick={() => navigate('session')}>
          Открыть
        </Button>
      </div>
    ) : (
      <Button size="lg" className="w-full" onClick={() => navigate('session')}>
        Продолжить <Play size={18} fill="currentColor" aria-hidden />
      </Button>
    );
    if (stale) extra = <StaleDelete active={active} />;
  } else if (plan.kind === 'prep') {
    const calibrated = sessions.some((s) => s.isCalibration && s.finishedAt !== undefined);
    badge = 'Подготовка';
    title = 'Подготовка к старту';
    text = calibrated ? 'Пробная тренировка сделана. Запиши стартовые замеры' : `Пробная тренировка ${formatDayMonth(CALIBRATION_DATE)} и стартовые замеры`;
    cta = (
      <div className="flex flex-col gap-2">
        {!calibrated && (
          <Button size="lg" className="w-full" onClick={() => void start(true)}>
            Пробная тренировка A <Play size={18} fill="currentColor" aria-hidden />
          </Button>
        )}
        <Button size="lg" variant="dark" className="w-full" onClick={() => openSheet('weight')}>
          Записать стартовые замеры
        </Button>
      </div>
    );
  } else if (plan.kind === 'finished') {
    badge = 'Финиш';
    title = 'Программа завершена';
    text = 'Итоги — на экране «Прогресс»';
  } else if (plan.kind === 'gym') {
    if (doneToday) {
      badge = 'Сделано';
      title = `Тренировка ${doneToday.workout}`;
      text = 'Выполнена. Отдыхай и добирай белок';
    } else {
      badge = 'Зал сегодня';
      title = `Тренировка ${workout}`;
      text = `${wp.length} упражнений · ≈ ${estimateMinutes(wp)} мин${firstText}${plan.isDeload ? ' · разгрузка' : ''}${plan.makeup ? ' · перенесена со вчера' : ''}`;
      cta = (
        <Button size="lg" className="w-full" onClick={() => void start(false)}>
          Начать тренировку <Play size={18} fill="currentColor" aria-hidden />
        </Button>
      );
      if (plan.pool) extra = <p className="text-center text-sm text-muted-on-ink">Бассейн сегодня — по желанию</p>;
    }
  } else if (plan.kind === 'pool' || plan.kind === 'pool_optional') {
    const optional = plan.kind === 'pool_optional';
    badge = optional ? 'Бассейн по желанию' : 'Бассейн';
    title = poolToday > 0 ? `Бассейн · ${poolToday} мин` : 'Бассейн';
    text = poolToday > 0 ? 'Записан' : plan.gymBlocked ? `Вчера был зал — сегодня без зала. ${plan.pool?.text ?? ''}` : (plan.pool?.text ?? '');
    cta = (
      <Button size="lg" variant={poolToday > 0 ? 'dark' : 'primary'} className="w-full" onClick={() => openSheet('pool')}>
        <Waves size={20} aria-hidden /> {poolToday > 0 ? 'Добавить ещё' : 'Записать'}
      </Button>
    );
  } else {
    cta = (
      <Button size="lg" variant="dark" className="w-full" onClick={() => openSheet('weight')}>
        Записать шаги
      </Button>
    );
  }

  return (
    <HeroCard className="flex flex-col gap-[18px] rounded-[30px]! px-5! pt-[22px]! pb-5!">
      <div className="flex items-center justify-between gap-3">
        <Badge>{badge}</Badge>
        <span className="text-[13px] font-semibold text-muted-on-ink">{phaseLine(date)}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <h2 className="font-display text-[34px] leading-10 font-bold">{title}</h2>
        <p className="text-[15px] text-muted-on-ink">{text}</p>
      </div>
      <WeekStrip days={week} />
      {cta}
      {extra}
    </HeroCard>
  );
}

/** 7 кружков недели: лайм — сделано в зале, тёмный с синей волной — бассейн, лаймовая обводка — сегодня, тусклые — план. */
function WeekStrip({ days }: { days: WeekDay[] }) {
  const style = (d: WeekDay): { cls: string; st?: React.CSSProperties } => {
    if (d.state === 'gym_done') return { cls: 'bg-primary text-on-primary' };
    if (d.state === 'pool_done') return { cls: 'bg-[#2A2C30]', st: { color: 'var(--protein)' } };
    if (d.today) return { cls: 'text-primary shadow-[inset_0_0_0_2px_var(--primary)]' };
    if (d.state === 'rest') return { cls: 'text-[#4A4D53]' };
    if (d.state === 'gym_plan') return { cls: 'bg-white/8 text-[#A7A9AE]' };
    if (d.state === 'gym_missed') return { cls: 'bg-white/8 text-[#6E737A]' };
    return { cls: `bg-white/8 ${d.state === 'pool_optional' ? 'text-[#6E737A]' : 'text-[#8A8D93]'}` };
  };
  return (
    <ol className="grid grid-cols-7" aria-label="Эта неделя">
      {days.map((d) => {
        const { cls, st } = style(d);
        return (
          <li key={d.date} className={`flex flex-col items-center gap-1.5 text-[11px] font-semibold ${d.today ? 'text-white' : 'text-muted-on-ink'}`}>
            <span className={`flex h-[34px] w-[34px] items-center justify-center rounded-full text-[13px] font-extrabold ${cls}`} style={st} aria-hidden>
              {d.label}
            </span>
            {d.name}
          </li>
        );
      })}
    </ol>
  );
}

function StaleDelete({ active }: { active: WorkoutSession }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <button type="button" className="flex min-h-11 w-full items-center justify-center gap-2 text-sm font-bold text-[#F07070]" onClick={() => setConfirm(true)}>
        <Trash2 size={16} aria-hidden /> Удалить тренировку
      </button>
      <Sheet open={confirm} title="Удалить тренировку?" onClose={() => setConfirm(false)}>
        <div className="flex flex-col gap-2 pb-2">
          <p className="px-1 pb-2 text-muted">Записанные подходы от {formatDayMonth(active.date)} пропадут из истории.</p>
          <Button size="lg" variant="danger" onClick={() => void discardSession(active.id).then(() => setConfirm(false))}>
            <Trash2 size={20} aria-hidden /> Удалить
          </Button>
          <Button size="lg" variant="secondary" onClick={() => setConfirm(false)}>
            Отмена
          </Button>
        </div>
      </Sheet>
    </>
  );
}

// ---------- Путь ----------

function PathCard({ date, settings, body }: { date: string; settings: Settings; body: BodyEntry[] }) {
  const avg = avg7(body, date);
  const lastW = [...body].reverse().find((b) => b.weight !== undefined)?.weight;
  const current = avg ?? lastW ?? settings.startWeight;
  const pct = pathProgress(settings.startWeight, settings.targetWeight, current);
  const lost = settings.startWeight - current;
  const total = settings.startWeight - settings.targetWeight;
  const forecast = forecastDate(body, date, settings.targetWeight);
  const pos = (kg: number) => Math.min(100, Math.max(0, ((settings.startWeight - kg) / (total || 1)) * 100));
  return (
    <Card className="flex flex-col gap-3.5 p-5!">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Caps>Путь к цели</Caps>
          <span className="font-display text-[44px] leading-[50px] font-bold tabular-nums">{Math.round(pct * 100)}%</span>
        </div>
        <div className="flex flex-col gap-1 pt-0.5 text-right">
          <span className="text-[13px] text-muted">прогноз</span>
          <span className="text-[17px] font-extrabold">{forecast ? formatDayMonth(forecast) : avg === null ? 'мало данных' : '—'}</span>
        </div>
      </div>
      <div className="relative h-3.5 rounded-full bg-track" role="img" aria-label={`Пройдено ${Math.round(pct * 100)}% пути от ${formatKg(settings.startWeight)} до ${formatKg(settings.targetWeight)}`}>
        <div className="h-3.5 rounded-full bg-progress transition-[width] duration-500" style={{ width: `${pct * 100}%` }} />
        {CHECKPOINTS.filter((c) => c.target.min < settings.startWeight && c.target.min > settings.targetWeight).map((c) => (
          <span
            key={c.date}
            title={`${formatDayMonth(c.date)} — ${c.todo}`}
            className="absolute top-0.5 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-2 border-ink bg-surface"
            style={{ left: `${pos(c.target.min)}%` }}
          />
        ))}
        <span className="absolute -top-[5px] h-6 w-6 -translate-x-1/2 rounded-full border-[3px] border-ink bg-primary" style={{ left: `${pct * 100}%` }} />
      </div>
      <div className="flex justify-between text-sm tabular-nums">
        <span className="text-muted">{formatScaled(settings.startWeight, 100, 1)}</span>
        <span>
          {avg === null && !lastW ? (
            <span className="text-muted">нужны 3 дня веса</span>
          ) : (
            <>
              <b>{formatScaled(current, 100, 1)} кг</b> · {lost > 0 ? '−' : lost < 0 ? '+' : ''}
              {formatScaled(Math.abs(lost), 100, 1)} из {formatScaled(total, 100, 1)}
            </>
          )}
        </span>
        <span className="text-muted">≈ {formatScaled(roundTargetKg(settings.targetWeight), 100, 0)}</span>
      </div>
    </Card>
  );
}

// ---------- Питание ----------

function NutritionTiles({ date, settings }: { date: string; settings: Settings }) {
  const logs = useFoodLog(date);
  const foods = useFoods();
  const adjustments = useAdjustments();
  const foodMap = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
  const t = dayTargets(date, adjustments, settings);
  const { total } = dayTotals(logs, foodMap);
  const protein = Math.round(total.p / 10);
  const tile = (label: string, color: string, value: string, of: number, left: number, ratio: number, unit: string) => (
    <Card onClick={() => navigate('nutrition')} className="flex flex-col gap-2.5 p-[18px]!">
      <div className="flex items-center gap-2">
        <i className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        <Caps>{label}</Caps>
      </div>
      <span className="font-display text-[26px] leading-[30px] font-bold tabular-nums">{value}</span>
      <span className={`text-[13px] ${left < 0 ? 'font-bold text-warn' : 'text-muted'}`}>
        из {formatInt(of)} · {left >= 0 ? `ещё ${formatInt(left)}` : `перебор ${formatInt(-left)}`}
        {unit}
      </span>
      <Bar value={ratio} color={color} overColor="var(--warn)" label={`${label} ${value} из ${formatInt(of)}`} />
    </Card>
  );
  return (
    <div className="grid grid-cols-2 gap-3">
      {tile('Калории', 'var(--energy)', formatInt(total.kcal), t.kcal, t.kcal - total.kcal, total.kcal / t.kcal, '')}
      {tile('Белок', 'var(--protein)', `${protein} г`, t.protein, t.protein - protein, protein / t.protein, '')}
      {t.maintenance && <p className="col-span-2 -mt-1 px-1 text-xs text-muted">Неделя на поддержке</p>}
    </div>
  );
}

// ---------- Вес ----------

function WeightRow({ date, body, fallback }: { date: string; body: BodyEntry[]; fallback: number }) {
  const todayEntry = body.find((b) => b.date === date && b.weight !== undefined);
  const last = [...body].reverse().find((b) => b.weight !== undefined);
  const [value, setValue] = useState<number>(todayEntry?.weight ?? last?.weight ?? fallback);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (todayEntry?.weight) setValue(todayEntry.weight);
    else if (last?.weight) setValue(last.weight);
  }, [todayEntry?.weight, last?.weight]);
  const avg = avg7(body, date);
  const change = weeklyChange(body, date);
  const set = (v: number) => {
    setValue(v);
    if (todayEntry) void putBody(date, { weight: v });
  };
  const bump = (d: number) => set(value + d);
  const note = todayEntry
    ? `кг · записано${change !== null ? ` · ${change <= 0 ? '↓' : '↑'}${formatScaled(Math.abs(change), 100, 1)} за неделю` : avg !== null ? ` · среднее ${formatScaled(avg, 100, 1)}` : ''}`
    : avg === null
      ? 'кг · ещё не записан'
      : `кг · среднее ${formatScaled(avg, 100, 1)}`;
  const circle = 'flex h-12 w-12 shrink-0 items-center justify-center rounded-full';
  return (
    <Card className="flex items-center gap-2 py-[18px]! pr-[18px]! pl-5!">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Caps>Вес сегодня</Caps>
        {editing ? (
          <input
            autoFocus
            inputMode="decimal"
            enterKeyHint="done"
            aria-label="Вес, кг"
            defaultValue={formatScaled(value, 100, 2)}
            onFocus={(e) => e.target.select()}
            onBlur={(e) => {
              setEditing(false);
              const v = parseKg(e.target.value);
              if (v && v > 3000 && v < 25000) set(v);
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="font-display w-full border-b-2 border-ink bg-transparent text-[26px] font-bold tabular-nums outline-none"
          />
        ) : (
          <button type="button" onClick={() => setEditing(true)} aria-label="Ввести вес" className="min-h-8 text-left active:opacity-70">
            <span className="font-display text-[26px] leading-8 font-bold tabular-nums">{formatScaled(value, 100, 1)}</span>
            <span className="ml-1 text-sm font-semibold text-muted">{note}</span>
          </button>
        )}
      </div>
      <button type="button" aria-label="Минус 0,1 кг" onClick={() => bump(-10)} className={`${circle} bg-track active:scale-95`}>
        <Minus size={20} strokeWidth={2.6} aria-hidden />
      </button>
      <button type="button" aria-label="Плюс 0,1 кг" onClick={() => bump(10)} className={`${circle} bg-track active:scale-95`}>
        <Plus size={20} strokeWidth={2.6} aria-hidden />
      </button>
      {todayEntry ? (
        <span className={`${circle} bg-primary text-on-primary`} aria-label="Вес записан">
          <Check size={20} strokeWidth={3} aria-hidden />
        </span>
      ) : (
        <button type="button" aria-label="Записать вес" onClick={() => void putBody(date, { weight: value })} className={`${circle} bg-ink text-primary active:scale-95`}>
          <Check size={20} strokeWidth={3} aria-hidden />
        </button>
      )}
    </Card>
  );
}

// ---------- Подсказки ----------

function Hints({ date, settings, body }: { date: string; settings: Settings; body: BodyEntry[] }) {
  const sessions = useSessions();
  const sets = useAllSets();
  const adjustments = useAdjustments();
  const pool = usePool();
  const t = dayTargets(date, adjustments, settings);
  const card = weeklyAdjustment(date, body, strengthSeries(sets, sessions), t.kcal);
  const dismissed = useKv<number>(card ? `adjDismissed:${card.weekOf}` : 'none');
  const applied = card ? adjustments.some((a) => a.date >= card.weekOf) : false;
  const next = CHECKPOINTS.find((c) => diffDays(date, c.date) >= -1);
  const inDays = next ? diffDays(date, next.date) : null;
  const checkpoint = next && inDays !== null && inDays <= 21 ? next : null;
  const records = sessions.length + body.length + pool.length;
  const backupDue = records >= 10 && (!settings.lastBackupAt || Date.now() - settings.lastBackupAt > 7 * 86_400_000);
  const phase3Ask = date >= '2027-02-22' && date <= '2027-03-07' && !settings.phase3Mode;
  const refineDismissed = useKv<string>('targetRefineDismissed');
  const refine = targetRefinement(body, CHECKPOINTS, settings, date, refineDismissed);

  return (
    <>
      {refine && (
        <Card className="flex flex-col gap-3 p-5!">
          <Caps>Цель по весу</Caps>
          <p className="text-[16px] font-extrabold">
            Цель уточнена: ≈ {formatScaled(roundTargetKg(refine.newTarget), 100, 0)} кг
            <span className="font-semibold text-muted"> (было ≈ {formatScaled(roundTargetKg(refine.oldTarget), 100, 0)})</span>
          </p>
          <p className="text-sm text-muted">
            По замерам {formatDayMonth(refine.measuredAt)}: жир ≈ {formatScaled(Math.round(refine.bodyFat * 10), 10, 1)}%, цель — сухая масса при {settings.targetBodyFat}% жира.
          </p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => void updateSettings({ targetWeight: refine.newTarget })}>
              Принять
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => void kvSet('targetRefineDismissed', refine.measuredAt)}>
              Оставить
            </Button>
          </div>
        </Card>
      )}
      {card && !dismissed && !applied && (
        <Card className="flex flex-col gap-3 p-5!">
          <Caps>Калории на неделю</Caps>
          <p className="font-bold">{card.text}</p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => void applyAdjustment(date, card.deltaKcal, card.text)}>
              Применить
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => void dismissAdjustment(card.weekOf)}>
              Не сейчас
            </Button>
          </div>
        </Card>
      )}
      {phase3Ask && (
        <Card className="flex flex-col gap-3 p-5!">
          <Caps>Фаза «Рельеф» с 1 марта</Caps>
          <p className="font-bold">Какие калории?</p>
          <p className="-mt-2 text-sm text-muted">Поддержка ≈ 2 400 ккал сохранит силу; дефицит — продолжит снижение.</p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => void setPhase3Mode('maintenance')}>
              Поддержка
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => void setPhase3Mode('deficit')}>
              Дефицит
            </Button>
          </div>
        </Card>
      )}
      {checkpoint && inDays !== null && (
        <Card
          onClick={() => (checkpoint.photos ? navigate('progress') : openSheet('weight'))}
          className="flex items-center gap-3.5 rounded-[28px]! px-5! py-[18px]!"
          style={{ background: 'color-mix(in srgb, var(--lime) 35%, var(--surface))' }}
        >
          <span className="font-display flex h-[52px] w-[52px] shrink-0 flex-col items-center justify-center rounded-[18px] bg-ink text-[18px] leading-[18px] font-bold text-primary">
            {checkpoint.date.slice(8).replace(/^0/, '')}
            <span className="font-sans text-[10px] leading-[14px] font-bold">{formatDayMonth(checkpoint.date).split(' ')[1]?.slice(0, 3).toUpperCase()}</span>
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[16px] font-extrabold">Контрольная точка</span>
            <span className="text-sm text-muted">
              {checkpoint.todo} · {inDays === 0 ? 'сегодня' : inDays === -1 ? 'вчера' : inDays === 1 ? 'завтра' : `через ${inDays} ${daysWord(inDays)}`}
            </span>
          </span>
        </Card>
      )}
      {backupDue && (
        <Card onClick={() => navigate('settings')} className="flex items-center gap-3 p-5!">
          <CloudDownload size={22} className="shrink-0 text-protein" aria-hidden />
          <p className="flex-1 text-[15px] font-semibold">Бэкапа не было неделю. Сохрани копию в «Файлы».</p>
          <ChevronRight size={18} className="text-muted" aria-hidden />
        </Card>
      )}
    </>
  );
}

function daysWord(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'день';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'дня';
  return 'дней';
}
