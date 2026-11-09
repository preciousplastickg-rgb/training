// Режим тренировки — SPEC 6.2, макеты BActive / BRest / BSummary (REDESIGN 4).
// Тёмная палитра независимо от темы, один подход на экране, зоны нажатия ≥ 56 px.

import { ArrowDown, ArrowUp, Check, ChevronDown, Equal, Flame, Info, Minus, Plus, StickyNote, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { navigate } from '../../app/router';
import { beep, unlockAudio } from '../../app/sound';
import { ExerciseSheet } from '../../components/ExerciseSheet';
import type { HowToTab } from '../../components/twin/TwinCards';
import { useManifest, useTwin3d } from '../../components/twin/useTwin';
import { Sheet } from '../../components/Sheet';
import { Button, Caps } from '../../components/ui';
import { db, updateSettings } from '../../db/db';
import { useLiveQuery } from '../../db/useLiveQuery';
import {
  deleteSet, discardSession, extendRest, finishSession, logSet, startRest, stopRest, updateSession, updateSet, type RestTimer,
} from '../../db/repo';
import type { CardioMachine, Exercise, Kg100, ProgramSlot, SaunaRounds, SetLog, Settings, WorkoutSession } from '../../db/types';
import { formatInt, formatKg, formatScaled, formatWeekdayDate, NBSP, pluralRu } from '../../domain/format';
import { lastSessionSets, recentVolumes, suggestionFor } from '../../domain/history';
import { isFirstInBlock, supersetRole, workoutPlan, type PlannedExercise } from '../../domain/program';
import { MANUAL_TEXT, type Suggestion } from '../../domain/progression';
import { sessionRecords, volume, type RecordHit } from '../../domain/records';
import { nextGym } from '../../domain/week';
import { adjacentWeight, barWeightFor, platesPerSide, warmupSets } from '../../domain/weights';
import { getExercise } from '../../data/exercises';
import {
  CARDIO_BY_WORKOUT, CARDIO_HINTS, CARDIO_MINUTES, CARDIO_NAMES, NEW_BLOCK_BANNER, SAUNA_HINT, WARMUP_CHECKLIST, WARMUP_MINUTES,
} from '../../data/program';
import { useActiveSession, useAllSets, useExerciseNotes, useKv, useLightWeeks, useRestTimer, useSessions, useSessionSets, useSettings, useSlots } from '../../hooks/useData';
import { kvDel, kvSet } from '../../db/repo';
import { useNow } from '../../hooks/useNow';
import { useWakeLock } from '../../hooks/useWakeLock';

const defaultWeight = (ex: Exercise, settings: Settings): Kg100 => {
  if (ex.unit === 'assist_kg') return 3000;
  if (ex.equipment === 'barbell') return barWeightFor(ex, settings) ?? settings.barWeight;
  return ex.equipment === 'dumbbell' ? 1000 : ex.equipment === 'cable' ? 2000 : ex.equipment === 'machine' ? 4000 : 0;
};

/** Шаги тренировки: разминка-чеклист, упражнения, кардио (SPEC 6.2). Индекс упражнения — его место в плане. */
type Step = { kind: 'warmup' } | { kind: 'exercise'; index: number } | { kind: 'cardio' };

const fmtClock = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
};

function valueText(ex: Exercise, weight: Kg100, reps: number): string {
  if (ex.unit === 'seconds') return `${reps}${NBSP}с`;
  if (ex.unit === 'assist_kg') return `−${formatKg(weight, false)} × ${reps}`;
  if (ex.unit === 'reps' || weight === 0) return `${reps} повт.`;
  return `${formatKg(weight, false)} × ${reps}`;
}

const SECTION_TITLES = { main: 'Основной блок', accessory: 'Дополнительный блок' } as const;

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
  const lightWeeks = useLightWeeks();
  if (!sessions || !allSets || !settings || !slots) return <div className="min-h-full bg-bg" />;
  return <ActiveWorkoutView session={session} onFinished={onFinished} sessions={sessions} allSets={allSets} settings={settings} slots={slots} lightWeeks={lightWeeks} />;
}

