import { ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import { navigate } from '../../app/router';
import { Mannequin } from '../../components/body/Mannequin';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Chip } from '../../components/ui';
import { EXERCISES } from '../../data/exercises';

/** Приёмка манекена: все 68 упражнений, кадры start и end рядом (SPEC 6.7.2). */
export function DevAnimations() {
  const [guides, setGuides] = useState(true);
  return (
    <>
      <ScreenHeader
        title="Позы упражнений"
        subtitle="Кадры start и end"
        leading={
          <button type="button" aria-label="Назад" onClick={() => navigate('settings')} className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full active:bg-track">
            <ChevronLeft size={26} />
          </button>
        }
        action={<Chip active={guides} onClick={() => setGuides((g) => !g)}>Углы</Chip>}
      />
      <div className="grid gap-3 px-4 pb-8">
        {EXERCISES.map((e) => (
          <section key={e.id} className="rounded-2xl bg-surface p-3" data-testid={`anim-${e.id}`}>
            <h2 className="mb-1 text-sm font-semibold">{e.name} <span className="font-normal text-muted">· {e.id}</span></h2>
            <div className="grid grid-cols-2">
              {(['start', 'end'] as const).map((f) => (
                <figure key={f} className="flex flex-col items-center">
                  <Mannequin exerciseId={e.id} frame={f} size={160} showGuides={guides} />
                  <figcaption className="text-xs text-muted">{f}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
