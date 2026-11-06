import { describe, expect, it } from 'vitest';
import { viewportShift } from './viewport';

const base = { offsetTop: 0, height: 874, scale: 1, layoutHeight: 874, typing: false };

describe('сдвиг закреплённых элементов при залипшей области iOS', () => {
  it('всё в порядке — ничего не сдвигаем', () => {
    expect(viewportShift(base)).toEqual({ top: 0, bottom: 0 });
  });

  it('область съехала вниз на 223 px (меню посреди экрана) — шапку и меню опускаем на столько же', () => {
    expect(viewportShift({ ...base, offsetTop: 223 })).toEqual({ top: 223, bottom: 223 });
  });

  it('видимая область короче на смещение (WebKit 297779: 24 px) — низ совпадает, сдвигаем только шапку', () => {
    expect(viewportShift({ ...base, offsetTop: 24, height: 850 })).toEqual({ top: 24, bottom: 0 });
  });

  it('«короткая» область раскладки без смещения — меню вниз не толкаем, туда iOS не рисует', () => {
    expect(viewportShift({ ...base, height: 874, layoutHeight: 812 })).toEqual({ top: 0, bottom: 0 });
  });

  it('клавиатура или масштаб — iOS двигает область сама, не вмешиваемся', () => {
    expect(viewportShift({ ...base, offsetTop: 200, height: 500, typing: true })).toEqual({ top: 0, bottom: 0 });
    expect(viewportShift({ ...base, offsetTop: 200, scale: 1.6 })).toEqual({ top: 0, bottom: 0 });
  });
});
