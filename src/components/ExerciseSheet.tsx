import { Play, Wrench } from 'lucide-react';
import { useState } from 'react';
import { ANIMATION_BY_ID, type AngleGuide, type ExerciseAnimation } from '../data/animations';
import { EXERCISE_BY_ID, videoUrl } from '../data/exercises';
import type { Exercise } from '../db/types';
import { mapViewFor } from '../domain/muscleCallouts';
import type { Phase } from '../domain/pose';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useToday } from '../hooks/useToday';
import type { ManifestExercise } from '../three/assets';
import { ExerciseTwin, MuscleList } from './twin/TwinCards';
import { useManifest, useTwin3d } from './twin/useTwin';
import { Mannequin, type MannequinFrame } from './body/Mannequin';
import { MuscleCallouts } from './body/MuscleMap';
import { ExerciseNoteRow } from './ExerciseNote';
import { Sheet } from './Sheet';
import { Caps, Tabs } from './ui';

type Mode = 'play' | MannequinFrame;

/**
 * «Как делать» — SPEC 6.6, макет BHowTo (REDESIGN 3). Упражнение с 3D в public/3d/manifest.json и включённым двойником —
 * один экран без вкладок (9 ноября 2026, по просьбе пользователя): двойник выполняет упражнение с подсветкой мышц
 * (вращение пальцем, щипок, пауза, 0,5×), под ним — мышцы и техника. Без 3D — манекен, схема мышц и подсказки.
 */
export function ExerciseSheet({ exerciseId, onClose }: { exerciseId: string | null; onClose: () => void }) {
  const ex = exerciseId ? EXERCISE_BY_ID[exerciseId] : undefined;
  const manifest = useManifest();
  const { on } = useTwin3d();
  if (!ex) return null;
  const entry = on ? manifest?.exercises[ex.id] : undefined;
  return (
    <Sheet open kicker="Как делать" title={ex.name} onClose={onClose}>
      {/* key: при смене упражнения режим и фаза начинаются заново */}
      {entry ? <ExerciseHowTo3d key={ex.id} ex={ex} entry={entry} /> : <ExerciseBody key={ex.id} ex={ex} />}
    </Sheet>
  );
}

function ExerciseHowTo3d({ ex, entry }: { ex: Exercise; entry: ManifestExercise }) {
  const today = useToday();
  const anim = ANIMATION_BY_ID[ex.id];
  return (
    <div className="flex flex-col gap-4 pb-2">
      <ExerciseTwin exerciseId={ex.id} entry={entry} date={today} />
      <MuscleList exerciseId={ex.id} />
      {anim && anim.angles.length > 0 && <AngleBlocks anim={anim} />}
      <Technique ex={ex} />
    </div>
  );
}

function ExerciseBody({ ex }: { ex: Exercise }) {
  const anim = ANIMATION_BY_ID[ex.id];
  const reduced = useReducedMotion();
  const [mode, setMode] = useState<Mode>(reduced ? 'end' : 'play');
  const [phase, setPhase] = useState<Phase>('rest');
  return (
    <div className="flex flex-col gap-4 pb-2">
      {anim && <FigureCard anim={anim} mode={mode} onMode={setMode} phase={phase} onPhase={setPhase} />}
      {anim && anim.angles.length > 0 && <AngleBlocks anim={anim} mode={mode} phase={phase} />}

      <section className="rounded-3xl bg-surface px-4 pt-4 pb-[18px]">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <Caps as="h3" className="whitespace-nowrap">Мышцы · {mapViewFor(ex.muscles.primary, ex.muscles.secondary) === 'back' ? 'сзади' : 'спереди'}</Caps>
          <span className="flex shrink-0 gap-3 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--m-primary)' }} /> основные
            </span>
            <span className="flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--m-secondary)' }} /> помогают
            </span>
          </span>
        </div>
        <MuscleCallouts ex={ex} />
      </section>

      <Technique ex={ex} />
    </div>
  );
}

/** Техника: ключевые моменты, ошибки, настройка, своя заметка, видео. */
function Technique({ ex }: { ex: Exercise }) {
  return (
    <>
      <NumberedList title="Ключевые моменты" items={ex.cues} badge="bg-primary text-on-primary" />
      <NumberedList title="Частые ошибки" items={ex.mistakes} badge="bg-[color-mix(in_srgb,var(--energy)_18%,transparent)] text-[color:var(--energy)]" mark="!" />

      {ex.setup && (
        <section className="flex flex-col gap-2.5 px-1">
          <Caps as="h3">Настройка</Caps>
          <p className="flex items-start gap-3 text-[15px] leading-[21px]">
            <Wrench size={18} className="mt-0.5 shrink-0 text-muted" aria-hidden />
            <span>{ex.setup}</span>
          </p>
        </section>
      )}

      <section className="rounded-3xl bg-surface px-4 py-1">
        <ExerciseNoteRow exerciseId={ex.id} name={ex.name} />
      </section>

      <a
        href={videoUrl(ex)}
        target="_blank"
        rel="noreferrer"
        className="mt-1 flex h-[52px] items-center justify-center gap-2 rounded-full bg-surface text-[15px] font-extrabold active:opacity-80"
      >
        <Play size={18} fill="currentColor" aria-hidden /> Видео · нужна сеть
      </a>
    </>
  );
}

