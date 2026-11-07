// Шторки питания — макеты BAddFood и BPortion (REDESIGN 4): таблетки приёмов, поиск 56 с чёрной обводкой,
// результаты на белой карточке, «Недавние» / «Частые», порция с ±64 и чёрной карточкой КБЖУ + «день после».

import { Minus, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Sheet } from '../../components/Sheet';
import { Button, Caps, Field, HeroCard, Stepper } from '../../components/ui';
import { FOOD_CATEGORIES } from '../../data/foods';
import { addFoodLog, saveQuickFood, saveRecipe, updateFoodLog } from '../../db/repo';
import type { Food, FoodCategory, FoodLog, FoodUnit } from '../../db/types';
import { formatInt, formatMacro, NBSP } from '../../domain/format';
import { frequentFoods, norm, recentFoods, searchFoods } from '../../domain/foodSearch';
import { MAX_KCAL_PER_100, MEAL_NAMES, portion, quickFoodDraft, recipePer100, unitLabel, type DayTargets, type Macros, type Meal } from '../../domain/nutrition';

export type AddMode = 'search' | 'quick' | 'recipe';

/** «в завтрак», «в обед», «в ужин», «в перекус». */
export const MEAL_ACC: Record<Meal, string> = { breakfast: 'завтрак', lunch: 'обед', dinner: 'ужин', snack: 'перекус' };

export interface DayContext {
  total: Macros;
  targets: DayTargets;
}

/** Строка результата: название (совпадение жирнее), «на 100 г · белок 31 г», ккал Unbounded справа. */
export function FoodRow({ food, query = '', onClick }: { food: Food; query?: string; onClick: () => void }) {
  const unit = food.unitName && food.unitGrams ? portion(food, food.unitGrams) : null;
  const u = unitLabel(food);
  const q = norm(query);
  const i = q ? norm(food.name).indexOf(q) : -1;
  const name: ReactNode =
    i >= 0 ? (
      <>
        {food.name.slice(0, i)}
        <b className="font-black">{food.name.slice(i, i + q.length)}</b>
        {food.name.slice(i + q.length)}
      </>
    ) : (
      food.name
    );
  return (
    <button type="button" onClick={onClick} className="flex min-h-16 w-full items-center gap-3 border-t border-line px-[18px] text-left first:border-t-0 active:bg-track">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-base font-bold">
          {name}
          {food.approx && <span className="ml-1 font-normal text-muted">≈</span>}
        </span>
        <span className="text-[13px] text-muted">
          {unit ? `${food.unitName} ${food.unitGrams} ${u} · белок ${formatMacro(unit.p, false)} г` : `на 100 ${u} · белок ${formatMacro(food.per100.p, false)} г`}
        </span>
      </span>
      <span className="font-display text-base font-bold tabular-nums">{unit ? unit.kcal : food.per100.kcal}</span>
    </button>
  );
}

// ---------- Добавить ----------

