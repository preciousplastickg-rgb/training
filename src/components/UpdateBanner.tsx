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
    // Над плавающим нижним меню (70 px + 26 px), не поверх него.
    <div role="status" className="vv-bottom fixed inset-x-4 bottom-[calc(6.75rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-xl items-center gap-2 rounded-full bg-primary py-2 pr-2 pl-4 text-on-primary">
      <RefreshCw size={20} aria-hidden />
      <span className="flex-1 text-sm font-semibold">Доступна новая версия</span>
      <button type="button" onClick={() => setNeedRefresh(false)} className="min-h-11 px-2 text-sm font-bold opacity-70">
        Позже
      </button>
      <button type="button" onClick={() => void updateServiceWorker(true)} className="min-h-11 rounded-full bg-[#111214] px-4 text-sm font-extrabold text-primary">
        Обновить
      </button>
    </div>
  );
}
