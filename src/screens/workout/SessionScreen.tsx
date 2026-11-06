// Режим тренировки — SPEC 6.2. Тёмная палитра, крупные зоны нажатия (≥ 56 px).

import { ArrowLeftRight, Check, Info, Medal, Plus, SkipForward, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { navigate } from '../../app/router';
import { beep, unlockAudio } from '../../app/sound';
import { ExerciseSheet } from '../../components/ExerciseSheet';
import { Sheet } from '../../components/Sheet';
import { Button, Stepper } from '../../components/ui';
import { db, updateSettings } from '../../db/db';
import { useLiveQuery } from '../../db/useLiveQuery';
import {
  deleteSet, discardSession, extendRest, finishSession, logSet, startRest, stopRest, updateSet, type RestTimer,
} from '../../db/repo';
import type { Exercise, Kg100, ProgramSlot, SetLog, Settings, WorkoutSession } from '../../db/types';
import { formatInt, formatKg, formatScaled, NBSP } from '../../domain/format';
import { lastSessionSets, suggestionFor } from '../../domain/history';
import { REST_SUPERSET, supersetRole, workoutPlan, type PlannedExercise } from '../../domain/program';
import { MANUAL_TEXT, type Suggestion } from '../../domain/progression';
import { findRecords, volume, type RecordHit } from '../../domain/records';
import { adjacentWeight, platesPerSide, warmupSets } from '../../domain/weights';
import { getExercise } from '../../data/exercises';
import { useActiveSession, useAllSets, useRestTimer, useSessions, useSessionSets, useSettings } from '../../hooks/useData';
import { useNow } from '../../hooks/useNow';
import { useWakeLock } from '../../hooks/useWakeLock';

const HINT_KEY = 'hint:session';

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
    return <div className="theme-dark fixed inset-0 z-10 overflow-y-auto">{s && <Summary session={s} sessions={sessions} />}</div>;
  }
  if (!active) return <div className="theme-dark fixed inset-0" />;
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
  // Подсказка «как записывать» — до первого «Понятно»; без обращения к БД, чтобы не мигала.
  const [hint, setHint] = useState(() => localStorage.getItem(HINT_KEY) === null);
  const dismissHint = () => {
    localStorage.setItem(HINT_KEY, '1');
    setHint(false);
  };

  // Текущий чип — всегда на виду: при автопереходе лента докручивается сама.
  const chipRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    chipRef.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [current]);

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

  return (
    // scroll-pb: панель отдыха внизу не накрывает активную строку, когда она докручивается в вид.
    <div className={`flex h-full flex-col overflow-y-auto bg-bg text-ink ${resting ? 'scroll-pb-[20rem]' : ''}`}>
      <header className="pt-safe sticky top-0 z-20 bg-bg">
        <div className="flex items-center gap-3 px-4 pt-2">
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Тренировка {session.workout}</h1>
            <p className="text-sm text-muted tabular-nums">
              {fmtClock(elapsed)} · {totalDone} из {totalPlanned}
              {session.isCalibration ? ' · подбор веса' : session.isDeload ? ' · разгрузка' : ''}
            </p>
          </div>
          <Button variant="secondary" className="min-h-14" onClick={() => setConfirm(true)}>
            Завершить
          </Button>
        </div>
        <div className="mx-4 mt-2 h-1.5 overflow-hidden rounded-full bg-track">
          <div className="h-full rounded-full bg-progress transition-[width] duration-300" style={{ width: `${(totalDone / Math.max(1, totalPlanned)) * 100}%` }} />
        </div>
        <nav aria-label="Упражнения" className="flex gap-2 overflow-x-auto px-4 py-2">
          {plan.map((x, i) => {
            const done = remaining(x) === 0;
            return (
              <button
                key={x.slot.id}
                ref={i === current ? chipRef : undefined}
                type="button"
                onClick={() => setIdx(i)}
                aria-current={i === current ? 'step' : undefined}
                aria-label={`${i + 1}. ${x.exercise.name}${done ? ', сделано' : ''}`}
                className={`flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3 text-sm whitespace-nowrap ${
                  i === current ? 'bg-primary font-medium text-on-primary' : done ? 'bg-progress/20 text-progress' : 'bg-surface-2 text-muted'
                }`}
              >
                {done && <Check size={14} aria-hidden />}
                {i + 1}. {x.exercise.short ?? x.exercise.name}
              </button>
            );
          })}
        </nav>
      </header>

      <main className={`flex-1 px-4 ${resting ? 'pb-[calc(20rem+env(safe-area-inset-bottom))]' : 'pb-[calc(2rem+env(safe-area-inset-bottom))]'}`}>
        {hint && (
          <aside className="mt-2 rounded-3xl border border-primary/50 bg-surface p-4" aria-label="Как записывать подход">
            <p className="font-semibold">Как это работает</p>
            <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5 text-[15px]">
              <li>Сделай подход с тем весом, что подсказан (или поставь свой стрелками ±).</li>
              <li>Поправь повторы, если сделал не столько, и нажми <b>«Подход сделан»</b>.</li>
              <li>Пойдёт отдых. После него — следующий подход, потом упражнение само сменится.</li>
            </ol>
            <Button variant="secondary" className="mt-3 w-full" onClick={dismissHint}>
              Понятно
            </Button>
          </aside>
        )}
        {p && (
          <ExerciseCard
            key={p.slot.id + p.exercise.id}
            p={p}
            index={current}
            suggestion={suggestions.get(p.exercise.id)!}
            settings={settings}
            session={session}
            logged={sessionSets.filter((s) => s.exerciseId === p.exercise.id)}
            last={lastSessionSets(p.exercise.id, allSets, sessions, session.id)}
            withWarmup={current === firstLongIdx && !session.isCalibration}
            resting={resting}
            onInfo={() => setInfo(p.exercise.id)}
            onLogged={() => afterSet(current)}
          />
        )}
      </main>

      {resting && (
        <RestPanel
          timer={timer}
          now={now}
          sound={settings.sound}
          nextText={nextSetText(plan, current, sessionSets, suggestions)}
          lastSet={[...sessionSets].filter((s) => s.kind === 'work').sort((a, b) => b.doneAt - a.doneAt)[0]}
        />
      )}

      <ExerciseSheet exerciseId={info} onClose={() => setInfo(null)} />

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

function nextSetText(plan: PlannedExercise[], current: number, sets: SetLog[], sug: Map<string, Suggestion>): string | null {
  const p = plan[current];
  if (!p) return null;
  const done = sets.filter((s) => s.exerciseId === p.exercise.id && s.kind === 'work');
  if (done.length >= p.sets) return null;
  const s = sug.get(p.exercise.id);
  const weight = done[done.length - 1]?.weight ?? s?.weight ?? 0;
  const reps = s?.targets[done.length] ?? p.slot.repMin;
  return `${p.exercise.short ?? p.exercise.name} · ${valueText(p.exercise, weight, reps)}`;
}

// ---------- Карточка упражнения ----------

function ExerciseCard({
  p, index, suggestion, settings, session, logged, last, withWarmup, resting, onInfo, onLogged,
}: {
  p: PlannedExercise;
  index: number;
  suggestion: Suggestion;
  settings: Settings;
  session: WorkoutSession;
  logged: SetLog[];
  last: ReturnType<typeof lastSessionSets>;
  withWarmup: boolean;
  /** Внизу панель отдыха: отступ под неё появляется позже записи подхода, поэтому докрутка повторяется. */
  resting: boolean;
  onInfo: () => void;
  onLogged: () => void;
}) {
  const ex = p.exercise;
  const eq = ex.equipment;
  const work = logged.filter((s) => s.kind === 'work').sort((a, b) => a.setIndex - b.setIndex);
  const warm = logged.filter((s) => s.kind === 'warmup');
  const isKg = ex.unit === 'kg';
  const [weight, setWeight] = useState<Kg100>(() => work[work.length - 1]?.weight ?? suggestion.weight ?? defaultWeight(ex, settings));
  const [reps, setReps] = useState<number[]>(() => Array.from({ length: p.sets }, (_, i) => suggestion.targets[i] ?? p.slot.repMin));
  const [busy, setBusy] = useState(false);
  const alt = p.slot.altExerciseIds[0];
  const isSub = ex.id !== p.slot.exerciseId;
  const repStep = ex.unit === 'seconds' ? 5 : 1;
  const firstOpenRow = Array.from({ length: p.sets }, (_, i) => i).find((i) => !work.some((s) => s.setIndex === i)) ?? -1;
  const [chosenRow, setActiveRow] = useState<number | null>(null);
  const activeRow = chosenRow !== null && !work.some((s) => s.setIndex === chosenRow) ? chosenRow : firstOpenRow;

  // Активная строка — в поле зрения (после записи подхода следующая строка может быть под панелью отдыха).
  const activeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeRow, resting]);

  const check = async (i: number) => {
    if (busy) return;
    setBusy(true);
    unlockAudio();
    try {
      await logSet({ sessionId: session.id, exerciseId: ex.id, slotId: p.slot.id, setIndex: i, kind: 'work', weight: isKg ? weight : 0, reps: reps[i]! });
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
  const side = ex.perSide ? (ex.id === 'db_row' ? ' на руку' : ' на ногу') : '';
  const range = `${p.sets} × ${p.slot.repMin}–${p.slot.repMax}${ex.unit === 'seconds' ? ' с' : ''}${side}`;
  const head = isKg ? (suggestion.weight === null ? 'Вес подбери сам' : formatKg(suggestion.weight)) : ex.unit === 'seconds' ? `${suggestion.targets[0]} с` : `${suggestion.targets[0]} повт.`;
  const swapLabel = isSub ? `Вернуть: ${getExercise(p.slot.exerciseId).name.toLowerCase()}` : alt ? `Заменить на: ${getExercise(alt).name.toLowerCase()}` : null;

  return (
    <article className="mt-2 rounded-3xl bg-surface p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">
            Упражнение {index + 1}{p.slot.supersetWith ? ' · суперсет' : ''} · подход {Math.min(p.sets, work.length + 1)} из {p.sets}
          </p>
          <h2 className="text-xl font-semibold leading-tight">{ex.name}</h2>
        </div>
        <button
          type="button"
          aria-label="Как делать"
          onClick={onInfo}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-accent active:scale-95"
        >
          <Info size={26} aria-hidden />
        </button>
      </div>

      <p className="mt-3 rounded-2xl bg-surface-2 px-3 py-2 text-[15px]">
        <b>{head}</b> · цель {range}
        <br />
        <span className={suggestion.mode === 'stall' ? 'text-warn' : 'text-muted'}>
          {session.isCalibration ? MANUAL_TEXT : suggestion.reason}
        </span>
      </p>
      {plates && (
        <p className="mt-2 text-sm text-muted">
          на сторону:{' '}
          <b className="text-ink">
            {plates.perSide.length ? plates.perSide.map((x) => formatKg(x, false)).join(' + ') : 'только гриф'}
          </b>
          {plates.remainder > 0 && ` (не хватает ${formatKg(plates.remainder)})`}
        </p>
      )}
      {swapLabel && (
        <button type="button" onClick={() => void swap()} className="mt-1 flex min-h-14 w-full items-center gap-2 text-left text-sm text-accent">
          <ArrowLeftRight size={18} aria-hidden /> {swapLabel}
        </button>
      )}

      {warmups.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">Разминка</p>
          {warmups.map((w, i) => {
            const done = warm.find((s) => s.setIndex === i);
            return (
              <div key={i} className="flex min-h-14 items-center gap-3 border-b border-line text-sm">
                <span className="w-6 text-muted">р{i + 1}</span>
                <span className="flex-1">{formatKg(w.weight)} × {w.reps}</span>
                <button
                  type="button"
                  aria-label={done ? `Разминка ${i + 1}: отменить` : `Разминка ${i + 1}: сделано`}
                  onClick={() =>
                    done
                      ? void deleteSet(done.id)
                      : void logSet({ sessionId: session.id, exerciseId: ex.id, slotId: p.slot.id, setIndex: i, kind: 'warmup', weight: w.weight, reps: w.reps })
                  }
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl ${done ? 'bg-progress text-bg' : 'bg-surface-2 text-muted'}`}
                >
                  <Check size={22} aria-hidden />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex flex-col">
        {Array.from({ length: p.sets }, (_, i) => {
          const done = work.find((s) => s.setIndex === i);
          const prev = last?.sets[i];
          const isActive = !done && i === activeRow;
          return (
            <div key={i} ref={isActive ? activeRef : undefined} className={`border-b border-line py-2 last:border-0 ${isActive ? 'rounded-2xl bg-surface-2/60 px-2' : ''}`}>
              {isActive ? (
                <div className="flex flex-col gap-2">
                  {isKg && (
                    <div className="flex items-center gap-2">
                      <span className="w-18 shrink-0 text-sm text-muted">Вес</span>
                      <div className="flex-1">
                        <Stepper big label={`Вес, подход ${i + 1}`} value={formatKg(weight, false)} unit="кг" onDec={() => setWeight(adjacentWeight(eq, weight, -1))} onInc={() => setWeight(adjacentWeight(eq, weight, 1))} />
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="w-18 shrink-0 text-sm text-muted">{ex.unit === 'seconds' ? 'Секунды' : isKg ? 'Повторы' : `Подход ${i + 1}`}</span>
                    <div className="flex-1">
                      <Stepper
                        big
                        label={`${ex.unit === 'seconds' ? 'Секунды' : 'Повторы'}, подход ${i + 1}`}
                        value={reps[i]}
                        unit={ex.unit === 'seconds' ? 'с' : undefined}
                        onDec={() => setReps((r) => r.map((v, j) => (j === i ? Math.max(1, v - repStep) : v)))}
                        onInc={() => setReps((r) => r.map((v, j) => (j === i ? v + repStep : v)))}
                      />
                    </div>
                  </div>
                  {/* Одна понятная кнопка вместо значка-галочки: что нажать — не нужно угадывать */}
                  <button
                    type="button"
                    aria-label={`Подход ${i + 1}: записать`}
                    disabled={busy}
                    onClick={() => void check(i)}
                    className="mt-1 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-semibold text-on-primary active:scale-[0.98] disabled:opacity-60"
                  >
                    <Check size={24} strokeWidth={2.6} aria-hidden /> Подход {i + 1} сделан
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="w-5 text-center text-sm font-semibold text-muted">{i + 1}</span>
                  <button
                    type="button"
                    disabled={!!done}
                    onClick={() => setActiveRow(i)}
                    className={`min-h-14 flex-1 text-left text-[22px] font-semibold tabular-nums ${done ? '' : 'text-muted'}`}
                    aria-label={done ? undefined : `Подход ${i + 1}: изменить`}
                  >
                    {done ? valueText(ex, done.weight, done.reps) : valueText(ex, isKg ? weight : 0, reps[i]!)}
                  </button>
                  <CheckButton i={i} done={!!done} busy={busy} onClick={() => (done ? void deleteSet(done.id) : void check(i))} />
                </div>
              )}
              {prev && <p className={`mt-1 text-xs text-muted ${isActive ? 'text-center' : 'pl-8'}`}>прошлый раз {valueText(ex, prev.weight, prev.reps)}</p>}
            </div>
          );
        })}
      </div>
    </article>
  );
}

function CheckButton({ i, done, busy, onClick }: { i: number; done: boolean; busy: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={done ? `Подход ${i + 1}: отменить запись` : `Подход ${i + 1}: записать`}
      disabled={busy}
      onClick={onClick}
      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition-colors ${
        done ? 'bg-progress text-bg' : 'bg-primary text-on-primary active:scale-95'
      }`}
    >
      <Check size={26} strokeWidth={2.6} aria-hidden />
    </button>
  );
}

// ---------- Отдых ----------

/**
 * Панель отдыха внизу экрана: карточка упражнения остаётся доступной — можно поправить вес
 * следующего подхода или открыть «Как делать», пока идёт отсчёт. Следующая галочка сама
 * запускает новый отдых, отдельный тап «Продолжить» не нужен.
 */
function RestPanel({ timer, now, sound, nextText, lastSet }: { timer: RestTimer; now: number; sound: boolean; nextText: string | null; lastSet?: SetLog }) {
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
  const size = 104;
  const stroke = 8;
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  const frac = done ? 1 : Math.max(0, Math.min(1, left / timer.total));
  return (
    <div className="vv-bottom animate-sheet-in fixed inset-x-0 bottom-0 z-30 mx-auto max-w-xl" role="region" aria-label="Отдых">
      <div className="pb-safe rounded-t-3xl border-t border-line bg-surface px-4 pt-3 text-ink shadow-[0_-12px_32px_rgb(0_0_0/0.45)]">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
              <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={done ? 'var(--progress)' : 'var(--energy)'}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={c * (1 - frac)}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-[28px] leading-none font-semibold tabular-nums ${done ? 'text-progress' : ''}`} role="timer">
                {done ? '0:00' : fmtClock(Math.ceil(left))}
              </span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-medium ${done ? 'text-progress' : 'text-muted'}`}>{done ? 'Отдых окончен' : 'Отдых'}</p>
            {nextText ? (
              <p className="mt-0.5 leading-snug">
                <span className="text-sm text-muted">Следующий подход</span>
                <br />
                <b className="text-lg">{nextText}</b>
              </p>
            ) : (
              <p className="mt-0.5 text-lg font-semibold">Дальше — следующее упражнение</p>
            )}
          </div>
        </div>

        {lastSet && (
          <div className="mt-3 flex items-center gap-2">
            <span className="w-18 shrink-0 text-sm leading-tight text-muted">Ещё мог, повторов</span>
            {([0, 1, 2, 3] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => void updateSet(lastSet.id, { rir: lastSet.rir === v ? undefined : v })}
                aria-pressed={lastSet.rir === v}
                aria-label={`Ещё мог: ${v === 3 ? '3 и больше' : v}`}
                className={`h-11 flex-1 rounded-xl text-base font-semibold ${lastSet.rir === v ? 'bg-primary text-on-primary' : 'bg-surface-2'}`}
              >
                {v === 3 ? '3+' : v}
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 flex gap-2 pb-3">
          {done ? (
            <Button size="lg" className="flex-1" onClick={() => void stopRest()}>
              <Check size={20} aria-hidden /> Готов
            </Button>
          ) : (
            <>
              <Button size="lg" variant="secondary" className="flex-1" onClick={() => void extendRest(30)}>
                <Plus size={20} aria-hidden /> 30 с
              </Button>
              <Button size="lg" variant="secondary" className="flex-1" onClick={() => void stopRest()}>
                <SkipForward size={20} aria-hidden /> Пропустить
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Итог ----------

function Summary({ session, sessions }: { session: WorkoutSession; sessions: WorkoutSession[] }) {
  const all = useAllSets();
  const mine = all.filter((s) => s.sessionId === session.id);
  const finishedBefore = new Set(sessions.filter((s) => s.finishedAt !== undefined && s.startedAt < session.startedAt).map((s) => s.id));
  const prior = all.filter((s) => finishedBefore.has(s.sessionId));
  const records: RecordHit[] = findRecords(mine, prior);
  const vol = volume(mine);
  const prev = sessions
    .filter((s) => s.workout === session.workout && s.finishedAt !== undefined && s.startedAt < session.startedAt && !s.isCalibration)
    .sort((a, b) => b.startedAt - a.startedAt)[0];
  const prevVol = prev ? volume(all.filter((s) => s.sessionId === prev.id)) : 0;
  const diff = prevVol > 0 ? Math.round(((vol - prevVol) / prevVol) * 100) : null;
  const minutes = Math.round(((session.finishedAt ?? Date.now()) - session.startedAt) / 60000);
  const workCount = mine.filter((s) => s.kind === 'work').length;
  return (
    <div className="pt-safe flex min-h-full flex-col bg-bg px-4 pb-8 text-ink">
      <h1 className="mt-6 text-2xl font-semibold">Тренировка {session.workout} завершена</h1>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat label="Длительность" value={`${minutes} мин`} />
        <Stat label="Объём" value={`${formatInt(Math.round(vol / 100))} кг`} />
        <Stat label="Подходов" value={String(workCount)} />
      </div>
      {diff !== null && (
        <p className="mt-3 rounded-2xl bg-surface p-3 text-center">
          Объём к прошлой тренировке {session.workout}:{' '}
          <b className={diff >= 0 ? 'text-progress' : 'text-warn'}>
            {diff >= 0 ? '↑' : '↓'} {Math.abs(diff)}%
          </b>
        </p>
      )}
      <h2 className="mt-6 mb-2 text-sm font-semibold text-muted">Рекорды</h2>
      {records.length === 0 ? (
        <p className="rounded-2xl bg-surface p-3 text-muted">В этот раз без рекордов — главное, что тренировка сделана.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {records.map((r) => (
            <li key={r.setId + r.kind} className="flex items-center gap-3 rounded-2xl bg-surface p-3">
              <Medal size={26} className="text-warn" aria-hidden />
              <span className="flex-1">
                <b>{getExercise(r.exerciseId).name}</b>
                <br />
                <span className="text-sm text-muted">
                  {r.kind === 'weight' ? `${formatKg(r.weight)} × ${r.reps} — лучший вес на ${r.reps}+` : `e1RM ${formatScaled(r.e1rm ?? 0, 100, 1)}${NBSP}кг`}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex-1" />
      <Button size="lg" className="mt-8 w-full" onClick={() => navigate('today', true)}>
        Готово
      </Button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface p-3 text-center">
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
