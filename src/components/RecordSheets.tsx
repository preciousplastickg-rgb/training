// Шторки записи: вес и замеры (с пульсом в покое), бассейн (тип, сауна).

import { useEffect, useState } from 'react';
import { addPool, putBody } from '../db/repo';
import type { BodyEntry, PoolType, SaunaRounds } from '../db/types';
import { bodyFatPercent, latestWith } from '../domain/body';
import { formatDayMonth, formatScaled, parseKg } from '../domain/format';
import { useToday } from '../hooks/useToday';
import { POOL_TYPE_NAMES, SAUNA_HINT, poolPlan, poolTypeFor } from '../data/program';
import { isoWeekday } from '../domain/dates';
import { deloadFor, lightWeekFor } from '../domain/program';
import { useLightWeeks } from '../hooks/useData';
import { Sheet } from './Sheet';
import { Button, Caps, Chip, Field, Stepper } from './ui';

const toNum = (s: string): number | null => {
  const v = Number(s.replace(',', '.').replace(/\s/g, ''));
  return Number.isFinite(v) && s.trim() !== '' ? v : null;
};

export function WeightSheet({
  open, onClose, date, body, heightCm, fallbackWeight, focusSteps,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
  body: BodyEntry[];
  heightCm: number;
  /** Пока записей веса нет — стартовый вес из настроек. */
  fallbackWeight: number;
  /** Открыта с «Записать шаги»: курсор сразу в поле шагов. */
  focusSteps?: boolean;
}) {
  const todayEntry = body.find((b) => b.date === date);
  const last = latestWith(body, 'weight');
  const lastWaist = latestWith(body, 'waist');
  const lastNeck = latestWith(body, 'neck');
  const lastHr = latestWith(body, 'restingHr');
  const [weight, setWeight] = useState(fallbackWeight);
  const [waist, setWaist] = useState('');
  const [neck, setNeck] = useState('');
  const [steps, setSteps] = useState('');
  const [hr, setHr] = useState('');

  useEffect(() => {
    if (!open) return;
    setWeight(todayEntry?.weight ?? last?.weight ?? fallbackWeight);
    setWaist(todayEntry?.waist ? formatScaled(todayEntry.waist, 10, 1) : '');
    setNeck(todayEntry?.neck ? formatScaled(todayEntry.neck, 10, 1) : '');
    setSteps(todayEntry?.steps ? String(todayEntry.steps) : '');
    setHr(todayEntry?.restingHr ? String(todayEntry.restingHr) : '');
  }, [open]);

  const w10 = toNum(waist);
  const n10 = toNum(neck);
  const fat = w10 && n10 ? bodyFatPercent(Math.round(w10 * 10), Math.round(n10 * 10), heightCm) : null;

  const save = async () => {
    const patch: Partial<BodyEntry> = { weight };
    if (w10) patch.waist = Math.round(w10 * 10);
    if (n10) patch.neck = Math.round(n10 * 10);
    const st = toNum(steps);
    if (st) patch.steps = Math.round(st);
    const h = toNum(hr);
    if (h && h >= 30 && h <= 150) patch.restingHr = Math.round(h);
    await putBody(date, patch);
    onClose();
  };

  return (
    <Sheet open={open} title="Вес и замеры" onClose={onClose}>
      <div className="flex flex-col gap-4 px-2 pb-2">
        <div>
          <p className="mb-1 text-sm text-muted">Утренний вес</p>
          <Stepper
            big
            label="Вес"
            value={formatScaled(weight, 100, 2)}
            unit="кг"
            onDec={() => setWeight((w) => w - 10)}
            onInc={() => setWeight((w) => w + 10)}
            onEdit={(raw) => {
              const v = parseKg(raw);
              if (v && v > 3000 && v < 25000) setWeight(v);
            }}
          />
          <div className="mt-2 flex justify-center gap-2">
            {[-50, 50].map((d) => (
              <Button key={d} size="sm" variant="secondary" onClick={() => setWeight((w) => w + d)}>
                {d > 0 ? '+0,5' : '−0,5'}
              </Button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Талия" suffix="см" inputMode="decimal" placeholder={lastWaist ? formatScaled(lastWaist.waist!, 10, 1) : '92'} value={waist} onChange={(e) => setWaist(e.target.value)} />
          <Field label="Шея" suffix="см" inputMode="decimal" placeholder={lastNeck ? formatScaled(lastNeck.neck!, 10, 1) : '38'} value={neck} onChange={(e) => setNeck(e.target.value)} />
          <Field label="Шаги" inputMode="numeric" placeholder="8000" value={steps} onChange={(e) => setSteps(e.target.value)} autoFocus={focusSteps} />
          <Field label="Пульс в покое" suffix="уд/мин" inputMode="numeric" placeholder={lastHr ? String(lastHr.restingHr) : '58'} value={hr} onChange={(e) => setHr(e.target.value)} />
        </div>
        <p className="text-sm text-muted">
          Талия — на уровне пупка, шея — под кадыком, пульс — утром лёжа. {fat !== null && <b className="text-ink">% жира ≈ {formatScaled(Math.round(fat * 10), 10, 1)}</b>}
        </p>
        <Button size="lg" onClick={() => void save()}>
          Записать
        </Button>
      </div>
    </Sheet>
  );
}

const FEEL = ['Тяжело', 'Так себе', 'Нормально', 'Хорошо', 'Отлично'] as const;
const POOL_TYPES: PoolType[] = ['technique', 'intervals', 'long'];
const SAUNA: SaunaRounds[] = [0, 1, 2, 3];

export function PoolSheet({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  const today = useToday();
  const lightWeeks = useLightWeeks();
  const dayType = poolTypeFor(isoWeekday(date));
  const [type, setType] = useState<PoolType>(dayType);
  const plan = poolPlan(date, type, { deload: deloadFor(date) !== null, lightWeek: lightWeekFor(date, lightWeeks) !== null });
  const [minutes, setMinutes] = useState(plan.minutes);
  const [meters, setMeters] = useState('');
  const [feel, setFeel] = useState<1 | 2 | 3 | 4 | 5 | undefined>();
  const [sauna, setSauna] = useState<SaunaRounds | undefined>();
  useEffect(() => {
    if (open) {
      setType(dayType);
      setMinutes(poolPlan(date, dayType, { deload: deloadFor(date) !== null, lightWeek: lightWeekFor(date, lightWeeks) !== null }).minutes);
      setMeters('');
      setFeel(undefined);
      setSauna(undefined);
    }
  }, [open]);
  const pick = (t: PoolType) => {
    setType(t);
    setMinutes(poolPlan(date, t, { deload: deloadFor(date) !== null, lightWeek: lightWeekFor(date, lightWeeks) !== null }).minutes);
  };
  const save = async () => {
    const m = toNum(meters);
    await addPool({ date, type, minutes, ...(m ? { meters: Math.round(m) } : {}), ...(feel ? { feel } : {}), ...(sauna !== undefined ? { saunaRounds: sauna } : {}) });
    onClose();
  };
  return (
    <Sheet open={open} title={date === today ? 'Бассейн' : `Бассейн · ${formatDayMonth(date)}`} onClose={onClose}>
      <div className="flex flex-col gap-4 px-2 pb-2">
        <div>
          <p className="mb-1 text-sm text-muted">Тип занятия</p>
          <div className="flex gap-2" role="radiogroup" aria-label="Тип занятия">
            {POOL_TYPES.map((t) => (
              <Chip key={t} active={type === t} onClick={() => pick(t)} role="radio" aria-checked={type === t} className="flex-1 justify-center px-2 text-[13px]">
                {POOL_TYPE_NAMES[t]}
              </Chip>
            ))}
          </div>
        </div>
        <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm">План: {plan.text}</p>
        <div>
          <p className="mb-1 text-sm text-muted">Длительность</p>
          <Stepper big label="Минуты" value={minutes} unit="мин" onDec={() => setMinutes((m) => Math.max(5, m - 5))} onInc={() => setMinutes((m) => m + 5)} />
        </div>
        <Field label="Дистанция (необязательно)" suffix="м" inputMode="numeric" placeholder="1000" value={meters} onChange={(e) => setMeters(e.target.value)} />
        <div>
          <p className="mb-1 text-sm text-muted">Ощущение</p>
          <div className="grid grid-cols-5 gap-1">
            {FEEL.map((label, i) => {
              const v = (i + 1) as 1 | 2 | 3 | 4 | 5;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setFeel(feel === v ? undefined : v)}
                  aria-pressed={feel === v}
                  className={`flex min-h-14 flex-col items-center justify-center rounded-xl text-xs ${feel === v ? 'bg-primary text-on-primary' : 'bg-surface-2'}`}
                >
                  <span className="text-lg font-semibold">{v}</span>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <Caps className="mb-1">Сауна · заходов</Caps>
          <div className="grid grid-cols-4 gap-1" role="radiogroup" aria-label="Сауна, заходов">
            {SAUNA.map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={sauna === v}
                onClick={() => setSauna(sauna === v ? undefined : v)}
                className={`min-h-12 rounded-xl text-lg font-semibold ${sauna === v ? 'bg-primary text-on-primary' : 'bg-surface-2'}`}
              >
                {v}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">{SAUNA_HINT}</p>
        </div>
        <Button size="lg" onClick={() => void save()}>
          Записать
        </Button>
      </div>
    </Sheet>
  );
}
