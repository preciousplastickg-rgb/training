// Двойник на экранах (docs/TWIN-3D.md, 1 и 8): «Сегодня», «Прогресс → Тело», нагрузка за неделю, «Как делать».

import { ChevronRight, Pause, Play } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { navigate } from '../../app/router';
import { EXERCISE_BY_ID, MUSCLE_NAMES } from '../../data/exercises';
import type { BodyEntry, Muscle, Settings } from '../../db/types';
import { bodyComposition, pathProgress } from '../../domain/body';
import { formatDayMonth, formatScaled } from '../../domain/format';
import type { TwinBody } from '../../domain/twin';
import { assetUrl, loadMuscles, type ManifestExercise } from '../../three/assets';
import { exerciseZones, ZONE_OF, type Zone } from '../../three/zones';
import { fatText, Mini, sign, leanText } from '../../screens/progress/BodyTab';
import { Bar, Caps, Card } from '../ui';
import { TwinView } from './TwinView';
import { useTwin3d, useTwinBodies } from './useTwin';

const kgText = (kg100: number) => formatScaled(kg100, 100, 1);

// ---------- «Сегодня» ----------

/** Карточка тела на «Сегодня»: двойник в покое (≤ 30 FPS, вращение), строка «% жира → цель», шкала пути. Тап — «Прогресс». */
export function TwinTodayCard({ date, settings, body, fallback }: { date: string; settings: Settings; body: BodyEntry[]; fallback: ReactNode }) {
  const { rotate } = useTwin3d();
  const t = useTwinBodies(date);
  const c = bodyComposition(body, settings.heightCm, settings.startWeight, date);
  const path = c.weight !== null ? pathProgress(settings.startWeight, settings.targetWeight, c.weight) : 0;
  const goal = fatText(settings.targetBodyFat);
  return (
    <Card onClick={() => navigate('progress')} className="flex flex-col gap-3 rounded-[28px]! pb-5!">
      <div className="flex items-center justify-between px-1">
        <h2 className="font-display text-[17px] font-bold">Тело</h2>
        <ChevronRight size={18} className="text-muted" aria-hidden />
      </div>
      <TwinView
        className="h-[280px] w-full"
        label="3D-двойник по вашим замерам"
        config={{ kind: 'idle', body: t.now, rotate, maxFps: 30 }}
        fallback={fallback}
      />
      <p className="text-center text-[15px] font-bold tabular-nums">
        {c.fat !== null ? `${fatText(c.fat)} % жира → цель ${goal} %` : `Цель ${goal} % жира · запиши талию и шею`}
      </p>
      <div className="flex flex-col gap-1 px-1">
        <Bar value={path} label="Путь к цели по весу" />
        <span className="text-[13px] font-bold text-muted tabular-nums">
          {c.weight !== null ? `${kgText(c.weight)} кг · путь ${Math.round(path * 100)} %` : 'путь к цели — по среднему весу'}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        <Mini label="% жира" value={c.fat !== null ? fatText(c.fat) : '—'}>
          {c.fatDelta !== null ? `${sign(c.fatDelta)}${fatText(Math.abs(c.fatDelta))}` : null}
        </Mini>
        <Mini label="Талия" value={c.waist !== null ? formatScaled(c.waist, 10, 0) : '—'}>
          {c.waistDelta !== null ? `${sign(c.waistDelta)}${formatScaled(Math.abs(c.waistDelta), 10, 0)} см` : null}
        </Mini>
        <Mini label="Мышцы" value={c.lean !== null ? kgText(c.lean) : '—'} muted={c.leanDelta !== null && Math.abs(c.leanDelta) < 50}>
          {leanText(c.leanDelta)}
        </Mini>
      </div>
    </Card>
  );
}

// ---------- «Прогресс → Тело» ----------

/** Три фигуры «Старт · Сейчас · Цель»; ползунок недель меняет среднюю фигуру по истории замеров. */
export function TwinCompareCard({ date }: { date: string }) {
  const t = useTwinBodies(date);
  const last = Math.max(0, t.history.length - 1);
  const [pick, setPick] = useState<number | null>(null);
  const i = pick === null ? last : Math.min(pick, last);
  const week = t.history[i];
  const mid: TwinBody = i === last || !week ? t.now : week.body;
  const figures = [{ body: t.start }, { body: mid }, { body: t.goal }];
  const caption = (label: string, b: TwinBody) => (
    <div className="flex flex-col items-center">
      <Caps>{label}</Caps>
      <span className="font-display text-[17px] font-bold tabular-nums">{fatText(b.bf)} %</span>
    </div>
  );
  return (
    <Card className="flex flex-col gap-2 rounded-[28px]!">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="font-display text-[17px] font-bold">Двойник</h2>
        <span className="text-[13px] text-muted">по замерам талии, шеи и веса</span>
      </div>
      <TwinView className="h-[300px] w-full" label="Двойник: старт, сейчас и цель" config={{ kind: 'figures', figures }} fallback={null} />
      <div className="grid grid-cols-3">
        {caption('Старт', t.start)}
        {caption(i === last ? 'Сейчас' : `Неделя ${i + 1}`, mid)}
        {caption('Цель', t.goal)}
      </div>
      {t.history.length > 1 && (
        <div className="flex flex-col gap-1 px-1 pt-1">
          <input
            type="range"
            min={0}
            max={last}
            step={1}
            value={i}
            onChange={(e) => setPick(Number(e.target.value))}
            aria-label="Неделя"
            aria-valuetext={week ? `неделя с ${formatDayMonth(week.week)}` : undefined}
            className="h-11 w-full accent-[var(--ink)]"
          />
          <span className="text-center text-[13px] font-bold text-muted tabular-nums">
            {week ? `неделя с ${formatDayMonth(week.week)}${week.measured ? '' : ' · между замерами'}` : ''}
          </span>
        </div>
      )}
    </Card>
  );
}

