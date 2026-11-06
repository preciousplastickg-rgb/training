import type { ReactNode } from 'react';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  leading?: ReactNode;
}

export function ScreenHeader({ title, subtitle, action, leading }: ScreenHeaderProps) {
  return (
    <header className="vv-top pt-safe sticky top-0 z-10 bg-bg/95 backdrop-blur">
      <div className="flex min-h-14 items-center gap-2 px-4 py-2">
        {leading}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold">{title}</h1>
          {/* Строка подзаголовка есть всегда: заголовок стоит на одной высоте на всех экранах, без прыжка при переключении. */}
          <p className="truncate text-sm text-muted">{subtitle ?? '\u00a0'}</p>
        </div>
        {action}
      </div>
    </header>
  );
}
