// Шторки питания: добавить продукт, изменить граммы, быстрая запись, своё блюдо.

import { Search, Trash2, Zap } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { Button, Chip, Field, Stepper } from '../../components/ui';
import { addFoodLog, saveRecipe, updateFoodLog } from '../../db/repo';
import type { Food, FoodLog } from '../../db/types';
import { formatInt, formatMacro, NBSP } from '../../domain/format';
import { frequentFoods, recentFoods, searchFoods } from '../../domain/foodSearch';
import { MEAL_NAMES, portion, recipePer100, type Meal } from '../../domain/nutrition';

export function FoodRow({ food, onClick, right }: { food: Food; onClick: () => void; right?: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left active:bg-track">
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">
          {food.name}
          {food.approx && <span className="ml-1 text-muted" title="Приблизительно">≈</span>}
        </span>
        <span className="block text-xs text-muted">
          {food.per100.kcal} ккал · Б {formatMacro(food.per100.p, false)} · Ж {formatMacro(food.per100.f, false)} · У {formatMacro(food.per100.c, false)} на 100 г
        </span>
      </span>
      {right}
    </button>
  );
}

// ---------- Добавить ----------

export function AddFoodSheet({
  open, onClose, date, meal, foods, logs,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
  meal: Meal;
  foods: Food[];
  logs: FoodLog[];
}) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Food | null>(null);
  const [mode, setMode] = useState<'search' | 'quick' | 'recipe'>('search');
  const map = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) {
      setQuery('');
      setPicked(null);
      setMode('search');
    }
  }, [open]);
  const results = searchFoods(foods, query);
  const recent = recentFoods(logs, map);
  const frequent = frequentFoods(logs, map);

  const title = picked ? picked.name : mode === 'quick' ? 'Быстрая запись' : mode === 'recipe' ? 'Моё блюдо' : `${MEAL_NAMES[meal]}: добавить`;
  return (
    <Sheet open={open} title={title} onClose={onClose}>
      <div className="max-h-[75dvh] overflow-y-auto overscroll-contain px-2 pb-2">
        {picked ? (
          <GramsPicker
            food={picked}
            onBack={() => setPicked(null)}
            onDone={async (grams) => {
              await addFoodLog({ date, meal, foodId: picked.id, grams });
              onClose();
            }}
          />
        ) : mode === 'quick' ? (
          <QuickForm
            onDone={async (q) => {
              await addFoodLog({ date, meal, quick: q });
              onClose();
            }}
          />
        ) : mode === 'recipe' ? (
          <RecipeForm foods={foods} onDone={() => setMode('search')} />
        ) : (
          <>
            <label className="flex min-h-12 items-center gap-2 rounded-xl bg-surface-2 px-3">
              <Search size={18} className="text-muted" aria-hidden />
              <input
                ref={inputRef}
                className="min-w-0 flex-1 bg-transparent py-2 outline-none"
                placeholder="Поиск: грудка, рис, плов…"
                aria-label="Поиск продукта"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <div className="mt-2 flex gap-2">
              <Chip onClick={() => setMode('quick')}>
                <Zap size={16} aria-hidden /> Быстро
              </Chip>
              <Chip onClick={() => setMode('recipe')}>Моё блюдо</Chip>
            </div>
            {query ? (
              <List title={results.length ? 'Найдено' : 'Ничего не нашлось — попробуй «Быстро»'} items={results} onPick={setPicked} />
            ) : (
              <>
                {recent.length > 0 && <List title="Недавние" items={recent} onPick={setPicked} />}
                {frequent.length > 0 && <List title="Частые" items={frequent} onPick={setPicked} />}
                {recent.length === 0 && <p className="mt-6 text-center text-sm text-muted">Начни вводить название — например, «курица»</p>}
              </>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}

function List({ title, items, onPick }: { title: string; items: Food[]; onPick: (f: Food) => void }) {
  return (
    <section className="mt-3">
      <h3 className="mb-1 px-2 text-xs font-semibold tracking-wide text-muted uppercase">{title}</h3>
      {items.map((f) => (
        <FoodRow key={f.id} food={f} onClick={() => onPick(f)} />
      ))}
    </section>
  );
}

export function GramsPicker({
  food, initial, onDone, onBack, doneLabel = 'Добавить',
}: {
  food: Food;
  initial?: number;
  onDone: (grams: number) => void | Promise<void>;
  onBack?: () => void;
  doneLabel?: string;
}) {
  const [grams, setGrams] = useState(initial ?? food.unitGrams ?? 100);
  const m = portion(food, grams);
  const presets: { label: string; g: number }[] = [
    { label: '50', g: 50 },
    { label: '100', g: 100 },
    { label: '150', g: 150 },
    { label: '200', g: 200 },
    ...(food.unitName && food.unitGrams ? [{ label: food.unitName, g: food.unitGrams }] : []),
  ];
  return (
    <div className="flex flex-col gap-4">
      <Stepper big label="Граммы" value={grams} unit="г" onDec={() => setGrams((g) => Math.max(5, g - (g > 100 ? 10 : 5)))} onInc={() => setGrams((g) => g + (g >= 100 ? 10 : 5))} />
      <div className="flex flex-wrap justify-center gap-2">
        {presets.map((p) => (
          <Chip key={p.label} active={grams === p.g} onClick={() => setGrams(p.g)}>
            {p.label}
            {/^\d+$/.test(p.label) ? ' г' : ''}
          </Chip>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-2xl bg-surface-2 p-3">
          <p className="text-2xl font-semibold tabular-nums text-energy">{formatInt(m.kcal)}</p>
          <p className="text-xs text-muted">ккал{food.approx ? ' ≈' : ''}</p>
        </div>
        <div className="rounded-2xl bg-surface-2 p-3">
          <p className="text-2xl font-semibold tabular-nums text-protein">{formatMacro(m.p, false)}</p>
          <p className="text-xs text-muted">белок, г</p>
        </div>
      </div>
      <div className="flex gap-2">
        {onBack && (
          <Button variant="secondary" size="lg" onClick={onBack}>
            Назад
          </Button>
        )}
        <Button size="lg" className="flex-1" onClick={() => void onDone(grams)}>
          {doneLabel}
        </Button>
      </div>
    </div>
  );
}

function QuickForm({ onDone }: { onDone: (q: { name: string; kcal: number; p: number }) => void }) {
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [p, setP] = useState('');
  const k = Math.round(Number(kcal.replace(',', '.')));
  const pr = Math.round(Number(p.replace(',', '.')) * 10);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">Когда ешь в кафе и не знаешь состава — запиши на глаз.</p>
      <Field label="Что съел" placeholder="Плов в кафе" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Калории" suffix="ккал" inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} />
        <Field label="Белок" suffix="г" inputMode="decimal" value={p} onChange={(e) => setP(e.target.value)} />
      </div>
      <Button size="lg" disabled={!name.trim() || !(k > 0)} onClick={() => onDone({ name: name.trim(), kcal: k, p: Number.isFinite(pr) ? pr : 0 })}>
        Добавить
      </Button>
    </div>
  );
}

function RecipeForm({ foods, onDone }: { foods: Food[]; onDone: () => void }) {
  const [name, setName] = useState('');
  const [items, setItems] = useState<{ foodId: string; grams: number }[]>([]);
  const [cooked, setCooked] = useState('');
  const [query, setQuery] = useState('');
  const [picking, setPicking] = useState<Food | null>(null);
  const map = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
  const raw = items.reduce((a, i) => a + i.grams, 0);
  const cookedW = Math.round(Number(cooked.replace(',', '.'))) || raw;
  const per100 = recipePer100({ items, cookedWeight: cookedW }, map);
  if (picking) {
    return (
      <GramsPicker
        food={picking}
        doneLabel="В состав"
        onBack={() => setPicking(null)}
        onDone={(g) => {
          setItems((xs) => [...xs, { foodId: picking.id, grams: g }]);
          setPicking(null);
          setQuery('');
        }}
      />
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <Field label="Название" placeholder="Плов домашний" value={name} onChange={(e) => setName(e.target.value)} />
      <div>
        <p className="mb-1 text-sm text-muted">Состав (сырой вес)</p>
        {items.map((it, i) => {
          const f = map.get(it.foodId);
          return (
            <div key={i} className="flex min-h-11 items-center gap-2 border-b border-line text-sm">
              <span className="flex-1 truncate">{f?.name}</span>
              <span className="tabular-nums">{it.grams}{NBSP}г</span>
              <button type="button" aria-label="Убрать" onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))} className="flex h-11 w-11 items-center justify-center text-muted">
                <Trash2 size={16} aria-hidden />
              </button>
            </div>
          );
        })}
        <label className="mt-2 flex min-h-12 items-center gap-2 rounded-xl bg-surface-2 px-3">
          <Search size={18} className="text-muted" aria-hidden />
          <input className="min-w-0 flex-1 bg-transparent py-2 outline-none" placeholder="Добавить ингредиент" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        {searchFoods(foods.filter((f) => f.source !== 'recipe'), query, 6).map((f) => (
          <FoodRow key={f.id} food={f} onClick={() => setPicking(f)} />
        ))}
      </div>
      <Field label={`Вес готового блюда (сырой ${raw} г)`} suffix="г" inputMode="numeric" value={cooked} onChange={(e) => setCooked(e.target.value)} />
      {items.length > 0 && (
        <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm">
          На 100 г готового: <b>{per100.kcal} ккал</b> · Б {formatMacro(per100.p, false)} · Ж {formatMacro(per100.f, false)} · У {formatMacro(per100.c, false)}
        </p>
      )}
      <Button
        size="lg"
        disabled={!name.trim() || items.length === 0}
        onClick={async () => {
          await saveRecipe(
            { name: name.trim(), aliases: [], per100, approx: false, archived: false, unitName: 'порция', unitGrams: Math.round(cookedW / 4) },
            { items, cookedWeight: cookedW },
          );
          onDone();
        }}
      >
        Сохранить блюдо
      </Button>
    </div>
  );
}

// ---------- Изменить запись ----------

export function EditEntrySheet({ entry, food, onClose }: { entry: FoodLog | null; food: Food | undefined; onClose: () => void }) {
  if (!entry) return null;
  return (
    <Sheet open title={food?.name ?? entry.quick?.name ?? 'Запись'} onClose={onClose}>
      <div className="px-2 pb-2">
        {food && entry.grams ? (
          <GramsPicker
            food={food}
            initial={entry.grams}
            doneLabel="Сохранить"
            onDone={async (grams) => {
              await updateFoodLog(entry.id, { grams });
              onClose();
            }}
          />
        ) : (
          <p className="text-muted">Быстрая запись: {entry.quick?.kcal} ккал, белок {formatMacro(entry.quick?.p ?? 0)}. Удалить — свайпом влево.</p>
        )}
      </div>
    </Sheet>
  );
}
