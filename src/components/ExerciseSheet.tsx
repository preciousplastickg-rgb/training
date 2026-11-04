import { CircleAlert, CircleCheck, ExternalLink, Play, Wrench } from 'lucide-react';
import { useState } from 'react';
import { ANIMATION_BY_ID } from '../data/animations';
import { EXERCISE_BY_ID, videoUrl } from '../data/exercises';
import { tempoText } from '../domain/pose';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { Mannequin } from './body/Mannequin';
import { MuscleMapPair, exerciseColors } from './body/MuscleMap';
import { Sheet } from './Sheet';
import { Button } from './ui';

/** «Как делать» — SPEC 6.6. */
export function ExerciseSheet({ exerciseId, onClose }: { exerciseId: string | null; onClose: () => void }) {
  const ex = exerciseId ? EXERCISE_BY_ID[exerciseId] : undefined;
  const anim = exerciseId ? ANIMATION_BY_ID[exerciseId] : undefined;
  const reduced = useReducedMotion();
  const [forcePlay, setForcePlay] = useState(false);
  if (!ex) return null;
  const playing = !reduced || forcePlay;
  return (
    <Sheet open={!!ex} title={ex.name} onClose={onClose}>
      <div className="max-h-[78vh] overflow-y-auto px-2 pb-2">
        {anim && (
          <div className="flex flex-col items-center rounded-2xl bg-surface-2/60 py-2">
            <Mannequin exerciseId={ex.id} size={300} playing={playing} frame={playing ? undefined : 'end'} />
            <div className="flex flex-wrap justify-center gap-2 px-2 pb-1 text-xs">
              <span className="rounded-full bg-surface px-3 py-1.5 font-medium">{tempoText(anim)}</span>
              <span className="rounded-full bg-surface px-3 py-1.5 text-muted">Углы — в крайней точке</span>
              {reduced && !forcePlay && (
                <button type="button" onClick={() => setForcePlay(true)} className="inline-flex min-h-11 items-center gap-1 rounded-full bg-primary px-3 font-medium text-on-primary">
                  <Play size={14} aria-hidden /> Показать движение
                </button>
              )}
            </div>
          </div>
        )}

        <div className="mt-4">
          <MuscleMapPair colors={exerciseColors(ex.muscles.primary, ex.muscles.secondary)} />
        </div>

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
    </Sheet>
  );
}
