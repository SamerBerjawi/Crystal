import React, { useEffect, useMemo, useState } from 'react';
import type { LifeEvent, LifeEventKind } from '../types';
import { Dialog } from './ui/Overlays';
import { Button, HoldButton } from './ui/Actions';
import { DateInput, Textarea, TextInput } from './ui/Fields';
import { Select } from './ui/Pickers';
import { Row } from './ui/Display';
import { EmptyState } from './ui/States';
import Icon from './ui/Icon';
import { LIFE_EVENT_KINDS, lifeEventKind, lifeEventProblem, sortLifeEvents } from '../utils/lifeEvents';
import { formatDate } from '../utils';

interface LifeEventsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  events: LifeEvent[];
  onSave: (event: Omit<LifeEvent, 'id'> & { id?: string }) => void;
  onDelete: (id: string) => void;
  /** `YYYY-MM-DD`, offered as the date of a new event. */
  today: string;
}

interface Draft { id?: string; title: string; date: string; kind: LifeEventKind; note: string }

/** Marks on the net-worth line. A list of what is there, and one small form to add or change an event. */
const LifeEventsDialog: React.FC<LifeEventsDialogProps> = ({ isOpen, onClose, events, onSave, onDelete, today }) => {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showError, setShowError] = useState(false);
  const sorted = useMemo(() => sortLifeEvents(events).reverse(), [events]);

  useEffect(() => { if (!isOpen) { setDraft(null); setShowError(false); } }, [isOpen]);

  const problem = draft ? lifeEventProblem(draft) : null;
  const startNew = () => { setShowError(false); setDraft({ title: '', date: today, kind: 'other', note: '' }); };
  const edit = (event: LifeEvent) => { setShowError(false); setDraft({ id: event.id, title: event.title, date: event.date, kind: event.kind, note: event.note ?? '' }); };

  const save = () => {
    if (!draft) return;
    if (problem) { setShowError(true); return; }
    onSave({ id: draft.id, title: draft.title.trim(), date: draft.date, kind: draft.kind, note: draft.note.trim() || undefined });
    setDraft(null);
  };

  const footer = draft ? (
    <div className="flex w-full flex-wrap items-center justify-between gap-2">
      {draft.id ? <HoldButton label="Delete event" onConfirm={() => { onDelete(draft.id!); setDraft(null); }} /> : <span />}
      <div className="flex gap-2">
        <Button variant="ghost" onPress={() => setDraft(null)}>Back</Button>
        <Button onPress={save}>{draft.id ? 'Save' : 'Add event'}</Button>
      </div>
    </div>
  ) : (
    <div className="flex w-full justify-end gap-2">
      <Button variant="ghost" onPress={onClose}>Done</Button>
      <Button icon="add" onPress={startNew}>Add event</Button>
    </div>
  );

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={draft ? (draft.id ? 'Edit life event' : 'New life event') : 'Life events'} description={draft ? undefined : 'Moments that explain your net worth. They show on the chart and in Wrapped.'} footer={footer} isDirty={false}>
      {draft ? (
        <div className="space-y-4">
          <TextInput label="What happened" value={draft.title} onChange={title => setDraft({ ...draft, title })} placeholder="Bought the flat" autoFocus error={showError && !draft.title.trim() ? 'Give the event a name.' : undefined} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DateInput label="Date" value={draft.date} onChange={date => setDraft({ ...draft, date })} error={showError && problem && draft.title.trim() ? problem : undefined} />
            <Select label="Kind" value={draft.kind} onChange={id => setDraft({ ...draft, kind: id as LifeEventKind })} options={LIFE_EVENT_KINDS.map(({ id, label, icon }) => ({ id, label, icon }))} />
          </div>
          <Textarea label="Note (optional)" value={draft.note} onChange={note => setDraft({ ...draft, note })} />
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState icon="flag" title="No life events yet" description="Mark a new job, a move or a purchase, and it appears on your net-worth line." />
      ) : (
        <ul className="divide-y divide-line">
          {sorted.map(event => (
            <li key={event.id}>
              <Row
                leading={<Icon name={lifeEventKind(event.kind).icon} size={20} className="text-muted" />}
                title={event.title}
                context={`${formatDate(event.date)} · ${lifeEventKind(event.kind).label}`}
                trailing={<Icon name="chevron_right" size={18} className="text-muted" />}
                onPress={() => edit(event)}
              />
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
};

export default LifeEventsDialog;
