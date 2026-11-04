import { Camera, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Silhouette, useSilhouetteFactors } from '../../components/body/Silhouette';
import { LineChart } from '../../components/charts/Charts';
import { Bar, Card, Chip, SectionTitle } from '../../components/ui';
import { CHECKPOINTS, PROGRAM_START } from '../../data/program';
import { DEFAULT_SETTINGS } from '../../db/db';
import { addPhoto, deletePhoto } from '../../db/repo';
import type { BodyEntry, ProgressPhoto, Settings } from '../../db/types';
import { avg7, bodyFatAt, firstBodyFat, firstWith, latestWith, leanMass, pathProgress, weightSeries } from '../../domain/body';
import { addDays, diffDays } from '../../domain/dates';
import { formatDayMonth, formatScaled, NBSP } from '../../domain/format';
import { targetWaist } from '../../domain/silhouette';
import { useBody, usePhotos, useSettings } from '../../hooks/useData';
import { useToday } from '../../hooks/useToday';
import { EmptyState } from '../../components/EmptyState';

const kg = (v: number, d = 1) => formatScaled(v, 100, d);

export function BodyTab() {
  const today = useToday();
  const settings = useSettings() ?? DEFAULT_SETTINGS;
  const body = useBody();
  const factors = useSilhouetteFactors();
  const [compare, setCompare] = useState(false);
  const avg = avg7(body, today) ?? latestWith(body, 'weight')?.weight ?? null;
  const fat = bodyFatAt(body, settings.heightCm, today);
  const fat0 = firstBodyFat(body, settings.heightCm);
  const waist = latestWith(body, 'waist');
  const waist0 = firstWith(body, 'waist');
  const neck = latestWith(body, 'neck')?.neck;
  const waistGoal = neck ? targetWaist(neck, settings.heightCm, settings.targetBodyFat) : null;
  const strengthPct = Math.round(factors.fUpper * 30);

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <div className="flex flex-col items-center">
          <Silhouette
            factors={factors}
            size={300}
            compare={compare}
            callouts={{
              shoulders: `Плечи +${strengthPct}%`,
              waist: waist ? `Талия ${formatScaled(waist.waist!, 10, 1)} см` : 'Талия —',
              legs: `Ноги +${Math.round(factors.fLegs * 30)}%`,
            }}
          />
          <p className="mt-1 text-xs text-muted">Силуэт меняется по твоим замерам и силе</p>
          <Chip className="mt-2" active={compare} onClick={() => setCompare((c) => !c)}>
            Сравнить со стартом
          </Chip>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <GoalCard label="Вес" value={avg !== null ? `${kg(avg)} кг` : '—'} sub={`${kg(settings.startWeight, 0)} · ${kg(settings.targetWeight)}`} progress={avg !== null ? pathProgress(settings.startWeight, settings.targetWeight, avg) : 0} />
          <GoalCard
            label="% жира"
            value={fat !== null ? `${formatScaled(Math.round(fat * 10), 10, 1)}%` : '—'}
            sub={`${fat0 !== null ? formatScaled(Math.round(fat0 * 10), 10, 1) : '—'} · ${settings.targetBodyFat}`}
            progress={fat !== null && fat0 !== null && fat0 > settings.targetBodyFat ? (fat0 - fat) / (fat0 - settings.targetBodyFat) : 0}
          />
          <GoalCard
            label="Талия"
            value={waist ? `${formatScaled(waist.waist!, 10, 1)} см` : '—'}
            sub={`${waist0 ? formatScaled(waist0.waist!, 10, 1) : '—'} · ${waistGoal ? formatScaled(waistGoal, 10, 0) : '—'}`}
            progress={factors.fWaist}
          />
          <GoalCard label="Сила" value={`+${strengthPct}%`} sub="старт · +30%" progress={factors.fUpper} />
        </div>
      </Card>

      <WeightChart body={body} settings={settings} today={today} />

      <div className="grid grid-cols-3 gap-2">
        <Delta label="% жира" now={fat !== null ? fat : null} start={fat0} format={(v) => `${formatScaled(Math.round(v * 10), 10, 1)}%`} />
        <Delta label="Талия" now={waist?.waist ?? null} start={waist0?.waist ?? null} format={(v) => `${formatScaled(Math.round(v), 10, 1)} см`} />
        <Delta
          label="Сухая масса"
          now={avg !== null && fat !== null ? leanMass(avg, fat) : null}
          start={fat0 !== null ? leanMass(firstWith(body, 'weight')?.weight ?? settings.startWeight, fat0) : null}
          format={(v) => `${kg(v)} кг`}
          goodUp
        />
      </div>

      <Photos />
    </div>
  );
}

