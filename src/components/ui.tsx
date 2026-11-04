import { Minus, Plus } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`block w-full rounded-2xl bg-surface p-4 text-left shadow-[0_1px_2px_rgb(0_0_0/0.04)] active:opacity-80 ${className}`}>
        {children}
      </button>
    );
  }
  return <section className={`rounded-2xl bg-surface p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)] ${className}`}>{children}</section>;
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'md' | 'lg' | 'sm' }) {
  const v: Record<Variant, string> = {
    primary: 'bg-primary text-on-primary',
    secondary: 'bg-surface-2 text-ink',
    ghost: 'text-accent',
    danger: 'bg-danger/10 text-danger',
  };
  const s = size === 'lg' ? 'min-h-14 px-6 text-base' : size === 'sm' ? 'min-h-11 px-3 text-sm' : 'min-h-12 px-4 text-base';
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-[transform,opacity] active:scale-[0.98] disabled:opacity-40 ${v[variant]} ${s} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function IconButton({ label, children, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted active:bg-track ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Степпер ±: крупные кнопки (в режиме тренировки — 56 px). */
export function Stepper({
  value,
  onDec,
  onInc,
  label,
  big = false,
  unit,
}: {
  value: ReactNode;
  onDec: () => void;
  onInc: () => void;
  label: string;
  big?: boolean;
  unit?: string;
}) {
  const btn = big ? 'h-14 w-14' : 'h-11 w-11';
  return (
    <div className="flex items-center gap-1">
      <button type="button" aria-label={`${label}: меньше`} onClick={onDec} className={`${btn} flex shrink-0 items-center justify-center rounded-xl bg-surface-2 active:scale-95`}>
        <Minus size={big ? 22 : 18} aria-hidden />
      </button>
      <div className={`min-w-0 flex-1 text-center font-semibold tabular-nums ${big ? 'text-[22px]' : 'text-lg'}`} aria-label={label}>
        {value}
        {unit && <span className="ml-0.5 text-xs font-normal text-muted">{unit}</span>}
      </div>
      <button type="button" aria-label={`${label}: больше`} onClick={onInc} className={`${btn} flex shrink-0 items-center justify-center rounded-xl bg-surface-2 active:scale-95`}>
        <Plus size={big ? 22 : 18} aria-hidden />
      </button>
    </div>
  );
}

export function Chip({
  active = false,
  children,
  onClick,
  className = '',
  ...rest
}: { active?: boolean; children: ReactNode; onClick?: () => void; className?: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium ${
        active ? 'bg-primary text-on-primary' : 'bg-surface-2 text-ink'
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string }[] }) {
  return (
    <div role="tablist" className="flex gap-1 rounded-2xl bg-surface-2 p-1">
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={`min-h-11 min-w-0 flex-auto whitespace-nowrap rounded-xl px-2 text-sm font-medium ${value === it.value ? 'bg-surface text-ink shadow-sm' : 'text-muted'}`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function Bar({ value, color = 'var(--progress)', height = 8, label }: { value: number; color?: string; height?: number; label?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="w-full overflow-hidden rounded-full bg-track" style={{ height }} role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-[width] duration-400 ease-out" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function Field({
  label,
  suffix,
  ...rest
}: { label: string; suffix?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-muted">{label}</span>
      <span className="flex min-h-12 items-center rounded-xl border border-line bg-surface px-3 focus-within:border-accent">
        <input className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none" {...rest} />
        {suffix && <span className="text-sm text-muted">{suffix}</span>}
      </span>
    </label>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 className="text-sm font-semibold text-muted">{children}</h2>
      {action}
    </div>
  );
}
