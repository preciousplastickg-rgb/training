// Прогресс · Тело — макет BProgressBody (REDESIGN 4): чёрный герой со средним весом и графиком,
// три мини-карточки (% жира, талия, мышцы), силуэт (SPEC 6.7), фото со слайдером.

import { Camera, ChevronsLeftRight, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Silhouette, useSilhouetteFactors } from '../../components/body/Silhouette';
import { LineChart, type Marker } from '../../components/charts/Charts';
import { EmptyState } from '../../components/EmptyState';
import { Caps, Card, Chip, HeroCard } from '../../components/ui';
import { CHECKPOINTS, PROGRAM_END, PROGRAM_START } from '../../data/program';
import { DEFAULT_SETTINGS } from '../../db/db';
import { addPhoto, deletePhoto } from '../../db/repo';
import type { BodyEntry, ProgressPhoto, Settings } from '../../db/types';
import { avg7, bodyFatAt, firstBodyFat, firstWith, forecastDate, latestWith, leanMass, weightSeries } from '../../domain/body';
import { addDays, diffDays } from '../../domain/dates';
import { formatDayMonth, formatScaled, NBSP } from '../../domain/format';
import { useBody, usePhotos, useSettings } from '../../hooks/useData';
import { useToday } from '../../hooks/useToday';

const kg = (v: number, d = 1) => formatScaled(v, 100, d);
const sign = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '');

export function BodyTab() {
  const today = useToday();
  const settings = useSettings() ?? DEFAULT_SETTINGS;
  const body = useBody();
  const factors = useSilhouetteFactors();
  const [compare, setCompare] = useState(false);
  const avg = avg7(body, today) ?? latestWith(body, 'weight')?.weight ?? null;
  const fat = bodyFatAt(body, settings.heightCm, today);
  const fat0 = firstBodyFat(body, settings.heightCm);
  const waist = latestWith(body, 'waist')?.waist ?? null;
  const waist0 = firstWith(body, 'waist')?.waist ?? null;
  const lean = avg !== null && fat !== null ? leanMass(avg, fat) : null;
  const lean0 = fat0 !== null ? leanMass(firstWith(body, 'weight')?.weight ?? settings.startWeight, fat0) : null;
  const leanDelta = lean !== null && lean0 !== null ? lean - lean0 : null;

  return (
    <div className="flex flex-col gap-3">
      <WeightHero body={body} settings={settings} today={today} avg={avg} />

      <div className="grid grid-cols-3 gap-2.5">
        <Mini label="% жира" value={fat !== null ? formatScaled(Math.round(fat * 10), 10, 1) : '—'}>
          {fat !== null && fat0 !== null ? `${sign(fat - fat0)}${formatScaled(Math.round(Math.abs(fat - fat0) * 10), 10, 1)}` : null}
        </Mini>
        <Mini label="Талия" value={waist !== null ? formatScaled(waist, 10, 0) : '—'}>
          {waist !== null && waist0 !== null ? `${sign(waist - waist0)}${formatScaled(Math.abs(waist - waist0), 10, 0)} см` : null}
        </Mini>
        <Mini label="Мышцы" value={lean !== null ? kg(lean) : '—'} muted={leanDelta !== null && Math.abs(leanDelta) < 50}>
          {leanDelta === null ? null : Math.abs(leanDelta) < 50 ? 'держим' : `${sign(leanDelta)}${kg(Math.abs(leanDelta))}`}
        </Mini>
      </div>

      <Card className="flex flex-col items-center gap-2 rounded-[28px]!">
        <div className="flex w-full items-baseline justify-between px-1">
          <h2 className="font-display text-[17px] font-bold">Силуэт</h2>
          <span className="text-[13px] text-muted">по замерам и силе</span>
        </div>
        <Silhouette
          factors={factors}
          size={280}
          compare={compare}
          callouts={{
            shoulders: `Плечи +${Math.round(factors.fUpper * 30)}%`,
            waist: waist !== null ? `Талия ${formatScaled(waist, 10, 1)} см` : 'Талия —',
            legs: `Ноги +${Math.round(factors.fLegs * 30)}%`,
          }}
        />
        <Chip active={compare} onClick={() => setCompare((c) => !c)}>
          Сравнить со стартом
        </Chip>
      </Card>

      <Photos />
    </div>
  );
}

