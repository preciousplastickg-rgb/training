// Меню «+» — макет BMenu (REDESIGN 4): три строки 80 px с контекстом, внизу «Вчерашний …» и «Быстро».

import { ChevronRight, Scale, Utensils, Waves } from 'lucide-react';
import { useMemo } from 'react';
import { navigate } from '../app/router';
import { openSheet } from '../app/uiStore';
import { DEFAULT_SETTINGS } from '../db/db';
import { copyMeal } from '../db/repo';
import { addDays } from '../domain/dates';
import { mealByHour } from '../domain/foodSearch';
import { formatInt, formatScaled } from '../domain/format';
import { dayTargets, dayTotals, MEAL_NAMES } from '../domain/nutrition';
import { dayTypeFor, gymDatesOf, planForDate, planOptionsOf } from '../domain/program';
import { POOL_TYPE_NAMES } from '../data/program';
import { useAdjustments, useBody, useFoodLog, useFoods, useLightWeeks, usePool, useSessions, useSettings } from '../hooks/useData';
import { useToday } from '../hooks/useToday';
import { Sheet } from './Sheet';

const MEAL_GEN: Record<string, string> = { breakfast: 'завтрак', lunch: 'обед', dinner: 'ужин', snack: 'перекус' };
const MEAL_NOW: Record<string, string> = { breakfast: 'сейчас завтрак', lunch: 'сейчас обед', dinner: 'сейчас ужин', snack: 'сейчас перекус' };

export function AddMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const today = useToday();
  const settings = useSettings() ?? DEFAULT_SETTINGS;
  const logs = useFoodLog(today);
  const yesterday = useFoodLog(addDays(today, -1));
  const foods = useFoods();
  const adjustments = useAdjustments();
  const body = useBody();
  const sessions = useSessions();
  const pool = usePool();
  const lightWeeks = useLightWeeks();
  const map = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);

  const meal = mealByHour(new Date().getHours());
  const t = dayTargets(today, adjustments, settings, dayTypeFor(today, sessions, pool, planOptionsOf(settings, lightWeeks)));
  const left = t.kcal - dayTotals(logs, map).total.kcal;
  const foodHint = `${MEAL_NOW[meal]} · ${left >= 0 ? `ещё ${formatInt(left)} ккал` : `перебор ${formatInt(-left)} ккал`}`;

  const w = body.find((b) => b.date === today && b.weight !== undefined)?.weight;
  const weightHint = w ? `сегодня ${formatScaled(w, 100, 1)} кг · изменить` : 'сегодня ещё не записан';

  const poolToday = pool.filter((p) => p.date === today).reduce((a, p) => a + p.minutes, 0);
  const poolHint = (() => {
    if (poolToday > 0) return `сегодня записано ${poolToday} мин`;
    const opts = planOptionsOf(settings, lightWeeks);
    const gym = gymDatesOf(sessions);
    for (let i = 0; i < 7; i++) {
      const d = addDays(today, i);
      const p = planForDate(d, gym, opts);
      if (p.kind === 'pool' || p.kind === 'pool_optional' || (p.kind === 'gym' && p.pool)) {
        const when = i === 0 ? 'сегодня' : i === 1 ? 'по плану завтра' : `по плану ${['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'][(new Date(d).getUTCDay() + 6) % 7]}`;
        return `${when} · ${p.pool?.minutes ?? 60} мин${p.pool ? ` · ${POOL_TYPE_NAMES[p.pool.type]}` : ''}`;
      }
    }
    return 'записать за любой день';
  })();

  const yesterdayHasMeal = yesterday.some((l) => l.meal === meal);
  const go = (fn: () => void) => {
    onClose();
    fn();
  };
  const rows = [
    { label: 'Еда', hint: foodHint, icon: Utensils, cls: 'bg-energy text-white', action: () => (navigate('nutrition'), openSheet('food')) },
    { label: 'Вес', hint: weightHint, icon: Scale, cls: 'bg-primary text-on-primary', action: () => openSheet('weight') },
    { label: 'Бассейн', hint: poolHint, icon: Waves, cls: 'bg-protein text-white', action: () => openSheet('pool') },
  ];

  return (
    <Sheet open={open} title="Добавить" onClose={onClose}>
      <ul className="flex flex-col gap-3">
        {rows.map(({ label, hint, icon: Icon, cls, action }) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => go(action)}
              className="flex h-20 w-full items-center gap-4 rounded-3xl bg-surface py-0 pr-5 pl-3.5 text-left active:opacity-80"
            >
              <span className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full ${cls}`}>
                <Icon size={24} aria-hidden />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-lg font-extrabold">{label}</span>
                <span className="truncate text-sm text-muted">{hint}</span>
              </span>
              <ChevronRight size={20} strokeWidth={2.2} className="shrink-0 text-ink" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2 pb-2">
        <button
          type="button"
          disabled={!yesterdayHasMeal}
          onClick={() => go(() => void copyMeal(addDays(today, -1), meal, today).then(() => navigate('nutrition')))}
          className="h-12 flex-1 rounded-full bg-ink text-sm font-bold text-bg active:opacity-80 disabled:opacity-40"
        >
          Вчерашний {MEAL_GEN[meal]}
        </button>
        <button
          type="button"
          onClick={() => go(() => (navigate('nutrition'), openSheet('food_quick')))}
          className="h-12 flex-1 rounded-full bg-surface text-sm font-bold active:opacity-80"
        >
          Быстро: ккал + белок
        </button>
      </div>
      <span className="sr-only">{MEAL_NAMES[meal]}</span>
    </Sheet>
  );
}