function NumberedList({ title, items, badge, mark }: { title: string; items: readonly string[]; badge: string; mark?: string }) {
  return (
    <section className="flex flex-col gap-2.5 px-1">
      <Caps as="h3">{title}</Caps>
      <ol className="flex flex-col gap-2.5">
        {items.map((text, i) => (
          <li key={text} className="flex items-start gap-3 text-[15px] leading-[21px]">
            <span className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-xs font-bold ${badge}`} aria-hidden>
              {mark ?? i + 1}
            </span>
            <span>{text}</span>
          </li>
        ))}
      </ol>
    </section>
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
    <section className="flex flex-col gap-3.5 rounded-[28px] bg-surface p-4">
      <div className="flex justify-center">
        <Mannequin exerciseId={anim.exerciseId} size={300} frame={isStatic ? 'end' : mode === 'play' ? undefined : mode} onPhase={onPhase} />
      </div>
      {!isStatic && (
        <Tabs
          variant="lime"
          value={mode}
          onChange={onMode}
          items={[
            { value: 'play', label: 'Движение' },
            { value: 'start', label: frameName(anim, 'start') },
            { value: 'end', label: frameName(anim, 'end') },
          ]}
        />
      )}
      <TempoStrip anim={anim} phase={mode === 'play' ? phase : null} />
    </section>
  );
}

/** Темп: 4 сегмента (вниз · пауза · вверх · отдых) по `tempo`, текущий непрозрачный, фаза усилия — лайм. */
function TempoStrip({ anim, phase }: { anim: ExerciseAnimation; phase: Phase | null }) {
  if (anim.direction === 'static') {
    return <p className="text-center text-sm font-bold">{anim.hold_seconds ?? 'Статика'}</p>;
  }
  const fmt = (n: number) => String(n).replace('.', ',');
  const down = anim.direction === 'down';
  const toEndConc = anim.direction === anim.concentric;
  const segs: { id: Phase; label: string; dur: number; effort: boolean; color: string }[] = [
    { id: 'toEnd', label: down ? `вниз ${fmt(anim.tempo.down)} с` : `вверх ${fmt(anim.tempo.up)} с`, dur: down ? anim.tempo.down : anim.tempo.up, effort: toEndConc, color: 'var(--protein)' },
    { id: 'pause', label: 'пауза', dur: anim.tempo.pause, effort: false, color: 'var(--muted)' },
    { id: 'toStart', label: down ? `вверх ${fmt(anim.tempo.up)} с` : `вниз ${fmt(anim.tempo.down)} с`, dur: down ? anim.tempo.up : anim.tempo.down, effort: !toEndConc, color: 'var(--protein)' },
    { id: 'rest', label: 'отдых', dur: anim.tempo.rest, effort: false, color: 'var(--line)' },
  ];
  return (
    <div className="flex flex-col gap-2 px-0.5" aria-label="Темп">
      <div className="flex h-1.5 gap-1">
        {segs.map((s) => (
          <div
            key={s.id}
            className="rounded-full transition-opacity duration-200"
            style={{ flex: Math.max(0.6, s.dur), background: s.effort ? 'var(--primary)' : s.color, opacity: phase === null || phase === s.id ? 1 : 0.35 }}
          />
        ))}
      </div>
      <div className="flex gap-1 text-xs leading-4">
        {segs.map((s) => (
          <span
            key={s.id}
            className={`min-w-0 truncate ${s.effort ? 'font-bold' : ''} ${phase === s.id ? 'text-ink' : 'text-muted'}`}
            style={{ flex: Math.max(0.6, s.dur) }}
          >
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Подпись подсказки: что и какой угол. */
export function guideText(g: AngleGuide): { title: string; value?: string } {
  if (g.reference === 'along' || (g.reference === 'horizontal' && g.value === 0 && !g.text)) return { title: g.label };
  return { title: g.label, value: g.text ?? `~${g.value}° от ${g.reference === 'vertical' ? 'вертикали' : 'горизонтали'}` };
}

/**
 * Углы — блоки «В нижней точке» / «В верхней точке»; с манекеном блок подсвечивается фоном, когда фигура в этой точке.
 * Без `mode` (под 3D-двойником) — просто список, без подсветки.
 */
function AngleBlocks({ anim, mode, phase }: { anim: ExerciseAnimation; mode?: Mode; phase?: Phase }) {
  const isStatic = anim.direction === 'static';
  const frames: MannequinFrame[] = isStatic ? ['end'] : (['start', 'end'] as const).filter((f) => anim.angles.some((g) => g.keyframe === f));
  return (
    <>
      {frames.map((f) => {
        const active = mode !== undefined && (isStatic || mode === f || (mode === 'play' && ((f === 'end' && phase === 'pause') || (f === 'start' && phase === 'rest'))));
        const title = isStatic ? 'Положение' : frameName(anim, f) === 'Низ' ? 'В нижней точке' : 'В верхней точке';
        return (
          <section
            key={f}
            className="flex flex-col gap-3 rounded-[20px] px-4 py-3.5 transition-colors duration-200"
            style={{ background: active ? 'color-mix(in srgb, var(--guide) 12%, transparent)' : 'transparent' }}
          >
            <Caps as="h3">{title}</Caps>
            <ol className="flex flex-col gap-3">
              {anim.angles.map((g, i) => {
                if (!isStatic && g.keyframe !== f) return null;
                const t = guideText(g);
                return (
                  <li key={i} className="flex items-start gap-3 text-[15px] leading-[21px]">
                    <span
                      className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-xs font-bold"
                      style={{ background: 'var(--guide)', color: 'var(--on-guide)' }}
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold">{t.title}</span>
                      {t.value && <span className="text-muted"> — {t.value}</span>}
                      {g.warn && <span className="mt-0.5 block text-sm text-warn">⚠ {g.warn}</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </>
  );
}
