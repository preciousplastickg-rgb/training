import { ChartLine, Dumbbell, House, Plus, Utensils, type LucideIcon } from 'lucide-react';
import { navigate, type Route } from '../app/router';

const LEFT: { route: Route; label: string; icon: LucideIcon }[] = [
  { route: 'today', label: 'Сегодня', icon: House },
  { route: 'workout', label: 'Тренировка', icon: Dumbbell },
];
const RIGHT: { route: Route; label: string; icon: LucideIcon }[] = [
  { route: 'nutrition', label: 'Питание', icon: Utensils },
  { route: 'progress', label: 'Прогресс', icon: ChartLine },
];

interface BottomNavProps {
  route: Route;
  onAdd: () => void;
}

/** Нижнее меню: Сегодня · Тренировка · [+] · Питание · Прогресс (SPEC 6). */
export function BottomNav({ route, onAdd }: BottomNavProps) {
  const item = ({ route: r, label, icon: Icon }: (typeof LEFT)[number]) => {
    const active = route === r;
    return (
      <button
        key={r}
        type="button"
        onClick={() => navigate(r)}
        aria-current={active ? 'page' : undefined}
        className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
          active ? 'text-ink' : 'text-muted'
        }`}
      >
        <span className={`flex h-7 w-12 items-center justify-center rounded-full ${active ? 'bg-primary/15' : ''}`}>
          <Icon size={22} strokeWidth={active ? 2.4 : 1.8} aria-hidden />
        </span>
        {label}
      </button>
    );
  };

  return (
    <nav aria-label="Основное меню" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-xl items-stretch px-1 py-1">
        {LEFT.map(item)}
        <div className="flex flex-1 items-center justify-center">
          <button
            type="button"
            onClick={onAdd}
            aria-label="Добавить запись"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg active:scale-95 transition-transform"
          >
            <Plus size={28} strokeWidth={2.4} aria-hidden />
          </button>
        </div>
        {RIGHT.map(item)}
      </div>
    </nav>
  );
}
