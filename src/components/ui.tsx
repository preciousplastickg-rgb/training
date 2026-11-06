// Общие компоненты — редизайн «Энергия», вариант B (docs/design/REDESIGN.md 1.3):
// карточки 26 px без теней, кнопки и таблетки полностью скруглённые, лаймовый главный CTA,
// кнопки ± круглые на --track, капс-метки 12/800.

import { Minus, Plus } from 'lucide-react';
import { useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';

export function Card({ children, className = '', onClick, style }: { children: ReactNode; className?: string; onClick?: () => void; style?: CSSProperties }) {
  if (onClick) {
    // Не <button>: внутри карточки заголовки и абзацы, в кнопке им нельзя. role=button + клавиатура.
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        style={style}
        className={`block w-full cursor-pointer rounded-[26px] bg-surface p-4 text-left active:opacity-80 ${className}`}
      >
        {children}
      </div>
    );
  }
  return (
    <section style={style} className={`rounded-[26px] bg-surface p-4 ${className}`}>
      {children}
    </section>
  );
}

/** Тёмная карточка-«герой» (тренировка дня, итоги питания, профиль): `--hero`, белый текст, акцент лаймом. */
export function HeroCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[28px] border border-hero-line bg-hero p-5 text-white ${className}`}>{children}</section>;
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark';

/**
 * Кнопка-таблетка. `primary` — лайм, 58 px (`lg`) для главного действия экрана;
 * `secondary` — на дорожке `--track`; `surface` в className — белая таблетка на фоне `--bg`.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'md' | 'lg' | 'sm' }) {
  const v: Record<Variant, string> = {
    primary: 'bg-primary text-on-primary font-extrabold',
    secondary: 'bg-track text-ink font-bold',
    ghost: 'text-accent font-bold',
    danger: 'bg-danger/10 text-danger font-bold',
    /** Вторичная кнопка на чёрной карточке-герое. */
    dark: 'bg-[#2A2C30] text-white font-bold',
  };
  const s = size === 'lg' ? 'min-h-[58px] px-6 text-[17px]' : size === 'sm' ? 'min-h-11 px-4 text-sm' : 'min-h-12 px-5 text-[15px]';
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-full transition-[transform,opacity] active:scale-[0.98] disabled:opacity-40 ${v[variant]} ${s} ${className}`}
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

/**
 * Степпер ±: круглые кнопки 48 px, в режиме тренировки (`big`) — 56 px.
 * С `onEdit` число можно и набрать: тап по нему открывает ввод, Enter или уход из поля — сохраняет.
 */
export function Stepper({
  value,
  onDec,
  onInc,
  label,
  big = false,
  unit,
  onEdit,
  editValue,
}: {
  value: ReactNode;
  onDec: () => void;
  onInc: () => void;
  label: string;
  big?: boolean;
  unit?: string;
  onEdit?: (raw: string) => void;
  /** Текст в поле ввода, если `value` — не строка и не число. */
  editValue?: string;
}) {
  const btn = big ? 'h-14 w-14' : 'h-12 w-12';
  const [editing, setEditing] = useState(false);
  const text = `font-display ${big ? 'text-[26px]' : 'text-[22px]'} font-bold tabular-nums`;
  const initial = editValue ?? (typeof value === 'string' || typeof value === 'number' ? String(value) : '');
  const commit = (raw: string) => {
    setEditing(false);
    onEdit?.(raw);
  };
  return (
    <div className="flex items-center gap-1">
      <button type="button" aria-label={`${label}: меньше`} onClick={onDec} className={`${btn} flex shrink-0 items-center justify-center rounded-full bg-track active:scale-95`}>
        <Minus size={big ? 22 : 20} strokeWidth={2.4} aria-hidden />
      </button>
      {editing ? (
        <input
          autoFocus
          inputMode="decimal"
          enterKeyHint="done"
          aria-label={label}
          defaultValue={initial}
          onFocus={(e) => e.target.select()}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className={`min-w-0 flex-1 border-b-2 border-accent bg-transparent text-center outline-none ${text}`}
        />
      ) : onEdit ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`${label}: ввести число`}
          className={`min-h-11 min-w-0 flex-1 rounded-2xl text-center active:bg-track ${text}`}
        >
          {value}
          {unit && <span className="ml-1 font-sans text-sm font-bold text-muted">{unit}</span>}
        </button>
      ) : (
        <div className={`min-w-0 flex-1 text-center ${text}`} aria-label={label}>
          {value}
          {unit && <span className="ml-1 font-sans text-sm font-bold text-muted">{unit}</span>}
        </div>
      )}
      <button type="button" aria-label={`${label}: больше`} onClick={onInc} className={`${btn} flex shrink-0 items-center justify-center rounded-full bg-track active:scale-95`}>
        <Plus size={big ? 22 : 20} strokeWidth={2.4} aria-hidden />
      </button>
    </div>
  );
}

