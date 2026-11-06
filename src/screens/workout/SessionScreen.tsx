// Режим тренировки — SPEC 6.2, макеты BActive / BRest / BSummary (REDESIGN 4).
// Тёмная палитра независимо от темы, один подход на экране, зоны нажатия ≥ 56 px.

import { ArrowDown, ArrowUp, Check, ChevronDown, Equal, Info, Minus, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { navigate } from '../../app/router';
import { beep, unlockAudio } from '../../app/sound';
import { ExerciseSheet } from '../../components/ExerciseSheet';
import { Sheet } from '../../components/Sheet';
import { Button, Caps } from '../../components/ui';
import { db, updateSettings } from '../../db/db';
import { useLiveQuery } from '../../db/useLiveQuery';
import {
  deleteSet, discardSession, extendRest, finishSession, logSet, startRest, stopRest, updateSet, type RestTimer,
} from '../../db/repo';
import type { Exercise, Kg100, ProgramSlot, SetLog, Settings, WorkoutSession } from '../../db/types';
import { formatInt, formatKg, formatScaled, formatWeekdayDate, NBSP, pluralRu } from '../../domain/format';
import { lastSessionSets, recentVolumes, suggestionFor } from '../../domain/history';
import { REST_SUPERSET, supersetRole, workoutPlan, type PlannedExercise } from '../../domain/program';
import { MANUAL_TEXT, type Suggestion } from '../../domain/progression';
import { findRecords, volume, type RecordHit } from '../../domain/records';
import { nextGym } from '../../domain/week';
import { adjacentWeight, platesPerSide, warmupSets } from '../../domain/weights';
import { getExercise } from '../../data/exercises';
import { useActiveSession, useAllSets, useRestTimer, useSessions, useSessionSets, useSettings, useSlots } from '../../hooks/useData';
import { useNow } from '../../hooks/useNow';
import { useWakeLock } from '../../hooks/useWakeLock';

const defaultWeight = (ex: Exercise, settings: Settings): Kg100 =>
  ex.equipment === 'barbell' ? settings.barWeight : ex.equipment === 'dumbbell' ? 1000 : ex.equipment === 'cable' ? 2000 : ex.equipment === 'machine' ? 4000 : 0;

const fmtClock = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
};

function valueText(ex: Exercise, weight: Kg100, reps: number): string {
  if (ex.unit === 'seconds') return `${reps}${NBSP}с`;
  if (ex.unit === 'reps' || weight === 0) return `${reps} повт.`;
  return `${formatKg(weight, false)} × ${reps}`;
}

export function SessionScreen() {
  const active = useActiveSession();
  const [summaryId, setSummaryId] = useState<string | null>(null);
  const sessions = useSessions();

  useEffect(() => {
    if (active === null && !summaryId) navigate('workout', true);
  }, [active, summaryId]);

  if (summaryId) {
    const s = sessions.find((x) => x.id === summaryId);
    return <div className="theme-dark fixed inset-0 z-10 overflow-y-auto bg-bg">{s && <Summary session={s} sessions={sessions} />}</div>;
  }
  if (!active) return <div className="theme-dark fixed inset-0 bg-bg" />;
  return (
    <div className="theme-dark fixed inset-0 z-10">
      <ActiveWorkout session={active} onFinished={setSummaryId} />
    </div>
  );
}

function ActiveWorkout({ session, onFinished }: { session: WorkoutSession; onFinished: (id: string) => void }) {
  // Ждём историю целиком: от неё зависят подставленные вес и повторы.
  const sessions = useLiveQuery(() => db.sessions.toArray(), []);
  const allSets = useLiveQuery(() => db.sets.toArray(), []);
  const settings = useSettings();
  const slots = useLiveQuery(() => db.slots.toArray(), []);
  if (!sessions || !allSets || !settings || !slots) return <div className="min-h-full bg-bg" />;
  return <ActiveWorkoutView session={session} onFinished={onFinished} sessions={sessions} allSets={allSets} settings={settings} slots={slots} />;
}

