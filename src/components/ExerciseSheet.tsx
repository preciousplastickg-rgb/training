import { Play, Wrench } from 'lucide-react';
import { useState } from 'react';
import { ANIMATION_BY_ID, type AngleGuide, type ExerciseAnimation } from '../data/animations';
import { EXERCISE_BY_ID, videoUrl } from '../data/exercises';
import type { Exercise } from '../db/types';
import { mapViewFor } from '../domain/muscleCallouts';
import type { Phase } from '../domain/pose';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useToday } from '../hooks/useToday';
import { assetUrl, type ManifestExercise } from '../three/assets';
import { ExerciseTwin, MuscleList, type HowToTab } from './twin/TwinCards';
import { useManifest, useTwin3d } from './twin/useTwin';
import { Mannequin, type MannequinFrame } from './body/Mannequin';
import { MuscleCallouts } from './body/MuscleMap';
import { ExerciseNoteRow } from './ExerciseNote';
import { Sheet } from './Sheet';
import { Caps, Tabs } from './ui';

type Mode = 'play' | MannequinFrame;

/**
 * «Как делать» — SPEC 6.6, макет BHowTo (REDESIGN 3). Упражнение с 3D в public/3d/manifest.json — вкладки
 * «3D · Мышцы · Техника» (docs/TWIN-3D.md, 1); без 3D — прежние подсказки и схема мышц.
 */
export function ExerciseSheet({ exerciseId, onClose, tab }: { exerciseId: string | null; onClose: () => void; tab?: HowToTab }) {
  const ex = exerciseId ? EXERCISE_BY_ID[exerciseId] : undefined;
  const manifest = useManifest();
  if (!ex) return null;
  const entry = manifest?.exercises[ex.id];
  return (
    <Sheet open kicker="Как делать" title={ex.name} onClose={onClose}>
      {/* key: при смене упражнения режим и фаза начинаются заново */}
      {entry ? <ExerciseTabs key={ex.id} ex={ex} entry={entry} tab={tab} /> : <ExerciseBody key={ex.id} ex={ex} />}
    </Sheet>
  );
}

function ExerciseTabs({ ex, entry, tab: initial }: { ex: Exercise; entry: ManifestExercise; tab?: HowToTab }) {
  const { on, reduced } = useTwin3d();
  const today = useToday();
  // «Уменьшение движения» в iOS — по умолчанию «Мышцы» вместо «3D» (TWIN-3D 6)
  const [tab, setTab] = useState<HowToTab>(initial ?? (reduced ? 'muscles' : '3d'));
  const stills = (
    <div className="grid grid-cols-2 gap-2" data-testid="twin-stills">
      {entry.stills.map((src, k) => (
        <img key={src} src={assetUrl(src)} alt={k === 0 ? 'Начало движения' : 'Конец движения'} className="w-full rounded-2xl bg-white" />
      ))}
    </div>
  );
  return (
    <div className="flex flex-col gap-4 pb-2">
      <Tabs
        value={tab}
        onChange={setTab}
        items={[{ value: '3d', label: '3D' }, { value: 'muscles', label: 'Мышцы' }, { value: 'technique', label: 'Техника' }]}
      />
      {tab === '3d' && (on ? <ExerciseTwin exerciseId={ex.id} entry={entry} still={false} date={today} /> : stills)}
      {tab === 'muscles' && (
        <>
          {on ? <ExerciseTwin exerciseId={ex.id} entry={entry} still date={today} /> : stills}
          <MuscleList exerciseId={ex.id} />
        </>
      )}
      {/* «Техника» — прежние подсказки целиком: манекен с углами, моменты, ошибки, настройка, заметка, видео */}
      {tab === 'technique' && (
        <div className="twin-palette">
          <ExerciseBody ex={ex} muscleMap={false} />
        </div>
      )}
    </div>
  );
}

function ExerciseBody({ ex, muscleMap = true }: { ex: Exercise; muscleMap?: boolean }) {
  const anim = ANIMATION_BY_ID[ex.id];
  const reduced = useReducedMotion();
  const [mode, setMode] = useState<Mode>(reduced ? 'end' : 'play');
  const [phase, setPhase] = useState<Phase>('rest');
  return (
    <div className="flex flex-col gap-4 pb-2">
      {anim && <FigureCard anim={anim} mode={mode} onMode={setMode} phase={phase} onPhase={setPhase} />}
      {anim && anim.angles.length > 0 && <AngleBlocks anim={anim} mode={mode} phase={phase} />}

      {muscleMap && <section className="rounded-3xl bg-surface px-4 pt-4 pb-[18px]">
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
      </section>}

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
    </div>
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

/** Углы — блоки «В нижней точке» / «В верхней точке»; блок подсвечивается фоном, когда фигура в этой точке. */
function AngleBlocks({ anim, mode, phase }: { anim: ExerciseAnimation; mode: Mode; phase: Phase }) {
  const isStatic = anim.direction === 'static';
  const frames: MannequinFrame[] = isStatic ? ['end'] : (['start', 'end'] as const).filter((f) => anim.angles.some((g) => g.keyframe === f));
  return (
    <>
      {frames.map((f) => {
        const active = isStatic || mode === f || (mode === 'play' && ((f === 'end' && phase === 'pause') || (f === 'start' && phase === 'rest')));
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
