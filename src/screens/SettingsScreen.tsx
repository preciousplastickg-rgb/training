// Настройки — SPEC 6.5, макет BSettings (REDESIGN 4): чёрная карточка профиля, группы строк на белом.

import { ChevronLeft, ChevronRight, Volume2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { navigate } from '../app/router';
import { beep, unlockAudio } from '../app/sound';
import { ScreenHeader } from '../components/ScreenHeader';
import { Sheet } from '../components/Sheet';
import { Button, Caps, Field } from '../components/ui';
import { DEFAULT_SETTINGS, updateSettings } from '../db/db';
import type { Settings, Theme } from '../db/types';
import { roundTargetKg } from '../domain/body';
import { formatDayMonth, formatKg, formatScaled, parseKg } from '../domain/format';
import { useAdjustments, useFoods, useSlots } from '../hooks/useData';
import { BackupRows } from './settings/BackupSection';
import { FoodsSheet } from './settings/FoodsSection';
import { CaloriesSheet, Group, PlatesSheet, ProgramSheet, RestSheet, ScheduleSheet, scheduleText } from './settings/ProgramSheets';
import { ViewportDiagnostics } from './settings/ViewportDiagnostics';

const THEMES: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
  { value: 'system', label: 'Авто' },
];

interface SettingsScreenProps {
  settings: Settings | undefined;
  persisted: boolean | undefined;
}

type Open = 'profile' | 'program' | 'rest' | 'plates' | 'schedule' | 'calories' | 'foods' | null;

/** Строка-кнопка группы: подпись, значение, шеврон. Отступы 22 px — классом, не глобальным сбросом. */
export function SettingsRow({ label, value, onClick, ariaLabel }: { label: string; value?: string; onClick: () => void; ariaLabel?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel} className="flex min-h-[58px] w-full items-center gap-3 border-t border-line px-[22px] text-left first:border-t-0 active:bg-track">
      <span className="flex-1 text-[16px] font-semibold">{label}</span>
      {value && <span className="truncate text-[15px] text-muted">{value}</span>}
      <ChevronRight size={16} strokeWidth={2.4} className="shrink-0 text-muted" aria-hidden />
    </button>
  );
}

function GroupTitle({ children }: { children: ReactNode }) {
  return <Caps className="mb-2 px-[22px]">{children}</Caps>;
}

