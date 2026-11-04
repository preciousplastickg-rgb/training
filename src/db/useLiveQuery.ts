import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';

/**
 * Последний результат запросов с ключом. Экран при открытии сразу рисуется с данными,
 * а не пустым на кадр: иначе карточки «дорастают» и контент сдвигается.
 */
const cache = new Map<string, unknown>();

/** Прочитать запрос заранее и положить в кэш — при старте приложения, до первого экрана. */
export async function prefetch<T>(key: string, query: () => Promise<T> | T): Promise<void> {
  cache.set(key, await query());
}

/**
 * Подписка на запрос Dexie: компонент перерисовывается, когда меняются прочитанные данные.
 * Пока первый результат не пришёл — значение из кэша по `key`, иначе `initial`.
 */
export function useLiveQuery<T>(query: () => Promise<T> | T, deps: unknown[], initial: T, key?: string): T;
export function useLiveQuery<T>(query: () => Promise<T> | T, deps: unknown[]): T | undefined;
export function useLiveQuery<T>(query: () => Promise<T> | T, deps: unknown[], initial?: T, key?: string): T | undefined {
  const [value, setValue] = useState<T | undefined>(() => (key && cache.has(key) ? (cache.get(key) as T) : initial));
  useEffect(() => {
    const sub = liveQuery(query).subscribe({
      next: (v) => {
        if (key) cache.set(key, v);
        setValue(v);
      },
      error: (err: unknown) => console.error('liveQuery', err),
    });
    return () => sub.unsubscribe();
  }, deps);
  return value;
}
