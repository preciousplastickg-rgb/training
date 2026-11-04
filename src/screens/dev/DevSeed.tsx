import { ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import { DEV_TODAY_KEY } from '../../app/clock';
import { navigate } from '../../app/router';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Button, Card } from '../../components/ui';
import { db, ensureSettings, updateSettings } from '../../db/db';
import { formatDayMonth } from '../../domain/format';
import { SEED_TODAY, generateSeed } from '../../dev/seedData';

/** `npm run seed` — только dev: 8 недель данных (SPEC 10). */
export function DevSeed() {
  const [status, setStatus] = useState<string | null>(null);
  if (!import.meta.env.DEV) {
    return <p className="p-6">Демо-данные доступны только в режиме разработки.</p>;
  }
  const run = async () => {
    setStatus('Заполняю…');
    const settings = await ensureSettings();
    const seed = generateSeed(settings);
    await db.transaction('rw', [db.sessions, db.sets, db.pool, db.body, db.foodLog, db.adjustments, db.photos, db.kv], async () => {
      await Promise.all([db.sessions.clear(), db.sets.clear(), db.pool.clear(), db.body.clear(), db.foodLog.clear(), db.adjustments.clear(), db.photos.clear()]);
      await db.kv.where('key').anyOf(['restTimer', 'silhouette:last']).delete();
      await db.sessions.bulkAdd(seed.sessions);
      await db.sets.bulkAdd(seed.sets);
      await db.pool.bulkAdd(seed.pool);
      await db.body.bulkAdd(seed.body);
      await db.foodLog.bulkAdd(seed.foodLog);
    });
    await updateSettings({ onboarded: true, startWeight: 8100, targetWeight: 7300 });
    localStorage.setItem(DEV_TODAY_KEY, SEED_TODAY);
    setStatus(`Готово: ${seed.sessions.length} тренировок, ${seed.sets.length} подходов, ${seed.body.length} записей тела. «Сегодня» = ${formatDayMonth(SEED_TODAY)}. Перезагрузи страницу.`);
  };
  return (
    <>
      <ScreenHeader
        title="Демо-данные"
        leading={
          <button type="button" aria-label="Назад" onClick={() => navigate('settings')} className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full active:bg-track">
            <ChevronLeft size={26} />
          </button>
        }
      />
      <div className="flex flex-col gap-3 px-4">
        <Card>
          <p>8 недель с 9 ноября: тренировки с прогрессией, вес с трендом −0,55 кг/нед, питание (85% дней в цели), 2 пропуска.</p>
          <p className="mt-2 text-sm text-warn">Текущие тренировки, вес, питание и фото будут стёрты.</p>
          <Button size="lg" className="mt-3 w-full" onClick={() => void run()}>
            Заполнить
          </Button>
          <Button variant="secondary" className="mt-2 w-full" onClick={() => (localStorage.removeItem(DEV_TODAY_KEY), location.reload())}>
            Вернуть реальную дату
          </Button>
        </Card>
        {status && <Card>{status}</Card>}
      </div>
    </>
  );
}
