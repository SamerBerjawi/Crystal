import React, { useRef, useState } from 'react';
import { toast } from 'sonner';
import type { Task, TaskPriority, TaskStatus } from '../types';
import { Button } from './ui/Actions';
import { DateInput, Textarea, TextInput } from './ui/Fields';
import { Dialog } from './ui/Overlays';
import SegmentedControl from './ui/SegmentedControl';

interface TaskModalProps {
  isOpen?: boolean;
  task?: Task | null;
  onClose: () => void;
  onSave: (task: Omit<Task, 'id'> & { id?: string }) => void;
  onDelete: (id: string) => void;
}

const PRIORITIES = (['Low', 'Medium', 'High'] as TaskPriority[]).map(id => ({ id, label: id }));
const STATUSES = (['To Do', 'In Progress', 'Done'] as TaskStatus[]).map(id => ({ id, label: id }));

/** Add or edit a task (TSK-04). */
const TaskModal: React.FC<TaskModalProps> = ({ task, onClose, onSave, onDelete }) => {
  const initial = useRef({
    title: task?.title ?? '', description: task?.description ?? '', dueDate: task?.dueDate ?? '', reminderDate: task?.reminderDate ?? '',
    status: task?.status ?? ('To Do' as TaskStatus), priority: task?.priority ?? ('Medium' as TaskPriority),
  });
  const [draft, setDraft] = useState(initial.current);
  const update = (patch: Partial<typeof draft>) => setDraft(prev => ({ ...prev, ...patch }));

  const handleSave = () => {
    if (!draft.title.trim()) {
      toast.error('Add a title');
      return;
    }
    onSave({ ...draft, id: task?.id, title: draft.title.trim(), description: draft.description.trim(), reminderDate: draft.dueDate ? draft.reminderDate : '' });
  };

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title={task ? 'Edit task' : 'New task'}
      isDirty={JSON.stringify(draft) !== JSON.stringify(initial.current)}
      footer={close => (
        <div className="flex items-center justify-between gap-2">
          {task ? <Button variant="ghost" className="text-money-out" onPress={() => onDelete(task.id)}>Delete</Button> : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" onPress={close}>Cancel</Button>
            <Button onPress={handleSave}>{task ? 'Save changes' : 'Add task'}</Button>
          </div>
        </div>
      )}
    >
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleSave(); }}>
        <TextInput label="Title" value={draft.title} onChange={title => update({ title })} autoFocus />
        <Textarea label="Description" value={draft.description} onChange={description => update({ description })} />
        <div>
          <p className="type-label mb-1.5 text-ink">Priority</p>
          <SegmentedControl className="w-full" items={PRIORITIES} activeId={draft.priority} onChange={priority => update({ priority: priority as TaskPriority })} />
        </div>
        <div>
          <p className="type-label mb-1.5 text-ink">Status</p>
          <SegmentedControl className="w-full" items={STATUSES} activeId={draft.status} onChange={status => update({ status: status as TaskStatus })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <DateInput label="Due date" value={draft.dueDate} onChange={dueDate => update({ dueDate })} />
          {draft.dueDate && <DateInput label="Remind me" value={draft.reminderDate} onChange={reminderDate => update({ reminderDate })} />}
        </div>
      </form>
    </Dialog>
  );
};

export default TaskModal;
