import { Utensils } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { ScreenHeader } from '../components/ScreenHeader';

export function NutritionScreen() {
  return (
    <>
      <ScreenHeader title="Питание" />
      <div className="px-4 pb-6">
        <EmptyState icon={Utensils} text="Добавь первый приём пищи — появятся кольца КБЖУ" hint="Дневник питания — этап 6" />
      </div>
    </>
  );
}
