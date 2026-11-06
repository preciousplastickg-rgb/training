// Первый запуск — SPEC 6.8, макет BOnboarding (REDESIGN 4): вопрос → крупное число → линейка/степпер.

import { ChevronLeft, Minus, Plus, Volume2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { beep, unlockAudio } from '../app/sound';
import { Field } from '../components/ui';
import { Ruler } from '../components/Ruler';
import { CHECKPOINTS, PROGRAM_START } from '../data/program';
import { updateSettings } from '../db/db';
import { putBody } from '../db/repo';
import type { Settings } from '../db/types';
import { bodyFatPercent, leanMass, roundTargetKg, targetWeightFor } from '../domain/body';
import { appToday as today } from '../app/clock';
import { formatDayMonth, formatScaled } from '../domain/format';

export function Onboarding({ settings }: { settings: Settings }) {
  const [step, setStep] = useState(0);
  const [height, setHeight] = useState(Math.round(settings.heightCm));
  const [weight, setWeight] = useState(settings.startWeight);
  const [waist, setWaist] = useState(920);
  const [neck, setNeck] = useState(380);
  const [startDate, setStartDate] = useState(settings.startDate || PROGRAM_START);
  const fat = bodyFatPercent(waist, neck, height);
  const calcTarget = fat !== null ? targetWeightFor(weight, fat, settings.targetBodyFat) : null;
  const nextCheck = CHECKPOINTS.find((c) => c.date > today() && c.todo.includes('% жира')) ?? CHECKPOINTS.find((c) => c.date > today());

  const finish = async () => {
    await putBody(today(), { weight, waist, neck });
    await updateSettings({
      heightCm: height,
      startWeight: weight,
      targetWeight: calcTarget ?? settings.targetWeight,
      startDate,
      onboarded: true,
    });
  };

  const steps: { question: string; hint: string; body: ReactNode }[] = [
    {
      question: 'Какой у тебя рост?',
      hint: 'Без обуви. Нужен для расчёта % жира.',
      body: (
        <>
          <Big value={String(height)} unit="см" />
          <Ruler label="Рост, см" value={height} min={140} max={220} step={1} majorEvery={5} format={String} onChange={setHeight} />
        </>
      ),
    },
    {
      question: 'Сколько ты весишь?',
      hint: 'Утром, после туалета, до еды. Это стартовый вес.',
      body: (
        <>
          <Big value={formatScaled(weight, 100, 1)} unit="кг" />
          <Ruler label="Вес, кг" value={weight} min={4000} max={20000} step={10} majorEvery={10} format={(v) => formatScaled(v, 100, 0)} onChange={setWeight} />
        </>
      ),
    },
    {
      question: 'Какой обхват талии?',
      hint: 'Утром, на выдохе, лента на уровне пупка.',
      body: (
        <>
          <Big value={formatScaled(waist, 10, 0)} unit="см" />
          <Ruler label="Талия, см" value={waist} min={500} max={1500} step={10} majorEvery={5} format={(v) => formatScaled(v, 10, 0)} onChange={setWaist} />
          <div className="mx-4 mt-3.5 flex items-center gap-2.5 rounded-3xl bg-surface py-3 pr-3 pl-5">
            <span className="flex flex-1 flex-col">
              <span className="text-[13px] text-muted">Шея, под кадыком</span>
              <span className="font-display text-2xl font-bold tabular-nums">
                {formatScaled(neck, 10, 0)} <span className="font-sans text-sm font-bold text-muted">см</span>
              </span>
            </span>
            <Round label="Шея минус 1 см" onClick={() => setNeck((n) => Math.max(250, n - 10))}>
              <Minus size={20} strokeWidth={2.6} aria-hidden />
            </Round>
            <Round label="Шея плюс 1 см" onClick={() => setNeck((n) => Math.min(600, n + 10))}>
              <Plus size={20} strokeWidth={2.6} aria-hidden />
            </Round>
          </div>
          <div className="mx-4 mt-3 grid grid-cols-2 gap-2 rounded-[26px] border border-hero-line bg-hero px-5 py-[18px] text-white">
            <span className="flex flex-col gap-0.5">
              <span className="text-[13px] text-muted-on-ink">Жир сейчас</span>
              <span className="font-display text-[30px] font-bold text-primary tabular-nums">{fat !== null ? `${formatScaled(Math.round(fat * 10), 10, 1)}%` : '—'}</span>
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[13px] text-muted-on-ink">Цель при {settings.targetBodyFat}%</span>
              <span className="font-display text-[30px] font-bold tabular-nums">{calcTarget !== null ? `≈ ${formatScaled(roundTargetKg(calcTarget), 100, 0)} кг` : '—'}</span>
            </span>
            <span className="col-span-2 text-xs leading-[17px] text-muted-on-ink">
              {fat !== null
                ? `Ориентир: мышцы ${formatScaled(leanMass(weight, fat), 100, 1)} кг ÷ ${formatScaled(100 - settings.targetBodyFat, 100, 2)}.${nextCheck ? ` Уточним ${formatDayMonth(nextCheck.date)} по новым замерам.` : ''}`
                : 'Талия должна быть больше шеи — проверь замеры.'}
            </span>
          </div>
        </>
      ),
    },
    {
      question: 'Когда старт программы?',
      hint: 'По плану — 9 ноября. Заодно проверь сигнал таймера.',
      body: (
        <div className="mx-4 flex flex-col gap-3">
          <Big value={formatDayMonth(startDate)} small />
          <div className="rounded-3xl bg-surface p-4">
            <Field label="Дата старта" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value || PROGRAM_START)} />
          </div>
          <button
            type="button"
            onClick={() => (unlockAudio(), beep())}
            className="flex h-14 items-center justify-center gap-2 rounded-full bg-surface text-[15px] font-extrabold active:opacity-80"
          >
            <Volume2 size={20} aria-hidden /> Проверить сигнал таймера
          </button>
          <p className="px-1 text-sm text-muted">Сигнал звучит, когда отдых закончился и приложение на экране. Выключи беззвучный режим.</p>
        </div>
      ),
    },
  ];
  const cur = steps[step]!;
  const last = step === steps.length - 1;
  return (
    <div className="vv-top pt-safe pb-safe fixed inset-0 z-50 flex flex-col bg-bg">
      <div className="flex items-center justify-between px-[22px] pt-3">
        {step > 0 ? (
          <Round label="Назад" onClick={() => setStep((s) => s - 1)} className="bg-surface!">
            <ChevronLeft size={22} strokeWidth={2.2} aria-hidden />
          </Round>
        ) : (
          <button type="button" onClick={() => void updateSettings({ onboarded: true })} className="h-12 rounded-full bg-surface px-5 text-sm font-bold active:opacity-80">
            Пропустить
          </button>
        )}
        <div className="flex gap-1.5" aria-label={`Шаг ${step + 1} из ${steps.length}`}>
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-2 rounded-full ${i === step ? 'w-10 bg-ink' : i < step ? 'w-[22px] bg-ink' : 'w-[22px]'}`}
              style={i > step ? { background: 'color-mix(in srgb, var(--ink) 16%, var(--bg))' } : undefined}
            />
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        <div className="flex flex-col gap-2.5 px-[22px] pt-[34px]">
          <h1 className="font-display text-[28px] leading-9 font-bold">{cur.question}</h1>
          <p className="text-[15px] leading-[22px] text-muted">{cur.hint}</p>
        </div>
        <div className="mt-[26px]">{cur.body}</div>
      </div>
      <div className="px-4 pb-4">
        <button
          type="button"
          onClick={() => (last ? void finish() : setStep((s) => s + 1))}
          className="h-[60px] w-full rounded-full bg-ink text-[17px] font-extrabold text-bg active:scale-[0.98]"
        >
          {last ? 'Готово' : 'Дальше'}
        </button>
      </div>
    </div>
  );
}

function Big({ value, unit, small = false }: { value: string; unit?: string; small?: boolean }) {
  return (
    <div className="mb-2 flex items-baseline justify-center gap-2">
      <span className={`font-display font-bold tabular-nums ${small ? 'text-[40px] leading-[48px]' : 'text-huge text-[76px] leading-[84px]'}`}>{value}</span>
      {unit && <span className="text-xl font-bold text-muted">{unit}</span>}
    </div>
  );
}

function Round({ label, onClick, children, className = '' }: { label: string; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-track active:scale-95 ${className}`}>
      {children}
    </button>
  );
}
