import { Dumbbell } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { ScreenHeader } from '../components/ScreenHeader';

export function WorkoutScreen() {
  return (
    <>
      <ScreenHeader title="Тренировка" />
      <div className="px-4 pb-6">
        <EmptyState icon={Dumbbell} text="Программа и упражнения появятся здесь" hint="Этап 2 — программа, этап 3 — режим тренировки" />
      </div>
    </>
  );
}
