import { ChevronLeft, ChevronRight, Copy, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { openSheet, useGlobalSheet } from '../app/uiStore';
import { Rings } from '../components/Rings';
import { ScreenHeader } from '../components/ScreenHeader';
import { Bar, Card } from '../components/ui';
import { DEFAULT_SETTINGS } from '../db/db';
import { copyMeal, deleteFoodLog, deleteFoodLogs, restoreFoodLog } from '../db/repo';
import type { Food, FoodLog } from '../db/types';
import { addDays } from '../domain/dates';
import { formatDayMonth, formatInt, formatKcal, NBSP } from '../domain/format';
import { mealByHour } from '../domain/foodSearch';
import { dayTargets, dayTotals, logMacros, MEAL_NAMES, MEALS, type Meal } from '../domain/nutrition';
import { useAdjustments, useAllFoodLog, useFoodLog, useFoods, useSettings } from '../hooks/useData';
import { useToday } from '../hooks/useToday';
import { AddFoodSheet, EditEntrySheet } from './nutrition/FoodSheets';

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
  const [addMeal, setAddMeal] = useState<Meal | null>(null);
  const [edit, setEdit] = useState<FoodLog | null>(null);
  const [undo, setUndo] = useState<{ text: string; revert: () => Promise<void> } | null>(null);
  const global = useGlobalSheet();

  // «+ → Еда» с любого экрана: приём по времени суток.
  useEffect(() => {
    if (global === 'food') {
      setDate(today);
      setAddMeal(mealByHour(new Date().getHours()));
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
  const label = date === today ? 'Сегодня' : date === addDays(today, -1) ? 'Вчера' : formatDayMonth(date);

  return (
    <>
      <ScreenHeader
        title="Питание"
        subtitle={date === today || date === addDays(today, -1) ? `${label}, ${formatDayMonth(date)}` : label}
        action={
          <div className="-mr-2 flex">
            <button type="button" aria-label="Предыдущий день" onClick={() => setDate((d) => addDays(d, -1))} className="flex h-11 w-11 items-center justify-center rounded-full active:bg-track">
              <ChevronLeft size={24} />
            </button>
            <button type="button" aria-label="Следующий день" disabled={date >= today} onClick={() => setDate((d) => addDays(d, 1))} className="flex h-11 w-11 items-center justify-center rounded-full active:bg-track disabled:opacity-30">
              <ChevronRight size={24} />
            </button>
          </div>
        }
      />
      <div className="flex flex-col gap-3 px-4 pb-6">
        <Card>
          <div className="flex items-center gap-4">
            <Rings
              size={148}
              rings={[
                { value: total.kcal / t.kcal, color: 'var(--energy)', label: `Калории ${total.kcal} из ${t.kcal}` },
                { value: protein / t.protein, color: 'var(--protein)', label: `Белок ${protein} из ${t.protein} г` },
              ]}
            >
              <span className="text-lg leading-tight font-semibold tabular-nums">{formatInt(total.kcal)}</span>
              <span className="text-[11px] text-muted">/ {formatKcal(t.kcal)}</span>
            </Rings>
            <div className="flex flex-1 flex-col gap-2.5 text-sm">
              <Macro label="Белок" value={protein} target={t.protein} color="var(--protein)" />
              <Macro label="Жиры" value={fat} target={t.fat} color="var(--warn)" />
              <Macro label="Углеводы" value={carbs} target={t.carbs} color="var(--progress)" />
            </div>
          </div>
          {t.maintenance && <p className="mt-2 text-xs text-muted">Неделя разгрузки — калории на поддержке.</p>}
        </Card>

        {MEALS.map((meal) => {
          const entries = logs.filter((l) => l.meal === meal);
          const yesterdayHas = yesterdayLogs.some((l) => l.meal === meal);
          return (
            <Card key={meal} className="!p-0">
              <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                <h2 className="flex-1 font-semibold">{MEAL_NAMES[meal]}</h2>
                <span className="text-sm text-muted tabular-nums">{formatKcal(byMeal[meal].kcal)}</span>
              </div>
              <ul>
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
              <div className="flex gap-1 px-2 pb-2">
                <button type="button" onClick={() => setAddMeal(meal)} className="flex min-h-12 flex-1 items-center gap-2 rounded-xl px-2 text-accent active:bg-track" aria-label={`${MEAL_NAMES[meal]}: добавить`}>
                  <Plus size={20} aria-hidden /> Добавить
                </button>
                {entries.length === 0 && yesterdayHas && (
                  <button type="button" onClick={async () => {
                      const ids = await copyMeal(addDays(date, -1), meal, date);
                      setUndo({ text: `${MEAL_NAMES[meal]}: как вчера`, revert: () => deleteFoodLogs(ids) });
                    }} className="flex min-h-12 items-center gap-2 rounded-xl px-3 text-sm text-muted active:bg-track">
                    <Copy size={16} aria-hidden /> Как вчера
                  </button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {undo && (
        <div role="status" className="vv-bottom fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-xl items-center gap-3 rounded-2xl bg-ink px-4 py-2 text-bg shadow-lg">
          <span className="flex-1 text-sm">{undo.text}</span>
          <button type="button" className="min-h-11 px-2 font-semibold" onClick={() => void undo.revert().then(() => setUndo(null))}>
            Вернуть
          </button>
        </div>
      )}

      <AddFoodSheet open={addMeal !== null} onClose={() => setAddMeal(null)} date={date} meal={addMeal ?? 'breakfast'} foods={foods} logs={allLogs} />
      <EditEntrySheet entry={edit} food={edit?.foodId ? map.get(edit.foodId) : undefined} onClose={() => setEdit(null)} />
    </>
  );
}

function Macro({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between">
        <span>{label}</span>
        <span className="tabular-nums text-muted">
          {value} / {target}
          {NBSP}г
        </span>
      </div>
      <Bar value={value / Math.max(1, target)} color={color} height={6} label={label} />
    </div>
  );
}

/** Строка записи: тап — изменить граммы, свайп влево — удалить. */
function SwipeRow({ entry, food, kcal, onTap, onDelete }: { entry: FoodLog; food: Food | undefined; kcal: number; onTap: () => void; onDelete: () => void }) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const REVEAL = 88;
  return (
    <li className="relative overflow-hidden">
      <button type="button" onClick={onDelete} aria-label="Удалить запись" className="absolute inset-y-0 right-0 flex w-[88px] items-center justify-center bg-danger text-white">
        <Trash2 size={20} aria-hidden />
      </button>
      <div
        className="relative flex min-h-14 items-center gap-3 bg-surface px-4 transition-transform"
        style={{ transform: `translateX(${dx}px)`, transitionDuration: start.current ? '0ms' : '180ms', touchAction: 'pan-y' }}
        onPointerDown={(e) => (start.current = { x: e.clientX - dx, y: e.clientY, moved: false })}
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
        <span className="min-w-0 flex-1">
          <span className="block truncate">
            {food?.name ?? entry.quick?.name ?? 'Продукт удалён'}
            {food?.approx && <span className="ml-1 text-muted">≈</span>}
          </span>
          <span className="block text-xs text-muted">{entry.grams ? `${entry.grams}${NBSP}г` : 'быстрая запись'}</span>
        </span>
        <span className="tabular-nums">{formatInt(kcal)}</span>
      </div>
    </li>
  );
}
