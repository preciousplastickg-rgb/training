import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';

/**
 * Подписка на запрос Dexie: компонент перерисовывается, когда меняются прочитанные данные.
 * Пока первый результат не пришёл — `initial`.
 */
export function useLiveQuery<T>(query: () => Promise<T> | T, deps: unknown[], initial: T): T;
export function useLiveQuery<T>(query: () => Promise<T> | T, deps: unknown[]): T | undefined;
export function useLiveQuery<T>(query: () => Promise<T> | T, deps: unknown[], initial?: T): T | undefined {
  const [value, setValue] = useState<T | undefined>(initial);
  useEffect(() => {
    const sub = liveQuery(query).subscribe({
      next: setValue,
      error: (err: unknown) => console.error('liveQuery', err),
    });
    return () => sub.unsubscribe();
  }, deps);
  return value;
}
