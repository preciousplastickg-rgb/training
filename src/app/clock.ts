// «Сегодня» для приложения. В dev можно сдвинуть дату (демо-данные), в проде — всегда реальная.
import { today } from '../domain/dates';

export const DEV_TODAY_KEY = 'devToday';

export function appToday(now: number = Date.now()): string {
  if (import.meta.env.DEV) {
    const override = typeof localStorage !== 'undefined' ? localStorage.getItem(DEV_TODAY_KEY) : null;
    if (override) return override;
  }
  return today(now);
}
