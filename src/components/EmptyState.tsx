import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  text: string;
  hint?: string;
}

/** Пустое состояние — одна фраза, что сделать (SPEC 9). */
export function EmptyState({ icon: Icon, text, hint }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[26px] bg-surface px-6 py-10 text-center">
      <Icon size={32} className="text-muted" aria-hidden />
      <p className="text-base">{text}</p>
      {hint && <p className="text-sm text-muted">{hint}</p>}
    </div>
  );
}
