import React, { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { Page, Task, TaskPriority, TaskStatus } from '../types';
import { Button } from './ui/Actions';
import { DateInput, Textarea, TextInput } from './ui/Fields';
import { Dialog } from './ui/Overlays';
import { Select, type PickerOption } from './ui/Pickers';
import { SmoothTab, type SwipeTabItem } from './ui/smooth-tab';
import { useGoalsContext, useScheduleContext } from '../contexts/FinancialDataContext';
import { useAccountsContext } from '../contexts/DomainProviders';

interface TaskModalProps {
  isOpen?: boolean;
  task?: Task | null;
  onClose: () => void;
  onSave: (task: Omit<Task, 'id'> & { id?: string }) => void;
  onDelete: (id: string) => void;
}

const PRIORITIES: SwipeTabItem[] = [
  { id: 'Low', title: 'Low' },
  { id: 'Medium', title: 'Medium' },
  { id: 'High', title: 'High', activeColor: 'bg-money-out', activeTextColor: 'text-on-danger' },
];

const STATUSES: SwipeTabItem[] = (['To Do', 'In Progress', 'Done'] as TaskStatus[]).map(id => ({ id, title: id }));

const LINKED_SECTION_OPTIONS: PickerOption[] = [
  { id: 'none', label: 'None' },
  { id: 'Accounts', label: 'Accounts' },
  { id: 'Transactions', label: 'Transactions' },
  { id: 'Budget', label: 'Budget' },
  { id: 'Goals', label: 'Goals' },
  { id: 'Schedule & Bills', label: 'Schedule & Bills' },
  { id: 'Subscriptions', label: 'Subscriptions' },
  { id: 'Investments', label: 'Investments' },
];

/** Add or edit a task with priority, status, due dates, and financial entity linking (TSK-04). */
const TaskModal: React.FC<TaskModalProps> = ({ task, onClose, onSave, onDelete }) => {
  const { accounts } = useAccountsContext();
  const { financialGoals } = useGoalsContext();
  const { recurringTransactions } = useScheduleContext();

  const initial = useRef({
    title: task?.title ?? '',
    description: task?.description ?? '',
    dueDate: task?.dueDate ?? '',
    reminderDate: task?.reminderDate ?? '',
    status: task?.status ?? ('To Do' as TaskStatus),
    priority: task?.priority ?? ('Medium' as TaskPriority),
    linkedPage: task?.linkedPage ?? ('' as Page | ''),
    linkedEntityType: task?.linkedEntityType,
    linkedEntityId: task?.linkedEntityId ?? '',
    linkedEntityName: task?.linkedEntityName ?? '',
  });

  const [draft, setDraft] = useState(initial.current);
  const update = (patch: Partial<typeof draft>) => setDraft(prev => ({ ...prev, ...patch }));

  // Options for entity pickers depending on linked section
  const goalOptions: PickerOption[] = useMemo(
    () => [
      { id: 'none', label: 'Select a goal...' },
      ...financialGoals.map(g => ({ id: g.id, label: g.name })),
    ],
    [financialGoals]
  );

  const billOptions: PickerOption[] = useMemo(
    () => [
      { id: 'none', label: 'Select a bill / subscription...' },
      ...recurringTransactions.map(b => ({ id: b.id, label: b.merchant || b.description || 'Recurring bill' })),
    ],
    [recurringTransactions]
  );

  const accountOptions: PickerOption[] = useMemo(
    () => [
      { id: 'none', label: 'Select an account...' },
      ...accounts.map(a => ({ id: a.id, label: a.name })),
    ],
    [accounts]
  );

  const handleSectionChange = (sectionId: string) => {
    if (sectionId === 'none') {
      update({
        linkedPage: '',
        linkedEntityType: undefined,
        linkedEntityId: '',
        linkedEntityName: '',
      });
    } else {
      update({
        linkedPage: sectionId as Page,
        linkedEntityType:
          sectionId === 'Goals'
            ? 'goal'
            : sectionId === 'Schedule & Bills' || sectionId === 'Subscriptions'
              ? 'bill'
              : sectionId === 'Accounts'
                ? 'account'
                : undefined,
        linkedEntityId: '',
        linkedEntityName: '',
      });
    }
  };

  const handleEntityChange = (entityId: string) => {
    if (entityId === 'none') {
      update({ linkedEntityId: '', linkedEntityName: '' });
      return;
    }
    if (draft.linkedPage === 'Goals') {
      const g = financialGoals.find(item => item.id === entityId);
      update({ linkedEntityId: entityId, linkedEntityName: g?.name ?? '' });
    } else if (draft.linkedPage === 'Schedule & Bills' || draft.linkedPage === 'Subscriptions') {
      const b = recurringTransactions.find(item => item.id === entityId);
      update({ linkedEntityId: entityId, linkedEntityName: b?.merchant || b?.description || 'Bill' });
    } else if (draft.linkedPage === 'Accounts') {
      const a = accounts.find(item => item.id === entityId);
      update({ linkedEntityId: entityId, linkedEntityName: a?.name ?? 'Account' });
    }
  };

  const handleSave = () => {
    if (!draft.title.trim()) {
      toast.error('Add a title');
      return;
    }
    if (draft.dueDate && draft.reminderDate && draft.reminderDate > draft.dueDate) {
      toast.error('Reminder date cannot be after the due date');
      return;
    }
    onSave({
      ...draft,
      id: task?.id,
      title: draft.title.trim(),
      description: draft.description.trim(),
      reminderDate: draft.dueDate ? draft.reminderDate : '',
      linkedPage: draft.linkedPage ? (draft.linkedPage as Page) : undefined,
      linkedEntityType: draft.linkedEntityId ? draft.linkedEntityType : undefined,
      linkedEntityId: draft.linkedEntityId || undefined,
      linkedEntityName: draft.linkedEntityName || undefined,
    });
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
          <SmoothTab fullWidth className="w-full" items={PRIORITIES} value={draft.priority} onChange={priority => update({ priority: priority as TaskPriority })} label="Task priority" />
        </div>
        <div>
          <p className="type-label mb-1.5 text-ink">Status</p>
          <SmoothTab fullWidth className="w-full" items={STATUSES} value={draft.status} onChange={status => update({ status: status as TaskStatus })} label="Task status" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <DateInput label="Due date" value={draft.dueDate} onChange={dueDate => update({ dueDate })} />
          {draft.dueDate && <DateInput label="Remind me" value={draft.reminderDate} onChange={reminderDate => update({ reminderDate })} />}
        </div>
        <div className="space-y-3 pt-1">
          <Select
            label="Linked section"
            options={LINKED_SECTION_OPTIONS}
            value={draft.linkedPage || 'none'}
            onChange={handleSectionChange}
          />

          {draft.linkedPage === 'Goals' && financialGoals.length > 0 && (
            <Select
              label="Linked goal"
              options={goalOptions}
              value={draft.linkedEntityId || 'none'}
              onChange={handleEntityChange}
            />
          )}

          {(draft.linkedPage === 'Schedule & Bills' || draft.linkedPage === 'Subscriptions') && recurringTransactions.length > 0 && (
            <Select
              label="Linked bill or subscription"
              options={billOptions}
              value={draft.linkedEntityId || 'none'}
              onChange={handleEntityChange}
            />
          )}

          {draft.linkedPage === 'Accounts' && accounts.length > 0 && (
            <Select
              label="Linked account"
              options={accountOptions}
              value={draft.linkedEntityId || 'none'}
              onChange={handleEntityChange}
            />
          )}
        </div>
      </form>
    </Dialog>
  );
};

export default TaskModal;