export function SettingsScreen({ settings: maybe, persisted }: SettingsScreenProps) {
  const settings = maybe ?? DEFAULT_SETTINGS;
  const [open, setOpen] = useState<Open>(null);
  const slots = useSlots();
  const foods = useFoods();
  const adjustments = useAdjustments();
  const close = () => setOpen(null);
  const countA = slots.filter((s) => s.workout === 'A' && (s.toPhase ?? 3) >= 2).length;
  const countB = slots.filter((s) => s.workout === 'B' && (s.toPhase ?? 3) >= 2).length;
  return (
    <>
      <ScreenHeader
        title="Настройки"
        leading={
          <button type="button" aria-label="Назад" onClick={() => navigate('today')} className="mr-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface active:bg-track">
            <ChevronLeft size={22} strokeWidth={2.2} aria-hidden />
          </button>
        }
      />
      <div className="flex flex-col gap-5 px-4 pb-8">
        <ProfileHero settings={settings} onEdit={() => setOpen('profile')} />

        <section>
          <GroupTitle>Программа</GroupTitle>
          <Group className="px-0!">
            <SettingsRow label="Тренировки A и B" value={`${countA} и ${countB}`} onClick={() => setOpen('program')} />
            <SettingsRow label="Отдых" value={`${settings.restLong} / ${settings.restShort} / 60 с`} onClick={() => setOpen('rest')} />
            <SettingsRow label="Гриф и блины" value={`${formatKg(settings.barWeight)} · ${settings.plates.length} видов`} onClick={() => setOpen('plates')} />
            <SettingsRow label="Расписание" value={scheduleText(settings)} onClick={() => setOpen('schedule')} />
            <SettingsRow label="Калории" value={adjustments.length ? `${adjustments.length} корр.` : settings.phase3Mode === 'maintenance' ? 'фаза 3: поддержка' : 'по плану'} onClick={() => setOpen('calories')} />
          </Group>
        </section>

        <section>
          <GroupTitle>Данные</GroupTitle>
          <Group className="px-0!">
            <SettingsRow label="База продуктов" value={String(foods.filter((f) => !f.archived).length)} onClick={() => setOpen('foods')} />
            <BackupRows settings={settings} persisted={persisted} />
          </Group>
        </section>

        <section>
          <GroupTitle>Приложение</GroupTitle>
          <Group className="px-0!">
            <div className="flex min-h-[58px] items-center gap-3 px-[22px]">
              <span className="flex-1 text-[16px] font-semibold">Сигнал конца отдыха</span>
              <button type="button" onClick={() => (unlockAudio(), beep())} aria-label="Проверить звук" className="flex h-11 w-11 items-center justify-center rounded-full text-muted active:bg-track">
                <Volume2 size={18} aria-hidden />
              </button>
              <Toggle label="Звук" value={settings.sound} onChange={(v) => void updateSettings({ sound: v })} />
            </div>
            <div className="flex flex-col gap-3 border-t border-line px-[22px] py-4">
              <span className="text-[16px] font-semibold">Тема</span>
              <div role="radiogroup" aria-label="Тема" className="grid grid-cols-3 gap-1.5">
                {THEMES.map(({ value, label }) => {
                  const checked = settings.theme === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      onClick={() => void updateSettings({ theme: value })}
                      className={`h-11 rounded-full text-sm ${checked ? 'bg-ink font-bold text-bg' : 'bg-track font-semibold text-ink'}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </Group>
        </section>

        <section>
          <GroupTitle>О приложении</GroupTitle>
          <Group className="px-0!">
            <div className="px-[22px] py-4">
              <p className="text-[16px] font-semibold">Тренировки и питание · версия {__APP_VERSION__}</p>
              <p className="text-sm text-muted">Сборка {__APP_BUILD__}</p>
              <ViewportDiagnostics />
              <p className="mt-1 text-sm text-muted">Карта мышц: body-highlighter, MIT</p>
              <p className="text-sm text-muted">Шрифты: Unbounded и Manrope, SIL Open Font License 1.1</p>
            </div>
            <SettingsRow label="Позы упражнений" value="манекен" onClick={() => navigate('dev/animations')} />
            {import.meta.env.DEV && <SettingsRow label="Демо-данные за 8 недель" value="dev" onClick={() => navigate('dev/seed')} />}
          </Group>
        </section>
        <p className="text-center text-xs text-muted">Данные хранятся только на этом телефоне</p>
      </div>

      <ProfileSheet open={open === 'profile'} onClose={close} settings={settings} />
      <ProgramSheet open={open === 'program'} onClose={close} />
      <RestSheet open={open === 'rest'} onClose={close} settings={settings} />
      <PlatesSheet open={open === 'plates'} onClose={close} settings={settings} />
      <ScheduleSheet open={open === 'schedule'} onClose={close} settings={settings} />
      <CaloriesSheet open={open === 'calories'} onClose={close} settings={settings} />
      <FoodsSheet open={open === 'foods'} onClose={close} />
    </>
  );
}

/** Переключатель: чёрная дорожка, лаймовая ручка. */
export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      onClick={() => onChange(!value)}
      className="-my-1.5 -mr-1.5 flex h-11 shrink-0 items-center px-1.5"
    >
      <span className={`relative block h-8 w-[52px] rounded-full transition-colors ${value ? 'bg-ink' : 'bg-track'}`}>
        <span className={`absolute top-[3px] h-[26px] w-[26px] rounded-full transition-[left] ${value ? 'left-[23px] bg-primary' : 'left-[3px] bg-surface'}`} />
      </span>
    </button>
  );
}

function ProfileHero({ settings, onEdit }: { settings: Settings; onEdit: () => void }) {
  const cell = (label: string, value: ReactNode, note: string, lime = false) => (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-on-ink">{label}</span>
      <span className={`font-display text-xl font-bold tabular-nums ${lime ? 'text-primary' : ''}`}>{value}</span>
      <span className="text-xs text-muted-on-ink">{note}</span>
    </div>
  );
  return (
    <section className="flex flex-col gap-4 rounded-[28px] border border-hero-line bg-hero px-[22px] py-5 text-white">
      <div className="flex items-center justify-between">
        <span className="font-display text-[22px] font-bold">{settings.name?.trim() || 'Профиль'}</span>
        <button type="button" onClick={onEdit} className="h-11 rounded-full bg-[#2A2C30] px-4 text-[13px] font-bold text-white active:opacity-80">
          Изменить
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {cell('Рост', formatScaled(Math.round(settings.heightCm * 10), 10, 1), 'см')}
        {cell('Старт', formatScaled(settings.startWeight, 100, 1), formatDayMonth(settings.startDate))}
        {cell('Цель', `≈ ${formatScaled(roundTargetKg(settings.targetWeight), 100, 0)}`, `при ${settings.targetBodyFat}% жира`, true)}
      </div>
    </section>
  );
}

function ProfileSheet({ open, onClose, settings }: { open: boolean; onClose: () => void; settings: Settings }) {
  const save = (patch: Partial<Settings>) => void updateSettings(patch);
  /** Неверное значение не сохраняется и не остаётся в поле — возвращаем прежнее, чтобы было видно, что ввод не принят. */
  const commit = (e: React.FocusEvent<HTMLInputElement>, parse: (s: string) => number | null, shown: string, patch: (v: number) => Partial<Settings>) => {
    const v = parse(e.target.value);
    if (v === null) e.target.value = shown;
    else save(patch(v));
  };
  const num = (min: number, max: number) => (s: string) => {
    const v = Number(s.replace(',', '.'));
    return Number.isFinite(v) && v > min && v < max ? v : null;
  };
  const kg = (s: string) => {
    const v = parseKg(s);
    return v && v > 3000 && v < 25000 ? v : null;
  };
  return (
    <Sheet open={open} kicker="Настройки" title="Профиль" onClose={onClose}>
      <div className="flex flex-col gap-3 rounded-[26px] bg-surface p-4">
        <Field label="Имя" placeholder="Как к тебе обращаться" defaultValue={settings.name ?? ''} onBlur={(e) => save({ name: e.target.value.trim() })} />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Рост"
            suffix="см"
            inputMode="decimal"
            defaultValue={String(settings.heightCm).replace('.', ',')}
            onBlur={(e) => commit(e, num(100, 250), String(settings.heightCm).replace('.', ','), (v) => ({ heightCm: v }))}
          />
          <Field label="Старт программы" type="date" defaultValue={settings.startDate} onBlur={(e) => e.target.value && save({ startDate: e.target.value })} />
          <Field
            label="Стартовый вес"
            suffix="кг"
            inputMode="decimal"
            defaultValue={formatScaled(settings.startWeight, 100, 2)}
            onBlur={(e) => commit(e, kg, formatScaled(settings.startWeight, 100, 2), (v) => ({ startWeight: v }))}
          />
          <Field
            label="Цель"
            suffix="кг"
            inputMode="decimal"
            defaultValue={formatScaled(settings.targetWeight, 100, 2)}
            onBlur={(e) => commit(e, kg, formatScaled(settings.targetWeight, 100, 2), (v) => ({ targetWeight: v }))}
          />
          <Field
            label="Цель по жиру"
            suffix="%"
            inputMode="numeric"
            defaultValue={String(settings.targetBodyFat)}
            onBlur={(e) => commit(e, num(3, 40), String(settings.targetBodyFat), (v) => ({ targetBodyFat: v }))}
          />
        </div>
        <p className="text-xs text-muted">Цель по весу — ориентир от сухой массы; на контрольных точках приложение предложит уточнить её по новым замерам.</p>
      </div>
      <Button size="lg" className="mt-3 w-full" onClick={onClose}>
        Готово
      </Button>
    </Sheet>
  );
}
