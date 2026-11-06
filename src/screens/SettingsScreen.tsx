import { ChevronLeft, ChevronRight, MonitorSmartphone, Moon, Sun, Volume2, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { navigate } from '../app/router';
import { beep, unlockAudio } from '../app/sound';
import { ScreenHeader } from '../components/ScreenHeader';
import { Sheet } from '../components/Sheet';
import { Button, Card, Chip, Field, Stepper, Tabs } from '../components/ui';
import { getExercise } from '../data/exercises';
import { DEFAULT_SETTINGS, updateSettings } from '../db/db';
import { resetProgram, updateSlot } from '../db/repo';
import type { ProgramSlot, Settings, Theme } from '../db/types';
import { formatKg, formatScaled, parseKg } from '../domain/format';
import { Trash2 } from 'lucide-react';
import { useAdjustments, useSlots } from '../hooks/useData';
import { db } from '../db/db';
import { formatDayMonth } from '../domain/format';
import { BackupSection } from './settings/BackupSection';
import { FoodsSection } from './settings/FoodsSection';

const THEMES: { value: Theme; label: string; icon: LucideIcon }[] = [
  { value: 'light', label: 'Светлая', icon: Sun },
  { value: 'dark', label: 'Тёмная', icon: Moon },
  { value: 'system', label: 'Как в системе', icon: MonitorSmartphone },
];

const ALL_PLATES = [2500, 2000, 1500, 1000, 500, 250, 125, 50];

interface SettingsScreenProps {
  settings: Settings | undefined;
  persisted: boolean | undefined;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-sm font-semibold text-muted">{title}</h2>
      <Card>{children}</Card>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-14 items-center gap-3 border-b border-line py-1 last:border-0">
      <span className="flex-1">{label}</span>
      <div className="w-44">{children}</div>
    </div>
  );
}

