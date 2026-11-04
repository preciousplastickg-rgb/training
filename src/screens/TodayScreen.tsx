import { CalendarDays, Settings as SettingsIcon } from 'lucide-react';
import { navigate } from '../app/router';
import { EmptyState } from '../components/EmptyState';
import { ScreenHeader } from '../components/ScreenHeader';
import { formatWeekdayDate } from '../domain/format';
import { today } from '../domain/dates';

export function TodayScreen() {
  return (
    <>
      <ScreenHeader
        title={formatWeekdayDate(today())}
        subtitle="Подготовка · старт 9 ноября"
        action={
          <button
            type="button"
            aria-label="Настройки"
            onClick={() => navigate('settings')}
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-muted active:bg-track"
          >
            <SettingsIcon size={22} />
          </button>
        }
      />
      <div className="flex flex-col gap-3 px-4 pb-6">
        <EmptyState icon={CalendarDays} text="Здесь будет план на день" hint="Карточки пути, тренировки и питания — этап 5" />
      </div>
    </>
  );
}
