import { ChartLine } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { ScreenHeader } from '../components/ScreenHeader';

export function ProgressScreen() {
  return (
    <>
      <ScreenHeader title="Прогресс" />
      <div className="px-4 pb-6">
        <EmptyState icon={ChartLine} text="Запиши вес 3 дня — появится среднее" hint="Графики и календарь дисциплины — этап 8" />
      </div>
    </>
  );
}
