import { useEffect, useState } from 'react';
import { AddMenu } from '../components/AddMenu';
import { BottomNav } from '../components/BottomNav';
import { PoolSheet, WeightSheet } from '../components/RecordSheets';
import { UpdateBanner } from '../components/UpdateBanner';
import { db, DEFAULT_SETTINGS } from '../db/db';
import { seedIfNeeded } from '../db/repo';
import { useLiveQuery } from '../db/useLiveQuery';
import { useBody } from '../hooks/useData';
import { useToday } from '../hooks/useToday';
import { DevAnimations } from '../screens/dev/DevAnimations';
import { DevSeed } from '../screens/dev/DevSeed';
import { NutritionScreen } from '../screens/NutritionScreen';
import { Onboarding } from '../screens/Onboarding';
import { ProgressScreen } from '../screens/ProgressScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { TodayScreen } from '../screens/TodayScreen';
import { WorkoutScreen } from '../screens/WorkoutScreen';
import { SessionScreen } from '../screens/workout/SessionScreen';
import { useRoute } from './router';
import { requestPersistentStorage } from './storage';
import { openSheet, useGlobalSheet } from './uiStore';
import { useApplyTheme } from './useTheme';

export function App() {
  const route = useRoute();
  const [addOpen, setAddOpen] = useState(false);
  const [persisted, setPersisted] = useState<boolean>();
  const [ready, setReady] = useState(false);
  const settings = useLiveQuery(() => db.settings.get('main'), []);
  const sheet = useGlobalSheet();
  const date = useToday();
  const body = useBody();

  useEffect(() => {
    void seedIfNeeded().then(() => setReady(true));
    void requestPersistentStorage().then(setPersisted);
  }, []);

  useEffect(() => window.scrollTo(0, 0), [route]);

  useApplyTheme(settings?.theme);

  if (!ready || !settings) return <UpdateBanner />;
  if (!settings.onboarded && !route.startsWith('dev/')) {
    return (
      <>
        <Onboarding settings={settings} />
        <UpdateBanner />
      </>
    );
  }

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
        {route === 'dev/seed' && <DevSeed />}
      </main>
      {route !== 'session' && <BottomNav route={route} onAdd={() => setAddOpen(true)} />}
      <AddMenu open={addOpen} onClose={() => setAddOpen(false)} />
      <WeightSheet open={sheet === 'weight'} onClose={() => openSheet(null)} date={date} body={body} heightCm={settings.heightCm ?? DEFAULT_SETTINGS.heightCm} />
      <PoolSheet open={sheet === 'pool'} onClose={() => openSheet(null)} date={date} />
      <UpdateBanner />
    </div>
  );
}
