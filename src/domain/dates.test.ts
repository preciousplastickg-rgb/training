import { describe, expect, it } from 'vitest';
import { addDays, diffDays, isBetween, isLocalDate, isoWeekday, toLocalDate, weekStart } from './dates';

describe('toLocalDate — Asia/Bishkek (UTC+6)', () => {
  it('после 18:00 UTC в Бишкеке уже следующий день', () => {
    expect(toLocalDate(Date.UTC(2026, 10, 8, 17, 59))).toBe('2026-11-08');
    expect(toLocalDate(Date.UTC(2026, 10, 8, 18, 0))).toBe('2026-11-09');
  });
  it('до 18:00 UTC — тот же день', () => {
    expect(toLocalDate(Date.UTC(2026, 10, 9, 0, 0))).toBe('2026-11-09');
  });
});

describe('арифметика дат', () => {
  it('addDays через границы месяца и года', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28');
  });
  it('diffDays', () => {
    expect(diffDays('2026-11-09', '2027-04-30')).toBe(172);
    expect(diffDays('2026-11-09', '2026-11-09')).toBe(0);
    expect(diffDays('2026-11-10', '2026-11-09')).toBe(-1);
  });
  it('isBetween включает края', () => {
    expect(isBetween('2026-12-28', '2026-12-28', '2027-01-03')).toBe(true);
    expect(isBetween('2027-01-03', '2026-12-28', '2027-01-03')).toBe(true);
    expect(isBetween('2027-01-04', '2026-12-28', '2027-01-03')).toBe(false);
  });
});

describe('неделя с понедельника', () => {
  it('isoWeekday', () => {
    expect(isoWeekday('2026-11-09')).toBe(1); // старт программы — понедельник
    expect(isoWeekday('2026-11-05')).toBe(4);
    expect(isoWeekday('2026-11-08')).toBe(7);
  });
  it('weekStart', () => {
    expect(weekStart('2026-11-08')).toBe('2026-11-02');
    expect(weekStart('2026-11-09')).toBe('2026-11-09');
    expect(weekStart('2027-01-01')).toBe('2026-12-28');
  });
});

describe('isLocalDate', () => {
  it('принимает только существующие даты в формате YYYY-MM-DD', () => {
    expect(isLocalDate('2026-11-09')).toBe(true);
    expect(isLocalDate('2027-02-29')).toBe(false);
    expect(isLocalDate('2026-1-9')).toBe(false);
    expect(isLocalDate('09.11.2026')).toBe(false);
  });
});
