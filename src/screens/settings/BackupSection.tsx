import { Download, Image as ImageIcon, Upload } from 'lucide-react';
import { useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/ui';
import { updateSettings } from '../../db/db';
import { backupFileName, exportBackup, exportPhotosZip, parseBackup, replaceAll, shareOrDownload, type ParseResult, type TableName } from '../../db/backup';
import type { Settings } from '../../db/types';
import { toLocalDate } from '../../domain/dates';
import { formatDayMonth } from '../../domain/format';

const LABELS: Partial<Record<TableName, string>> = {
  sessions: 'тренировок',
  sets: 'подходов',
  pool: 'бассейнов',
  body: 'записей веса и замеров',
  foodLog: 'записей еды',
  foods: 'продуктов',
  adjustments: 'корректировок',
};

async function exportNow(): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const backup = await exportBackup();
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const r = await shareOrDownload(blob, backupFileName());
  if (r !== 'cancelled') await updateSettings({ lastBackupAt: Date.now() });
  return r;
}

/** Строки группы «Данные»: бэкап, фото, импорт; статус хранилища под ними. */
export function BackupRows({ settings, persisted }: { settings: Settings; persisted: boolean | undefined }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [step, setStep] = useState<'preview' | 'saving' | 'unsaved'>('preview');

  const doReplace = async () => {
    if (!parsed?.ok) return;
    await replaceAll(parsed.backup);
    location.reload();
  };

  const row = 'flex min-h-[58px] w-full items-center gap-3 border-t border-line px-[22px] text-left active:bg-track';
  return (
    <>
      <button
        type="button"
        aria-label="Экспорт данных (JSON)"
        className={row}
        onClick={async () => {
          const r = await exportNow();
          setMsg(r === 'cancelled' ? null : 'Бэкап сохранён');
        }}
      >
        <span className="flex-1 text-[16px] font-semibold">Бэкап в «Файлы»</span>
        <span className="text-[15px] text-muted">{settings.lastBackupAt ? formatDayMonth(toLocalDate(settings.lastBackupAt)) : 'ещё не было'}</span>
        <Download size={16} className="text-muted" aria-hidden />
      </button>
      <button
        type="button"
        className={row}
        onClick={async () => {
          const zip = await exportPhotosZip();
          if (!zip) return setMsg('Фото пока нет');
          const r = await shareOrDownload(zip, `fitness-photos-${toLocalDate(Date.now())}.zip`);
          if (r !== 'cancelled') setMsg('Фото сохранены');
        }}
      >
        <span className="flex-1 text-[16px] font-semibold">Фото (zip)</span>
        <ImageIcon size={16} className="text-muted" aria-hidden />
      </button>
      <label className={`${row} cursor-pointer`}>
        <span className="flex-1 text-[16px] font-semibold">Импорт из файла</span>
        <Upload size={16} className="text-muted" aria-hidden />
        <input
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            setStep('preview');
            setParsed(parseBackup(await f.text()));
          }}
        />
      </label>
      <p className="border-t border-line px-[22px] py-3 text-xs text-muted">
        {msg && (
          <span className="block font-bold text-ink" role="status">
            {msg}
          </span>
        )}
        JSON — все данные, кроме фото; сохрани в «Файлы» → iCloud Drive. Хранилище{' '}
        {persisted === undefined ? '…' : persisted ? 'постоянное' : 'обычное (iOS может очистить при нехватке места)'}.
      </p>
      <Sheet open={!!parsed} title="Импорт бэкапа" onClose={() => setParsed(null)}>
        <div className="flex flex-col gap-3 px-2 pb-2">
          {parsed && !parsed.ok && <p className="text-danger">{parsed.error}</p>}
          {parsed?.ok && (
            <>
              <p>
                Бэкап от <b>{formatDayMonth(toLocalDate(parsed.backup.exportedAt))}</b>:
              </p>
              <ul className="rounded-xl bg-surface-2 p-3 text-sm">
                {(Object.keys(LABELS) as TableName[]).map((k) => (
                  <li key={k}>
                    {parsed.counts[k]} {LABELS[k]}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-muted">Текущие данные (кроме фото) будут заменены. Перед заменой сохраним их копию.</p>
              {step === 'unsaved' ? (
                <>
                  <p className="text-sm text-warn">Копия текущих данных не сохранена.</p>
                  <Button size="lg" variant="danger" onClick={() => void doReplace()}>
                    Заменить без копии
                  </Button>
                </>
              ) : (
                <Button
                  size="lg"
                  disabled={step === 'saving'}
                  onClick={async () => {
                    setStep('saving');
                    const r = await exportNow();
                    if (r === 'cancelled') setStep('unsaved');
                    else await doReplace();
                  }}
                >
                  Заменить всё
                </Button>
              )}
              <Button variant="secondary" size="lg" onClick={() => setParsed(null)}>
                Отмена
              </Button>
            </>
          )}
        </div>
      </Sheet>
    </>
  );
}
