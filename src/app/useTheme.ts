import { useEffect } from 'react';
import type { Theme } from '../db/types';

const BG: Record<'light' | 'dark', string> = { light: '#F4F5F7', dark: '#131518' };

/**
 * Ставит data-theme на <html>; 'system' — без атрибута, решает prefers-color-scheme.
 * theme-color в <head> следует за выбором: иначе при ручной тёмной теме строка состояния остаётся светлой.
 */
export function useApplyTheme(theme: Theme | undefined): void {
  useEffect(() => {
    const root = document.documentElement;
    const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    if (!theme || theme === 'system') {
      root.removeAttribute('data-theme');
      metas.forEach((m) => m.setAttribute('content', m.media.includes('dark') ? BG.dark : BG.light));
    } else {
      root.setAttribute('data-theme', theme);
      metas.forEach((m) => m.setAttribute('content', BG[theme]));
    }
  }, [theme]);
}
