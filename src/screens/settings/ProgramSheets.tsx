// Шторки настроек программы (REDESIGN 4, BSettings): тренировки A, B, C по блокам, гриф и блины, расписание, калории.

import { ChevronRight, CirclePlay, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { ExerciseSheet } from '../../components/ExerciseSheet';
import { Sheet } from '../../components/Sheet';
import { Button, Caps, Chip, Stepper, Tabs } from '../../components/ui';
import { getExercise } from '../../data/exercises';
import { DEFAULT_SCHEDULE, MAINTENANCE_KCAL_PHASE3, WORKOUT_NAMES, WORKOUT_ORDER } from '../../data/program';
import { updateSettings } from '../../db/db';
import { deleteAdjustment, resetProgram, updateSlot } from '../../db/repo';
import type { BlockN, ProgramSlot, Settings, WeekSchedule, Workout } from '../../db/types';
import { formatDayMonth, formatInt, formatKg } from '../../domain/format';
import { blockFor } from '../../domain/program';
import { useAdjustments, useSlots } from '../../hooks/useData';
import { useToday } from '../../hooks/useToday';

const ALL_PLATES = [2500, 2000, 1500, 1000, 500, 250, 125, 50];
export const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const REST_OPTIONS = [150, 120, 90, 75, 60, 0];

interface SheetProps {
  open: boolean;
  onClose: () => void;
}

export function Row({ label, sub, children }: { label: string; sub?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[58px] items-center gap-3 border-t border-line py-1.5 first:border-t-0">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[16px] font-semibold">{label}</span>
        {sub && <span className="text-[13px] text-muted">{sub}</span>}
      </span>
      <div className="w-44 shrink-0">{children}</div>
    </div>
  );
}

export function Group({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[26px] bg-surface px-[22px] ${className}`}>{children}</div>;
}

/** Шаг слота: свой или из каталога упражнения. */
export function slotStep(s: ProgramSlot): number {
  return s.step ?? getExercise(s.exerciseId).defaultStep;
}

export function stepText(s: ProgramSlot): string {
  const ex = getExercise(s.exerciseId);
  const step = slotStep(s);
  if (ex.unit === 'seconds') return `+${step} с`;
  if (ex.unit === 'reps') return `+${step} повт.`;
  if (ex.unit === 'assist_kg') return `−${formatKg(step)}`;
  return `+${formatKg(step)}`;
}

export function ProgramSheet({ open, onClose }: SheetProps) {
  const slots = useSlots();
  const today = useToday();
  const [block, setBlock] = useState<BlockN>(() => blockFor(today));
  const [tab, setTab] = useState<Workout>('A');
  const [edit, setEdit] = useState<ProgramSlot | null>(null);
  // «Как делать» прямо из программы (10 ноября 2026, по просьбе пользователя): значок в строке и кнопка в правке слота
  const [howTo, setHowTo] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const list = slots.filter((s) => s.workout === tab && s.block === block).sort((a, b) => a.order - b.order || (a.fromPhase ?? 1) - (b.fromPhase ?? 1));
  return (
    <Sheet open={open} kicker="Программа" title="Тренировки A, B и C" onClose={onClose}>
      <div className="flex gap-2" role="radiogroup" aria-label="Блок">
        {([1, 2, 3] as BlockN[]).map((b) => (
          <Chip key={b} active={block === b} onClick={() => setBlock(b)} role="radio" aria-checked={block === b} className="flex-1 justify-center">
            Блок {b}
            {b === blockFor(today) ? ' · сейчас' : ''}
          </Chip>
        ))}
      </div>
      <div className="mt-2">
        <Tabs value={tab} onChange={setTab} items={WORKOUT_ORDER.map((w) => ({ value: w, label: `Тренировка ${w}` }))} />
      </div>
      <p className="mt-2 px-[22px] text-[13px] text-muted">
        {tab}: {WORKOUT_NAMES[tab]}. Правка слота меняет только блок {block}.
      </p>
      <Group className="mt-2">
        <ul>
          {list.map((s) => {
            const ex = getExercise(s.exerciseId);
            const phase = s.toPhase === 1 ? ' · фаза 1' : s.fromPhase === 2 ? ' · с фазы 2' : '';
            return (
              <li key={s.id} className="flex items-center border-t border-line first:border-t-0">
                <button type="button" onClick={() => setEdit(s)} className="flex min-h-[58px] min-w-0 flex-1 items-center gap-3 py-2 text-left">
                  <span className={`font-display w-9 shrink-0 text-sm font-bold tabular-nums ${s.section === 'main' ? 'text-ink' : 'text-muted'}`}>{s.code}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-semibold">{ex.name}</span>
                    <span className="block text-sm text-muted">
                      {s.sets} × {s.repMin}–{s.repMax}
                      {ex.unit === 'seconds' ? ' с' : ''} · шаг {stepText(s)} · отдых {s.restSec} с{phase}
                    </span>
                  </span>
                  <ChevronRight size={16} strokeWidth={2.4} className="shrink-0 text-muted" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => setHowTo(s.exerciseId)}
                  aria-label={`Как делать: ${ex.name.toLowerCase()}`}
                  className="-mr-2.5 ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink active:bg-track"
                >
                  <CirclePlay size={24} strokeWidth={1.9} aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      </Group>
      <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={() => setConfirmReset(true)}>
        Вернуть программу из плана
      </Button>
      {edit && <SlotSheet slot={slots.find((s) => s.id === edit.id) ?? edit} onClose={() => setEdit(null)} onHowTo={() => setHowTo(edit.exerciseId)} />}
      <ExerciseSheet exerciseId={howTo} onClose={() => setHowTo(null)} />
      <Sheet open={confirmReset} title="Вернуть исходную программу?" onClose={() => setConfirmReset(false)}>
        <div className="flex flex-col gap-2 pb-2">
          <p className="px-1 pb-2 text-muted">Подходы, повторы, шаги и отдых во всех блоках станут как в плане от 7 ноября. История тренировок не изменится.</p>
          <Button size="lg" onClick={() => void resetProgram().then(() => setConfirmReset(false))}>
            Вернуть
          </Button>
          <Button size="lg" variant="secondary" onClick={() => setConfirmReset(false)}>
            Отмена
          </Button>
        </div>
      </Sheet>
    </Sheet>
  );
}

function SlotSheet({ slot, onClose, onHowTo }: { slot: ProgramSlot; onClose: () => void; onHowTo: () => void }) {
  const ex = getExercise(slot.exerciseId);
  const up = (patch: Partial<ProgramSlot>) => void updateSlot(slot.id, patch);
  const stepDelta = ex.unit === 'kg' || ex.unit === 'assist_kg' ? 50 : ex.unit === 'seconds' ? 5 : 1;
  const step = slotStep(slot);
  const repStep = ex.unit === 'seconds' ? 5 : 1;
  return (
    <Sheet open title={ex.name} kicker={`Блок ${slot.block} · ${slot.code} · ${slot.section === 'main' ? 'основной блок' : 'дополнительный блок'}`} onClose={onClose}>
      <Group>
        <Row label="Подходов">
          <Stepper label="Подходов" value={slot.sets} onDec={() => up({ sets: Math.max(1, slot.sets - 1) })} onInc={() => up({ sets: Math.min(8, slot.sets + 1) })} />
        </Row>
        <Row label={ex.unit === 'seconds' ? 'Секунд от' : 'Повторов от'}>
          <Stepper label="Минимум" value={slot.repMin} onDec={() => up({ repMin: Math.max(1, slot.repMin - repStep) })} onInc={() => up({ repMin: Math.min(slot.repMax, slot.repMin + repStep) })} />
        </Row>
        <Row label="до">
          <Stepper label="Максимум" value={slot.repMax} onDec={() => up({ repMax: Math.max(slot.repMin, slot.repMax - repStep) })} onInc={() => up({ repMax: slot.repMax + repStep })} />
        </Row>
        <Row label="Шаг прогрессии">
          <Stepper label="Шаг" value={stepText(slot)} onDec={() => up({ step: Math.max(stepDelta, step - stepDelta) })} onInc={() => up({ step: step + stepDelta })} />
        </Row>
      </Group>
      <Caps className="mt-4 mb-2 px-[22px]">Отдых после подхода, с</Caps>
      <div className="flex flex-wrap gap-2 pb-2">
        {REST_OPTIONS.map((v) => (
          <Chip key={v} active={slot.restSec === v} onClick={() => up({ restSec: v })}>
            {v === 0 ? '0 · суперсет' : String(v)}
          </Chip>
        ))}
      </div>
      <Button size="lg" variant="secondary" className="mt-3 w-full" onClick={onHowTo}>
        <CirclePlay size={20} aria-hidden /> Как делать
      </Button>
    </Sheet>
  );
}

export function PlatesSheet({ open, onClose, settings }: SheetProps & { settings: Settings }) {
  return (
    <Sheet open={open} kicker="Программа" title="Гриф и блины" onClose={onClose}>
      <Group>
        <Row label="Гриф" sub="штанга">
          <Stepper label="Вес грифа" value={formatKg(settings.barWeight)} onDec={() => void updateSettings({ barWeight: Math.max(500, settings.barWeight - 250) })} onInc={() => void updateSettings({ barWeight: settings.barWeight + 250 })} />
        </Row>
        <Row label="Гриф EZ" sub="сгибания, скамья Скотта, французский жим">
          <Stepper label="Вес грифа EZ" value={formatKg(settings.ezBarWeight)} onDec={() => void updateSettings({ ezBarWeight: Math.max(250, settings.ezBarWeight - 250) })} onInc={() => void updateSettings({ ezBarWeight: settings.ezBarWeight + 250 })} />
        </Row>
      </Group>
      <Caps className="mt-4 mb-2 px-[22px]">Блины в зале, на одну сторону</Caps>
      <div className="flex flex-wrap gap-2 pb-2">
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
    </Sheet>
  );
}

const SCHEDULE_ROWS: { key: keyof WeekSchedule; label: string }[] = [
  { key: 'gym', label: 'Зал' },
  { key: 'pool', label: 'Бассейн' },
  { key: 'poolOptional', label: 'Бассейн по желанию' },
];

/** Расписание недели: какие дни зал, какие бассейн. День может быть только в одной строке. */
export function ScheduleSheet({ open, onClose, settings }: SheetProps & { settings: Settings }) {
  const schedule = settings.schedule ?? DEFAULT_SCHEDULE;
  const toggle = (key: keyof WeekSchedule, day: number) => {
    const next: WeekSchedule = { gym: [...schedule.gym], pool: [...schedule.pool], poolOptional: [...schedule.poolOptional] };
    const on = next[key].includes(day);
    for (const k of Object.keys(next) as (keyof WeekSchedule)[]) next[k] = next[k].filter((d) => d !== day);
    if (!on) next[key] = [...next[key], day].sort((a, b) => a - b);
    void updateSettings({ schedule: next });
  };
  const isDefault = JSON.stringify(schedule) === JSON.stringify(DEFAULT_SCHEDULE);
  return (
    <Sheet open={open} kicker="Программа" title="Расписание недели" onClose={onClose}>
      <div className="flex flex-col gap-4 rounded-[26px] bg-surface p-4">
        {SCHEDULE_ROWS.map(({ key, label }) => (
          <div key={key}>
            <Caps className="mb-2">{label}</Caps>
            <div className="flex gap-1" role="group" aria-label={label}>
              {WEEKDAYS.map((w, i) => {
                const day = i + 1;
                const on = schedule[key].includes(day);
                return (
                  <button
                    key={w}
                    type="button"
                    aria-pressed={on}
                    aria-label={`${label}: ${w}`}
                    onClick={() => toggle(key, day)}
                    className={`h-11 min-w-0 flex-1 rounded-full text-sm font-bold ${on ? 'bg-ink text-primary' : 'bg-track text-muted'}`}
                  >
                    {w}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 px-[22px] text-xs text-muted">
        Остальные дни — отдых. Тип бассейна — по дню недели: вт техника, чт интервалы, сб длинное. Разовые изменения — тапом по дню в календаре на экране «Тренировка».
      </p>
      {!isDefault && (
        <Button variant="ghost" size="sm" className="mt-1 w-full" onClick={() => void updateSettings({ schedule: DEFAULT_SCHEDULE })}>
          Вернуть по плану: пн·ср·пт зал, вт·чт·сб бассейн
        </Button>
      )}
    </Sheet>
  );
}

export function scheduleText(settings: Settings): string {
  const s = settings.schedule ?? DEFAULT_SCHEDULE;
  return `зал ${s.gym.map((d) => WEEKDAYS[d - 1]).join(', ') || '—'}`;
}

export function CaloriesSheet({ open, onClose, settings }: SheetProps & { settings: Settings }) {
  const adjustments = useAdjustments();
  const m = MAINTENANCE_KCAL_PHASE3;
  return (
    <Sheet open={open} kicker="Программа" title="Калории" onClose={onClose}>
      <p className="mb-3 px-[22px] text-sm text-muted">По типу дня: зал 2 300, бассейн 2 150, отдых 2 050 ккал. Белок 155 г, жиры 65 г.</p>
      <Caps className="mb-2 px-[22px]">Корректировки</Caps>
      <Group>
        {adjustments.length === 0 ? (
          <p className="py-4 text-sm text-muted">Корректировок пока нет. Приложение предложит их по понедельникам с 3-й недели.</p>
        ) : (
          <ul>
            {adjustments.map((a) => (
              <li key={a.id} className="flex min-h-[58px] items-center gap-2 border-t border-line text-[15px] first:border-t-0">
                <span className="flex-1">
                  <b className={a.deltaKcal < 0 ? 'text-energy' : ''}>
                    {a.deltaKcal > 0 ? '+' : '−'}
                    {Math.abs(a.deltaKcal)} ккал
                  </b>{' '}
                  с {formatDayMonth(a.date)}
                </span>
                <button type="button" aria-label="Отменить корректировку" onClick={() => void deleteAdjustment(a.id)} className="flex h-11 w-11 items-center justify-center text-muted">
                  <Trash2 size={16} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Group>
      <Caps className="mt-4 mb-2 px-[22px]">Фаза 3, с 1 марта</Caps>
      <div className="grid grid-cols-2 gap-2 pb-1">
        <Chip active={settings.phase3Mode !== 'maintenance'} onClick={() => void updateSettings({ phase3Mode: 'deficit' })} className="justify-center">
          Дефицит
        </Chip>
        <Chip active={settings.phase3Mode === 'maintenance'} onClick={() => void updateSettings({ phase3Mode: 'maintenance' })} className="justify-center">
          Поддержка
        </Chip>
      </div>
      <p className="px-[22px] pb-2 text-xs text-muted">
        Поддержка: зал {formatInt(m.gym)}, бассейн {formatInt(m.pool)}, отдых {formatInt(m.rest)} ккал.
      </p>
    </Sheet>
  );
}
