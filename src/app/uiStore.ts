// Глобальные шторки (меню «+» открывает их с любого экрана).
import { useSyncExternalStore } from 'react';

export type GlobalSheet = 'weight' | 'pool' | 'food' | null;

let current: GlobalSheet = null;
const listeners = new Set<() => void>();

export function openSheet(s: GlobalSheet): void {
  current = s;
  listeners.forEach((l) => l());
}

export function useGlobalSheet(): GlobalSheet {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}
