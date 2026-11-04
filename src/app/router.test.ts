import { describe, expect, it } from 'vitest';
import { parseRoute } from './router';

describe('parseRoute', () => {
  it('известные экраны', () => {
    expect(parseRoute('#/workout')).toBe('workout');
    expect(parseRoute('#/settings')).toBe('settings');
    expect(parseRoute('#nutrition')).toBe('nutrition');
  });
  it('пустой и неизвестный хеш → «Сегодня»', () => {
    expect(parseRoute('')).toBe('today');
    expect(parseRoute('#/')).toBe('today');
    expect(parseRoute('#/nope')).toBe('today');
  });
});