function GoalCard({ label, value, sub, progress }: { label: string; value: string; sub: string; progress: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100);
  return (
    <div className="rounded-2xl bg-surface-2/70 p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="mb-1.5 text-[11px] text-muted">старт · цель: {sub}</p>
      <Bar value={pct / 100} height={6} label={`${label}: ${pct}% к цели`} />
      <p className="mt-1 text-[11px] text-accent">{pct}% к цели</p>
    </div>
  );
}

function Delta({ label, now, start, format, goodUp = false }: { label: string; now: number | null; start: number | null; format: (v: number) => string; goodUp?: boolean }) {
  const d = now !== null && start !== null ? now - start : null;
  const good = d !== null && (goodUp ? d >= 0 : d <= 0);
  return (
    <Card className="!p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-semibold tabular-nums">{now !== null ? format(now) : '—'}</p>
      {d !== null && (
        <p className={`text-xs tabular-nums ${good ? 'text-accent' : 'text-warn'}`}>
          {d > 0 ? '+' : d < 0 ? '−' : ''}
          {format(Math.abs(d))} от старта
        </p>
      )}
    </Card>
  );
}

type Period = 28 | 84 | 0;

function WeightChart({ body, settings, today }: { body: BodyEntry[]; settings: Settings; today: string }) {
  const [period, setPeriod] = useState<Period>(28);
  const first = firstWith(body, 'weight')?.date ?? PROGRAM_START;
  const from = period === 0 ? (first < PROGRAM_START ? first : PROGRAM_START) : addDays(today, -period + 1);
  const series = useMemo(() => weightSeries(body, from, today), [body, from, today]);
  const hasData = series.some((p) => p.weight !== null);
  const n = diffDays(from, today);
  const labels = [0, Math.round(n / 2), n].map((x) => ({ x, label: formatDayMonth(addDays(from, x)).replace(/ (\S{3})\S*$/, ' $1') }));
  const markers = CHECKPOINTS.filter((c) => c.date >= from && c.date <= addDays(today, 0)).map((c) => ({
    x: diffDays(from, c.date),
    y: c.target.min,
    color: 'var(--accent)',
    label: `${formatDayMonth(c.date)}: ориентир ${kg(c.target.min)} кг`,
  }));
  return (
    <Card>
      <SectionTitle
        action={
          <div className="flex gap-1">
            {([28, 84, 0] as const).map((p) => (
              <Chip key={p} active={period === p} onClick={() => setPeriod(p)} className="!min-h-9 !px-3 text-xs">
                {p === 28 ? '4 нед' : p === 84 ? '12 нед' : 'Всё'}
              </Chip>
            ))}
          </div>
        }
      >
        Вес
      </SectionTitle>
      {hasData ? (
        <>
          <LineChart
            ariaLabel="График веса: точки — дни, линия — среднее за 7 дней"
            series={[
              { label: 'Вес по дням', kind: 'dots', color: 'var(--muted)', points: series.map((p, i) => ({ x: i, y: p.weight })) },
              { label: 'Среднее за 7 дней', kind: 'line', color: 'var(--progress)', points: series.map((p, i) => ({ x: i, y: p.avg })) },
            ]}
            hlines={[{ y: settings.targetWeight, color: 'var(--accent)', label: `цель ${kg(settings.targetWeight)}` }]}
            markers={markers}
            xLabels={labels}
            yFormat={(v) => kg(v, 0)}
          />
          <div className="mt-1 flex gap-4 text-xs text-muted">
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-muted opacity-60" /> дни</span>
            <span className="flex items-center gap-1"><i className="h-0.5 w-4 bg-progress" /> среднее 7 дней</span>
            <span className="flex items-center gap-1"><i className="h-2 w-2 rotate-45 border-2 border-accent" /> контрольные точки</span>
          </div>
        </>
      ) : (
        <p className="py-8 text-center text-muted">Запиши вес 3 дня — появится среднее</p>
      )}
    </Card>
  );
}

