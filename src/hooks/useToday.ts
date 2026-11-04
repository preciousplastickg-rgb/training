import { today } from '../domain/dates';
import { useNow } from './useNow';

/** Сегодняшняя дата в Бишкеке; обновляется после полуночи. */
export function useToday(): string {
  const now = useNow(60_000);
  return today(now);
}
