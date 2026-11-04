import { Scale, Utensils, Waves, type LucideIcon } from 'lucide-react';
import { Sheet } from './Sheet';

const ITEMS: { label: string; icon: LucideIcon; stage: number }[] = [
  { label: 'Еда', icon: Utensils, stage: 6 },
  { label: 'Вес', icon: Scale, stage: 5 },
  { label: 'Бассейн', icon: Waves, stage: 5 },
];

interface AddMenuProps {
  open: boolean;
  onClose: () => void;
}

/** Меню «+»: еда, вес, бассейн (SPEC 6). Сами формы появятся на этапах 5–6. */
export function AddMenu({ open, onClose }: AddMenuProps) {
  return (
    <Sheet open={open} title="Добавить" onClose={onClose}>
      <ul className="flex flex-col gap-1">
        {ITEMS.map(({ label, icon: Icon, stage }) => (
          <li key={label}>
            <button
              type="button"
              disabled
              className="flex min-h-14 w-full items-center gap-4 rounded-2xl px-3 text-left disabled:opacity-100"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-track">
                <Icon size={22} aria-hidden />
              </span>
              <span className="flex-1">
                <span className="block text-base font-medium">{label}</span>
                <span className="block text-sm text-muted">Появится на этапе {stage}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
