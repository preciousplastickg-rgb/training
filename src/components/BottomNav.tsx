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

/**
 * Нижнее меню (REDESIGN 1.3): чёрная таблетка 70 px над краем экрана, значки без подписей
 * (подпись — в aria-label), активный — лаймовый значок на подложке, «+» — лаймовый круг.
 */
export function BottomNav({ route, onAdd }: BottomNavProps) {
  const item = ({ route: r, label, icon: Icon }: (typeof LEFT)[number]) => {
    const active = route === r;
    return (
      <button
        key={r}
        type="button"
        onClick={() => navigate(r)}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        className={`flex h-12 items-center justify-center justify-self-center rounded-full transition-colors ${
          active ? 'bg-[#2A2C30] px-3.5 text-primary' : 'w-12 text-muted-on-ink'
        }`}
      >
        <Icon size={22} strokeWidth={2} aria-hidden />
      </button>
    );
  };

  return (
    <nav
      aria-label="Основное меню"
      className="vv-bottom fixed inset-x-4 bottom-[calc(26px+env(safe-area-inset-bottom))] z-40 mx-auto grid h-[70px] max-w-xl grid-cols-5 items-center rounded-full border border-hero-line bg-hero px-1.5"
    >
      {LEFT.map(item)}
      <button
        type="button"
        onClick={onAdd}
        aria-label="Добавить запись"
        className="flex h-[54px] w-[54px] items-center justify-center justify-self-center rounded-full bg-primary text-on-primary transition-transform active:scale-95"
      >
        <Plus size={26} strokeWidth={2.6} aria-hidden />
      </button>
      {RIGHT.map(item)}
    </nav>
  );
}
