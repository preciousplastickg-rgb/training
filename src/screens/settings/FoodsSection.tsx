import { Archive, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { Button, Card, Chip, Field } from '../../components/ui';
import { saveFood } from '../../db/repo';
import type { Food, FoodUnit } from '../../db/types';
import { formatScaled } from '../../domain/format';
import { searchFoods } from '../../domain/foodSearch';
import { useFoods } from '../../hooks/useData';
import { FoodRow } from '../nutrition/FoodSheets';

const EMPTY: Omit<Food, 'id'> = {
  name: '', aliases: [], per100: { kcal: 0, p: 0, f: 0, c: 0 }, source: 'user', approx: false, archived: false,
};

/** База продуктов: добавить, изменить (включая seed), архив (SPEC 6.5, 7). Шторка из настроек. */
export function FoodsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const foods = useFoods();
  const [query, setQuery] = useState('');
  const [edit, setEdit] = useState<(Omit<Food, 'id'> & { id?: string }) | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const list = query ? searchFoods(foods, query, 20) : foods.filter((f) => f.source !== 'seed' && !f.archived).slice(0, 20);
  const archived = foods.filter((f) => f.archived);
  return (
    <Sheet open={open} kicker="Данные" title={`База продуктов · ${foods.filter((f) => !f.archived).length}`} onClose={onClose}>
      <Card>
        <label className="flex min-h-12 items-center gap-2 rounded-full bg-track px-4 focus-within:shadow-[inset_0_0_0_2px_var(--ink)]">
          <Search size={18} className="text-muted" aria-hidden />
          <input className="min-w-0 flex-1 bg-transparent py-2 outline-none" placeholder="Найти продукт" aria-label="Найти продукт в базе" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        {!query && list.length === 0 && <p className="mt-3 text-sm text-muted">Свои продукты и блюда появятся здесь. Найди любой, чтобы изменить.</p>}
        <div className="mt-1">
          {list.map((f) => (
            <FoodRow key={f.id} food={f} onClick={() => setEdit(f)} />
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setEdit({ ...EMPTY })}>
            <Plus size={16} aria-hidden /> Новый продукт
          </Button>
          {archived.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setShowArchived((v) => !v)}>
              <Archive size={16} aria-hidden /> Архив · {archived.length}
            </Button>
          )}
        </div>
        {showArchived && archived.map((f) => <FoodRow key={f.id} food={f} onClick={() => setEdit(f)} />)}
      </Card>
      {edit && <FoodEditSheet food={edit} onClose={() => setEdit(null)} />}
    </Sheet>
  );
}

function num(s: string): number {
  const v = Number(s.replace(',', '.'));
  return Number.isFinite(v) ? v : 0;
}

function FoodEditSheet({ food, onClose }: { food: Omit<Food, 'id'> & { id?: string }; onClose: () => void }) {
  const [name, setName] = useState(food.name);
  const [aliases, setAliases] = useState(food.aliases.join(', '));
  const [kcal, setKcal] = useState(String(food.per100.kcal || ''));
  const [p, setP] = useState(food.per100.p ? formatScaled(food.per100.p, 10, 1) : '');
  const [f, setF] = useState(food.per100.f ? formatScaled(food.per100.f, 10, 1) : '');
  const [c, setC] = useState(food.per100.c ? formatScaled(food.per100.c, 10, 1) : '');
  const [unitName, setUnitName] = useState(food.unitName ?? '');
  const [unitGrams, setUnitGrams] = useState(food.unitGrams ? String(food.unitGrams) : '');
  const [unit, setUnit] = useState<FoodUnit>(food.unit ?? 'g');
  const u = unit === 'ml' ? 'мл' : 'г';
  const save = async (archived = food.archived) => {
    await saveFood({
      ...food,
      name: name.trim(),
      aliases: aliases.split(',').map((a) => a.trim().toLowerCase()).filter(Boolean),
      per100: { kcal: Math.round(num(kcal)), p: Math.round(num(p) * 10), f: Math.round(num(f) * 10), c: Math.round(num(c) * 10) },
      unit,
      unitName: unitName.trim() || undefined,
      unitGrams: Math.round(num(unitGrams)) || undefined,
      archived,
    });
    onClose();
  };
  return (
    <Sheet open title={food.id ? 'Продукт' : 'Новый продукт'} onClose={onClose}>
      <div className="flex flex-col gap-3 px-2 pb-2">
        <Field label="Название" value={name} onChange={(e) => setName(e.target.value)} />
        <Field label="Синонимы для поиска (через запятую)" value={aliases} onChange={(e) => setAliases(e.target.value)} />
        <div className="flex items-center gap-2">
          <p className="flex-1 text-sm text-muted">На 100 {u}{food.approx ? ' (приблизительно)' : ''}</p>
          {(['g', 'ml'] as const).map((x) => (
            <Chip key={x} active={unit === x} onClick={() => setUnit(x)} aria-label={x === 'g' ? 'В граммах' : 'В миллилитрах'}>
              {x === 'g' ? 'г' : 'мл'}
            </Chip>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-2">
          <Field label="Ккал" inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} />
          <Field label="Б" inputMode="decimal" value={p} onChange={(e) => setP(e.target.value)} />
          <Field label="Ж" inputMode="decimal" value={f} onChange={(e) => setF(e.target.value)} />
          <Field label="У" inputMode="decimal" value={c} onChange={(e) => setC(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Штука (название)" placeholder="1 шт" value={unitName} onChange={(e) => setUnitName(e.target.value)} />
          <Field label={`Штука, ${u}`} inputMode="numeric" value={unitGrams} onChange={(e) => setUnitGrams(e.target.value)} />
        </div>
        <Button size="lg" disabled={!name.trim()} onClick={() => void save()}>
          Сохранить
        </Button>
        {food.id && (
          <Button variant="secondary" onClick={() => void save(!food.archived)}>
            <Archive size={18} aria-hidden /> {food.archived ? 'Вернуть из архива' : 'В архив'}
          </Button>
        )}
      </div>
    </Sheet>
  );
}
