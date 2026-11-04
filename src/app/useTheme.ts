import { useEffect } from 'react';
import type { Theme } from '../db/types';

/** Ставит data-theme на <html>; 'system' — без атрибута, решает prefers-color-scheme. */
export function useApplyTheme(theme: Theme | undefined): void {
  useEffect(() => {
    const root = document.documentElement;
    if (!theme || theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);
}
