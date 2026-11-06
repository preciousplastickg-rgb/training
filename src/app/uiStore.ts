// Глобальные шторки (меню «+» открывает их с любого экрана).
import { useSyncExternalStore } from 'react';

/** food_quick — «Быстро: ккал + белок» из меню «+»: сразу форма быстрой записи. */
export type GlobalSheet = 'weight' | 'pool' | 'food' | 'food_quick' | null;

let current: GlobalSheet = null;
/** Дата записи для шторки (бассейн за прошедший день из календаря); по умолчанию — сегодня. */
let sheetDate: string | undefined;
const listeners = new Set<() => void>();

export function openSheet(s: GlobalSheet, date?: string): void {
  current = s;
  sheetDate = date;
  listeners.forEach((l) => l());
}

export const globalSheetDate = (): string | undefined => sheetDate;

export function useGlobalSheet(): GlobalSheet {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}