// ---------- нагрузка за неделю ----------

/** Недельная нагрузка на 3D-модели: интенсивность зоны = рабочие подходы за неделю / 15, не больше 1 (TWIN-3D 5). */
export function TwinLoadView({ load, fallback }: { load: Record<Muscle, number>; fallback: ReactNode }) {
  const zones = useMemo(() => {
    const z: Partial<Record<Zone, number>> = {};
    for (const [m, n] of Object.entries(load) as [Muscle, number][]) z[ZONE_OF[m]] = Math.min(1, n / 15);
    return z;
  }, [load]);
  return (
    <TwinView
      className="h-[300px] w-full"
      label="Нагрузка за неделю на модели: спереди и сзади"
      config={{ kind: 'figures', figures: [{ body: NEUTRAL, zones }, { body: NEUTRAL, zones, yaw: 180 }] }}
      fallback={fallback}
    />
  );
}

const NEUTRAL: TwinBody = { bf: 24.5, lean: 0, definition: 0.15, muscle: 0 };

// ---------- «Как делать» ----------

export type HowToTab = '3d' | 'muscles' | 'technique';

/** Вкладки «3D» и «Мышцы»: двойник выполняет упражнение (или стоит в нижней точке) с подсветкой. */
export function ExerciseTwin({ exerciseId, entry, still, date }: { exerciseId: string; entry: ManifestExercise; still: boolean; date: string }) {
  const ex = EXERCISE_BY_ID[exerciseId]!;
  const t = useTwinBodies(date);
  const [paused, setPaused] = useState(false);
  const [slow, setSlow] = useState(false);
  const zones = exerciseZones(ex);
  const side = useExerciseSide(exerciseId);
  const stills = (
    <div className="grid grid-cols-2 gap-2" data-testid="twin-stills">
      {entry.stills.map((s, k) => (
        <img key={s} src={assetUrl(s)} alt={k === 0 ? 'Начало движения' : 'Конец движения'} className="w-full rounded-2xl bg-white" />
      ))}
    </div>
  );
  return (
    <div className="flex flex-col gap-2">
      <TwinView
        className="h-[min(56dvh,440px)] w-full rounded-3xl bg-surface"
        label={still ? `${ex.name}: нижняя точка, работающие мышцы подсвечены` : `${ex.name}: 3D-анимация, работающие мышцы подсвечены`}
        config={{
          kind: 'exercise', id: exerciseId, body: t.now, still, paused, speed: slow ? 0.5 : 1,
          primary: zones.primary, secondary: zones.secondary, side, maxFps: 60,
        }}
        fallback={stills}
      />
      {!still && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-pressed={paused}
            className="flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full bg-surface px-4 text-[15px] font-bold active:opacity-80"
          >
            {paused ? <Play size={16} fill="currentColor" aria-hidden /> : <Pause size={16} fill="currentColor" aria-hidden />}
            {paused ? 'Пуск' : 'Пауза'}
          </button>
          <button
            type="button"
            onClick={() => setSlow((s) => !s)}
            aria-pressed={slow}
            className={`flex h-11 min-w-11 items-center justify-center rounded-full px-4 text-[15px] font-bold active:opacity-80 ${slow ? 'bg-ink text-bg' : 'bg-surface'}`}
          >
            0,5×
          </button>
          <span className="ml-auto text-right text-[12px] leading-4 text-muted">вращайте пальцем,<br />двойной тап — ракурс</span>
        </div>
      )}
    </div>
  );
}

/** Сторона одностороннего упражнения — из muscles.json (в каталоге её нет). */
function useExerciseSide(id: string): 'L' | 'R' | undefined {
  const [side, setSide] = useState<'L' | 'R' | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    loadMuscles().then((m) => alive && setSide(m.exercises[id]?.side)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [id]);
  return side;
}

/** Список мышц упражнения: основные и помогающие, с ролью. */
export function MuscleList({ exerciseId }: { exerciseId: string }) {
  const ex = EXERCISE_BY_ID[exerciseId]!;
  const row = (m: Muscle, primary: boolean) => (
    <li key={m} className="flex items-baseline gap-2.5 py-1.5">
      <i className="h-2.5 w-2.5 shrink-0 translate-y-[-1px] rounded-full" style={{ background: primary ? 'var(--twin-primary)' : 'var(--twin-secondary)' }} aria-hidden />
      <span className="text-[15px] font-semibold">{MUSCLE_NAMES[m]}</span>
      {ex.muscleRoles?.[m] && <span className="text-[13px] text-muted">— {ex.muscleRoles[m]}</span>}
    </li>
  );
  return (
    <section className="rounded-3xl bg-surface px-4 py-3">
      <Caps as="h3">Основные</Caps>
      <ul className="mb-2">{ex.muscles.primary.map((m) => row(m, true))}</ul>
      {ex.muscles.secondary.length > 0 && (
        <>
          <Caps as="h3">Помогают</Caps>
          <ul>{ex.muscles.secondary.map((m) => row(m, false))}</ul>
        </>
      )}
    </section>
  );
}
