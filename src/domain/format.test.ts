import { describe, expect, it } from 'vitest';
import { formatDayMonth, formatDuration, formatHours, formatInt, formatKcal, formatKg, formatMacro, formatWeekdayDate, NBSP, parseDuration, parseKg, pluralRu } from './format';

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

describe('множественное число', () => {
  it('рекорды', () => {
    const f = (n: number) => pluralRu(n, 'рекорд', 'рекорда', 'рекордов');
    expect([1, 2, 5, 11, 21, 22, 25, 101].map(f)).toEqual(['рекорд', 'рекорда', 'рекордов', 'рекордов', 'рекорд', 'рекорда', 'рекордов', 'рекорд']);
  });
});

describe('длительность', () => {
  it('минуты → «7 ч 30 мин», «8 ч», «45 мин»', () => {
    expect(formatDuration(450)).toBe(`7${NBSP}ч 30${NBSP}мин`);
    expect(formatDuration(480)).toBe(`8${NBSP}ч`);
    expect(formatDuration(45)).toBe(`45${NBSP}мин`);
    expect(formatHours(450)).toBe('7,5');
    expect(formatHours(420)).toBe('7');
  });
  it('ввод сна: часы с дробью, часы и минуты', () => {
    expect(parseDuration('7,5')).toBe(450);
    expect(parseDuration('7.5')).toBe(450);
    expect(parseDuration('8')).toBe(480);
    expect(parseDuration('7:30')).toBe(450);
    expect(parseDuration('7 30')).toBe(450);
    expect(parseDuration('7ч30')).toBe(450);
    expect(parseDuration('7 ч 15 мин')).toBe(435);
    expect(parseDuration('7:75')).toBeNull();
    expect(parseDuration('25')).toBeNull();
    expect(parseDuration('много')).toBeNull();
  });
});
