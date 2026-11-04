import { useEffect, useState } from 'react';
import { AddMenu } from '../components/AddMenu';
import { BottomNav } from '../components/BottomNav';
import { UpdateBanner } from '../components/UpdateBanner';
import { db, ensureSettings } from '../db/db';
import { useLiveQuery } from '../db/useLiveQuery';
import { NutritionScreen } from '../screens/NutritionScreen';
import { ProgressScreen } from '../screens/ProgressScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { TodayScreen } from '../screens/TodayScreen';
import { WorkoutScreen } from '../screens/WorkoutScreen';
import { useRoute } from './router';
import { requestPersistentStorage } from './storage';
import { useApplyTheme } from './useTheme';

export function App() {
  const route = useRoute();
  const [addOpen, setAddOpen] = useState(false);
  const [persisted, setPersisted] = useState<boolean>();
  const settings = useLiveQuery(() => db.settings.get('main'), []);

  useEffect(() => {
    void ensureSettings();
    void requestPersistentStorage().then(setPersisted);
  }, []);

  useEffect(() => window.scrollTo(0, 0), [route]);

  useApplyTheme(settings?.theme);

  return (
    <div className="mx-auto min-h-full max-w-xl pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      <main>
        {route === 'today' && <TodayScreen />}
        {route === 'workout' && <WorkoutScreen />}
        {route === 'nutrition' && <NutritionScreen />}
        {route === 'progress' && <ProgressScreen />}
        {route === 'settings' && <SettingsScreen settings={settings} persisted={persisted} />}
      </main>
      <BottomNav route={route} onAdd={() => setAddOpen(true)} />
      <AddMenu open={addOpen} onClose={() => setAddOpen(false)} />
      <UpdateBanner />
    </div>
  );
}
