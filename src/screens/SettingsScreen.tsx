import { ChevronLeft, MonitorSmartphone, Moon, Sun, type LucideIcon } from 'lucide-react';
import { navigate } from '../app/router';
import { ScreenHeader } from '../components/ScreenHeader';
import { updateSettings } from '../db/db';
import type { Settings, Theme } from '../db/types';

const THEMES: { value: Theme; label: string; icon: LucideIcon }[] = [
  { value: 'system', label: 'Как в системе', icon: MonitorSmartphone },
  { value: 'light', label: 'Светлая', icon: Sun },
  { value: 'dark', label: 'Тёмная', icon: Moon },
];

interface SettingsScreenProps {
  settings: Settings | undefined;
  persisted: boolean | undefined;
}

export function SettingsScreen({ settings, persisted }: SettingsScreenProps) {
  return (
    <>
      <ScreenHeader
        title="Настройки"
        leading={
          <button
            type="button"
            aria-label="Назад"
            onClick={() => navigate('today')}
            className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full active:bg-track"
          >
            <ChevronLeft size={26} />
          </button>
        }
      />
      <div className="flex flex-col gap-4 px-4 pb-6">
        <section className="rounded-2xl bg-surface p-4">
          <h2 className="mb-3 text-sm font-medium text-muted">Тема</h2>
          <div role="radiogroup" aria-label="Тема" className="grid grid-cols-3 gap-2">
            {THEMES.map(({ value, label, icon: Icon }) => {
              const checked = settings?.theme === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  onClick={() => void updateSettings({ theme: value })}
                  className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border text-sm ${
                    checked ? 'border-primary bg-primary text-on-primary' : 'border-line text-ink'
                  }`}
                >
                  <Icon size={20} aria-hidden />
                  {label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl bg-surface p-4 text-sm">
          <h2 className="mb-2 font-medium text-muted">Данные</h2>
          <p>
            Хранилище:{' '}
            {persisted === undefined ? '…' : persisted ? 'постоянное' : 'обычное — iOS может очистить при нехватке места'}
          </p>
        </section>

        <section className="rounded-2xl bg-surface p-4 text-sm">
          <h2 className="mb-2 font-medium text-muted">О приложении</h2>
          <p>Тренировки и питание · версия {__APP_VERSION__}</p>
          <p className="mt-1 text-muted">Шрифт: IBM Plex Sans, SIL Open Font License 1.1</p>
        </section>
      </div>
    </>
  );
}
