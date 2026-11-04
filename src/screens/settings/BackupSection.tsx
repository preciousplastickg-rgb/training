import type { Settings } from '../../db/types';

export function BackupSection({ persisted }: { settings: Settings; persisted: boolean | undefined }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-sm font-semibold text-muted">Данные</h2>
      <div className="rounded-2xl bg-surface p-4 text-sm">
        Хранилище: {persisted === undefined ? '…' : persisted ? 'постоянное' : 'обычное — iOS может очистить при нехватке места'}
      </div>
    </section>
  );
}
