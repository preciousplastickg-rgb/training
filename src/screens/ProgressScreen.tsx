import { useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Tabs } from '../components/ui';
import { BodyTab } from './progress/BodyTab';
import { DisciplineTab, NutritionTab } from './progress/OtherTabs';
import { StrengthTab } from './progress/StrengthTab';

type Tab = 'body' | 'strength' | 'nutrition' | 'discipline';

export function ProgressScreen() {
  const [tab, setTab] = useState<Tab>('body');
  return (
    <>
      <ScreenHeader title="Прогресс" />
      <div className="flex flex-col gap-3 px-4 pb-6">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'body', label: 'Тело' },
            { value: 'strength', label: 'Сила' },
            { value: 'nutrition', label: 'Питание' },
            { value: 'discipline', label: 'Дисциплина' },
          ]}
        />
        {tab === 'body' && <BodyTab />}
        {tab === 'strength' && <StrengthTab />}
        {tab === 'nutrition' && <NutritionTab />}
        {tab === 'discipline' && <DisciplineTab />}
      </div>
    </>
  );
}