export function AddFoodSheet({
  open, onClose, date, meal: initialMeal, foods, logs, initialMode = 'search', day,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
  meal: Meal;
  foods: Food[];
  logs: FoodLog[];
  /** «Быстро» из меню «+» — сразу форма быстрой записи; «Мои блюда» — рецепт. */
  initialMode?: AddMode;
  /** Итоги и цели дня — для «День после» в порции. */
  day?: DayContext;
}) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Food | null>(null);
  const [mode, setMode] = useState<AddMode>(initialMode);
  const [meal, setMeal] = useState<Meal>(initialMeal);
  const [cat, setCat] = useState<FoodCategory | 'mine' | null>(null);
  const map = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
  // Сброс — при закрытии: при следующем открытии поле поиска есть с первого кадра и получает фокус.
  useEffect(() => {
    if (!open) {
      setQuery('');
      setPicked(null);
      setCat(null);
    }
    setMode(open ? initialMode : 'search');
  }, [open, initialMode]);
  useEffect(() => {
    if (open) setMeal(initialMeal);
  }, [open, initialMeal]);

  const active = foods.filter((f) => !f.archived);
  const results = searchFoods(foods, query);
  const recent = recentFoods(logs, map);
  const frequent = frequentFoods(logs, map, 10, new Set(recent.map((f) => f.id)));
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of logs) if (l.foodId) m.set(l.foodId, (m.get(l.foodId) ?? 0) + 1);
    return m;
  }, [logs]);
  const mine = active.filter((f) => f.source !== 'seed');
  const catalog = cat
    ? active.filter((f) => (cat === 'mine' ? f.source !== 'seed' : f.category === cat)).sort((a, b) => a.name.localeCompare(b.name, 'ru'))
    : [];
  const catLabel = cat === 'mine' ? 'Мои продукты и блюда' : (FOOD_CATEGORIES.find((c) => c.id === cat)?.label ?? '');

  const title = picked ? 'Порция' : mode === 'quick' ? 'Быстрая запись' : mode === 'recipe' ? 'Моё блюдо' : `В ${MEAL_ACC[meal]}`;
  return (
    <Sheet open={open} title={title} onClose={onClose}>
      <div className="flex min-h-[70dvh] flex-col gap-3.5 pb-2">
        {picked ? (
          <GramsPicker
            food={picked}
            mealAcc={MEAL_ACC[meal]}
            day={day}
            doneLabel={`Добавить в ${MEAL_ACC[meal]}`}
            onBack={() => setPicked(null)}
            onDone={async (grams) => {
              await addFoodLog({ date, meal, foodId: picked.id, grams });
              onClose();
            }}
          />
        ) : mode === 'quick' ? (
          <>
            <MealPills value={meal} onChange={setMeal} />
            <QuickForm
              initialName={query}
              doneLabel={`Добавить в ${MEAL_ACC[meal]}`}
              onDone={async (draft, amount) => {
                // Продукт — в базу (или уже такой же из базы), в дневник — порция этого продукта.
                const foodId = await saveQuickFood(draft);
                await addFoodLog({ date, meal, foodId, grams: amount });
                onClose();
              }}
            />
          </>
        ) : mode === 'recipe' ? (
          <RecipeForm foods={foods} onDone={() => setMode('search')} />
        ) : (
          <>
            <MealPills value={meal} onChange={setMeal} />
            <label className="flex h-14 items-center gap-2.5 rounded-full bg-surface px-[18px] focus-within:shadow-[inset_0_0_0_2px_var(--ink)]">
              <Search size={18} className="shrink-0 text-muted" aria-hidden />
              <input
                // Шторка открывается тапом — фокус в том же тике, клавиатура iOS поднимается сразу: поиск → граммы → добавить.
                autoFocus
                enterKeyHint="search"
                className="min-w-0 flex-1 bg-transparent text-[17px] font-semibold"
                style={{ outline: 'none' }}
                placeholder="Поиск: грудка, рис, плов…"
                aria-label="Поиск продукта"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <span className="shrink-0 text-[13px] text-muted tabular-nums">
                  {results.length} из {active.length}
                </span>
              )}
            </label>
            {query ? (
              results.length ? (
                <ResultsCard items={results} query={query} onPick={setPicked} />
              ) : (
                <p className="px-1.5 text-sm text-muted">Ничего не нашлось — добавь через «Быстро» внизу: продукт сохранится в базе.</p>
              )
            ) : cat ? (
              <ResultsCard title={`${catLabel} · ${catalog.length}`} items={catalog} onPick={setPicked} onBack={() => setCat(null)} />
            ) : (
              <>
                {recent.length > 0 && <ChipGroup title="Недавние" items={recent.map((f) => ({ f, label: f.name }))} onPick={setPicked} />}
                {frequent.length > 0 && <ChipGroup title="Частые" items={frequent.map((f) => ({ f, label: `${f.name} · ${counts.get(f.id) ?? 0}` }))} onPick={setPicked} />}
                <div className="flex flex-col gap-2.5 px-1.5">
                  <Caps>Разделы</Caps>
                  <div className="flex flex-wrap gap-2" role="tablist" aria-label="Разделы каталога">
                    {FOOD_CATEGORIES.map((c) => (
                      <PillButton key={c.id} onClick={() => setCat(c.id)} role="tab" aria-selected={false}>
                        {c.label}
                      </PillButton>
                    ))}
                    {mine.length > 0 && (
                      <PillButton onClick={() => setCat('mine')} role="tab" aria-selected={false}>
                        Мои
                      </PillButton>
                    )}
                  </div>
                </div>
                {recent.length === 0 && <p className="px-1.5 text-sm text-muted">Начни вводить название или открой раздел: в базе {active.length} продуктов и блюд.</p>}
              </>
            )}
            <button
              type="button"
              onClick={() => setMode('quick')}
              className="mt-auto flex h-14 w-full items-center justify-center rounded-full border border-hero-line bg-hero text-[15px] font-extrabold text-white active:opacity-80"
            >
              Быстро: свой продукт на 100 г или мл
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}

