import { Scale, Utensils, Waves, type LucideIcon } from 'lucide-react';
import { navigate } from '../app/router';
import { openSheet, type GlobalSheet } from '../app/uiStore';
import { Sheet } from './Sheet';

const ITEMS: { label: string; hint: string; icon: LucideIcon; sheet: Exclude<GlobalSheet, null> }[] = [
  { label: 'Еда', hint: 'Поиск → граммы → добавить', icon: Utensils, sheet: 'food' },
  { label: 'Вес', hint: 'Утренний вес и замеры', icon: Scale, sheet: 'weight' },
  { label: 'Бассейн', hint: 'Длительность и ощущение', icon: Waves, sheet: 'pool' },
];

/** Меню «+»: еда, вес, бассейн (SPEC 6). */
export function AddMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} title="Добавить" onClose={onClose}>
      <ul className="flex flex-col gap-1">
        {ITEMS.map(({ label, hint, icon: Icon, sheet }) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => {
                onClose();
                if (sheet === 'food') navigate('nutrition');
                openSheet(sheet);
              }}
              className="flex min-h-14 w-full items-center gap-4 rounded-2xl px-3 py-1 text-left active:bg-track"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/40 text-accent">
                <Icon size={22} aria-hidden />
              </span>
              <span className="flex-1">
                <span className="block text-base font-medium">{label}</span>
                <span className="block text-sm text-muted">{hint}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