function ActiveWorkoutView({
  session, onFinished, sessions, allSets, settings, slots,
}: {
  session: WorkoutSession;
  onFinished: (id: string) => void;
  sessions: WorkoutSession[];
  allSets: SetLog[];
  settings: Settings;
  slots: ProgramSlot[];
}) {
  const sessionSets = useSessionSets(session.id);
  const timer = useRestTimer();
  const now = useNow(250);
  useWakeLock(true);

  const plan = useMemo(() => workoutPlan(session.workout, session.date, slots, settings), [session, slots, settings]);
  const workDone = (exId: string) => sessionSets.filter((s) => s.exerciseId === exId && s.kind === 'work');
  const remaining = (p: PlannedExercise) => Math.max(0, p.sets - workDone(p.exercise.id).length);
  const firstOpen = plan.findIndex((p) => remaining(p) > 0);
  const [idx, setIdx] = useState<number | null>(null);
  const current = idx ?? (firstOpen >= 0 ? firstOpen : 0);
  const p = plan[current];

  const totalPlanned = plan.reduce((a, x) => a + x.sets, 0);
  const totalDone = plan.reduce((a, x) => a + Math.min(x.sets, workDone(x.exercise.id).length), 0);
  const [info, setInfo] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [list, setList] = useState(false);

  const suggestions = new Map(
    plan.map((x) => [x.exercise.id, suggestionFor(x, allSets, sessions, { sessionId: session.id, isDeload: session.isDeload, isCalibration: session.isCalibration })]),
  );

  const firstLongIdx = plan.findIndex((x) => x.slot.rest === 'long');

  /** После подхода: отдых и/или переход к следующему упражнению. */
  const afterSet = async (i: number) => {
    const cur = plan[i]!;
    const role = supersetRole(plan, i);
    const doneNow = workDone(cur.exercise.id).length + 1;
    const leftHere = cur.sets - doneNow;
    let next = i;
    let rest = cur.restSeconds;
    if (role === 'lead') {
      const partner = plan.findIndex((x) => x.slot.id === cur.slot.supersetWith);
      if (partner >= 0 && remaining(plan[partner]!) > 0) {
        next = partner;
        rest = 0;
      }
    } else if (role === 'follow') {
      const lead = plan.findIndex((x) => x.slot.id === cur.slot.supersetWith);
      rest = REST_SUPERSET;
      if (lead >= 0 && remaining(plan[lead]!) > 0) next = lead;
      else if (leftHere <= 0) next = nextOpen(i);
    } else if (leftHere <= 0) {
      next = nextOpen(i);
    }
    if (next !== i) setIdx(next);
    const anyLeft = plan.some((x, j) => (j === i ? leftHere > 0 : remaining(x) > 0));
    if (rest > 0 && anyLeft) await startRest(session.id, rest);
  };

  const nextOpen = (from: number) => {
    for (let k = 1; k <= plan.length; k++) {
      const j = (from + k) % plan.length;
      if (j !== from && remaining(plan[j]!) > 0) return j;
    }
    return from;
  };

  const finish = async () => {
    onFinished(session.id);
    await finishSession(session.id);
  };

  const elapsed = (now - session.startedAt) / 1000;
  const resting = !!timer && timer.sessionId === session.id;
  const mode = session.isCalibration ? ' · подбор веса' : session.isDeload ? ' · разгрузка' : '';
  const doneHere = p ? workDone(p.exercise.id).length : 0;

  // Новый подход, отдых или другое упражнение — всегда с начала экрана.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [current, resting, doneHere]);

  return (
    <div ref={scrollRef} className="flex h-full flex-col overflow-y-auto bg-bg text-ink">
      <header className="pt-safe shrink-0 px-4">
        <div className="flex items-center gap-2.5 pt-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] whitespace-nowrap text-muted tabular-nums">
              Упражнение {current + 1} из {plan.length} · {fmtClock(elapsed)}
              {mode}
            </p>
            <h1 className="truncate text-[17px] font-extrabold">{p ? (p.exercise.short ?? p.exercise.name) : `Тренировка ${session.workout}`}</h1>
          </div>
          <button
            type="button"
            aria-label="Упражнения"
            onClick={() => setList(true)}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-surface active:scale-95"
          >
            <ChevronDown size={24} strokeWidth={2.4} aria-hidden />
          </button>
          {!resting && (
            <button
              type="button"
              onClick={() => setConfirm(true)}
              className="flex h-14 shrink-0 items-center rounded-full bg-surface px-3.5 text-[15px] font-bold active:scale-95"
            >
              Завершить
            </button>
          )}
        </div>
        {p && (
          <div className="mt-5 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${p.sets}, minmax(0, 1fr))` }} aria-label={`Подходов сделано ${doneHere} из ${p.sets}`} role="img">
            {Array.from({ length: p.sets }, (_, i) => (
              <div key={i} className={`h-1.5 rounded-[3px] ${i < doneHere ? 'bg-primary' : i === doneHere && !resting ? 'bg-[#4A4D33]' : 'bg-surface-2'}`} />
            ))}
          </div>
        )}
      </header>

      {p &&
        (resting ? (
          <RestScreen
            timer={timer}
            now={now}
            sound={settings.sound}
            next={nextSetText(plan, current, sessionSets, suggestions)}
            lastSet={[...sessionSets].filter((s) => s.kind === 'work').sort((a, b) => b.doneAt - a.doneAt)[0]}
          />
        ) : (
          <SetScreen
            key={p.slot.id + p.exercise.id}
            p={p}
            suggestion={suggestions.get(p.exercise.id)!}
            settings={settings}
            session={session}
            logged={sessionSets.filter((s) => s.exerciseId === p.exercise.id)}
            last={lastSessionSets(p.exercise.id, allSets, sessions, session.id)}
            withWarmup={current === firstLongIdx && !session.isCalibration}
            onInfo={() => setInfo(p.exercise.id)}
            onLogged={() => afterSet(current)}
          />
        ))}

      <ExerciseSheet exerciseId={info} onClose={() => setInfo(null)} />

      <Sheet open={list} title="Упражнения" kicker={`Тренировка ${session.workout} · ${totalDone} из ${totalPlanned} подходов`} onClose={() => setList(false)}>
        <ol className="theme-dark flex flex-col rounded-3xl bg-surface px-[18px] py-1">
          {plan.map((x, i) => {
            const d = Math.min(x.sets, workDone(x.exercise.id).length);
            const done = d >= x.sets;
            return (
              <li key={x.slot.id} className="border-t border-line first:border-t-0">
                <button
                  type="button"
                  onClick={() => {
                    setIdx(i);
                    setList(false);
                  }}
                  aria-current={i === current ? 'step' : undefined}
                  aria-label={`${i + 1}. ${x.exercise.name}${done ? ', сделано' : ''}`}
                  className="flex min-h-14 w-full items-center gap-3 text-left active:opacity-70"
                >
                  <span className={`font-display w-[22px] text-[13px] font-semibold tabular-nums ${done ? 'text-muted' : 'text-primary'}`}>{String(i + 1).padStart(2, '0')}</span>
                  <span className={`flex-1 text-[15px] ${i === current ? 'font-extrabold' : 'font-semibold'} ${done ? 'text-muted' : ''}`}>{x.exercise.name}</span>
                  {done ? (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-on-primary">
                      <Check size={16} strokeWidth={3} aria-hidden />
                    </span>
                  ) : (
                    <span className="text-[13px] text-muted tabular-nums">
                      {d} из {x.sets}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </Sheet>

      <Sheet open={confirm} title="Завершить тренировку?" onClose={() => setConfirm(false)}>
        <div className="theme-dark flex flex-col gap-2 rounded-2xl p-2">
          <p className="px-2 pb-2 text-muted">
            Сделано {totalDone} из {totalPlanned} подходов.{totalDone < totalPlanned ? ' Незаписанные подходы не попадут в историю.' : ''}
          </p>
          <Button size="lg" onClick={() => void finish()} disabled={totalDone === 0}>
            <Check size={20} aria-hidden /> Завершить и показать итог
          </Button>
          <Button size="lg" variant="secondary" onClick={() => setConfirm(false)}>
            Продолжить тренировку
          </Button>
          <Button
            size="lg"
            variant="danger"
            onClick={async () => {
              await discardSession(session.id);
              navigate('workout', true);
            }}
          >
            <X size={20} aria-hidden /> Отменить без сохранения
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

function nextSetText(plan: PlannedExercise[], current: number, sets: SetLog[], sug: Map<string, Suggestion>): { label: string; value: string } {
  const p = plan[current]!;
  const done = sets.filter((s) => s.exerciseId === p.exercise.id && s.kind === 'work');
  if (done.length >= p.sets) return { label: 'Дальше', value: 'следующее упражнение' };
  const s = sug.get(p.exercise.id);
  const weight = done[done.length - 1]?.weight ?? s?.weight ?? 0;
  const reps = s?.targets[done.length] ?? p.slot.repMin;
  return { label: 'Следующий подход', value: valueText(p.exercise, weight, reps) };
}

// ---------- Подход (BActive) ----------

function Round({ label, size, onClick, children }: { label: string; size: 64 | 56; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`flex shrink-0 items-center justify-center rounded-full bg-surface-2 active:scale-95 ${size === 64 ? 'h-16 w-16' : 'h-14 w-14'}`}
    >
      {children}
    </button>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex min-h-12 items-center gap-3 border-t border-line text-[15px] first:border-t-0">{children}</div>;
}

function SetScreen({
  p, suggestion, settings, session, logged, last, withWarmup, onInfo, onLogged,
}: {
  p: PlannedExercise;
  suggestion: Suggestion;
  settings: Settings;
  session: WorkoutSession;
  logged: SetLog[];
  last: ReturnType<typeof lastSessionSets>;
  withWarmup: boolean;
  onInfo: () => void;
  onLogged: () => void;
}) {
  const ex = p.exercise;
  const eq = ex.equipment;
  const work = logged.filter((s) => s.kind === 'work').sort((a, b) => a.setIndex - b.setIndex);
  const warm = logged.filter((s) => s.kind === 'warmup');
  const isKg = ex.unit === 'kg';
  const n = Math.min(p.sets, work.length + 1);
  const i = Math.min(p.sets - 1, work.length);
  const allDone = work.length >= p.sets;
  const [weight, setWeight] = useState<Kg100>(() => work[work.length - 1]?.weight ?? suggestion.weight ?? defaultWeight(ex, settings));
  const [reps, setReps] = useState<number>(() => suggestion.targets[i] ?? p.slot.repMin);
  const [busy, setBusy] = useState(false);
  const alt = p.slot.altExerciseIds[0];
  const isSub = ex.id !== p.slot.exerciseId;
  const repStep = ex.unit === 'seconds' ? 5 : 1;
  const lastReps = useRef(i);
  useEffect(() => {
    // Следующий подход — своя цель повторов.
    if (lastReps.current !== i) {
      lastReps.current = i;
      setReps(suggestion.targets[i] ?? p.slot.repMin);
    }
  }, [i, suggestion.targets, p.slot.repMin]);

  const check = async () => {
    if (busy || allDone) return;
    setBusy(true);
    unlockAudio();
    try {
      await logSet({ sessionId: session.id, exerciseId: ex.id, slotId: p.slot.id, setIndex: i, kind: 'work', weight: isKg ? weight : 0, reps });
      onLogged();
    } finally {
      setBusy(false);
    }
  };

  const swap = async () => {
    const subs = { ...settings.substitutions };
    if (isSub) delete subs[p.slot.exerciseId];
    else if (alt) subs[p.slot.exerciseId] = alt;
    await updateSettings({ substitutions: subs });
  };

  const plates = eq === 'barbell' ? platesPerSide(weight, settings.barWeight, settings.plates) : null;
  const warmups = withWarmup && isKg ? warmupSets(eq, weight, settings.barWeight) : [];
  // Разминка — одной строкой и одним тапом: все подходы сразу (или все отменить).
  const warmDone = warmups.length > 0 && warmups.every((_, k) => warm.some((s) => s.setIndex === k));
  const toggleWarmup = async () => {
    if (warmDone) {
      for (const s of warm) await deleteSet(s.id);
      return;
    }
    for (const [k, w] of warmups.entries()) {
      if (!warm.some((s) => s.setIndex === k)) {
        await logSet({ sessionId: session.id, exerciseId: ex.id, slotId: p.slot.id, setIndex: k, kind: 'warmup', weight: w.weight, reps: w.reps });
      }
    }
  };
  const unitLabel = ex.unit === 'seconds' ? 'с' : 'повт.';
  const repsLabel = ex.unit === 'seconds' ? 'Секунды' : 'Повторы';
  const step = isKg ? `±${formatKg(adjacentWeight(eq, weight, 1) - weight, false)}` : '';
  const weightText = formatKg(weight, false);
  const weightSize = weightText.length <= 2 ? 'text-[88px] leading-[96px]' : weightText.length <= 4 ? 'text-[64px] leading-[80px]' : 'text-[52px] leading-[64px]';

  // Строка прогрессии: значок по режиму, текст — вес и причина.
  const hint = (() => {
    const reason = session.isCalibration ? MANUAL_TEXT : suggestion.reason;
    if (suggestion.mode === 'progress') return { icon: <ArrowUp size={16} strokeWidth={3} aria-hidden />, cls: 'bg-primary text-on-primary', text: reason };
    if (suggestion.mode === 'stall' || suggestion.mode === 'deload') return { icon: <ArrowDown size={16} strokeWidth={3} aria-hidden />, cls: 'bg-warn text-on-primary', text: reason };
    if (suggestion.mode === 'manual') return { icon: <Info size={16} strokeWidth={2.6} aria-hidden />, cls: 'bg-surface-2 text-ink', text: reason };
    return { icon: <Equal size={16} strokeWidth={3} aria-hidden />, cls: 'bg-surface-2 text-ink', text: reason };
  })();
  const range = `${p.sets} × ${p.slot.repMin}–${p.slot.repMax}${ex.unit === 'seconds' ? ' с' : ''}${ex.perSide ? (ex.id === 'db_row' ? ' на руку' : ' на ногу') : ''}`;
  const swapLabel = isSub ? 'Вернуть' : alt ? 'Заменить' : null;

  return (
    <div className="flex flex-1 shrink-0 flex-col">
      <div className="mt-6 flex flex-col items-center gap-1">
        <Caps className="text-primary!">
          {allDone ? 'Все подходы сделаны' : `Подход ${n} из ${p.sets}`}
          {p.slot.supersetWith ? ' · суперсет' : ''}
        </Caps>
        {isKg && (
          <div className="mt-3 flex items-center gap-[18px]">
            <Round label={`Вес, подход ${n}: меньше`} size={64} onClick={() => setWeight(adjacentWeight(eq, weight, -1))}>
              <Minus size={26} strokeWidth={2.6} aria-hidden />
            </Round>
            <div className="flex w-[170px] items-baseline justify-center gap-1.5" aria-label={`Вес, подход ${n}`}>
              <span className={`font-display text-huge font-bold tabular-nums ${weightSize}`}>{weightText}</span>
              <span className="text-xl font-bold text-muted">кг</span>
            </div>
            <Round label={`Вес, подход ${n}: больше`} size={64} onClick={() => setWeight(adjacentWeight(eq, weight, 1))}>
              <Plus size={26} strokeWidth={2.6} aria-hidden />
            </Round>
          </div>
        )}
        <div className={`flex items-center gap-[18px] ${isKg ? 'mt-2' : 'mt-3'}`}>
          <Round label={`${repsLabel}, подход ${n}: меньше`} size={isKg ? 56 : 64} onClick={() => setReps((r) => Math.max(1, r - repStep))}>
            <Minus size={22} strokeWidth={2.6} aria-hidden />
          </Round>
          <div className="flex w-[170px] items-baseline justify-center gap-2" aria-label={`${repsLabel}, подход ${n}`}>
            <span className={`font-display font-bold tabular-nums ${isKg ? 'text-[40px] leading-[48px]' : 'text-huge text-[88px] leading-[96px]'}`}>
              {isKg ? `× ${reps}` : reps}
            </span>
            <span className="text-[15px] font-bold text-muted">{unitLabel}</span>
          </div>
          <Round label={`${repsLabel}, подход ${n}: больше`} size={isKg ? 56 : 64} onClick={() => setReps((r) => r + repStep)}>
            <Plus size={22} strokeWidth={2.6} aria-hidden />
          </Round>
        </div>
        <p className="mt-1 text-[13px] text-muted">
          цель {range}
          {step ? ` · шаг ${step}` : ''}
        </p>
      </div>

      <div className="mx-4 mt-4 rounded-3xl bg-surface px-[18px] py-1">
        <Row>
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${hint.cls}`}>{hint.icon}</span>
          <span className="flex-1 py-2">
            {isKg && suggestion.weight !== null ? (
              <>
                <b>{formatKg(suggestion.weight)}</b> — {hint.text.replace(/^./, (c) => c.toLowerCase())}
              </>
            ) : (
              hint.text
            )}
          </span>
        </Row>
        {plates && (
          <Row>
            <span className="flex-1 text-muted">На сторону</span>
            <span className="font-extrabold tabular-nums">
              {plates.perSide.length ? plates.perSide.map((x) => formatKg(x, false)).join(' + ') : 'только гриф'} · гриф {formatKg(settings.barWeight, false)}
              {plates.remainder > 0 && <span className="text-muted"> · не хватает {formatKg(plates.remainder)}</span>}
            </span>
          </Row>
        )}
        {warmups.length > 0 && (
          <Row>
            <span className="shrink-0 text-muted">Разминка</span>
            <span className="flex-1 text-right leading-5 font-extrabold tabular-nums">{warmups.map((w) => `${formatKg(w.weight, false)} × ${w.reps}`).join(' · ')}</span>
            <button
              type="button"
              aria-label={warmDone ? 'Разминка: отменить' : 'Разминка: сделано'}
              onClick={() => void toggleWarmup()}
              className={`-mr-1 flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${warmDone ? 'bg-primary text-on-primary' : 'bg-surface-2 text-muted'}`}
            >
              <Check size={22} strokeWidth={2.6} aria-hidden />
            </button>
          </Row>
        )}
        {work.length > 0 && (
          <Row>
            <span className="flex flex-1 flex-wrap gap-1.5 py-1.5" aria-label="Записанные подходы">
              {work.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`Подход ${s.setIndex + 1}: отменить запись`}
                  onClick={() => void deleteSet(s.id)}
                  className="flex min-h-14 items-center gap-1 rounded-full bg-surface-2 px-3 text-sm font-extrabold tabular-nums active:opacity-70"
                >
                  {valueText(ex, s.weight, s.reps)} <Check size={16} strokeWidth={3} className="text-primary" aria-hidden />
                </button>
              ))}
            </span>
          </Row>
        )}
        {last && suggestion.mode !== 'progress' && suggestion.mode !== 'hold' && (
          <Row>
            <span className="flex-1 text-muted">Прошлый раз</span>
            <span className="font-extrabold tabular-nums">
              {last.sets[0] && isKg ? `${formatKg(last.sets[0].weight, false)} × ` : ''}
              {last.sets.map((s) => s.reps).join(' / ')}
              {ex.unit === 'seconds' ? ' с' : ''}
            </span>
          </Row>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-2.5 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="flex gap-2.5">
          <button type="button" onClick={onInfo} className="h-14 flex-1 rounded-full bg-surface text-[15px] font-bold active:scale-[0.98]">
            Как делать
          </button>
          <button
            type="button"
            disabled={!swapLabel}
            onClick={() => void swap()}
            aria-label={isSub ? `Вернуть: ${getExercise(p.slot.exerciseId).name.toLowerCase()}` : alt ? `Заменить на: ${getExercise(alt).name.toLowerCase()}` : 'Заменить'}
            className="h-14 flex-1 rounded-full bg-surface text-[15px] font-bold active:scale-[0.98] disabled:opacity-40"
          >
            {swapLabel ?? 'Заменить'}
          </button>
        </div>
        <button
          type="button"
          aria-label={allDone ? 'Все подходы записаны' : `Подход ${n}: записать`}
          disabled={busy || allDone}
          onClick={() => void check()}
          className="flex h-[72px] w-full items-center justify-center gap-3 rounded-full bg-primary text-[19px] font-extrabold text-on-primary active:scale-[0.98] disabled:opacity-40"
        >
          <Check size={24} strokeWidth={3} aria-hidden /> {allDone ? 'Сделано' : 'Подход сделан'}
        </button>
      </div>
    </div>
  );
}

// ---------- Отдых (BRest) ----------

/** Отдых на весь экран: кольцо 300 px, «+30 с» и «Пропустить», RIR, строка «Следующий подход». Остаток — от сохранённого endsAt. */
function RestScreen({ timer, now, sound, next, lastSet }: { timer: RestTimer; now: number; sound: boolean; next: { label: string; value: string }; lastSet?: SetLog }) {
  const left = (timer.endsAt - now) / 1000;
  const done = left <= 0;
  const beeped = useRef<number | null>(null);
  useEffect(() => {
    // Сигнал — только если конец отдыха пришёлся на время, когда приложение на экране.
    if (done && sound && beeped.current !== timer.endsAt && now - timer.endsAt < 3000) {
      beeped.current = timer.endsAt;
      beep();
    }
  }, [done, sound, timer.endsAt, now]);
  const size = 300;
  const stroke = 18;
  const r = size / 2 - stroke / 2;
  const c = 2 * Math.PI * r;
  const frac = done ? 1 : Math.max(0, Math.min(1, left / timer.total));
  const text = done ? '0:00' : fmtClock(Math.ceil(left));
  return (
    <div className="flex flex-1 shrink-0 flex-col" role="region" aria-label="Отдых">
      <div className="relative mx-auto mt-5" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - frac)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <Caps className="tracking-[.1em]">{done ? 'Отдых окончен' : 'Отдых'}</Caps>
          <span role="timer" aria-label={`Осталось ${text}`} className="font-display text-huge text-[72px] leading-[80px] font-bold tabular-nums">
            {text}
          </span>
          <span className="text-[15px] text-muted">из {fmtClock(timer.total)}</span>
        </div>
      </div>

      <div className="mx-4 mt-5 grid grid-cols-2 gap-2.5">
        <button type="button" onClick={() => void extendRest(30)} className="h-14 rounded-full bg-surface text-base font-extrabold active:scale-[0.98]">
          +30 с
        </button>
        {done ? (
          <button type="button" onClick={() => void stopRest()} className="h-14 rounded-full bg-primary text-base font-extrabold text-on-primary active:scale-[0.98]">
            Готов
          </button>
        ) : (
          <button type="button" onClick={() => void stopRest()} className="h-14 rounded-full bg-surface text-base font-extrabold active:scale-[0.98]">
            Пропустить
          </button>
        )}
      </div>

      {lastSet && (
        <div className="mx-4 mt-3 flex flex-col gap-2.5 rounded-[26px] bg-surface px-[18px] py-3.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[15px] font-extrabold">Сколько ещё мог?</span>
            <span className="text-[13px] text-muted">можно пропустить</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {([0, 1, 2, 3] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => void updateSet(lastSet.id, { rir: lastSet.rir === v ? undefined : v })}
                aria-pressed={lastSet.rir === v}
                aria-label={`Ещё мог: ${v === 3 ? '3 и больше' : v}`}
                className={`h-14 rounded-full text-lg font-extrabold ${lastSet.rir === v ? 'bg-primary text-on-primary' : 'bg-surface-2'}`}
              >
                {v === 3 ? '3+' : v}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mx-4 mt-auto mb-[calc(1rem+env(safe-area-inset-bottom))] flex h-16 shrink-0 items-center justify-between rounded-full bg-surface px-[22px]">
        <span className="text-sm text-muted">{next.label}</span>
        <span className="font-display text-xl font-bold tabular-nums">{next.value}</span>
      </div>
    </div>
  );
}

// ---------- Итог (BSummary) ----------

function Summary({ session, sessions }: { session: WorkoutSession; sessions: WorkoutSession[] }) {
  const all = useAllSets();
  const slots = useSlots();
  const settings = useSettings();
  const mine = all.filter((s) => s.sessionId === session.id);
  const finishedBefore = new Set(sessions.filter((s) => s.finishedAt !== undefined && s.startedAt < session.startedAt).map((s) => s.id));
  const prior = all.filter((s) => finishedBefore.has(s.sessionId));
  const records: RecordHit[] = findRecords(mine, prior);
  const vol = volume(mine);
  const bars = recentVolumes(session, sessions, all, 5);
  const prevVol = bars.length >= 2 ? bars[bars.length - 2]!.volume : 0;
  const diff = prevVol > 0 ? Math.round(((vol - prevVol) / prevVol) * 100) : null;
  const maxVol = Math.max(1, ...bars.map((b) => b.volume));
  const minutes = Math.round(((session.finishedAt ?? Date.now()) - session.startedAt) / 60000);
  const workCount = mine.filter((s) => s.kind === 'work').length;
  const planned = settings ? workoutPlan(session.workout, session.date, slots, settings).reduce((a, p) => a + p.sets, 0) : 0;
  const next = settings ? nextGym(session.date, sessions, settings) : null;
  const badge = records.length ? `Готово · ${records.length} ${pluralRu(records.length, 'рекорд', 'рекорда', 'рекордов')}` : 'Готово';

  return (
    <div className="pt-safe flex min-h-full flex-col bg-bg pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-ink">
      <div className="flex flex-col gap-2.5 px-[22px] pt-8">
        <span className="caps self-start rounded-full bg-primary px-2.5 py-1.5 text-on-primary">{badge}</span>
        <h1 className="font-display text-[34px] leading-10 font-bold">
          Тренировка {session.workout}
          <br />
          закрыта
        </h1>
        <p className="text-[15px] text-muted">{formatWeekdayDate(session.date)}</p>
      </div>

      <div className="mx-4 mt-6 grid grid-cols-2 gap-2.5">
        <Stat label="Время" value={String(minutes)} unit=" мин" />
        <Stat label="Подходы" value={String(workCount)} unit={planned ? ` / ${planned}` : ''} />
        <div className="col-span-2 flex flex-col gap-3 rounded-3xl bg-surface px-[18px] py-4">
          <div className="flex items-end justify-between">
            <div className="flex flex-col gap-1">
              <Caps>Объём</Caps>
              <span className="font-display text-[30px] leading-9 font-bold tabular-nums">
                {formatInt(Math.round(vol / 100))}
                <span className="font-sans text-[15px] font-bold text-muted"> кг</span>
              </span>
            </div>
            {diff !== null && (
              <span className={`pb-1.5 text-[15px] font-extrabold ${diff >= 0 ? 'text-primary' : 'text-warn'}`}>
                {diff >= 0 ? '↑' : '↓'} {Math.abs(diff)}% к прошлой {session.workout}
              </span>
            )}
          </div>
          <div className="flex h-14 items-end gap-1.5" role="img" aria-label={`Объём последних ${bars.length} тренировок ${session.workout}`}>
            {bars.map((b, i) => (
              <div
                key={b.id}
                className={`flex-1 rounded-lg ${b.current ? 'bg-primary' : i === bars.length - 2 ? 'bg-[#3A3D42]' : 'bg-surface-2'}`}
                style={{ height: `${Math.max(8, Math.round((b.volume / maxVol) * 100))}%` }}
              />
            ))}
          </div>
          <div className="flex justify-between text-xs text-muted">
            <span>{bars.length > 1 ? `последние ${bars.length} ${pluralRu(bars.length, 'тренировка', 'тренировки', 'тренировок')} ${session.workout}` : `первая тренировка ${session.workout}`}</span>
            <span>сегодня</span>
          </div>
        </div>
      </div>

      <div className="mx-4 mt-3 rounded-3xl bg-surface px-[18px] py-1">
        {records.length === 0 ? (
          <p className="py-4 text-[15px] text-muted">Без рекордов — главное, что тренировка сделана.</p>
        ) : (
          records.map((r) => (
            <div key={r.setId + r.kind} className="flex min-h-[60px] items-center gap-3 border-t border-line first:border-t-0">
              <span className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary">PR</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-extrabold">{getExercise(r.exerciseId).name}</span>
                <span className="text-[13px] text-muted tabular-nums">
                  {formatKg(r.weight, false)} × {r.reps} · {r.kind === 'e1rm' ? `e1RM ${formatScaled(r.e1rm ?? 0, 100, 1)}${NBSP}кг` : `лучший вес на ${r.reps}+`}
                </span>
              </span>
              <span className="text-sm font-extrabold text-primary tabular-nums">+{formatKg(r.delta, false)}</span>
            </div>
          ))
        )}
      </div>

      <div className="mx-4 mt-auto flex flex-col gap-2.5 pt-6">
        {next && (
          <p className="text-center text-sm text-muted">
            Следующая — тренировка {next.workout}, {formatWeekdayDate(next.date).replace(/^./, (c) => c.toLowerCase())}
          </p>
        )}
        <button
          type="button"
          onClick={() => navigate('today', true)}
          className="h-16 w-full rounded-full bg-primary text-lg font-extrabold text-on-primary active:scale-[0.98]"
        >
          Готово
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-3xl bg-surface px-[18px] py-4">
      <Caps>{label}</Caps>
      <span className="font-display text-[30px] leading-9 font-bold tabular-nums">
        {value}
        {unit && <span className="font-sans text-[15px] font-bold text-muted">{unit}</span>}
      </span>
    </div>
  );
}