function PillButton({ children, className = '', ...rest }: { children: ReactNode; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`min-h-11 rounded-full bg-surface px-3.5 text-sm font-bold active:bg-track ${className}`} {...rest}>
      {children}
    </button>
  );
}

/** Таблетки приёмов: активная — чёрная с лаймовым текстом. */
function MealPills({ value, onChange }: { value: Meal; onChange: (m: Meal) => void }) {
  return (
    <div className="flex gap-1.5" role="radiogroup" aria-label="Приём пищи">
      {(['breakfast', 'lunch', 'snack', 'dinner'] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={value === m}
          onClick={() => onChange(m)}
          className={`min-h-11 flex-1 rounded-full px-2 text-sm font-bold ${value === m ? 'border border-hero-line bg-hero text-primary' : 'bg-surface'}`}
        >
          {MEAL_NAMES[m]}
        </button>
      ))}
    </div>
  );
}

function ChipGroup({ title, items, onPick }: { title: string; items: { f: Food; label: string }[]; onPick: (f: Food) => void }) {
  return (
    <div className="flex flex-col gap-2.5 px-1.5">
      <Caps>{title}</Caps>
      <div className="flex flex-wrap gap-2">
        {items.map(({ f, label }) => (
          <PillButton key={f.id} onClick={() => onPick(f)} aria-label={f.name}>
            {label}
          </PillButton>
        ))}
      </div>
    </div>
  );
}

function ResultsCard({ title, items, query, onPick, onBack }: { title?: string; items: Food[]; query?: string; onPick: (f: Food) => void; onBack?: () => void }) {
  return (
    <section className="overflow-hidden rounded-[26px] bg-surface">
      {title && (
        <div className="flex items-center justify-between px-[18px] pt-3.5 pb-1">
          <Caps>{title}</Caps>
          {onBack && (
            <button type="button" onClick={onBack} className="min-h-11 text-sm font-bold underline underline-offset-2">
              Все разделы
            </button>
          )}
        </div>
      )}
      {items.map((f) => (
        <FoodRow key={f.id} food={f} query={query} onClick={() => onPick(f)} />
      ))}
      {items.length === 0 && <p className="px-[18px] py-4 text-sm text-muted">Пусто</p>}
    </section>
  );
}

// ---------- Порция (BPortion) ----------