function Mini({ label, value, children, muted = false }: { label: string; value: string; children: string | null; muted?: boolean }) {
  return (
    <Card className="flex flex-col gap-1 rounded-3xl! p-3.5!">
      <Caps>{label}</Caps>
      <span className="font-display text-[22px] leading-7 font-bold tabular-nums">{value}</span>
      <span className={`text-[13px] font-extrabold tabular-nums ${muted ? 'font-bold text-muted' : ''}`}>{children ?? NBSP}</span>
    </Card>
  );
}

// ---------- Средний вес и график ----------

const DARK = { grid: '#232529', text: '#8A8D93', surface: 'var(--hero)' };
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function WeightHero({ body, settings, today, avg }: { body: BodyEntry[]; settings: Settings; today: string; avg: number | null }) {
  const [period, setPeriod] = useState<'month' | 'all'>('all');
  const first = firstWith(body, 'weight')?.date ?? PROGRAM_START;
  const from = period === 'month' ? addDays(today, -27) : first < PROGRAM_START ? first : PROGRAM_START;
  const series = useMemo(() => weightSeries(body, from, today), [body, from, today]);
  const hasData = series.some((p) => p.weight !== null);
  const n = diffDays(from, today);
  const lastAvg = [...series].reverse().find((p) => p.avg !== null);
  const lastI = lastAvg ? series.indexOf(lastAvg) : -1;
  // Прогноз: пунктир от последнего среднего к дате цели, если она в пределах двух месяцев.
  const fc = forecastDate(body, today, settings.targetWeight);
  const fcX = fc && fc > today && diffDays(today, fc) <= 60 && fc <= PROGRAM_END ? diffDays(from, fc) : null;
  const xEnd = fcX ?? n;
  const markers: Marker[] = CHECKPOINTS.filter((c) => c.date >= from && diffDays(from, c.date) <= xEnd).map((c) => ({
    x: diffDays(from, c.date),
    y: c.target.min,
    color: 'var(--lime)',
    filled: c.date <= today,
    label: `${formatDayMonth(c.date)}: ориентир ${kg(c.target.min)} кг`,
  }));
  const labels: { x: number; label: string }[] = [];
  for (let d = from; diffDays(from, d) <= xEnd; d = addDays(d, 1)) {
    if (d.endsWith('-01') || d === from) {
      const m = Number(d.slice(5, 7)) - 1;
      if (!labels.some((l) => l.label === MONTHS_SHORT[m])) labels.push({ x: diffDays(from, d), label: MONTHS_SHORT[m]! });
    }
  }
  const delta = avg !== null ? avg - settings.startWeight : null;

  return (
    <HeroCard className="flex flex-col gap-2.5 rounded-[30px]! px-4! pt-5! pb-3.5!">
      <div className="flex items-start justify-between gap-3 px-1">
        <div className="flex flex-col gap-1">
          <Caps className="text-muted-on-ink!">Средний вес</Caps>
          <span className="font-display text-[36px] leading-[42px] font-bold tabular-nums">
            {avg !== null ? kg(avg) : '—'}
            <span className="font-sans text-[15px] font-normal text-muted-on-ink"> кг</span>
          </span>
          {delta !== null && (
            <span className={`text-sm font-extrabold tabular-nums ${delta <= 0 ? 'text-primary' : 'text-[#FF8A63]'}`}>
              {sign(delta)}
              {kg(Math.abs(delta))} с {formatDayMonth(settings.startDate || PROGRAM_START)}
            </span>
          )}
        </div>
        <div className="flex gap-1 rounded-full bg-[#2A2C30] p-[3px]" role="radiogroup" aria-label="Период">
          {(['month', 'all'] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={period === p}
              onClick={() => setPeriod(p)}
              className={`h-11 rounded-full px-3.5 text-[13px] ${period === p ? 'bg-white font-extrabold text-[#111214]' : 'font-bold text-muted-on-ink'}`}
            >
              {p === 'month' ? 'Месяц' : 'Всё'}
            </button>
          ))}
        </div>
      </div>
      {hasData ? (
        <LineChart
          ariaLabel="График веса: точки — дни, линия — среднее за 7 дней"
          height={210}
          theme={DARK}
          xMax={xEnd}
          series={[
            { label: 'Вес по дням', kind: 'dots', color: '#4A4D53', dotR: 2.5, opacity: 1, points: series.map((p, i) => ({ x: i, y: p.weight })) },
            { label: 'Среднее за 7 дней', kind: 'line', color: 'var(--lime)', width: 3.5, points: series.map((p, i) => ({ x: i, y: p.avg })) },
            ...(fcX !== null && lastAvg?.avg != null
              ? [{ label: 'Прогноз', kind: 'dashed' as const, color: 'var(--lime)', width: 2, points: [{ x: lastI, y: lastAvg.avg }, { x: fcX, y: settings.targetWeight }] }]
              : []),
          ]}
          hlines={[{ y: settings.targetWeight, color: '#FFFFFF', label: `цель ≈ ${kg(settings.targetWeight, 0)}` }]}
          markers={markers}
          endDot={lastAvg?.avg != null ? { x: lastI, y: lastAvg.avg, color: 'var(--lime)' } : undefined}
          xLabels={labels}
          yFormat={(v) => kg(v, 0)}
        />
      ) : (
        <p className="py-8 text-center text-muted-on-ink">Запиши вес 3 дня — появится среднее</p>
      )}
    </HeroCard>
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
  const both = dates.length > 1 && !!urlA && !!urlB && dateA !== dateB;

  return (
    <Card className="flex flex-col gap-3 rounded-[28px]!">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="font-display text-[17px] font-bold">Фото</h2>
        {dateA && dateB && (
          <span className="text-[13px] text-muted">
            {both ? `${formatDayMonth(dateA)} → ${formatDayMonth(dateB)}` : formatDayMonth(dateB)}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        {POSES.map((p) => (
          <Chip key={p.v} active={pose === p.v} onClick={() => setPose(p.v)} className="bg-surface-2">
            {p.label}
          </Chip>
        ))}
      </div>
      {dates.length === 0 ? (
        <EmptyState icon={Camera} text="Сделай первое фото — потом сравнишь «до» и «после»" hint="Фото хранятся только на телефоне" />
      ) : (
        <>
          <div className="relative h-[260px] overflow-hidden rounded-[20px] bg-surface-2">
            {both ? (
              <>
                <img src={urlA} alt={`Фото ${formatDayMonth(dateA!)}`} className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${split}%)` }}>
                  <img src={urlB} alt={`Фото ${formatDayMonth(dateB!)}`} className="absolute inset-0 h-full w-full object-cover" />
                </div>
                <div className="absolute inset-y-0 w-[3px] -translate-x-1/2 bg-ink" style={{ left: `${split}%` }} aria-hidden />
                <div
                  className="pointer-events-none absolute top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-ink bg-primary text-[#111214]"
                  style={{ left: `${split}%` }}
                  aria-hidden
                >
                  <ChevronsLeftRight size={20} strokeWidth={2.4} />
                </div>
                <span className="absolute bottom-2.5 left-2.5 rounded-full bg-white px-2.5 py-1 text-xs font-extrabold text-[#111214]">{formatDayMonth(dateA!)}</span>
                <span className="absolute right-2.5 bottom-2.5 rounded-full bg-white px-2.5 py-1 text-xs font-extrabold text-[#111214]">{formatDayMonth(dateB!)}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={split}
                  onChange={(e) => setSplit(Number(e.target.value))}
                  aria-label="Сравнение: сдвинь границу"
                  className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
                />
              </>
            ) : (
              urlB && <img src={urlB} alt={`Фото ${formatDayMonth(dateB!)}`} className="h-full w-full object-cover" />
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            {dates.map((d) => (
              <Chip key={d} active={d === dateA || d === dateB} onClick={() => (d === dateA ? setA(null) : d < (dateB ?? d) ? setA(d) : setB(d))} className="bg-surface-2 text-xs">
                {formatDayMonth(d)}
              </Chip>
            ))}
          </div>
          {photoB && (
            <button type="button" onClick={() => void deletePhoto(photoB.id)} className="flex min-h-11 items-center gap-1.5 px-1 text-sm font-bold text-muted">
              <Trash2 size={16} aria-hidden /> Удалить фото {formatDayMonth(photoB.date)}
            </button>
          )}
        </>
      )}
      <label className={`flex min-h-[58px] cursor-pointer items-center justify-center gap-2 rounded-full bg-primary text-[17px] font-extrabold text-on-primary ${busy ? 'opacity-50' : ''}`}>
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
