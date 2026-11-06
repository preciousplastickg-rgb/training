// Шторки записи: вес и замеры, бассейн.

import { useEffect, useState } from 'react';
import { putBody, addPool } from '../db/repo';
import type { BodyEntry } from '../db/types';
import { bodyFatPercent, latestWith } from '../domain/body';
import { formatDayMonth, formatScaled } from '../domain/format';
import { useToday } from '../hooks/useToday';
import { poolPlan } from '../data/program';
import { Sheet } from './Sheet';
import { Button, Field, Stepper } from './ui';

const toNum = (s: string): number | null => {
  const v = Number(s.replace(',', '.').replace(/\s/g, ''));
  return Number.isFinite(v) && s.trim() !== '' ? v : null;
};

export function WeightSheet({
  open, onClose, date, body, heightCm,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
  body: BodyEntry[];
  heightCm: number;
}) {
  const todayEntry = body.find((b) => b.date === date);
  const last = latestWith(body, 'weight');
  const lastWaist = latestWith(body, 'waist');
  const lastNeck = latestWith(body, 'neck');
  const [weight, setWeight] = useState(8000);
  const [waist, setWaist] = useState('');
  const [neck, setNeck] = useState('');
  const [steps, setSteps] = useState('');

  useEffect(() => {
    if (!open) return;
    setWeight(todayEntry?.weight ?? last?.weight ?? 8000);
    setWaist(todayEntry?.waist ? formatScaled(todayEntry.waist, 10, 1) : '');
    setNeck(todayEntry?.neck ? formatScaled(todayEntry.neck, 10, 1) : '');
    setSteps(todayEntry?.steps ? String(todayEntry.steps) : '');
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
    await putBody(date, patch);
    onClose();
  };

  return (
    <Sheet open={open} title="Вес и замеры" onClose={onClose}>
      <div className="flex flex-col gap-4 px-2 pb-2">
        <div>
          <p className="mb-1 text-sm text-muted">Утренний вес</p>
          <Stepper big label="Вес" value={formatScaled(weight, 100, 2)} unit="кг" onDec={() => setWeight((w) => w - 10)} onInc={() => setWeight((w) => w + 10)} />
          <div className="mt-2 flex justify-center gap-2">
            {[-50, 50].map((d) => (
              <Button key={d} size="sm" variant="secondary" onClick={() => setWeight((w) => w + d)}>
                {d > 0 ? '+0,5' : '−0,5'}
              </Button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Талия" suffix="см" inputMode="decimal" placeholder={lastWaist ? formatScaled(lastWaist.waist!, 10, 1) : '92'} value={waist} onChange={(e) => setWaist(e.target.value)} />
          <Field label="Шея" suffix="см" inputMode="decimal" placeholder={lastNeck ? formatScaled(lastNeck.neck!, 10, 1) : '38'} value={neck} onChange={(e) => setNeck(e.target.value)} />
          <Field label="Шаги" inputMode="numeric" placeholder="8000" value={steps} onChange={(e) => setSteps(e.target.value)} />
        </div>
        <p className="text-sm text-muted">
          Талия — на уровне пупка, шея — под кадыком. {fat !== null && <b className="text-ink">% жира ≈ {formatScaled(Math.round(fat * 10), 10, 1)}</b>}
        </p>
        <Button size="lg" onClick={() => void save()}>
          Записать
        </Button>
      </div>
    </Sheet>
  );
}

const FEEL = ['Тяжело', 'Так себе', 'Нормально', 'Хорошо', 'Отлично'] as const;

export function PoolSheet({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  const today = useToday();
  const plan = poolPlan(date, false);
  const [minutes, setMinutes] = useState(plan.minutes);
  const [meters, setMeters] = useState('');
  const [feel, setFeel] = useState<1 | 2 | 3 | 4 | 5 | undefined>();
  useEffect(() => {
    if (open) {
      setMinutes(plan.minutes);
      setMeters('');
      setFeel(undefined);
    }
  }, [open]);
  const save = async () => {
    const m = toNum(meters);
    await addPool({ date, minutes, ...(m ? { meters: Math.round(m) } : {}), ...(feel ? { feel } : {}) });
    onClose();
  };
  return (
    <Sheet open={open} title={date === today ? 'Бассейн' : `Бассейн · ${formatDayMonth(date)}`} onClose={onClose}>
      <div className="flex flex-col gap-4 px-2 pb-2">
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
        <Button size="lg" onClick={() => void save()}>
          Записать
        </Button>
      </div>
    </Sheet>
  );
}
