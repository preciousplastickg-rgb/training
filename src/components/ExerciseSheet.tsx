import { CircleAlert, CircleCheck, ExternalLink, TriangleAlert, Wrench } from 'lucide-react';
import { useState } from 'react';
import { ANIMATION_BY_ID, type AngleGuide, type ExerciseAnimation } from '../data/animations';
import { EXERCISE_BY_ID, MUSCLE_NAMES, videoUrl } from '../data/exercises';
import type { Exercise, Muscle } from '../db/types';
import type { Phase } from '../domain/pose';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { Mannequin, type MannequinFrame } from './body/Mannequin';
import { MuscleMap, exerciseColors } from './body/MuscleMap';
import { Sheet } from './Sheet';
import { Button, Tabs } from './ui';

type Mode = 'play' | MannequinFrame;

/** «Как делать» — SPEC 6.6. */
export function ExerciseSheet({ exerciseId, onClose }: { exerciseId: string | null; onClose: () => void }) {
  const ex = exerciseId ? EXERCISE_BY_ID[exerciseId] : undefined;
  if (!ex) return null;
  return (
    <Sheet open title={ex.name} onClose={onClose}>
      {/* key: при смене упражнения режим и фаза начинаются заново */}
      <ExerciseBody key={ex.id} ex={ex} />
    </Sheet>
  );
}

function ExerciseBody({ ex }: { ex: Exercise }) {
  const anim = ANIMATION_BY_ID[ex.id];
  const reduced = useReducedMotion();
  const [mode, setMode] = useState<Mode>(reduced ? 'end' : 'play');
  const [phase, setPhase] = useState<Phase>('rest');
  return (
    <div className="px-2 pb-2">
      {anim && <FigureCard anim={anim} mode={mode} onMode={setMode} phase={phase} onPhase={setPhase} />}
      {anim && anim.angles.length > 0 && <AngleList anim={anim} mode={mode} phase={phase} />}
      <Muscles ex={ex} />

      <h3 className="mt-5 mb-2 text-sm font-semibold text-muted">Ключевые моменты</h3>
      <ul className="flex flex-col gap-2">
        {ex.cues.map((c) => (
          <li key={c} className="flex gap-2">
            <CircleCheck size={20} className="mt-0.5 shrink-0 text-accent" aria-hidden />
            <span>{c}</span>
          </li>
        ))}
      </ul>

      <h3 className="mt-5 mb-2 text-sm font-semibold text-muted">Частые ошибки</h3>
      <ul className="flex flex-col gap-2">
        {ex.mistakes.map((m) => (
          <li key={m} className="flex gap-2">
            <CircleAlert size={20} className="mt-0.5 shrink-0 text-warn" aria-hidden />
            <span>{m}</span>
          </li>
        ))}
      </ul>

      {ex.setup && (
        <>
          <h3 className="mt-5 mb-2 text-sm font-semibold text-muted">Настройка</h3>
          <p className="flex gap-2">
            <Wrench size={20} className="mt-0.5 shrink-0 text-muted" aria-hidden />
            <span>{ex.setup}</span>
          </p>
        </>
      )}

      <a href={videoUrl(ex)} target="_blank" rel="noreferrer" className="mt-5 block">
        <Button variant="secondary" className="w-full" tabIndex={-1}>
          <ExternalLink size={18} aria-hidden /> Видео
        </Button>
      </a>
      <p className="mt-1 text-center text-xs text-muted">Откроется поиск на YouTube, нужна сеть</p>
    </div>
  );
}

/** Название крайнего кадра по направлению движения: «Верх» / «Низ». */
function frameName(anim: ExerciseAnimation, frame: MannequinFrame): 'Верх' | 'Низ' {
  const endIsLow = anim.direction === 'down';
  return (frame === 'end') === endIsLow ? 'Низ' : 'Верх';
}

function FigureCard({
  anim, mode, onMode, phase, onPhase,
}: {
  anim: ExerciseAnimation;
  mode: Mode;
  onMode: (m: Mode) => void;
  phase: Phase;
  onPhase: (p: Phase) => void;
}) {
  const isStatic = anim.direction === 'static';
  return (
    <section className="rounded-3xl border border-line bg-surface p-2">
      {!isStatic && (
        <Tabs
          value={mode}
          onChange={onMode}
          items={[
            { value: 'play', label: 'Движение' },
            { value: 'start', label: frameName(anim, 'start') },
            { value: 'end', label: frameName(anim, 'end') },
          ]}
        />
      )}
      <div className="flex justify-center">
        <Mannequin exerciseId={anim.exerciseId} size={300} frame={isStatic ? 'end' : mode === 'play' ? undefined : mode} onPhase={onPhase} />
      </div>
      <TempoStrip anim={anim} phase={mode === 'play' ? phase : null} />
    </section>
  );
}