export function GramsPicker({
  food, initial, onDone, onBack, doneLabel = 'Добавить', mealAcc, day,
}: {
  food: Food;
  initial?: number;
  onDone: (grams: number) => void | Promise<void>;
  onBack?: () => void;
  doneLabel?: string;
  /** «в ужин» в подзаголовке. */
  mealAcc?: string;
  /** Итоги и цели дня — строка «День после». */
  day?: DayContext;
}) {
  const [grams, setGrams] = useState(initial ?? food.unitGrams ?? (food.unit === 'ml' ? 250 : 100));
  const m = portion(food, grams);
  const u = unitLabel(food);
  const what = food.unit === 'ml' ? 'Миллилитры' : 'Граммы';
  const presets: { label: string; g: number }[] = [
    ...(food.unit === 'ml' ? [100, 200, 250, 330] : [50, 100, 150, 200]).map((g) => ({ label: String(g), g })),
    ...(food.unitName && food.unitGrams ? [{ label: `1 ${food.unitName}`, g: food.unitGrams }] : []),
  ];
  const after = day ? { kcal: day.total.kcal + m.kcal, p: day.total.p + m.p } : null;
  return (
    <div className="flex flex-1 flex-col gap-[18px]">
      <div className="flex flex-col px-1">
        <span className="text-lg font-extrabold">
          {food.name}
          {food.approx && <span className="ml-1 font-normal text-muted">≈</span>}
        </span>
        <span className="text-[13px] text-muted">
          {mealAcc ? `в ${mealAcc} · ` : ''}
          {food.per100.kcal} ккал на 100 {u}
        </span>
      </div>
      <div className="flex items-center justify-between py-2">
        <button type="button" aria-label={`${what}: меньше`} onClick={() => setGrams((g) => Math.max(5, g - (g > 100 ? 10 : 5)))} className="flex h-16 w-16 items-center justify-center rounded-full bg-surface active:scale-95">
          <Minus size={26} strokeWidth={2.6} aria-hidden />
        </button>
        <div className="flex items-baseline gap-1.5" aria-label={what}>
          <span className="font-display text-huge text-[64px] leading-[72px] font-bold tabular-nums">{grams}</span>
          <span className="text-xl font-bold text-muted">{u}</span>
        </div>
        <button type="button" aria-label={`${what}: больше`} onClick={() => setGrams((g) => g + (g >= 100 ? 10 : 5))} className="flex h-16 w-16 items-center justify-center rounded-full bg-surface active:scale-95">
          <Plus size={26} strokeWidth={2.6} aria-hidden />
        </button>
      </div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${presets.length}, minmax(0, 1fr))` }}>
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            aria-pressed={grams === p.g}
            onClick={() => setGrams(p.g)}
            className={`h-12 truncate rounded-full px-1 text-[15px] font-bold ${grams === p.g ? 'border border-hero-line bg-hero text-primary' : 'bg-surface'}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <HeroCard className="flex flex-col gap-4 rounded-[28px]! p-5!">
        <div className="grid grid-cols-4 gap-1.5">
          <Macro value={formatInt(m.kcal)} label="Ккал" color="#FF9A78" />
          <Macro value={formatMacro(m.p, false)} label="Белок" color="#A6C0FF" />
          <Macro value={formatMacro(m.f, false)} label="Жиры" />
          <Macro value={formatMacro(m.c, false)} label="Углев." />
        </div>
        {day && after && (
          <>
            <div className="h-px bg-[#2A2C30]" />
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-on-ink">День после</span>
                <span className="tabular-nums">
                  <b>{formatInt(after.kcal)}</b> / {formatInt(day.targets.kcal)} ккал · <b>{Math.round(after.p / 10)}</b> / {day.targets.protein} г
                </span>
              </div>
              <StackBar now={day.total.kcal} add={m.kcal} target={day.targets.kcal} color="var(--energy)" light="#FFB59E" label="Калории после добавления" />
              <StackBar now={day.total.p} add={m.p} target={day.targets.protein * 10} color="var(--protein)" light="#A6C0FF" label="Белок после добавления" />
            </div>
          </>
        )}
      </HeroCard>
      <div className="mt-auto flex gap-2 pt-1">
        {onBack && (
          <Button variant="secondary" size="lg" className="bg-surface!" onClick={onBack}>
            Назад
          </Button>
        )}
        <button type="button" onClick={() => void onDone(grams)} className="h-16 flex-1 rounded-full bg-primary text-lg font-extrabold text-on-primary active:scale-[0.98]">
          {doneLabel}
        </button>
      </div>
    </div>
  );
}

function Macro({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-display text-[22px] font-bold tabular-nums" style={color ? { color } : undefined}>
        {value}
      </span>
      <Caps className="text-muted-on-ink!">{label}</Caps>
    </div>
  );
}

