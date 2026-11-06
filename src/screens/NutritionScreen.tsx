// Питание — SPEC 6.3, макет BNutrition (REDESIGN 4): чёрный герой «ОСТАЛОСЬ» с четырьмя полосами,
// приёмы пищи белыми карточками с чёрным «+», внизу «Быстро» и «Мои блюда».

import { ChevronLeft, ChevronRight, Copy, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { openSheet, useGlobalSheet } from '../app/uiStore';
import { ScreenHeader } from '../components/ScreenHeader';
import { Caps, Card, HeroCard } from '../components/ui';
import { DEFAULT_SETTINGS } from '../db/db';
import { copyMeal, deleteFoodLog, deleteFoodLogs, restoreFoodLog } from '../db/repo';
import type { Food, FoodLog } from '../db/types';
import { addDays } from '../domain/dates';
import { formatDayMonth, formatInt, NBSP } from '../domain/format';
import { mealByHour } from '../domain/foodSearch';
import { chickenGrams, dayTargets, dayTotals, logMacros, MEAL_NAMES, MEALS, type Meal } from '../domain/nutrition';
import { useAdjustments, useAllFoodLog, useFoodLog, useFoods, useSettings } from '../hooks/useData';
import { useToday } from '../hooks/useToday';
import { AddFoodSheet, EditEntrySheet, type AddMode } from './nutrition/FoodSheets';

export function NutritionScreen() {
  const today = useToday();
  const [date, setDate] = useState(today);
  const settings = useSettings() ?? DEFAULT_SETTINGS;
  const logs = useFoodLog(date);
  const yesterdayLogs = useFoodLog(addDays(date, -1));
  const allLogs = useAllFoodLog();
  const foods = useFoods();
  const adjustments = useAdjustments();
  const map = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
  const t = dayTargets(date, adjustments, settings);
  const { total, byMeal } = dayTotals(logs, map);
  const [add, setAdd] = useState<{ meal: Meal; mode: AddMode } | null>(null);
  const [edit, setEdit] = useState<FoodLog | null>(null);
  const [undo, setUndo] = useState<{ text: string; revert: () => Promise<void> } | null>(null);
  const global = useGlobalSheet();

  // «+ → Еда» с любого экрана: приём по времени суток.
  useEffect(() => {
    if (global === 'food' || global === 'food_quick') {
      setDate(today);
      setAdd({ meal: mealByHour(new Date().getHours()), mode: global === 'food_quick' ? 'quick' : 'search' });
      openSheet(null);
    }
  }, [global, today]);

  useEffect(() => {
    if (!undo) return;
    const id = setTimeout(() => setUndo(null), 5000);
    return () => clearTimeout(id);
  }, [undo]);

  const protein = Math.round(total.p / 10);
  const fat = Math.round(total.f / 10);
  const carbs = Math.round(total.c / 10);
  const over = total.kcal - t.kcal;
  const proteinLeft = t.protein - protein;
  const label = date === today ? 'Сегодня' : date === addDays(today, -1) ? 'Вчера' : formatDayMonth(date);
  const pct = (v: number, target: number) => `${Math.round((v / Math.max(1, target)) * 100)}%`;

  return (
    <>
      <ScreenHeader
        title="Питание"
        subtitle={formatDayMonth(date)}
        action={
          <div className="flex items-center rounded-full bg-surface">
            <button type="button" aria-label="Предыдущий день" onClick={() => setDate((d) => addDays(d, -1))} className="flex h-11 w-11 items-center justify-center rounded-full active:bg-track">
              <ChevronLeft size={18} strokeWidth={2.4} aria-hidden />
            </button>
            <button type="button" onClick={() => setDate(today)} className="min-h-11 text-[15px] font-extrabold" aria-label={date === today ? 'Сегодня' : `${label}: вернуться к сегодня`}>
              {label}
            </button>
            <button
              type="button"
              aria-label="Следующий день"
              disabled={date >= today}
              onClick={() => setDate((d) => addDays(d, 1))}
              className="flex h-11 w-11 items-center justify-center rounded-full text-ink active:bg-track disabled:text-[#B4B0A7]"
            >
              <ChevronRight size={18} strokeWidth={2.4} aria-hidden />
            </button>
          </div>
        }
      />
      <div className="flex flex-col gap-3 px-4 pb-6">
        <HeroCard className="flex flex-col gap-4 rounded-[30px]! px-5! py-[22px]!">
          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <Caps className="text-muted-on-ink!">{over > 0 ? 'Перебор' : 'Осталось'}</Caps>
              <span className={`font-display text-[40px] leading-[46px] font-bold tabular-nums ${over > 0 ? 'text-[#FF8A63]' : 'text-primary'}`}>{formatInt(Math.abs(over))}</span>
              <span className="text-sm text-muted-on-ink">{over > 0 ? `ккал сверх ${formatInt(t.kcal)}` : `ккал из ${formatInt(t.kcal)}`}</span>
            </div>
            <div className="flex flex-col gap-1 text-right">
              <Caps className="text-muted-on-ink!">Белок</Caps>
              <span className="font-display text-[26px] leading-8 font-bold tabular-nums">
                {protein}
                <span className="font-sans text-sm font-normal text-muted-on-ink"> / {t.protein} г</span>
              </span>
              <span className="text-[13px] text-[#A6C0FF]">{proteinLeft > 0 ? `ещё ${proteinLeft} г ≈ ${chickenGrams(proteinLeft)} г курицы` : 'белок набран'}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            <HeroBar label="ккал" value={total.kcal / t.kcal} color="var(--energy)" right={pct(total.kcal, t.kcal)} aria={`Калории ${total.kcal} из ${t.kcal}`} />
            <HeroBar label="белок" value={protein / t.protein} color="var(--protein)" right={pct(protein, t.protein)} aria={`Белок ${protein} из ${t.protein} г`} />
            <HeroBar label="жиры" value={fat / t.fat} color="var(--fat)" right={`${fat} г`} aria={`Жиры ${fat} из ${t.fat} г`} />
            <HeroBar label="углев." value={carbs / Math.max(1, t.carbs)} color="#C9CDD3" right={`${carbs} г`} aria={`Углеводы ${carbs} из ${t.carbs} г`} />
          </div>
          {t.maintenance && <p className="text-[13px] text-muted-on-ink">Неделя разгрузки — калории на поддержке.</p>}
        </HeroCard>

        {MEALS.map((meal) => {
          const entries = logs.filter((l) => l.meal === meal);
          const yesterdayHas = yesterdayLogs.some((l) => l.meal === meal);
          const mp = Math.round(byMeal[meal].p / 10);
          return (
            <Card key={meal} className="rounded-[26px]! py-1.5! pr-3.5! pl-5!">
              <div className="flex min-h-[58px] items-center gap-2.5">
                <span className="flex flex-1 flex-col">
                  <h2 className="font-display text-[17px] font-bold">{MEAL_NAMES[meal]}</h2>
                  <span className="text-[13px] text-muted tabular-nums">{entries.length ? `${formatInt(byMeal[meal].kcal)} ккал · ${mp} г белка` : 'пока пусто'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setAdd({ meal, mode: 'search' })}
                  aria-label={`${MEAL_NAMES[meal]}: добавить`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-hero-line bg-hero text-primary active:scale-95"
                >
                  <Plus size={22} strokeWidth={2.6} aria-hidden />
                </button>
              </div>
              {entries.length > 0 && (
                <ul className="mr-1.5">
                  {entries.map((e) => (
                    <SwipeRow
                      key={e.id}
                      entry={e}
                      food={e.foodId ? map.get(e.foodId) : undefined}
                      kcal={logMacros(e, map).kcal}
                      onTap={() => setEdit(e)}
                      onDelete={async () => {
                        const removed = await deleteFoodLog(e.id);
                        setUndo(removed ? { text: 'Запись удалена', revert: () => restoreFoodLog(removed) } : null);
                      }}
                    />
                  ))}
                </ul>
              )}
              {entries.length === 0 && yesterdayHas && (
                <button
                  type="button"
                  onClick={async () => {
                    const ids = await copyMeal(addDays(date, -1), meal, date);
                    setUndo({ text: `${MEAL_NAMES[meal]}: как вчера`, revert: () => deleteFoodLogs(ids) });
                  }}
                  className="flex min-h-11 w-full items-center gap-1.5 border-t border-line text-sm font-bold text-muted"
                >
                  <Copy size={15} aria-hidden /> Как вчера
                </button>
              )}
            </Card>
          );
        })}

        <div className="flex gap-2">
          <button type="button" onClick={() => setAdd({ meal: mealByHour(new Date().getHours()), mode: 'quick' })} className="h-[50px] flex-1 rounded-full bg-surface text-sm font-extrabold active:opacity-80">
            Быстро: ккал + белок
          </button>
          <button type="button" onClick={() => setAdd({ meal: mealByHour(new Date().getHours()), mode: 'recipe' })} className="h-[50px] flex-1 rounded-full bg-surface text-sm font-extrabold active:opacity-80">
            Мои блюда
          </button>
        </div>
      </div>

      {undo && (
        <div role="status" className="vv-bottom fixed inset-x-4 bottom-[calc(7rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-xl items-center gap-3 rounded-full border border-hero-line bg-hero px-5 py-2 text-white">
          <span className="flex-1 text-sm font-semibold">{undo.text}</span>
          <button type="button" className="min-h-11 px-2 font-extrabold text-primary" onClick={() => void undo.revert().then(() => setUndo(null))}>
            Вернуть
          </button>
        </div>
      )}

      <AddFoodSheet
        open={add !== null}
        onClose={() => setAdd(null)}
        date={date}
        meal={add?.meal ?? 'breakfast'}
        foods={foods}
        logs={allLogs}
        initialMode={add?.mode ?? 'search'}
        day={{ total, targets: t }}
      />
      <EditEntrySheet entry={edit} food={edit?.foodId ? map.get(edit.foodId) : undefined} onClose={() => setEdit(null)} />
    </>
  );
}

/** Полоса на чёрном герое: подпись слева, дорожка #2A2C30, значение справа. */
function HeroBar({ label, value, color, right, aria }: { label: string; value: number; color: string; right: string; aria: string }) {
  const w = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-16 text-[13px] text-muted-on-ink">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-[5px] bg-[#2A2C30]" role="img" aria-label={aria}>
        <div className="h-full rounded-[5px] transition-[width] duration-400 ease-out" style={{ width: `${w}%`, background: value > 1 ? 'var(--warn)' : color }} />
      </div>
      <span className="w-11 text-right text-[13px] font-bold tabular-nums">{right}</span>
    </div>
  );
}

/** Строка записи: тап — изменить граммы, свайп влево — удалить. */
function SwipeRow({ entry, food, kcal, onTap, onDelete }: { entry: FoodLog; food: Food | undefined; kcal: number; onTap: () => void; onDelete: () => void }) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const ref = useRef<HTMLLIElement>(null);
  // Строка уезжает на 88 px, кнопка 72 px: между числом и корзиной остаётся зазор 16 px.
  const REVEAL = 88;
  // Открытая строка закрывается тапом в любом другом месте.
  useEffect(() => {
    if (dx >= 0) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setDx(0);
    };
    document.addEventListener('pointerdown', close, true);
    return () => document.removeEventListener('pointerdown', close, true);
  }, [dx]);
  return (
    <li ref={ref} className="relative overflow-hidden">
      <button
        type="button"
        onClick={onDelete}
        aria-label="Удалить запись"
        tabIndex={dx < 0 ? 0 : -1}
        className="absolute inset-y-1 right-0 flex w-[72px] items-center justify-center rounded-2xl bg-danger text-white"
      >
        <Trash2 size={20} aria-hidden />
      </button>
      <div
        className="relative flex min-h-12 items-center gap-2.5 border-t border-line bg-surface transition-transform"
        style={{ transform: `translateX(${dx}px)`, transitionDuration: start.current ? '0ms' : '180ms', touchAction: 'pan-y' }}
        onPointerDown={(e) => {
          start.current = { x: e.clientX - dx, y: e.clientY, moved: false };
          // Палец ушёл за пределы строки — pointerup всё равно придёт сюда, строка не зависнет сдвинутой.
          e.currentTarget.setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s) return;
          const d = e.clientX - s.x;
          if (Math.abs(d) > 6) s.moved = true;
          setDx(Math.max(-REVEAL - 20, Math.min(0, d)));
        }}
        onPointerUp={() => {
          const moved = start.current?.moved;
          start.current = null;
          setDx((d) => (d < -REVEAL / 2 ? -REVEAL : 0));
          if (!moved) {
            if (dx < 0) setDx(0);
            else onTap();
          }
        }}
        onPointerCancel={() => {
          start.current = null;
          setDx(0);
        }}
      >
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
          {food?.name ?? entry.quick?.name ?? 'Продукт удалён'}
          {food?.approx && <span className="ml-1 text-muted">≈</span>}
        </span>
        <span className="text-[13px] text-muted tabular-nums">{entry.grams ? `${entry.grams}${NBSP}г` : 'быстро'}</span>
        <span className="w-[52px] text-right text-[15px] font-bold tabular-nums">{formatInt(kcal)}</span>
      </div>
    </li>
  );
}
