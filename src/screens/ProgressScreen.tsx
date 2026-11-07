import { useEffect, useState } from 'react';
import { openSheet, useGlobalSheet } from '../app/uiStore';
import { ScreenHeader } from '../components/ScreenHeader';
import { Tabs } from '../components/ui';
import { BodyTab } from './progress/BodyTab';
import { MindTab } from './progress/MindTab';
import { DisciplineTab, NutritionTab } from './progress/OtherTabs';
import { StrengthTab } from './progress/StrengthTab';

type Tab = 'body' | 'strength' | 'mind' | 'nutrition' | 'discipline';

export function ProgressScreen() {
  const [tab, setTab] = useState<Tab>('body');
  const global = useGlobalSheet();
  // «+ → Сон и медитация» с любого экрана: сразу вкладка «Разум».
  useEffect(() => {
    if (global === 'mind') {
      setTab('mind');
      openSheet(null);
    }
  }, [global]);
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
            { value: 'mind', label: 'Разум' },
            { value: 'nutrition', label: 'Питание' },
            { value: 'discipline', label: 'Режим' },
          ]}
        />
        {tab === 'body' && <BodyTab />}
        {tab === 'strength' && <StrengthTab />}
        {tab === 'mind' && <MindTab />}
        {tab === 'nutrition' && <NutritionTab />}
        {tab === 'discipline' && <DisciplineTab />}
      </div>
    </>
  );
}
