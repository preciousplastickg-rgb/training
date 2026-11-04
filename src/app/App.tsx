import { useEffect, useState } from 'react';
import { AddMenu } from '../components/AddMenu';
import { BottomNav } from '../components/BottomNav';
import { UpdateBanner } from '../components/UpdateBanner';
import { db } from '../db/db';
import { seedIfNeeded } from '../db/repo';
import { useLiveQuery } from '../db/useLiveQuery';
import { NutritionScreen } from '../screens/NutritionScreen';
import { ProgressScreen } from '../screens/ProgressScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { TodayScreen } from '../screens/TodayScreen';
import { WorkoutScreen } from '../screens/WorkoutScreen';
import { DevAnimations } from '../screens/dev/DevAnimations';
import { SessionScreen } from '../screens/workout/SessionScreen';
import { useRoute } from './router';
import { requestPersistentStorage } from './storage';
import { useApplyTheme } from './useTheme';

export function App() {
  const route = useRoute();
  const [addOpen, setAddOpen] = useState(false);
  const [persisted, setPersisted] = useState<boolean>();
  const settings = useLiveQuery(() => db.settings.get('main'), []);

  useEffect(() => {
    void seedIfNeeded();
    void requestPersistentStorage().then(setPersisted);
  }, []);

  useEffect(() => window.scrollTo(0, 0), [route]);

  useApplyTheme(settings?.theme);

  return (
    <div className={`mx-auto min-h-full max-w-xl ${route === 'session' ? '' : 'pb-[calc(5rem+env(safe-area-inset-bottom))]'}`}>
      <main>
        {route === 'session' && <SessionScreen />}
        {route === 'today' && <TodayScreen />}
        {route === 'workout' && <WorkoutScreen />}
        {route === 'nutrition' && <NutritionScreen />}
        {route === 'progress' && <ProgressScreen />}
        {route === 'settings' && <SettingsScreen settings={settings} persisted={persisted} />}
        {route === 'dev/animations' && <DevAnimations />}
      </main>
      {route !== 'session' && <BottomNav route={route} onAdd={() => setAddOpen(true)} />}
      <AddMenu open={addOpen} onClose={() => setAddOpen(false)} />
      <UpdateBanner />
    </div>
  );
}
