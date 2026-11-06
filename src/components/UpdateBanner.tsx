import { RefreshCw } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Новая версия не подменяется сама посреди тренировки: показываем плашку,
 * обновление — по нажатию.
 */
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    // iOS проверяет обновление только при запуске; приложение же обычно возвращается из фона.
    // Проверяем при каждом возврате и раз в час — плашка появится без перезапуска.
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const check = () => {
        if (document.visibilityState === 'visible' && navigator.onLine) reg.update().catch(() => {});
      };
      document.addEventListener('visibilitychange', check);
      setInterval(check, 60 * 60 * 1000);
    },
  });

  if (!needRefresh) return null;

  return (
    <div role="status" className="vv-bottom fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-xl items-center gap-3 rounded-2xl bg-primary px-4 py-2 text-on-primary shadow-lg">
      <RefreshCw size={20} aria-hidden />
      <span className="flex-1 text-sm">Доступна новая версия</span>
      <button type="button" onClick={() => setNeedRefresh(false)} className="min-h-11 px-2 text-sm opacity-80">
        Позже
      </button>
      <button type="button" onClick={() => void updateServiceWorker(true)} className="min-h-11 rounded-xl bg-white/15 px-3 text-sm font-semibold">
        Обновить
      </button>
    </div>
  );
}
