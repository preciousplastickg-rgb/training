// Заметка к упражнению («наклон скамьи 30°, сиденье 4»): строка в «Как делать», правка в шторке;
// в тренировке видна третьей строкой шапки. Одна на упражнение, таблица exerciseNotes (схема v2), попадает в бэкап.

import { StickyNote } from 'lucide-react';
import { useState } from 'react';
import { putExerciseNote } from '../db/repo';
import { useExerciseNotes } from '../hooks/useData';
import { Sheet } from './Sheet';
import { Button } from './ui';

export function ExerciseNoteRow({ exerciseId, name }: { exerciseId: string; name: string }) {
  const note = useExerciseNotes().find((n) => n.exerciseId === exerciseId);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={note ? 'Заметка: изменить' : 'Добавить заметку'}
        className="flex min-h-14 w-full items-center gap-3 text-left text-[15px] active:opacity-70"
      >
        <StickyNote size={18} strokeWidth={2.2} className="shrink-0 text-muted" aria-hidden />
        {note ? <span className="flex-1 leading-5">{note.text}</span> : <span className="flex-1 text-muted">Заметка: наклон, сиденье, хват…</span>}
      </button>
      {open && <NoteSheet exerciseId={exerciseId} name={name} initial={note?.text ?? ''} onClose={() => setOpen(false)} />}
    </>
  );
}

function NoteSheet({ exerciseId, name, initial, onClose }: { exerciseId: string; name: string; initial: string; onClose: () => void }) {
  const [text, setText] = useState(initial);
  const save = async () => {
    await putExerciseNote(exerciseId, text);
    onClose();
  };
  return (
    <Sheet open title="Заметка" kicker={name} onClose={onClose}>
      <div className="flex flex-col gap-3 pb-2">
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Наклон скамьи 30°, сиденье 4, хват на ширине колец"
          aria-label="Текст заметки"
          className="w-full resize-none rounded-[22px] border border-line bg-surface px-4 py-3 text-base leading-6 text-ink placeholder:text-muted focus:border-ink"
          style={{ outline: 'none' }}
        />
        <p className="px-1 text-xs text-muted">В тренировке покажется под названием упражнения. Пустая — удаляется.</p>
        <Button size="lg" onClick={() => void save()}>
          Сохранить
        </Button>
      </div>
    </Sheet>
  );
}
