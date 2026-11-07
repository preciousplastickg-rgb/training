// Глобальные шторки (меню «+» открывает их с любого экрана).
import { useSyncExternalStore } from 'react';

/** food_quick — «Быстро: ккал + белок» из меню «+»: сразу форма быстрой записи. */
export type GlobalSheet = 'weight' | 'pool' | 'food' | 'food_quick' | null;

let current: GlobalSheet = null;
/** Дата записи для шторки (бассейн за прошедший день из календаря); по умолчанию — сегодня. */
let sheetDate: string | undefined;
const listeners = new Set<() => void>();

/** Поле, на которое встать сразу: «Записать шаги» с дня отдыха открывает шторку веса на шагах. */
export type SheetFocus = 'steps';
let sheetFocus: SheetFocus | undefined;

export function openSheet(s: GlobalSheet, opts: { date?: string; focus?: SheetFocus } = {}): void {
  current = s;
  sheetDate = opts.date;
  sheetFocus = opts.focus;
  listeners.forEach((l) => l());
}

export const globalSheetDate = (): string | undefined => sheetDate;
export const globalSheetFocus = (): SheetFocus | undefined => sheetFocus;

export function useGlobalSheet(): GlobalSheet {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}
