import { describe, expect, it } from 'vitest';
import { formatDayMonth, formatInt, formatKcal, formatKg, formatMacro, formatWeekdayDate, parseKg } from './format';

const sp = (s: string) => s.replace(/ /g, ' ');

describe('форматирование чисел', () => {
  it('вес', () => {
    expect(formatKg(6250)).toBe(sp('62,5 кг'));
    expect(formatKg(8000)).toBe(sp('80 кг'));
    expect(formatKg(8025)).toBe(sp('80,25 кг'));
    expect(formatKg(125)).toBe(sp('1,25 кг'));
    expect(formatKg(-410, false)).toBe('−4,1');
  });
  it('калории с разделением разрядов', () => {
    expect(formatKcal(2050)).toBe(sp('2 050 ккал'));
    expect(formatKcal(980)).toBe(sp('980 ккал'));
    expect(formatInt(12_345_678)).toBe(sp('12 345 678'));
  });
  it('БЖУ × 10', () => {
    expect(formatMacro(1550)).toBe(sp('155 г'));
    expect(formatMacro(126)).toBe(sp('12,6 г'));
  });
});

describe('parseKg', () => {
  it('понимает запятую и точку', () => {
    expect(parseKg('62,5')).toBe(6250);
    expect(parseKg('62.5')).toBe(6250);
    expect(parseKg(' 81 ')).toBe(8100);
    expect(parseKg('80,25')).toBe(8025);
  });
  it('без float-хвостов', () => {
    expect(parseKg('80,3')).toBe(8030);
    expect(parseKg('0,1')).toBe(10);
  });
  it('мусор → null', () => {
    expect(parseKg('')).toBeNull();
    expect(parseKg('abc')).toBeNull();
    expect(parseKg('-5')).toBeNull();
  });
});

describe('даты по-русски', () => {
  it('день и месяц', () => {
    expect(formatDayMonth('2026-11-05')).toBe('5 ноября');
    expect(formatDayMonth('2027-02-24')).toBe('24 февраля');
  });
  it('с днём недели', () => {
    expect(formatWeekdayDate('2026-11-09')).toBe('Понедельник, 9 ноября');
  });
});
