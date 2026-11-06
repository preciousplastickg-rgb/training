import type { ReactNode } from 'react';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  leading?: ReactNode;
}

/** Шапка экрана: заголовок Unbounded 28/34 (REDESIGN 1.2), подзаголовок капсом. */
export function ScreenHeader({ title, subtitle, action, leading }: ScreenHeaderProps) {
  return (
    <header className="vv-top pt-safe sticky top-0 z-10 bg-bg/95 backdrop-blur">
      <div className="flex min-h-14 items-center gap-2 px-5 py-2">
        {leading}
        <div className="min-w-0 flex-1">
          {/* Строка подзаголовка есть всегда: заголовок стоит на одной высоте на всех экранах, без прыжка при переключении. */}
          <p className="caps truncate text-muted">{subtitle ?? ' '}</p>
          {/* Длинный заголовок («Пятница, 6 ноября») — мельче, чтобы не обрезался: Unbounded широкий. */}
          <h1 className={`font-display truncate font-bold ${title.length > 12 ? 'text-[22px] leading-[30px]' : 'text-[28px] leading-[34px]'}`}>{title}</h1>
        </div>
        {action}
      </div>
    </header>
  );
}
