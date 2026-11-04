// Календарные даты приложения: строка 'YYYY-MM-DD' в часовом поясе Asia/Bishkek.
// Неделя начинается с понедельника. Арифметика — через UTC-полночь, без часовых сдвигов.

export type LocalDate = string;

export const TIME_ZONE = 'Asia/Bishkek';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

const localDateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function isLocalDate(value: string): value is LocalDate {
  if (!DATE_RE.test(value)) return false;
  const ms = toUtcMs(value);
  return ms !== null && fromUtcMs(ms) === value;
}

/** Дата в Бишкеке для момента времени `ts` (мс). */
export function toLocalDate(ts: number): LocalDate {
  const parts = localDateFormat.formatToParts(new Date(ts));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function today(now: number = Date.now()): LocalDate {
  return toLocalDate(now);
}

function toUtcMs(date: LocalDate): number | null {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return null;
  const ms = Date.UTC(y, m - 1, d);
  return Number.isNaN(ms) ? null : ms;
}

function fromUtcMs(ms: number): LocalDate {
  return new Date(ms).toISOString().slice(0, 10);
}

function mustUtcMs(date: LocalDate): number {
  const ms = toUtcMs(date);
  if (ms === null) throw new Error(`Некорректная дата: ${date}`);
  return ms;
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return fromUtcMs(mustUtcMs(date) + days * DAY_MS);
}

/** b − a в днях. */
export function diffDays(a: LocalDate, b: LocalDate): number {
  return Math.round((mustUtcMs(b) - mustUtcMs(a)) / DAY_MS);
}

/** 1 = понедельник … 7 = воскресенье. */
export function isoWeekday(date: LocalDate): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  const js = new Date(mustUtcMs(date)).getUTCDay();
  return (js === 0 ? 7 : js) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

/** Понедельник недели, в которую входит дата. */
export function weekStart(date: LocalDate): LocalDate {
  return addDays(date, 1 - isoWeekday(date));
}

/** Включительно с обеих сторон. */
export function isBetween(date: LocalDate, start: LocalDate, end: LocalDate): boolean {
  return date >= start && date <= end;
}
