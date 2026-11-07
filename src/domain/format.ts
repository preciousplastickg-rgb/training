// Форматирование для интерфейса на русском: «62,5 кг», «2 050 ккал».
// Разряды разделяются неразрывным пробелом, дробная часть — запятой.
// Своя реализация, а не Intl.NumberFormat: вывод не должен зависеть от версии ICU в Safari.

import { isoWeekday, type LocalDate } from './dates';

export type Kg100 = number;

export const NBSP = '\u00A0';

function groupThousands(int: number): string {
  const digits = String(Math.abs(int));
  const out = digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return int < 0 ? `−${out}` : out;
}

/** Целое с разделением разрядов: 2050 → «2 050». */
export function formatInt(n: number): string {
  return groupThousands(Math.round(n));
}

/**
 * Число, хранящееся как целое × scale, с не более чем `maxFraction` знаками после запятой,
 * без хвостовых нулей: (6250, 100) → «62,5».
 */
export function formatScaled(value: number, scale: number, maxFraction: number): string {
  const sign = value < 0 ? '−' : '';
  const abs = Math.abs(Math.round(value));
  const int = Math.floor(abs / scale);
  const fracDigits = String(scale).length - 1;
  let frac = String(abs % scale).padStart(fracDigits, '0').slice(0, maxFraction);
  frac = frac.replace(/0+$/, '');
  return `${sign}${groupThousands(int)}${frac ? ',' + frac : ''}`;
}

/** 6250 → «62,5 кг». */
export function formatKg(kg100: Kg100, withUnit = true): string {
  const s = formatScaled(kg100, 100, 2);
  return withUnit ? `${s}${NBSP}кг` : s;
}

/** 2050 → «2 050 ккал». */
export function formatKcal(kcal: number, withUnit = true): string {
  const s = formatInt(kcal);
  return withUnit ? `${s}${NBSP}ккал` : s;
}

/** БЖУ хранятся × 10: 925 → «92,5 г». */
export function formatMacro(g10: number, withUnit = true): string {
  const s = formatScaled(g10, 10, 1);
  return withUnit ? `${s}${NBSP}г` : s;
}

/** «62,5» или «62.5» → 6250. Шаг хранения — 0,01 кг. null, если не число. */
export function parseKg(input: string): Kg100 | null {
  const normalized = input.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

const MONTHS_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];
const WEEKDAYS = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];

/** '2026-11-05' → «5 ноября». */
export function formatDayMonth(date: LocalDate): string {
  const [, m, d] = date.split('-').map(Number);
  return `${d} ${MONTHS_GEN[(m ?? 1) - 1]}`;
}

/** '2026-11-05' → «Четверг, 5 ноября». */
export function formatWeekdayDate(date: LocalDate): string {
  const wd = WEEKDAYS[isoWeekday(date) - 1] ?? '';
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)}, ${formatDayMonth(date)}`;
}

/** Русское множественное число: pluralRu(2, 'рекорд', 'рекорда', 'рекордов') → «рекорда». */
export function pluralRu(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

/** Минуты → «7 ч 30 мин», «8 ч», «45 мин». */
export function formatDuration(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (!h) return `${rest}${NBSP}мин`;
  return rest ? `${h}${NBSP}ч ${rest}${NBSP}мин` : `${h}${NBSP}ч`;
}

/** Короткая форма для подписей графика: 450 → «7,5», 420 → «7». */
export function formatHours(min: number): string {
  return formatScaled(Math.round(min / 6), 10, 1);
}

/**
 * Длительность сна, набранная руками: «7,5» и «7.5» — часы, «7:30» и «7 30» — часы и минуты,
 * «7ч30» — тоже. null — не похоже на время сна (0–16 ч).
 */
export function parseDuration(input: string): number | null {
  const s = input.trim().toLowerCase().replace(',', '.');
  let min: number | null = null;
  const hm = /^(\d{1,2})\s*(?:[: ]|ч)\s*(\d{1,2})\s*(?:мин|м)?$/.exec(s);
  if (hm) {
    const m = Number(hm[2]);
    if (m < 60) min = Number(hm[1]) * 60 + m;
  } else if (/^\d{1,2}(\.\d+)?\s*(?:ч)?$/.test(s)) {
    min = Math.round(parseFloat(s) * 60);
  }
  return min !== null && min >= 0 && min <= 16 * 60 ? min : null;
}