/** Таблетка-переключатель: активная — лайм. */
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
      className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-bold ${
        active ? 'bg-primary text-on-primary' : 'bg-track text-ink'
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/**
 * Вкладки. `pill` (Прогресс): белая подложка, активная — чёрная с лаймовым текстом.
 * `lime` (переключатель в «Как делать»): подложка `--surface-2`, активная — лайм.
 */
export function Tabs<T extends string>({
  value, onChange, items, variant = 'pill',
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: string }[];
  variant?: 'pill' | 'lime';
}) {
  const box = variant === 'lime' ? 'bg-surface-2' : 'bg-surface';
  const on = variant === 'lime' ? 'bg-primary text-on-primary font-extrabold' : 'bg-ink text-primary font-bold';
  return (
    <div role="tablist" className={`flex gap-1 rounded-full p-1 ${box}`}>
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={`min-h-11 min-w-0 flex-auto whitespace-nowrap rounded-full px-2 text-sm transition-colors ${value === it.value ? on : 'font-semibold text-muted'}`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function Bar({
  value, color = 'var(--progress)', overColor, height = 8, label,
}: {
  value: number;
  color?: string;
  /** Цвет при значении выше 100% — перебор виден, а не выглядит как «выполнено». */
  overColor?: string;
  height?: number;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="w-full overflow-hidden rounded-full bg-track" style={{ height }} role="progressbar" aria-label={label} aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-[width] duration-400 ease-out" style={{ width: `${pct}%`, background: overColor && value > 1 ? overColor : color }} />
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
      <span className="flex min-h-12 items-center rounded-2xl border border-line bg-surface px-4 focus-within:border-ink">
        <input className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none" {...rest} />
        {suffix && <span className="text-sm text-muted">{suffix}</span>}
      </span>
    </label>
  );
}

/** Удаление в два тапа без отдельной шторки: «Удалить…» → «Точно удалить? Да / Нет». */
export function ConfirmDelete({ label, note, onConfirm, className = '' }: { label: string; note?: string; onConfirm: () => void | Promise<void>; className?: string }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <Button variant="danger" className={className} onClick={() => setAsking(true)}>
        {label}
      </Button>
    );
  }
  return (
    <div className={`rounded-[22px] bg-danger/10 p-3 ${className}`} role="alertdialog" aria-label="Подтверждение удаления">
      <p className="mb-2 text-sm font-bold text-danger">Точно удалить?{note ? ` ${note}` : ''}</p>
      <div className="flex gap-2">
        <Button variant="danger" className="flex-1 bg-danger text-white" onClick={() => void onConfirm()}>
          Да, удалить
        </Button>
        <Button variant="secondary" className="flex-1" onClick={() => setAsking(false)}>
          Нет
        </Button>
      </div>
    </div>
  );
}

/** Капс-метка: «КАЛОРИИ», «В НИЖНЕЙ ТОЧКЕ». Текст передавать в обычном регистре — капс делает CSS. */
export function Caps({ children, className = '', as: Tag = 'p' }: { children: ReactNode; className?: string; as?: 'p' | 'h2' | 'h3' | 'span' }) {
  return <Tag className={`caps text-muted ${className}`}>{children}</Tag>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between px-1">
      <Caps as="h2">{children}</Caps>
      {action}
    </div>
  );
}