/** Полоса «сейчас + добавка» на чёрном: добавка светлее. */
function StackBar({ now, add, target, color, light, label }: { now: number; add: number; target: number; color: string; light: string; label: string }) {
  const t = Math.max(1, target);
  const a = Math.min(100, (now / t) * 100);
  const b = Math.min(100 - a, (add / t) * 100);
  return (
    <div className="flex h-2.5 overflow-hidden rounded-[5px] bg-[#2A2C30]" role="img" aria-label={label}>
      <div style={{ width: `${a}%`, background: color }} />
      <div style={{ width: `${b}%`, background: light }} />
    </div>
  );
}

// ---------- Быстро и своё блюдо ----------

const num = (s: string): number => {
  const v = Number(s.replace(',', '.').replace(/\s/g, ''));
  return Number.isFinite(v) ? v : NaN;
};

/**
 * Быстрая запись своего продукта: значения на 100 г или на 100 мл (с этикетки), сколько съел или выпил,
 * итог порции. Продукт сохраняется в базе — дальше находится поиском, как любой другой.
 */
function QuickForm({
  initialName = '', doneLabel, onDone,
}: {
  initialName?: string;
  doneLabel: string;
  onDone: (draft: Omit<Food, 'id'>, amount: number) => void | Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [unit, setUnit] = useState<FoodUnit>('g');
  const [kcal, setKcal] = useState('');
  const [p, setP] = useState('');
  const [f, setF] = useState('');
  const [c, setC] = useState('');
  const [amount, setAmount] = useState(100);
  const [busy, setBusy] = useState(false);
  const u = unit === 'ml' ? 'мл' : 'г';
  const g10 = (v: string) => (v.trim() === '' ? 0 : Math.round(num(v) * 10));
  const per100: Macros = { kcal: Math.round(num(kcal)), p: g10(p), f: g10(f), c: g10(c) };
  const numbersOk = kcal.trim() !== '' && [per100.kcal, per100.p, per100.f, per100.c].every((v) => Number.isFinite(v) && v >= 0);
  const tooMuch = numbersOk && per100.kcal > MAX_KCAL_PER_100;
  const valid = !!name.trim() && numbersOk && !tooMuch && amount > 0;
  const m = numbersOk ? portion({ per100 }, amount) : null;
  const presets = unit === 'ml' ? [100, 200, 250, 330, 500] : [50, 100, 150, 200, 300];
  const switchUnit = (next: FoodUnit) => {
    if (next === unit) return;
    setUnit(next);
    setAmount(next === 'ml' ? 250 : 100);
  };
  return (
    <div className="flex flex-col gap-3.5">
      <Field label="Название" placeholder={unit === 'ml' ? 'Кефир 2,5%' : 'Плов в кафе'} value={name} onChange={(e) => setName(e.target.value)} />
      <div className="flex gap-1.5" role="radiogroup" aria-label="В чём меряется">
        {(['g', 'ml'] as const).map((x) => (
          <button
            key={x}
            type="button"
            role="radio"
            aria-checked={unit === x}
            onClick={() => switchUnit(x)}
            className={`min-h-11 flex-1 rounded-full px-2 text-sm font-bold ${unit === x ? 'border border-hero-line bg-hero text-primary' : 'bg-surface'}`}
          >
            {x === 'g' ? 'Еда · граммы' : 'Напиток · миллилитры'}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <Caps className="px-1">На 100 {u} — как на этикетке</Caps>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Калории" suffix="ккал" inputMode="numeric" placeholder="0" value={kcal} onChange={(e) => setKcal(e.target.value)} />
          <Field label="Белок" suffix="г" inputMode="decimal" placeholder="0" value={p} onChange={(e) => setP(e.target.value)} />
          <Field label="Жиры" suffix="г" inputMode="decimal" placeholder="0" value={f} onChange={(e) => setF(e.target.value)} />
          <Field label="Углеводы" suffix="г" inputMode="decimal" placeholder="0" value={c} onChange={(e) => setC(e.target.value)} />
        </div>
        {tooMuch && (
          <p className="px-1 text-sm font-bold text-warn">
            Больше {MAX_KCAL_PER_100} ккал на 100 {u} не бывает. Нужны калории на 100 {u}, а не на всю порцию.
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Caps className="px-1">{unit === 'ml' ? 'Сколько выпил' : 'Сколько съел'}</Caps>
        <Stepper
          label={unit === 'ml' ? 'Сколько выпил, мл' : 'Сколько съел, г'}
          value={amount}
          unit={u}
          onDec={() => setAmount((a) => Math.max(5, a - (a > 100 ? 10 : 5)))}
          onInc={() => setAmount((a) => Math.min(5000, a + (a >= 100 ? 10 : 5)))}
          onEdit={(raw) => {
            const v = Math.round(num(raw));
            if (v > 0 && v <= 5000) setAmount(v);
          }}
        />
        <div className="grid grid-cols-5 gap-1.5">
          {presets.map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={amount === g}
              aria-label={`${g} ${u}`}
              onClick={() => setAmount(g)}
              className={`h-11 rounded-full text-[15px] font-bold ${amount === g ? 'border border-hero-line bg-hero text-primary' : 'bg-surface'}`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>
      <HeroCard className="grid grid-cols-4 gap-1.5 rounded-[28px]! p-5!" >
        <Macro value={m ? formatInt(m.kcal) : '—'} label="Ккал" color="#FF9A78" />
        <Macro value={m ? formatMacro(m.p, false) : '—'} label="Белок" color="#A6C0FF" />
        <Macro value={m ? formatMacro(m.f, false) : '—'} label="Жиры" />
        <Macro value={m ? formatMacro(m.c, false) : '—'} label="Углев." />
      </HeroCard>
      <Button
        size="lg"
        disabled={!valid || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onDone(quickFoodDraft({ name, unit, per100 }), amount);
          } finally {
            setBusy(false);
          }
        }}
      >
        {doneLabel}
      </Button>
      <p className="px-1 text-center text-[13px] text-muted">Продукт сохранится в базе — в следующий раз найдёшь его поиском.</p>
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
        <Caps className="mb-1.5 px-1">Состав (сырой вес)</Caps>
        {items.length > 0 && (
          <div className="rounded-3xl bg-surface px-4">
            {items.map((it, i) => {
              const f = map.get(it.foodId);
              return (
                <div key={i} className="flex min-h-12 items-center gap-2 border-t border-line text-[15px] first:border-t-0">
                  <span className="flex-1 truncate font-semibold">{f?.name}</span>
                  <span className="text-muted tabular-nums">{it.grams}{NBSP}{unitLabel(f)}</span>
                  <button type="button" aria-label="Убрать" onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))} className="-mr-2 flex h-11 w-11 items-center justify-center text-muted">
                    <Trash2 size={16} aria-hidden />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <label className="mt-2 flex h-14 items-center gap-2.5 rounded-full bg-surface px-[18px] focus-within:shadow-[inset_0_0_0_2px_var(--ink)]">
          <Search size={18} className="text-muted" aria-hidden />
          <input className="min-w-0 flex-1 bg-transparent text-[17px] font-semibold" style={{ outline: 'none' }} placeholder="Добавить ингредиент" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        {query && (
          <div className="mt-2 overflow-hidden rounded-[26px] bg-surface">
            {searchFoods(foods.filter((f) => f.source !== 'recipe'), query, 6).map((f) => (
              <FoodRow key={f.id} food={f} query={query} onClick={() => setPicking(f)} />
            ))}
          </div>
        )}
      </div>
      <Field label={`Вес готового блюда (сырой ${raw} г)`} suffix="г" inputMode="numeric" value={cooked} onChange={(e) => setCooked(e.target.value)} />
      {items.length > 0 && (
        <p className="rounded-2xl bg-surface px-4 py-2.5 text-sm">
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
    <Sheet open title={food && entry.grams ? 'Изменить порцию' : 'Быстрая запись'} kicker={food && entry.grams ? undefined : entry.quick?.name} onClose={onClose}>
      <div className="flex flex-col pb-2">
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
          <p className="px-1 text-muted">{entry.quick?.kcal} ккал, белок {formatMacro(entry.quick?.p ?? 0)}. Изменить нельзя — удали свайпом влево и запиши заново.</p>
        )}
      </div>
    </Sheet>
  );
}