/** Темп: фазы цикла пропорционально длительности, текущая подсвечена; фаза усилия — жирным. */
function TempoStrip({ anim, phase }: { anim: ExerciseAnimation; phase: Phase | null }) {
  if (anim.direction === 'static') {
    return <p className="pb-2 text-center text-sm font-medium">{anim.hold_seconds ?? 'Статика'}</p>;
  }
  const fmt = (n: number) => String(n).replace('.', ',');
  const down = `Вниз ${fmt(anim.tempo.down)} с`;
  const up = `Вверх ${fmt(anim.tempo.up)} с`;
  const toEndConc = anim.direction === anim.concentric;
  const segs: { id: Phase; label: string; dur: number; effort: boolean }[] = [
    { id: 'toEnd', label: anim.direction === 'down' ? down : up, dur: anim.direction === 'down' ? anim.tempo.down : anim.tempo.up, effort: toEndConc },
    { id: 'pause', label: 'пауза', dur: anim.tempo.pause, effort: false },
    { id: 'toStart', label: anim.direction === 'down' ? up : down, dur: anim.direction === 'down' ? anim.tempo.up : anim.tempo.down, effort: !toEndConc },
  ];
  return (
    <div className="px-2 pt-1 pb-2" aria-label="Темп">
      <div className="flex gap-1">
        {segs.map((s) => (
          <div key={s.id} className="min-w-0" style={{ flexGrow: Math.max(0.9, s.dur), flexBasis: 0 }}>
            <div className={`h-1.5 rounded-full transition-colors duration-200 ${phase === s.id ? 'bg-accent' : 'bg-surface-2'}`} />
            <p className={`mt-1 truncate text-center text-[12px] ${s.effort ? 'font-semibold text-ink' : 'text-muted'}`}>{s.label}</p>
          </div>
        ))}
      </div>
      <p className="mt-0.5 text-center text-[11px] text-muted">Жирным — фаза усилия: мышцы на фигуре горят ярче</p>
    </div>
  );
}

/** Подпись подсказки: что и какой угол. */
export function guideText(g: AngleGuide): { title: string; value?: string } {
  if (g.reference === 'along' || (g.reference === 'horizontal' && g.value === 0 && !g.text)) return { title: g.label };
  return { title: g.label, value: g.text ?? `~${g.value}° от ${g.reference === 'vertical' ? 'вертикали' : 'горизонтали'}` };
}

/** Углы — постоянно, списком с номерами как на фигуре. Группа подсвечивается, когда фигура в этой точке. */
function AngleList({ anim, mode, phase }: { anim: ExerciseAnimation; mode: Mode; phase: Phase }) {
  const isStatic = anim.direction === 'static';
  const frames: MannequinFrame[] = isStatic ? ['end'] : (['start', 'end'] as const).filter((f) => anim.angles.some((g) => g.keyframe === f));
  return (
    <section className="mt-3 flex flex-col gap-2">
      {frames.map((f) => {
        const active = isStatic || mode === f || (mode === 'play' && ((f === 'end' && phase === 'pause') || (f === 'start' && phase === 'rest')));
        const title = isStatic ? 'Положение' : frameName(anim, f) === 'Низ' ? 'В нижней точке' : 'В верхней точке';
        return (
          <div
            key={f}
            className={`rounded-2xl border p-3 transition-colors duration-200 ${active ? 'border-[color-mix(in_oklab,var(--guide)_45%,transparent)] bg-[color-mix(in_oklab,var(--guide)_8%,transparent)]' : 'border-line'}`}
          >
            <h3 className="mb-1 text-sm font-semibold text-muted">{title}</h3>
            <ul className="flex flex-col">
              {anim.angles.map((g, i) => {
                if (!isStatic && g.keyframe !== f) return null;
                const t = guideText(g);
                return (
                  <li key={i} className="flex items-start gap-3 py-1.5">
                    <span
                      className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
                      style={{ background: 'var(--guide)', color: 'var(--surface)' }}
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap justify-between gap-x-2">
                        <span className="font-medium">{t.title}</span>
                        {t.value && <span className="text-muted tabular-nums">{t.value}</span>}
                      </span>
                      {g.warn && (
                        <span className="mt-0.5 flex items-center gap-1 text-sm text-warn">
                          <TriangleAlert size={14} aria-hidden /> {g.warn}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

/** Мышцы: маленькие карты спереди и сзади и названия. */
function Muscles({ ex }: { ex: Exercise }) {
  const colors = exerciseColors(ex.muscles.primary, ex.muscles.secondary);
  const row = (names: readonly Muscle[], color: string) =>
    names.map((m) => (
      <li key={m} className="flex items-center gap-2">
        <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
        {MUSCLE_NAMES[m]}
      </li>
    ));
  return (
    <section className="mt-3 rounded-2xl border border-line p-3">
      <h3 className="mb-2 text-sm font-semibold text-muted">Мышцы</h3>
      <div className="flex items-center gap-4">
        <div className="flex shrink-0 gap-1">
          <MuscleMap view="front" colors={colors} width={56} glow={false} />
          <MuscleMap view="back" colors={colors} width={56} glow={false} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2 text-sm">
          <div>
            <p className="text-xs text-muted">Основные</p>
            <ul className="mt-0.5 flex flex-col gap-0.5">{row(ex.muscles.primary, 'var(--m-primary)')}</ul>
          </div>
          {ex.muscles.secondary.length > 0 && (
            <div>
              <p className="text-xs text-muted">Помогают</p>
              <ul className="mt-0.5 flex flex-col gap-0.5">{row(ex.muscles.secondary, 'var(--m-secondary)')}</ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
