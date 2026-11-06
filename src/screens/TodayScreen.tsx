import { Camera, Check, ChevronRight, CloudDownload, Dumbbell, Flag, Footprints, Minus, Play, Plus, Settings as SettingsIcon, Trash2, Waves } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { navigate } from '../app/router';
import { unlockAudio } from '../app/sound';
import { openSheet } from '../app/uiStore';
import { Rings } from '../components/Rings';
import { ScreenHeader } from '../components/ScreenHeader';
import { Sheet } from '../components/Sheet';
import { SilhouetteMini } from '../components/body/Silhouette';
import { Button, Card } from '../components/ui';
import { CALIBRATION_DATE, CHECKPOINTS, PHASES, PROGRAM_END, PROGRAM_START, REST_DAY_STEPS } from '../data/program';
import { DEFAULT_SETTINGS } from '../db/db';
import { applyAdjustment, discardSession, dismissAdjustment, finishSession, putBody, setPhase3Mode, startSession } from '../db/repo';
import type { BodyEntry, Settings, WorkoutSession } from '../db/types';
import { avg7, forecastDate, pathProgress, weeklyChange } from '../domain/body';
import { addDays, diffDays } from '../domain/dates';
import { formatDayMonth, formatInt, formatKcal, formatKg, formatScaled, formatWeekdayDate, parseKg, NBSP } from '../domain/format';
import { strengthSeries } from '../domain/history';
import { dayTargets, dayTotals, weeklyAdjustment } from '../domain/nutrition';
import { estimateMinutes, gymDatesOf, nextWorkout, phaseWeek, planForDate, workoutPlan } from '../domain/program';
import {
  useActiveSession, useAdjustments, useAllSets, useBody, useFoodLog, useFoods, useKv, usePool, useSessions, useSettings, useSlots,
} from '../hooks/useData';
import { useToday } from '../hooks/useToday';

export function TodayScreen() {
  const date = useToday();
  const settings = useSettings() ?? DEFAULT_SETTINGS;
  const body = useBody();
  const pw = phaseWeek(date);
  const subtitle = pw
    ? `Фаза ${pw.phase.n} · неделя ${pw.week} из ${pw.weeks}`
    : date < PROGRAM_START
      ? `Подготовка · старт ${formatDayMonth(PROGRAM_START)}`
      : 'Программа завершена';
  return (
    <>
      <ScreenHeader
        title={formatWeekdayDate(date)}
        subtitle={subtitle}
        action={
          <button type="button" aria-label="Настройки" onClick={() => navigate('settings')} className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-muted active:bg-track">
            <SettingsIcon size={22} />
          </button>
        }
      />
      <div className="flex flex-col gap-3 px-4 pb-6">
        <PathCard date={date} settings={settings} body={body} />
        <DayCard date={date} settings={settings} />
        <NutritionCard date={date} settings={settings} />
        <WeightCard date={date} body={body} fallback={settings.startWeight} />
        <Hints date={date} settings={settings} body={body} />
      </div>
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
  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-muted">Путь к цели</h2>
            <span className="text-2xl font-semibold tabular-nums text-accent">{Math.round(pct * 100)}%</span>
          </div>
          <div className="relative mt-7 mb-2">
            <div className="h-3 rounded-full bg-track" />
            <div className="absolute inset-y-0 left-0 rounded-full bg-progress transition-[width] duration-500" style={{ width: `${pct * 100}%` }} />
            <div className="absolute -top-[4px] -translate-x-1/2" style={{ left: `${pct * 100}%` }}>
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-semibold whitespace-nowrap tabular-nums">{formatScaled(current, 100, 1)}</span>
              <span className="block h-5 w-5 rounded-full border-[3px] border-surface bg-progress shadow" />
            </div>
          </div>
          <div className="flex justify-between text-xs text-muted tabular-nums">
            <span>{formatKg(settings.startWeight)}</span>
            <span>{formatKg(settings.targetWeight)}</span>
          </div>
          <p className="mt-2 text-sm">
            {avg === null && !lastW ? (
              'Запиши вес 3 дня — появится среднее'
            ) : (
              <>
                {lost > 0 ? '−' : lost < 0 ? '+' : ''}
                {formatScaled(Math.abs(lost), 100, 1)}
                {NBSP}кг из {formatScaled(total, 100, 1)}
                {forecast ? ` · прогноз: ${formatDayMonth(forecast)}` : avg === null ? ' · мало данных для среднего' : ''}
              </>
            )}
          </p>
        </div>
        <SilhouetteMini />
      </div>
      <PhaseCalendar date={date} />
    </Card>
  );
}

