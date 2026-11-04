import { useEffect, useLayoutEffect, useState } from 'react';
import { AddMenu } from '../components/AddMenu';
import { BottomNav } from '../components/BottomNav';
import { PoolSheet, WeightSheet } from '../components/RecordSheets';
import { UpdateBanner } from '../components/UpdateBanner';
import { DEFAULT_SETTINGS } from '../db/db';
import { seedIfNeeded } from '../db/repo';
import { prefetchData, useBody, useSettings } from '../hooks/useData';
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
  const settings = useSettings();
  const sheet = useGlobalSheet();
  const date = useToday();
  const body = useBody();

  useEffect(() => {
    void seedIfNeeded()
      .then(prefetchData)
      .then(() => setReady(true));
    void requestPersistentStorage().then(setPersisted);
  }, []);

  // До отрисовки нового экрана — иначе на кадр виден старый скролл. Фигурные скобки нужны:
  // в новых браузерах scrollTo возвращает Promise, и React принял бы его за функцию очистки.
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

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
