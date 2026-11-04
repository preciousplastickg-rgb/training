import { appToday } from '../app/clock';
import { useNow } from './useNow';

/** Сегодняшняя дата в Бишкеке; обновляется после полуночи. */
export function useToday(): string {
  const now = useNow(60_000);
  return appToday(now);
}
