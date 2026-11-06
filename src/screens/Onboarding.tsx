// Первый запуск — SPEC 6.8.

import { Volume2 } from 'lucide-react';
import { useState } from 'react';
import { beep, unlockAudio } from '../app/sound';
import { Button, Chip, Field, Stepper } from '../components/ui';
import { PROGRAM_START } from '../data/program';
import { updateSettings } from '../db/db';
import { putBody } from '../db/repo';
import type { Settings } from '../db/types';
import { bodyFatPercent, leanMass, targetWeightFor } from '../domain/body';
import { appToday as today } from '../app/clock';
import { formatKg, formatScaled, parseKg } from '../domain/format';

export function Onboarding({ settings }: { settings: Settings }) {
  const [step, setStep] = useState(0);
  const [height, setHeight] = useState(Math.round(settings.heightCm * 10));
  const [weight, setWeight] = useState(settings.startWeight);
  const [waist, setWaist] = useState(920);
  const [neck, setNeck] = useState(380);
  const [startDate, setStartDate] = useState(settings.startDate || PROGRAM_START);
  const [useCalc, setUseCalc] = useState(true);
  const heightCm = height / 10;
  const fat = bodyFatPercent(waist, neck, heightCm);
  const calcTarget = fat !== null ? Math.round(targetWeightFor(weight, fat, settings.targetBodyFat) / 10) * 10 : settings.targetWeight;

  const finish = async () => {
    await putBody(today(), { weight, waist, neck });
    await updateSettings({
      heightCm,
      startWeight: weight,
      targetWeight: useCalc ? calcTarget : settings.targetWeight,
      startDate,
      onboarded: true,
    });
  };

  // Тап по числу — ввод с клавиатуры: до нужного значения не нужно щёлкать степпером десятки раз.
  const parse10 = (raw: string, min: number, max: number) => {
    const v = Number(raw.replace(',', '.').trim());
    return Number.isFinite(v) && v >= min && v <= max ? Math.round(v * 10) : null;
  };
  const hint = <p className="mt-2 text-center text-xs text-muted">Тап по числу — ввести с клавиатуры</p>;

  const steps = [
    {
      title: 'Рост',
      body: (
        <>
          <Stepper
            big
            label="Рост"
            value={formatScaled(height, 10, 1)}
            unit="см"
            onDec={() => setHeight((h) => h - 5)}
            onInc={() => setHeight((h) => h + 5)}
            onEdit={(raw) => {
              const v = parse10(raw, 120, 230);
              if (v !== null) setHeight(v);
            }}
          />
          {hint}
        </>
      ),
    },
    {
      title: 'Вес сегодня утром',
      body: (
        <>
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
            <Button size="sm" variant="secondary" onClick={() => setWeight((w) => w - 100)}>−1 кг</Button>
            <Button size="sm" variant="secondary" onClick={() => setWeight((w) => w + 100)}>+1 кг</Button>
          </div>
          {hint}
        </>
      ),
    },
    {
      title: 'Талия и шея',
      body: (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">Талия — на уровне пупка, шея — под кадыком. Сантиметровой лентой, без втягивания.</p>
          <div>
            <p className="mb-1 text-sm text-muted">Талия</p>
            <Stepper
              big
              label="Талия"
              value={formatScaled(waist, 10, 1)}
              unit="см"
              onDec={() => setWaist((w) => w - 5)}
              onInc={() => setWaist((w) => w + 5)}
              onEdit={(raw) => {
                const v = parse10(raw, 50, 200);
                if (v !== null) setWaist(v);
              }}
            />
          </div>
          <div>
            <p className="mb-1 text-sm text-muted">Шея</p>
            <Stepper
              big
              label="Шея"
              value={formatScaled(neck, 10, 1)}
              unit="см"
              onDec={() => setNeck((n) => n - 5)}
              onInc={() => setNeck((n) => n + 5)}
              onEdit={(raw) => {
                const v = parse10(raw, 25, 60);
                if (v !== null) setNeck(v);
              }}
            />
          </div>
          {fat !== null && (
            <div className="rounded-2xl bg-surface-2 p-3">
              <p>
                % жира ≈ <b>{formatScaled(Math.round(fat * 10), 10, 1)}</b> · сухая масса {formatKg(leanMass(weight, fat))}
              </p>
              <p className="mt-1 text-sm text-muted">
                Цель при {settings.targetBodyFat}% жира: сухая масса / {formatScaled(100 - settings.targetBodyFat, 100, 2)} = <b className="text-ink">{formatKg(calcTarget)}</b>
              </p>
              <div className="mt-2 flex gap-2">
                <Chip active={useCalc} onClick={() => setUseCalc(true)}>Цель {formatKg(calcTarget)}</Chip>
                <Chip active={!useCalc} onClick={() => setUseCalc(false)}>Оставить {formatKg(settings.targetWeight)}</Chip>
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Старт и звук',
      body: (
        <div className="flex flex-col gap-4">
          <Field label="Дата старта программы" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value || PROGRAM_START)} />
          <Button variant="secondary" size="lg" onClick={() => (unlockAudio(), beep())}>
            <Volume2 size={20} aria-hidden /> Проверить сигнал таймера
          </Button>
          <p className="text-sm text-muted">Сигнал звучит, когда отдых закончился и приложение на экране. Выключи беззвучный режим.</p>
        </div>
      ),
    },
  ];
  const cur = steps[step]!;
  return (
    <div className="vv-top pt-safe pb-safe fixed inset-0 z-50 flex flex-col bg-bg px-5">
      <div className="mt-6 flex items-center gap-1" aria-label={`Шаг ${step + 1} из ${steps.length}`}>
        {steps.map((_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-progress' : 'bg-track'}`} />
        ))}
      </div>
      <p className="mt-6 text-sm text-muted">Шаг {step + 1} из {steps.length}</p>
      <h1 className="text-2xl font-semibold">{cur.title}</h1>
      <div className="mt-6 flex-1 overflow-y-auto">{cur.body}</div>
      <div className="flex gap-2 py-4">
        {step > 0 ? (
          <Button variant="secondary" size="lg" onClick={() => setStep((s) => s - 1)}>
            Назад
          </Button>
        ) : (
          <Button variant="ghost" size="lg" onClick={() => void updateSettings({ onboarded: true })}>
            Пропустить
          </Button>
        )}
        <Button size="lg" className="flex-1" onClick={() => (step < steps.length - 1 ? setStep((s) => s + 1) : void finish())}>
          {step < steps.length - 1 ? 'Дальше' : 'Готово'}
        </Button>
      </div>
    </div>
  );
}