function PhaseCalendar({ date }: { date: string }) {
  const days = diffDays(PROGRAM_START, PROGRAM_END) + 1;
  const pos = (d: string) => Math.min(100, Math.max(0, (diffDays(PROGRAM_START, d) / days) * 100));
  return (
    <div className="mt-4" aria-label="Календарь фаз">
      <div className="relative h-5">
        <div className="absolute inset-x-0 top-2 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
          {PHASES.map((p) => (
            <div
              key={p.n}
              className="h-full"
              style={{
                width: `${((diffDays(p.start, p.end) + 1) / days) * 100}%`,
                background: p.n === 1 ? 'var(--m-secondary)' : p.n === 2 ? 'var(--progress)' : 'var(--accent)',
                opacity: date > p.end ? 0.45 : 1,
              }}
            />
          ))}
        </div>
        {CHECKPOINTS.map((c) => (
          <span
            key={c.date}
            title={`${formatDayMonth(c.date)} — ${c.todo}`}
            className={`absolute top-[5px] h-2.5 w-2.5 -translate-x-1/2 rotate-45 border border-surface ${c.date <= date ? 'bg-accent' : 'bg-surface-2'}`}
            style={{ left: `${pos(c.date)}%` }}
          />
        ))}
        {date >= PROGRAM_START && date <= PROGRAM_END && (
          <span className="absolute top-0 h-5 w-0.5 -translate-x-1/2 rounded bg-ink" style={{ left: `${pos(date)}%` }} aria-label="Сегодня" />
        )}
      </div>
      <div className="mt-1 flex text-[11px] text-muted">
        {PHASES.map((p) => {
          const share = (diffDays(p.start, p.end) + 1) / days;
          const current = date >= p.start && date <= p.end;
          // В узком сегменте имя не помещается и налезает на соседнее — там только номер.
          return (
            <span key={p.n} style={{ width: `${share * 100}%` }} className={`truncate pr-1 ${current ? 'font-medium text-ink' : ''}`}>
              {p.n}
              {current || share >= 0.25 ? `. ${p.name}` : ''}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ---------- День ----------

function DayCard({ date, settings }: { date: string; settings: Settings }) {
  const sessions = useSessions();
  const pool = usePool();
  const slots = useSlots();
  const active = useActiveSession();
  const plan = planForDate(date, gymDatesOf(sessions));
  const workout = nextWorkout(sessions);
  const doneToday = sessions.find((s) => s.date === date && s.finishedAt !== undefined && !s.isCalibration);
  const poolToday = pool.filter((p) => p.date === date).reduce((a, p) => a + p.minutes, 0);
  const wp = workoutPlan(workout, date, slots, settings);

  const start = async (calibration: boolean) => {
    unlockAudio();
    await startSession({ workout, isDeload: plan.isDeload, isCalibration: calibration });
    navigate('session');
  };

  if (active) return <ActiveCard active={active} date={date} />;

  if (plan.kind === 'prep') {
    const calibrated = sessions.some((s) => s.isCalibration && s.finishedAt !== undefined);
    return (
      <Card>
        <DayRow icon={Flag} title="Подготовка к старту" text={`Пробная тренировка ${formatDayMonth(CALIBRATION_DATE)} и стартовые замеры`} />
        <div className="mt-3 flex flex-col gap-2">
          {!calibrated && (
            <Button size="lg" onClick={() => void start(true)}>
              <Play size={20} aria-hidden /> Пробная тренировка A · подбор веса
            </Button>
          )}
          {calibrated && <p className="flex items-center gap-2 text-sm text-accent"><Check size={18} aria-hidden /> Пробная тренировка сделана</p>}
          <Button variant="secondary" onClick={() => openSheet('weight')}>
            Записать стартовые замеры
          </Button>
        </div>
      </Card>
    );
  }

  if (plan.kind === 'finished') {
    return (
      <Card>
        <DayRow icon={Flag} title="Программа завершена" text="Итоги — на экране «Прогресс»" />
      </Card>
    );
  }

  if (plan.kind === 'gym') {
    if (doneToday) {
      return (
        <Card>
          <DayRow icon={Check} title={`Тренировка ${doneToday.workout} выполнена`} text="Отдыхай и добирай белок" done />
        </Card>
      );
    }
    return (
      <Card>
        <DayRow
          icon={Dumbbell}
          title={`Тренировка ${workout}${plan.isDeload ? ' · разгрузка' : ''}`}
          text={`${wp.length} упражнений · ≈ ${estimateMinutes(wp)} мин${plan.makeup ? ' · перенесена со вчера' : ''}`}
        />
        <Button size="lg" className="mt-3 w-full" onClick={() => void start(false)}>
          <Play size={20} aria-hidden /> Начать
        </Button>
        {plan.pool && <p className="mt-2 text-center text-sm text-muted">Бассейн сегодня — по желанию</p>}
      </Card>
    );
  }

  if (plan.kind === 'pool' || plan.kind === 'pool_optional') {
    const optional = plan.kind === 'pool_optional';
    return (
      <Card>
        <DayRow
          icon={poolToday >= 20 ? Check : Waves}
          done={poolToday >= 20}
          title={poolToday > 0 ? `Бассейн записан · ${poolToday} мин` : `Бассейн${optional ? ' по желанию' : ''}`}
          text={plan.gymBlocked ? `Вчера был зал — сегодня без зала. ${plan.pool?.text ?? ''}` : (plan.pool?.text ?? '')}
        />
        <Button size="lg" variant={poolToday > 0 ? 'secondary' : 'primary'} className="mt-3 w-full" onClick={() => openSheet('pool')}>
          <Waves size={20} aria-hidden /> {poolToday > 0 ? 'Добавить ещё' : 'Записать'}
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <DayRow icon={Footprints} title="Отдых" text={`Цель — ${formatInt(REST_DAY_STEPS)} шагов`} />
      <Button variant="secondary" className="mt-3 w-full" onClick={() => openSheet('weight')}>
        <Footprints size={20} aria-hidden /> Записать шаги
      </Button>
    </Card>
  );
}

/**
 * Незавершённая тренировка. Сегодняшняя — «Продолжить». Вчерашняя и старше — забыли нажать
 * «Завершить»: предлагаем закрыть её (конец — по последнему подходу) или удалить, иначе она
 * подменяет карточку дня бесконечно.
 */
function ActiveCard({ active, date }: { active: WorkoutSession; date: string }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const stale = active.date < date;
  if (!stale) {
    return (
      <Card className="border-2 border-primary">
        <DayRow icon={Dumbbell} title={`Тренировка ${active.workout} идёт`} text="Незавершённая тренировка сохранена" />
        <Button size="lg" className="mt-3 w-full" onClick={() => navigate('session')}>
          <Play size={20} aria-hidden /> Продолжить
        </Button>
      </Card>
    );
  }
  return (
    <Card className="border-l-4 border-warn">
      <DayRow icon={Dumbbell} title={`Тренировка ${active.workout} не завершена`} text={`Начата ${formatDayMonth(active.date)}. Завершить и сохранить сделанное?`} />
      <div className="mt-3 flex gap-2">
        <Button size="lg" className="flex-1" onClick={() => void finishSession(active.id)}>
          <Check size={20} aria-hidden /> Завершить
        </Button>
        <Button size="lg" variant="secondary" onClick={() => navigate('session')} aria-label="Открыть тренировку">
          <Play size={20} aria-hidden />
        </Button>
        <Button size="lg" variant="danger" onClick={() => setConfirmDelete(true)} aria-label="Удалить тренировку">
          <Trash2 size={20} aria-hidden />
        </Button>
      </div>
      <Sheet open={confirmDelete} title="Удалить тренировку?" onClose={() => setConfirmDelete(false)}>
        <div className="flex flex-col gap-2 p-2">
          <p className="px-2 pb-2 text-muted">Записанные подходы от {formatDayMonth(active.date)} пропадут из истории.</p>
          <Button size="lg" variant="danger" onClick={() => void discardSession(active.id).then(() => setConfirmDelete(false))}>
            <Trash2 size={20} aria-hidden /> Удалить
          </Button>
          <Button size="lg" variant="secondary" onClick={() => setConfirmDelete(false)}>
            Отмена
          </Button>
        </div>
      </Sheet>
    </Card>
  );
}

function DayRow({ icon: Icon, title, text, done }: { icon: typeof Dumbbell; title: string; text: string; done?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${done ? 'bg-progress text-white' : 'bg-primary/45 text-accent'}`}>
        <Icon size={24} aria-hidden />
      </span>
      <div className="min-w-0">
        <h2 className="text-lg leading-tight font-semibold">{title}</h2>
        <p className="text-sm text-muted">{text}</p>
      </div>
    </div>
  );
}

// ---------- Питание ----------

function NutritionCard({ date, settings }: { date: string; settings: Settings }) {
  const logs = useFoodLog(date);
  const foods = useFoods();
  const adjustments = useAdjustments();
  const foodMap = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
  const t = dayTargets(date, adjustments, settings);
  const { total } = dayTotals(logs, foodMap);
  const protein = Math.round(total.p / 10);
  const over = total.kcal - t.kcal;
  return (
    <Card onClick={() => navigate('nutrition')}>
      <div className="flex items-center gap-4">
        <Rings
          size={124}
          rings={[
            { value: total.kcal / t.kcal, color: 'var(--energy)', overColor: 'var(--warn)', label: `Калории ${total.kcal} из ${t.kcal}` },
            { value: protein / t.protein, color: 'var(--protein)', label: `Белок ${protein} из ${t.protein} г` },
          ]}
        >
          <span className={`text-base leading-tight font-semibold tabular-nums ${over > 0 ? 'text-warn' : ''}`}>{formatInt(total.kcal)}</span>
          <span className="text-[11px] text-muted">/ {formatKcal(t.kcal)}</span>
        </Rings>
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-muted">Питание сегодня</h2>
          <p className="mt-1 flex items-center gap-1.5 text-[15px] whitespace-nowrap">
            <i className={`h-2.5 w-2.5 shrink-0 rounded-full ${over > 0 ? 'bg-warn' : 'bg-energy'}`} /> {formatInt(total.kcal)} / {formatKcal(t.kcal)}
          </p>
          <p className="flex items-center gap-1.5 text-[15px] whitespace-nowrap">
            <i className="h-2.5 w-2.5 shrink-0 rounded-full bg-protein" /> Белок {protein} / {t.protein}{NBSP}г
          </p>
          {over > 0 && <p className="mt-1 text-xs font-medium text-warn">Перебор {formatKcal(over)}</p>}
          {t.maintenance && <p className="mt-1 text-xs text-muted">Неделя на поддержке</p>}
        </div>
        <ChevronRight className="text-muted" aria-hidden />
      </div>
    </Card>
  );
}

// ---------- Вес ----------

function WeightCard({ date, body, fallback }: { date: string; body: BodyEntry[]; fallback: number }) {
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
  return (
    <Card>
      <h2 className="text-sm font-semibold text-muted">Вес сегодня</h2>
      <div className="mt-2 flex items-center gap-2">
        <button type="button" aria-label="Минус 0,1 кг" onClick={() => bump(-10)} className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-2">
          <Minus size={20} aria-hidden />
        </button>
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
            className="min-w-0 flex-1 border-b-2 border-accent bg-transparent text-center text-3xl font-semibold tabular-nums outline-none"
          />
        ) : (
          <button type="button" onClick={() => setEditing(true)} aria-label="Ввести вес" className="min-h-12 flex-1 rounded-lg text-center text-3xl font-semibold tabular-nums active:bg-track">
            {formatScaled(value, 100, 2)}
            <span className="ml-1 text-sm font-normal text-muted">кг</span>
          </button>
        )}
        <button type="button" aria-label="Плюс 0,1 кг" onClick={() => bump(10)} className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-2">
          <Plus size={20} aria-hidden />
        </button>
        {!todayEntry && (
          <Button onClick={() => void putBody(date, { weight: value })} aria-label="Записать вес">
            <Check size={20} aria-hidden />
          </Button>
        )}
      </div>
      <p className="mt-2 text-center text-sm text-muted">
        {todayEntry ? (
          <>
            Записано
            {avg !== null && ` · среднее ${formatScaled(avg, 100, 1)}`}
            {change !== null && ` ${change <= 0 ? '↓' : '↑'}${formatScaled(Math.abs(change), 100, 1)} за неделю`}
          </>
        ) : avg === null ? (
          'Запиши вес 3 дня — появится среднее'
        ) : (
          `Среднее за 7 дней ${formatScaled(avg, 100, 1)}`
        )}
      </p>
      <button type="button" onClick={() => openSheet('weight')} className="mt-1 min-h-11 w-full text-sm text-accent">
        Замеры: талия, шея, шаги
      </button>
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
  const checkpoint = CHECKPOINTS.find((c) => diffDays(date, c.date) >= 0 && diffDays(date, c.date) <= 3) ?? CHECKPOINTS.find((c) => c.date === addDays(date, -1));
  const records = sessions.length + body.length + pool.length;
  const backupDue = records >= 10 && (!settings.lastBackupAt || Date.now() - settings.lastBackupAt > 7 * 86_400_000);
  const phase3Ask = date >= '2027-02-22' && date <= '2027-03-07' && !settings.phase3Mode;

  return (
    <>
      {card && !dismissed && !applied && (
        <Card className="border-l-4 border-warn">
          <p className="font-medium">{card.text}</p>
          <div className="mt-3 flex gap-2">
            <Button onClick={() => void applyAdjustment(date, card.deltaKcal, card.text)}>Применить</Button>
            <Button variant="secondary" onClick={() => void dismissAdjustment(card.weekOf)}>
              Не сейчас
            </Button>
          </div>
        </Card>
      )}
      {phase3Ask && (
        <Card className="border-l-4 border-accent">
          <p className="font-medium">С 1 марта — фаза «Рельеф». Какие калории?</p>
          <p className="mt-1 text-sm text-muted">Поддержка ≈ 2 400 ккал сохранит силу; дефицит — продолжит снижение.</p>
          <div className="mt-3 flex gap-2">
            <Button onClick={() => void setPhase3Mode('maintenance')}>Поддержка</Button>
            <Button variant="secondary" onClick={() => void setPhase3Mode('deficit')}>
              Дефицит
            </Button>
          </div>
        </Card>
      )}
      {checkpoint && (
        <Card onClick={() => (checkpoint.photos ? navigate('progress') : openSheet('weight'))} className="border-l-4 border-accent">
          <div className="flex items-center gap-3">
            <Camera size={22} className="text-accent" aria-hidden />
            <p className="flex-1">
              <b>{formatDayMonth(checkpoint.date)}</b> — {checkpoint.todo.toLowerCase()}
              <span className="block text-sm text-muted">
                Ориентир: {formatScaled(checkpoint.target.min, 100, 1)}
                {checkpoint.target.max !== checkpoint.target.min ? `–${formatScaled(checkpoint.target.max, 100, 1)}` : ''}
                {NBSP}кг среднего
              </span>
            </p>
          </div>
        </Card>
      )}
      {backupDue && (
        <Card onClick={() => navigate('settings')} className="border-l-4 border-protein">
          <div className="flex items-center gap-3">
            <CloudDownload size={22} className="text-protein" aria-hidden />
            <p className="flex-1">Бэкапа не было неделю. Сохрани копию в «Файлы».</p>
            <ChevronRight size={18} className="text-muted" aria-hidden />
          </div>
        </Card>
      )}
    </>
  );
}