export function SettingsScreen({ settings: maybe, persisted }: SettingsScreenProps) {
  const settings = maybe ?? DEFAULT_SETTINGS;
  return (
    <>
      <ScreenHeader
        title="Настройки"
        leading={
          <button type="button" aria-label="Назад" onClick={() => navigate('today')} className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full active:bg-track">
            <ChevronLeft size={26} />
          </button>
        }
      />
      <div className="flex flex-col gap-5 px-4 pb-8">
        <ProfileSection settings={settings} />
        <ProgramSection />

        <Section title="Отдых">
          <Row label="Долгий (присед, жимы, тяги)">
            <Stepper label="Долгий отдых" value={`${settings.restLong} с`} onDec={() => void updateSettings({ restLong: Math.max(30, settings.restLong - 15) })} onInc={() => void updateSettings({ restLong: settings.restLong + 15 })} />
          </Row>
          <Row label="Обычный">
            <Stepper label="Обычный отдых" value={`${settings.restShort} с`} onDec={() => void updateSettings({ restShort: Math.max(30, settings.restShort - 15) })} onInc={() => void updateSettings({ restShort: settings.restShort + 15 })} />
          </Row>
        </Section>

        <Section title="Гриф и блины">
          <Row label="Гриф">
            <Stepper label="Вес грифа" value={formatKg(settings.barWeight)} onDec={() => void updateSettings({ barWeight: Math.max(500, settings.barWeight - 250) })} onInc={() => void updateSettings({ barWeight: settings.barWeight + 250 })} />
          </Row>
          <p className="mt-3 mb-2 text-sm text-muted">Блины в зале (на одну сторону)</p>
          <div className="flex flex-wrap gap-2">
            {ALL_PLATES.map((pl) => {
              const on = settings.plates.includes(pl);
              return (
                <Chip
                  key={pl}
                  active={on}
                  onClick={() => void updateSettings({ plates: on ? settings.plates.filter((x) => x !== pl) : [...settings.plates, pl].sort((a, b) => b - a) })}
                >
                  {formatKg(pl, false)}
                </Chip>
              );
            })}
          </div>
        </Section>

        <Section title="Звук и тема">
          <div className="flex min-h-14 items-center gap-3">
            <span className="flex-1">Сигнал конца отдыха</span>
            <Button variant="secondary" size="sm" onClick={() => (unlockAudio(), beep())} aria-label="Проверить звук">
              <Volume2 size={18} aria-hidden />
            </Button>
            <Toggle label="Звук" value={settings.sound} onChange={(v) => void updateSettings({ sound: v })} />
          </div>
          <div role="radiogroup" aria-label="Тема" className="mt-3 grid grid-cols-3 gap-2">
            {THEMES.map(({ value, label, icon: Icon }) => {
              const checked = settings.theme === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  onClick={() => void updateSettings({ theme: value })}
                  className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border text-sm ${
                    checked ? 'border-primary bg-primary text-on-primary' : 'border-line text-ink'
                  }`}
                >
                  <Icon size={20} aria-hidden />
                  {label}
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="Калории">
          <AdjustmentsList />
          <p className="mt-3 mb-2 text-sm text-muted">Фаза 3 (с 1 марта)</p>
          <div className="grid grid-cols-2 gap-2">
            <Chip active={settings.phase3Mode !== 'maintenance'} onClick={() => void updateSettings({ phase3Mode: 'deficit' })} className="justify-center">
              Дефицит (как сейчас)
            </Chip>
            <Chip active={settings.phase3Mode === 'maintenance'} onClick={() => void updateSettings({ phase3Mode: 'maintenance' })} className="justify-center">
              Поддержка ≈ 2 400
            </Chip>
          </div>
        </Section>

        <FoodsSection />
        <BackupSection settings={settings} persisted={persisted} />

        <Section title="О приложении">
          <p>Тренировки и питание · версия {__APP_VERSION__}</p>
          <p className="text-sm text-muted">Сборка {__APP_BUILD__}</p>
          <p className="mt-1 text-sm text-muted">Карта мышц: body-highlighter, MIT</p>
          <p className="text-sm text-muted">Шрифт: IBM Plex Sans, SIL Open Font License 1.1</p>
          <button type="button" onClick={() => navigate('dev/animations')} className="mt-2 flex min-h-11 w-full items-center justify-between text-left text-accent">
            Позы упражнений (проверка манекена) <ChevronRight size={18} aria-hidden />
          </button>
          {import.meta.env.DEV && (
            <button type="button" onClick={() => navigate('dev/seed')} className="flex min-h-11 w-full items-center justify-between text-left text-accent">
              Демо-данные за 8 недель (dev) <ChevronRight size={18} aria-hidden />
            </button>
          )}
        </Section>
      </div>
    </>
  );
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      onClick={() => onChange(!value)}
      className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${value ? 'bg-progress' : 'bg-surface-2'}`}
    >
      <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-[left] ${value ? 'left-7' : 'left-1'}`} />
    </button>
  );
}

function ProfileSection({ settings }: { settings: Settings }) {
  const save = (patch: Partial<Settings>) => void updateSettings(patch);
  return (
    <Section title="Профиль">
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Рост"
          suffix="см"
          inputMode="decimal"
          defaultValue={String(settings.heightCm).replace('.', ',')}
          onBlur={(e) => {
            const v = Number(e.target.value.replace(',', '.'));
            if (v > 100 && v < 250) save({ heightCm: v });
          }}
        />
        <Field label="Старт программы" type="date" defaultValue={settings.startDate} onBlur={(e) => e.target.value && save({ startDate: e.target.value })} />
        <Field
          label="Стартовый вес"
          suffix="кг"
          inputMode="decimal"
          defaultValue={formatScaled(settings.startWeight, 100, 2)}
          onBlur={(e) => {
            const v = parseKg(e.target.value);
            if (v) save({ startWeight: v });
          }}
        />
        <Field
          label="Цель"
          suffix="кг"
          inputMode="decimal"
          defaultValue={formatScaled(settings.targetWeight, 100, 2)}
          onBlur={(e) => {
            const v = parseKg(e.target.value);
            if (v) save({ targetWeight: v });
          }}
        />
        <Field
          label="Цель по жиру"
          suffix="%"
          inputMode="numeric"
          defaultValue={String(settings.targetBodyFat)}
          onBlur={(e) => {
            const v = Number(e.target.value);
            if (v > 3 && v < 40) save({ targetBodyFat: v });
          }}
        />
      </div>
    </Section>
  );
}

function ProgramSection() {
  const slots = useSlots();
  const [tab, setTab] = useState<'A' | 'B'>('A');
  const [edit, setEdit] = useState<ProgramSlot | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const list = slots.filter((s) => s.workout === tab).sort((a, b) => a.order - b.order || (a.fromPhase ?? 1) - (b.fromPhase ?? 1));
  return (
    <section>
      <h2 className="mb-2 px-1 text-sm font-semibold text-muted">Программа</h2>
      <Tabs value={tab} onChange={setTab} items={[{ value: 'A', label: 'A' }, { value: 'B', label: 'B' }]} />
      <Card className="mt-2">
        <ul className="divide-y divide-line">
          {list.map((s) => {
            const ex = getExercise(s.exerciseId);
            const phase = s.toPhase === 1 ? ' · фаза 1' : s.fromPhase === 2 ? ' · с фазы 2' : '';
            return (
              <li key={s.id}>
                <button type="button" onClick={() => setEdit(s)} className="flex min-h-14 w-full items-center gap-2 py-2 text-left">
                  <span className="flex-1">
                    <span className="block font-medium">{ex.name}</span>
                    <span className="block text-sm text-muted">
                      {s.sets} × {s.repMin}–{s.repMax}
                      {ex.unit === 'seconds' ? ' с' : ''} · шаг {stepText(s)}
                      {phase}
                    </span>
                  </span>
                  <ChevronRight size={18} className="text-muted" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => setConfirmReset(true)}>
          Вернуть программу из плана
        </Button>
      </Card>
      {edit && <SlotSheet slot={slots.find((s) => s.id === edit.id) ?? edit} onClose={() => setEdit(null)} />}
      <Sheet open={confirmReset} title="Вернуть исходную программу?" onClose={() => setConfirmReset(false)}>
        <div className="flex flex-col gap-2 p-2">
          <p className="px-2 pb-2 text-muted">Подходы, повторы и шаги станут как в плане от 5 ноября. История тренировок не изменится.</p>
          <Button size="lg" onClick={() => void resetProgram().then(() => setConfirmReset(false))}>
            Вернуть
          </Button>
          <Button size="lg" variant="secondary" onClick={() => setConfirmReset(false)}>
            Отмена
          </Button>
        </div>
      </Sheet>
    </section>
  );
}

function stepText(s: ProgramSlot): string {
  const ex = getExercise(s.exerciseId);
  if (ex.unit === 'seconds') return `+${s.step} с`;
  if (ex.unit === 'reps') return `+${s.step} повт.`;
  return `+${formatKg(s.step)}`;
}

function SlotSheet({ slot, onClose }: { slot: ProgramSlot; onClose: () => void }) {
  const ex = getExercise(slot.exerciseId);
  const up = (patch: Partial<ProgramSlot>) => void updateSlot(slot.id, patch);
  const stepDelta = ex.unit === 'kg' ? 50 : ex.unit === 'seconds' ? 5 : 1;
  const restOptions: { v: ProgramSlot['rest']; label: string }[] = [
    { v: 'long', label: 'Долгий' },
    { v: 'short', label: 'Обычный' },
    { v: 60, label: '60 с' },
  ];
  return (
    <Sheet open title={ex.name} onClose={onClose}>
      <div className="px-2 pb-2">
        <Row label="Подходов">
          <Stepper label="Подходов" value={slot.sets} onDec={() => up({ sets: Math.max(1, slot.sets - 1) })} onInc={() => up({ sets: Math.min(8, slot.sets + 1) })} />
        </Row>
        <Row label={ex.unit === 'seconds' ? 'Секунд от' : 'Повторов от'}>
          <Stepper label="Минимум" value={slot.repMin} onDec={() => up({ repMin: Math.max(1, slot.repMin - (ex.unit === 'seconds' ? 5 : 1)) })} onInc={() => up({ repMin: Math.min(slot.repMax, slot.repMin + (ex.unit === 'seconds' ? 5 : 1)) })} />
        </Row>
        <Row label="до">
          <Stepper label="Максимум" value={slot.repMax} onDec={() => up({ repMax: Math.max(slot.repMin, slot.repMax - (ex.unit === 'seconds' ? 5 : 1)) })} onInc={() => up({ repMax: slot.repMax + (ex.unit === 'seconds' ? 5 : 1) })} />
        </Row>
        <Row label="Шаг прогрессии">
          <Stepper label="Шаг" value={stepText(slot)} onDec={() => up({ step: Math.max(stepDelta, slot.step - stepDelta) })} onInc={() => up({ step: slot.step + stepDelta })} />
        </Row>
        <p className="mt-3 mb-2 text-sm text-muted">Отдых</p>
        <div className="flex gap-2">
          {restOptions.map((o) => (
            <Chip key={String(o.v)} active={slot.rest === o.v} onClick={() => up({ rest: o.v })}>
              {o.label}
            </Chip>
          ))}
        </div>
      </div>
    </Sheet>
  );
}

function AdjustmentsList() {
  const adjustments = useAdjustments();
  if (adjustments.length === 0) {
    return <p className="text-sm text-muted">Корректировок пока нет. Приложение предложит их по понедельникам с 3-й недели.</p>;
  }
  return (
    <ul className="divide-y divide-line">
      {adjustments.map((a) => (
        <li key={a.id} className="flex min-h-12 items-center gap-2 text-sm">
          <span className="flex-1">
            <b className={a.deltaKcal < 0 ? 'text-energy' : 'text-accent'}>
              {a.deltaKcal > 0 ? '+' : '−'}
              {Math.abs(a.deltaKcal)} ккал
            </b>{' '}
            с {formatDayMonth(a.date)}
          </span>
          <button type="button" aria-label="Отменить корректировку" onClick={() => void db.adjustments.delete(a.id)} className="flex h-11 w-11 items-center justify-center text-muted">
            <Trash2 size={16} aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}