// ---------- Фото ----------

const POSES: { v: ProgressPhoto['pose']; label: string }[] = [
  { v: 'front', label: 'Спереди' },
  { v: 'side', label: 'Сбоку' },
  { v: 'back', label: 'Сзади' },
];

function useObjectUrl(blob: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) return setUrl(undefined);
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

function Photos() {
  const today = useToday();
  const photos = usePhotos();
  const [pose, setPose] = useState<ProgressPhoto['pose']>('front');
  const [busy, setBusy] = useState(false);
  const mine = photos.filter((p) => p.pose === pose).sort((a, b) => a.date.localeCompare(b.date));
  const dates = [...new Set(mine.map((p) => p.date))];
  const [a, setA] = useState<string | null>(null);
  const [b, setB] = useState<string | null>(null);
  const dateA = a ?? dates[0] ?? null;
  const dateB = b ?? dates[dates.length - 1] ?? null;
  const photoA = mine.find((p) => p.date === dateA);
  const photoB = mine.find((p) => p.date === dateB);
  const [split, setSplit] = useState(50);
  const urlA = useObjectUrl(photoA?.blob);
  const urlB = useObjectUrl(photoB?.blob);

  return (
    <Card>
      <SectionTitle>Фото</SectionTitle>
      <div className="flex gap-2">
        {POSES.map((p) => (
          <Chip key={p.v} active={pose === p.v} onClick={() => setPose(p.v)}>
            {p.label}
          </Chip>
        ))}
      </div>
      {dates.length === 0 ? (
        <div className="mt-3">
          <EmptyState icon={Camera} text="Сделай первое фото — потом сравнишь «до» и «после»" hint="Фото хранятся только на телефоне" />
        </div>
      ) : (
        <>
          {dates.length > 1 && urlA && urlB ? (
            <div className="relative mt-3 aspect-[3/4] overflow-hidden rounded-2xl bg-surface-2">
              <img src={urlA} alt={`Фото ${formatDayMonth(dateA!)}`} className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 0 0 ${split}%)` }}>
                <img src={urlB} alt={`Фото ${formatDayMonth(dateB!)}`} className="absolute inset-0 h-full w-full object-cover" />
              </div>
              <div className="absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${split}%` }} />
              <span className="absolute top-2 left-2 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white">{formatDayMonth(dateA!)}</span>
              <span className="absolute top-2 right-2 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white">{formatDayMonth(dateB!)}</span>
            </div>
          ) : (
            urlB && <img src={urlB} alt="Фото" className="mt-3 aspect-[3/4] w-full rounded-2xl object-cover" />
          )}
          {dates.length > 1 && (
            <input type="range" min={0} max={100} value={split} onChange={(e) => setSplit(Number(e.target.value))} aria-label="Сравнение: сдвинь границу" className="mt-3 w-full accent-[var(--progress)]" />
          )}
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            {dates.map((d) => (
              <Chip
                key={d}
                active={d === dateA || d === dateB}
                onClick={() => (d === dateA ? setA(null) : d < (dateB ?? d) ? setA(d) : setB(d))}
                className="!min-h-9 text-xs"
              >
                {formatDayMonth(d)}
              </Chip>
            ))}
          </div>
          {photoB && (
            <button type="button" onClick={() => void deletePhoto(photoB.id)} className="mt-2 flex min-h-11 items-center gap-1 text-sm text-muted">
              <Trash2 size={16} aria-hidden /> Удалить фото {formatDayMonth(photoB.date)}
            </button>
          )}
        </>
      )}
      <label className={`mt-3 flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-on-primary ${busy ? 'opacity-50' : ''}`}>
        <Camera size={20} aria-hidden /> Добавить фото{NBSP}· {POSES.find((p) => p.v === pose)?.label.toLowerCase()}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            setBusy(true);
            try {
              await addPhoto(today, pose, f);
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
    </Card>
  );
}