function ActiveWorkoutView({
  session, onFinished, sessions, allSets, settings, slots, lightWeeks,
}: {
  session: WorkoutSession;
  onFinished: (id: string) => void;
  sessions: WorkoutSession[];
  allSets: SetLog[];
  settings: Settings;
  slots: ProgramSlot[];
  lightWeeks: ReturnType<typeof useLightWeeks>;
}) {
  const sessionSets = useSessionSets(session.id);
  const timer = useRestTimer();
  const now = useNow(250);
  const notes = useExerciseNotes();
  useWakeLock(true);

  const plan = useMemo(() => workoutPlan(session.workout, session.date, slots, settings, { lightWeeks }), [session, slots, settings, lightWeeks]);
  const workDone = (exId: string) => sessionSets.filter((s) => s.exerciseId === exId && s.kind === 'work');
  const remaining = (p: PlannedExercise) => Math.max(0, p.sets - workDone(p.exercise.id).length);
  const firstOpen = plan.findIndex((p) => remaining(p) > 0);
  // Чек-лист разминки (SPEC 3.5) — первый шаг, пока не отмечен; пробная тренировка без него.
  const warmupKey = `warmup:${session.id}`;
  const warmupDone = useKv<boolean>(warmupKey) === true || session.isCalibration;
  const [step, setStep] = useState<Step | null>(null);
  const current: Step = step ?? (!warmupDone ? { kind: 'warmup' } : firstOpen >= 0 ? { kind: 'exercise', index: firstOpen } : session.cardio ? { kind: 'exercise', index: 0 } : { kind: 'cardio' });
  const exIndex = current.kind === 'exercise' ? current.index : -1;
  const setIdx = (i: number) => setStep({ kind: 'exercise', index: i });
  const p = exIndex >= 0 ? plan[exIndex] : undefined;
  const firstInBlock = isFirstInBlock(session.date, sessions) && !session.isCalibration;

  const totalPlanned = plan.reduce((a, x) => a + x.sets, 0);
  const totalDone = plan.reduce((a, x) => a + Math.min(x.sets, workDone(x.exercise.id).length), 0);
  const [info, setInfo] = useState<string | null>(null);
  const [infoTab, setInfoTab] = useState<HowToTab | undefined>(undefined);
  const [confirm, setConfirm] = useState(false);
  const [list, setList] = useState(false);

  const suggestions = new Map(
    plan.map((x) => [x.exercise.id, suggestionFor(x, allSets, sessions, { sessionId: session.id, isDeload: session.isDeload, isCalibration: session.isCalibration })]),
  );

  // Разминочные подходы: первое упражнение тренировки и базовые со штангой (SPEC 5.3).
  const withWarmupSets = (i: number) => i === 0 || (plan[i]!.section === 'main' && plan[i]!.exercise.equipment === 'barbell');

  /** После подхода: отдых и/или переход к следующему упражнению. Суперсет: после `a` сразу `b`, отдых — после `b` (SPEC 3.4). */
  const afterSet = async (i: number) => {
    const cur = plan[i]!;
    const role = supersetRole(plan, i);
    const doneNow = workDone(cur.exercise.id).length + 1;
    const leftHere = cur.sets - doneNow;
    let next = i;
    let rest = cur.restSeconds;
    if (role === 'lead') {
      const partner = plan.findIndex((x) => x.slot.code === cur.slot.supersetWith);
      if (partner >= 0 && remaining(plan[partner]!) > 0) {
        next = partner;
        rest = 0;
      } else if (leftHere <= 0) {
        next = nextOpen(i);
      }
    } else if (role === 'follow') {
      const lead = plan.findIndex((x) => x.slot.code === cur.slot.supersetWith);
      if (lead >= 0 && remaining(plan[lead]!) > 0) next = lead;
      else if (leftHere <= 0) next = nextOpen(i);
    } else if (leftHere <= 0) {
      next = nextOpen(i);
    }
    const anyLeft = plan.some((x, j) => (j === i ? leftHere > 0 : remaining(x) > 0));
    if (next !== i) setIdx(next);
    else if (!anyLeft) setStep({ kind: 'cardio' });
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
  const workHere = p ? workDone(p.exercise.id).sort((a, b) => a.setIndex - b.setIndex) : [];
  const doneHere = workHere.length;
  const currentIdx = p ? firstOpenIndex(p.sets, workHere) : 0;
  // Своя заметка («стойки на 4») — третьей строкой шапки: карточка подхода и так впритык к высоте экрана.
  const note = p ? notes.find((n) => n.exerciseId === p.exercise.id) : undefined;
  const headerLine =
    current.kind === 'warmup' ? `Разминка · ${fmtClock(elapsed)}` : current.kind === 'cardio' ? `Кардио · ${fmtClock(elapsed)}` : `Упражнение ${exIndex + 1} из ${plan.length} · ${fmtClock(elapsed)}`;
  const headerTitle =
    current.kind === 'warmup' ? `${WARMUP_MINUTES} минут перед залом` : current.kind === 'cardio' ? CARDIO_NAMES[CARDIO_BY_WORKOUT[session.workout]] : p ? (p.exercise.short ?? p.exercise.name) : `Тренировка ${session.workout}`;

  // Новый подход, отдых или другое упражнение — всегда с начала экрана.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [exIndex, current.kind, resting, doneHere]);

  return (
    <div ref={scrollRef} className="flex h-full flex-col overflow-y-auto bg-bg text-ink">
      <header className="pt-safe shrink-0 px-4">
        <div className="flex items-center gap-2.5 pt-2">
          <div className="min-w-0 flex-1">
            {/* 18 + 22 + 16 px — три строки с заметкой ровно в высоту кнопок 56: шапка не растёт, подход помещается на экран. */}
            <p className="truncate text-[13px] leading-[18px] whitespace-nowrap text-muted tabular-nums">
              {headerLine}
              {mode}
            </p>
            <h1 className="truncate text-[17px] leading-[22px] font-extrabold">{headerTitle}</h1>
            {p && note && (
              <p className="truncate text-[12px] leading-4 font-semibold text-primary">
                <StickyNote size={12} strokeWidth={2.4} className="mr-1 inline align-[-1px]" aria-hidden />
                {note.text}
              </p>
            )}
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
        {p && <SetTracker ex={p.exercise} total={p.sets} work={workHere} current={currentIdx} resting={resting} onUndo={(id) => void deleteSet(id)} />}
      </header>

      {firstInBlock && current.kind !== 'cardio' && (
        <p className="mx-4 mt-3 rounded-2xl bg-primary px-4 py-2.5 text-[13px] leading-[18px] font-bold text-on-primary" role="note">
          {NEW_BLOCK_BANNER}
        </p>
      )}

      {current.kind === 'warmup' && (
        <WarmupChecklist onDone={() => void kvSet(warmupKey, true).then(() => setStep(firstOpen >= 0 ? { kind: 'exercise', index: firstOpen } : { kind: 'cardio' }))} />
      )}

      {current.kind === 'cardio' && (
        <CardioStep
          session={session}
          onDone={(cardio) => void (cardio ? updateSession(session.id, { cardio }) : Promise.resolve()).then(() => setConfirm(true))}
          onBack={() => setIdx(Math.max(0, firstOpen))}
        />
      )}

      {p &&
        (resting ? (
          <RestScreen
            timer={timer}
            now={now}
            sound={settings.sound}
            next={nextSetText(plan, exIndex, sessionSets, suggestions)}
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
            withWarmup={withWarmupSets(exIndex) && !session.isCalibration}
            onInfo={(tab) => (setInfoTab(tab), setInfo(p.exercise.id))}
            onLogged={() => afterSet(exIndex)}
          />
        ))}

      <ExerciseSheet exerciseId={info} tab={infoTab} onClose={() => setInfo(null)} />

      <Sheet open={list} title="Упражнения" kicker={`Тренировка ${session.workout} · ${totalDone} из ${totalPlanned} подходов`} onClose={() => setList(false)}>
        <ol className="theme-dark flex flex-col rounded-3xl bg-surface px-[18px] py-1">
          {plan.map((x, i) => {
            const d = Math.min(x.sets, workDone(x.exercise.id).length);
            const done = d >= x.sets;
            const sectionStart = i === 0 || plan[i - 1]!.section !== x.section;
            return (
              <li key={x.slot.id} className="border-t border-line first:border-t-0">
                {sectionStart && <Caps className="pt-3 pb-1">{SECTION_TITLES[x.section]}</Caps>}
                <button
                  type="button"
                  onClick={() => {
                    setIdx(i);
                    setList(false);
                  }}
                  aria-current={i === exIndex ? 'step' : undefined}
                  aria-label={`${i + 1}. ${x.exercise.name}${done ? ', сделано' : ''}`}
                  className="flex min-h-14 w-full items-center gap-3 text-left active:opacity-70"
                >
                  <span className={`font-display w-[22px] text-[13px] font-semibold tabular-nums ${done ? 'text-muted' : 'text-primary'}`}>{String(i + 1).padStart(2, '0')}</span>
                  <span className={`flex-1 text-[15px] ${i === exIndex ? 'font-extrabold' : 'font-semibold'} ${done ? 'text-muted' : ''}`}>
                    {x.exercise.name}
                    {x.slot.supersetWith ? <span className="text-[13px] font-semibold text-muted"> · суперсет</span> : null}
                  </span>
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
          <li className="border-t border-line">
            <Caps className="pt-3 pb-1">Кардио</Caps>
            <button
              type="button"
              onClick={() => {
                setStep({ kind: 'cardio' });
                setList(false);
              }}
              aria-current={current.kind === 'cardio' ? 'step' : undefined}
              className="flex min-h-14 w-full items-center gap-3 text-left active:opacity-70"
            >
              <span className="flex w-[22px] justify-center text-primary"><Flame size={16} aria-hidden /></span>
              <span className={`flex-1 text-[15px] ${current.kind === 'cardio' ? 'font-extrabold' : 'font-semibold'}`}>{CARDIO_NAMES[CARDIO_BY_WORKOUT[session.workout]]}</span>
              <span className="text-[13px] text-muted tabular-nums">{session.cardio ? `${session.cardio.minutes} мин` : `${CARDIO_MINUTES} мин`}</span>
            </button>
          </li>
        </ol>
      </Sheet>

      <Sheet open={confirm} title="Завершить тренировку?" onClose={() => setConfirm(false)}>
        <div className="theme-dark flex flex-col gap-2 rounded-2xl p-2">
          <p className="px-2 pb-2 text-muted">
            Сделано {totalDone} из {totalPlanned} подходов.{totalDone < totalPlanned ? ' Незаписанные подходы не попадут в историю.' : ''}
            {session.cardio ? ` Кардио ${session.cardio.minutes} мин.` : ' Кардио не записано.'}
          </p>
          <SaunaPicker value={session.saunaRounds} onChange={(v) => void updateSession(session.id, { saunaRounds: v })} />
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
  const p = plan[current];
  if (!p) return { label: 'Дальше', value: 'кардио' };
  const done = sets.filter((s) => s.exerciseId === p.exercise.id && s.kind === 'work');
  if (done.length >= p.sets) return { label: 'Дальше', value: 'следующее упражнение' };
  const s = sug.get(p.exercise.id);
  const weight = done[done.length - 1]?.weight ?? s?.weight ?? 0;
  const reps = s?.targets[done.length] ?? p.slot.repMin;
  return { label: 'Следующий подход', value: valueText(p.exercise, weight, reps) };
}

/** Первый незаписанный подход: после отмены среднего подхода запись идёт в него, а не поверх следующего. */
function firstOpenIndex(total: number, work: readonly SetLog[]): number {
  for (let i = 0; i < total; i++) if (!work.some((s) => s.setIndex === i)) return i;
  return total - 1;
}

/**
 * Трекер подходов под шапкой: ячейка на каждый подход. Сделанные — лаймовые с результатом (тап — отменить запись),
 * текущий — с лаймовой обводкой и подписью «сейчас» / «дальше» в отдыхе, будущие — серые с номером.
 */
function SetTracker({
  ex, total, work, current, resting, onUndo,
}: {
  ex: Exercise;
  total: number;
  work: readonly SetLog[];
  current: number;
  resting: boolean;
  onUndo: (id: string) => void;
}) {
  const allDone = work.length >= total;
  return (
    <div
      className="mt-3.5 grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
      role="group"
      aria-label={`Подходы: сделано ${work.length} из ${total}`}
    >
      {Array.from({ length: total }, (_, i) => {
        const done = work.find((s) => s.setIndex === i);
        if (done) {
          return (
            <button
              key={i}
              type="button"
              aria-label={`Подход ${i + 1}: отменить запись`}
              onClick={() => onUndo(done.id)}
              className="flex h-14 min-w-0 flex-col items-center justify-center rounded-2xl bg-primary px-1 text-on-primary active:opacity-80"
            >
              <span className="max-w-full truncate text-[14px] leading-4 font-extrabold tabular-nums">{valueText(ex, done.weight, done.reps)}</span>
              <span className="mt-0.5 flex items-center gap-0.5 text-[10px] leading-3 font-bold tracking-[.08em] uppercase opacity-70">
                <Check size={10} strokeWidth={3.5} aria-hidden /> {i + 1}
              </span>
            </button>
          );
        }
        const isCurrent = !allDone && i === current;
        return (
          <div
            key={i}
            aria-hidden
            className={`flex h-14 flex-col items-center justify-center rounded-2xl ${isCurrent ? 'border-2 border-primary' : 'bg-surface-2 text-muted'}`}
          >
            <span className="font-display text-[17px] leading-5 font-bold tabular-nums">{i + 1}</span>
            {isCurrent && <span className="mt-0.5 text-[10px] leading-3 font-bold tracking-[.08em] text-primary uppercase">{resting ? 'дальше' : 'сейчас'}</span>}
          </div>
        );
      })}
    </div>
  );
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
  /** «Как делать»; tab = '3d' — сразу на вкладке «3D» (docs/TWIN-3D.md, 1). */
  onInfo: (tab?: HowToTab) => void;
  onLogged: () => void;
}) {
  const ex = p.exercise;
  const eq = ex;
  const twin = useTwin3d();
  const has3d = !!useManifest()?.exercises[ex.id] && twin.on;
  const work = logged.filter((s) => s.kind === 'work').sort((a, b) => a.setIndex - b.setIndex);
  const warm = logged.filter((s) => s.kind === 'warmup');
  const isAssist = ex.unit === 'assist_kg';
  const isKg = ex.unit === 'kg' || isAssist;
  const i = firstOpenIndex(p.sets, work);
  const n = i + 1;
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

  // Замена — по code слота и только в текущем блоке (SPEC 3.4).
  const swap = async (to?: string) => {
    const subs = settings.substitutionsBlock === p.slot.block ? { ...settings.substitutions } : {};
    const target = to ?? alt;
    if (isSub && !to) delete subs[p.slot.code];
    else if (target) subs[p.slot.code] = target;
    await updateSettings({ substitutions: subs, substitutionsBlock: p.slot.block });
  };

  const barWeight = barWeightFor(ex, settings);
  const plates = barWeight !== null && !isAssist ? platesPerSide(weight, barWeight, settings.plates) : null;
  const warmups = withWarmup && ex.unit === 'kg' ? warmupSets(eq, weight, barWeight ?? settings.barWeight) : [];
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
  const weightText = isAssist ? `−${formatKg(weight, false)}` : formatKg(weight, false);
  const weightSize = weightText.length <= 2 ? 'text-[88px] leading-[96px]' : weightText.length <= 4 ? 'text-[64px] leading-[80px]' : 'text-[52px] leading-[64px]';

  // Строка прогрессии: значок по режиму, текст — вес и причина.
  const hint = (() => {
    const reason = session.isCalibration ? MANUAL_TEXT : suggestion.reason;
    if (suggestion.mode === 'progress') return { icon: <ArrowUp size={16} strokeWidth={3} aria-hidden />, cls: 'bg-primary text-on-primary', text: reason };
    if (suggestion.mode === 'stall' || suggestion.mode === 'deload') return { icon: <ArrowDown size={16} strokeWidth={3} aria-hidden />, cls: 'bg-warn text-on-primary', text: reason };
    if (suggestion.mode === 'manual' || suggestion.mode === 'switch') return { icon: <Info size={16} strokeWidth={2.6} aria-hidden />, cls: 'bg-surface-2 text-ink', text: reason };
    return { icon: <Equal size={16} strokeWidth={3} aria-hidden />, cls: 'bg-surface-2 text-ink', text: reason };
  })();
  const range = `${p.sets} × ${p.slot.repMin}–${p.slot.repMax}${ex.unit === 'seconds' ? ' с' : ''}${perSideLabel(ex)}`;
  const swapLabel = isSub ? 'Вернуть' : alt ? 'Заменить' : null;
  const switchTo = suggestion.mode === 'switch' && suggestion.switchTo && p.slot.altExerciseIds.includes(suggestion.switchTo) ? suggestion.switchTo : null;

  return (
    <div className="flex flex-1 shrink-0 flex-col">
      <div className="mt-5 flex flex-col items-center gap-1">
        <Caps className="text-primary!">
          {allDone ? 'Все подходы сделаны' : `Подход ${n} из ${p.sets}`}
          {p.slot.supersetWith ? ` · суперсет ${p.slot.code}` : ''}
        </Caps>
        {isKg && (
          <div className="mt-3 flex items-center gap-[18px]">
            <Round label={`Вес, подход ${n}: меньше`} size={64} onClick={() => setWeight(adjacentWeight(eq, weight, -1))}>
              <Minus size={26} strokeWidth={2.6} aria-hidden />
            </Round>
            <div className="flex w-[170px] items-baseline justify-center gap-1.5" aria-label={`Вес, подход ${n}`}>
              <span className={`font-display text-huge font-bold tabular-nums ${weightSize}`}>{weightText}</span>
              <span className="text-xl font-bold text-muted">{isAssist ? 'кг противовес' : 'кг'}</span>
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
            {isKg && suggestion.weight !== null && suggestion.mode !== 'switch' ? (
              <>
                <b>{isAssist ? `−${formatKg(suggestion.weight)}` : formatKg(suggestion.weight)}</b> — {hint.text.replace(/^./, (c) => c.toLowerCase())}
              </>
            ) : (
              hint.text
            )}
          </span>
          {switchTo && (
            <button type="button" onClick={() => void swap(switchTo)} className="h-11 shrink-0 rounded-full bg-primary px-3.5 text-sm font-extrabold text-on-primary active:scale-95">
              Переключить
            </button>
          )}
        </Row>
        {plates && barWeight !== null && (
          <Row>
            <span className="flex-1 text-muted">На сторону</span>
            <span className="font-extrabold tabular-nums">
              {plates.perSide.length ? plates.perSide.map((x) => formatKg(x, false)).join(' + ') : 'только гриф'} · гриф {formatKg(barWeight, false)}
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
        {last && suggestion.mode !== 'progress' && suggestion.mode !== 'hold' && (
          <Row>
            <span className="flex-1 text-muted">Прошлый раз</span>
            <span className="font-extrabold tabular-nums">
              {last.sets[0] && isKg ? `${isAssist ? '−' : ''}${formatKg(last.sets[0].weight, false)} × ` : ''}
              {last.sets.map((s) => s.reps).join(' / ')}
              {ex.unit === 'seconds' ? ' с' : ''}
            </span>
          </Row>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-2.5 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="flex gap-2.5">
          <button type="button" onClick={() => onInfo()} className="h-14 flex-1 rounded-full bg-surface text-[15px] font-bold active:scale-[0.98]">
            Как делать
          </button>
          {has3d && (
            <button
              type="button"
              onClick={() => onInfo('3d')}
              aria-label={`3D: ${p.exercise.name.toLowerCase()}`}
              className="h-14 w-14 shrink-0 rounded-full bg-surface text-[15px] font-extrabold active:scale-[0.98]"
            >
              3D
            </button>
          )}
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
  const records: RecordHit[] = sessionRecords(session, sessions, all);
  const vol = volume(mine);
  const bars = recentVolumes(session, sessions, all, 5);
  const prevVol = bars.length >= 2 ? bars[bars.length - 2]!.volume : 0;
  const diff = prevVol > 0 ? Math.round(((vol - prevVol) / prevVol) * 100) : null;
  const maxVol = Math.max(1, ...bars.map((b) => b.volume));
  const minutes = Math.round(((session.finishedAt ?? Date.now()) - session.startedAt) / 60000);
  const workCount = mine.filter((s) => s.kind === 'work').length;
  const lightWeeks = useLightWeeks();
  const planned = settings ? workoutPlan(session.workout, session.date, slots, settings, { lightWeeks }).reduce((a, p) => a + p.sets, 0) : 0;
  const next = settings ? nextGym(session.date, sessions, settings, lightWeeks) : null;
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
        <div className="flex flex-col gap-1 rounded-3xl bg-surface px-[18px] py-4">
          <Caps>Кардио</Caps>
          <span className="font-display text-[30px] leading-9 font-bold tabular-nums">
            {session.cardio ? session.cardio.minutes : '—'}
            {session.cardio && <span className="font-sans text-[15px] font-bold text-muted"> мин</span>}
          </span>
          <span className="text-[13px] text-muted">{session.cardio ? CARDIO_NAMES[session.cardio.machine].toLowerCase() : 'не записано'}</span>
        </div>
        <div className="flex flex-col gap-2 rounded-3xl bg-surface px-[18px] py-4">
          <Caps>Сауна</Caps>
          <SaunaPicker value={session.saunaRounds} compact onChange={(v) => void updateSession(session.id, { saunaRounds: v })} />
        </div>
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

// ---------- Разминка (чек-лист), кардио и сауна (SPEC 3.5, 3.7) ----------

/** Разминка 10 минут — пункт чек-листа в начале тренировки: отметил всё → первое упражнение. */
function WarmupChecklist({ onDone }: { onDone: () => void }) {
  const [done, setDone] = useState<boolean[]>(() => WARMUP_CHECKLIST.map(() => false));
  const all = done.every(Boolean);
  return (
    <div className="flex flex-1 shrink-0 flex-col">
      <div className="mt-5 flex flex-col items-center gap-1 px-4 text-center">
        <Caps className="text-primary!">Разминка</Caps>
        <p className="font-display text-[26px] leading-8 font-bold">{WARMUP_MINUTES} минут</p>
        <p className="text-[13px] text-muted">Разогрев перед первым подходом</p>
      </div>
      <ul className="mx-4 mt-4 rounded-3xl bg-surface px-[18px] py-1" aria-label="Разминка">
        {WARMUP_CHECKLIST.map((item, i) => (
          <li key={item} className="border-t border-line first:border-t-0">
            <button
              type="button"
              role="checkbox"
              aria-checked={done[i]}
              onClick={() => setDone((d) => d.map((v, k) => (k === i ? !v : v)))}
              className="flex min-h-14 w-full items-center gap-3 text-left active:opacity-70"
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${done[i] ? 'bg-primary text-on-primary' : 'bg-surface-2 text-muted'}`}>
                <Check size={18} strokeWidth={3} aria-hidden />
              </span>
              <span className={`flex-1 text-[15px] ${done[i] ? 'font-semibold text-muted line-through' : 'font-semibold'}`}>{item}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-auto flex flex-col gap-2.5 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={onDone}
          className={`flex h-[72px] w-full items-center justify-center gap-3 rounded-full text-[19px] font-extrabold active:scale-[0.98] ${all ? 'bg-primary text-on-primary' : 'bg-surface text-ink'}`}
        >
          <Check size={24} strokeWidth={3} aria-hidden /> {all ? 'Разминка сделана' : 'Пропустить разминку'}
        </button>
      </div>
    </div>
  );
}

const MACHINES: CardioMachine[] = ['treadmill', 'elliptical', 'bike'];

/** Кардио после дополнительного блока: таймер 15 мин от сохранённого старта, тренажёр подставлен по тренировке (SPEC 6.2). */
function CardioStep({ session, onDone, onBack }: { session: WorkoutSession; onDone: (cardio: WorkoutSession['cardio'] | null) => void; onBack: () => void }) {
  const key = `cardio:${session.id}`;
  const started = useKv<{ startedAt: number; machine: CardioMachine }>(key);
  const now = useNow(1000);
  const [machine, setMachine] = useState<CardioMachine>(session.cardio?.machine ?? started?.machine ?? CARDIO_BY_WORKOUT[session.workout]);
  const total = CARDIO_MINUTES * 60;
  const elapsed = started ? Math.max(0, (now - started.startedAt) / 1000) : 0;
  const left = Math.max(0, total - elapsed);
  const finished = !!started && left <= 0;
  const size = 300;
  const stroke = 18;
  const r = size / 2 - stroke / 2;
  const c = 2 * Math.PI * r;
  const frac = Math.min(1, elapsed / total);
  const done = async () => {
    const minutes = Math.max(1, Math.round(elapsed / 60));
    await kvDel(key);
    onDone({ machine, minutes });
  };
  return (
    <div className="flex flex-1 shrink-0 flex-col" role="region" aria-label="Кардио">
      <div className="mx-4 mt-3 flex gap-2" role="radiogroup" aria-label="Тренажёр">
        {MACHINES.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={machine === m}
            disabled={!!started}
            onClick={() => setMachine(m)}
            className={`h-11 min-w-0 flex-1 truncate rounded-full px-2 text-[13px] font-bold disabled:opacity-60 ${machine === m ? 'bg-primary text-on-primary' : 'bg-surface text-ink'}`}
          >
            {CARDIO_NAMES[m]}
          </button>
        ))}
      </div>
      <div className="relative mx-auto mt-4" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--energy)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <Caps className="tracking-[.1em]">{finished ? 'Кардио сделано' : started ? 'Кардио' : 'Кардио · 15 мин'}</Caps>
          <span role="timer" aria-label={`Осталось ${fmtClock(left)}`} className="font-display text-huge text-[72px] leading-[80px] font-bold tabular-nums">
            {fmtClock(started ? left : total)}
          </span>
          <span className="px-6 text-center text-[13px] text-muted">{CARDIO_HINTS[machine]}</span>
        </div>
      </div>
      <div className="mt-auto flex flex-col gap-2.5 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="flex gap-2.5">
          <button type="button" onClick={onBack} className="h-14 flex-1 rounded-full bg-surface text-[15px] font-bold active:scale-[0.98]">
            К упражнениям
          </button>
          <button type="button" onClick={() => void kvDel(key).then(() => onDone(null))} className="h-14 flex-1 rounded-full bg-surface text-[15px] font-bold active:scale-[0.98]">
            Без кардио
          </button>
        </div>
        {started ? (
          <button type="button" onClick={() => void done()} className="flex h-[72px] w-full items-center justify-center gap-3 rounded-full bg-primary text-[19px] font-extrabold text-on-primary active:scale-[0.98]">
            <Check size={24} strokeWidth={3} aria-hidden /> {finished ? 'Готово' : 'Закончить раньше'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void kvSet(key, { startedAt: Date.now(), machine })}
            className="flex h-[72px] w-full items-center justify-center gap-3 rounded-full bg-primary text-[19px] font-extrabold text-on-primary active:scale-[0.98]"
          >
            <Flame size={24} aria-hidden /> Начать кардио
          </button>
        )}
      </div>
    </div>
  );
}

/** «Сауна: 0 / 1 / 2 / 3 захода» — в итоге тренировки (SPEC 3.7). */
function SaunaPicker({ value, onChange, compact = false }: { value: SaunaRounds | undefined; onChange: (v: SaunaRounds) => void; compact?: boolean }) {
  return (
    <div className={compact ? '' : 'rounded-[22px] bg-surface px-4 py-3'}>
      {!compact && <p className="mb-2 text-[15px] font-extrabold">Сауна: заходов</p>}
      <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Сауна, заходов">
        {([0, 1, 2, 3] as SaunaRounds[]).map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(v)}
            className={`h-12 rounded-full text-lg font-extrabold ${value === v ? 'bg-primary text-on-primary' : 'bg-surface-2'}`}
          >
            {v}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">{SAUNA_HINT}</p>
    </div>
  );
}

function perSideLabel(ex: Exercise): string {
  if (!ex.perSide) return '';
  if (ex.unit === 'seconds') return ' на сторону';
  return ['db_row', 'cable_lateral_raise', 'single_arm_cable_row', 'reverse_grip_pushdown'].includes(ex.id) ? ' на руку' : ' на ногу';
}
