import { getMainCurrency } from '../utils';
import React, { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { Account, FinancialGoal, GoalCategory, RecurrenceFrequency } from '../types';
import { FREQUENCIES } from '../constants';
import { draftFromGoal, emptyGoalDraft, goalAccounts, planGoal, type GoalDraft } from '../utils/goalsModel';
import { sortAccountsByType } from '../utils/accountsModel';
import { Button } from './ui/Actions';
import { AmountInput, DateInput, TextInput } from './ui/Fields';
import { SidePanel } from './ui/Overlays';
import { Select, type PickerOption } from './ui/Pickers';
import { SmoothTab, type SwipeTabItem } from './ui/smooth-tab';

interface GoalScenarioModalProps {
  onClose: () => void;
  onSave: (goal: Omit<FinancialGoal, 'id'> & { id?: string }) => void;
  goalToEdit?: FinancialGoal | null;
  financialGoals: FinancialGoal[];
  parentId?: string;
  accounts: Account[];
}

type Shape = 'by-date' | 'ongoing' | 'bucket';

const SHAPES: SwipeTabItem[] = [{ id: 'by-date', title: 'Target date' }, { id: 'ongoing', title: 'Recurring' }, { id: 'bucket', title: 'Bucket' }];
const CATEGORIES: PickerOption[] = [{ id: 'savings', label: 'Saving' }, { id: 'expense', label: 'Spending' }, { id: 'income', label: 'Income' }];
const AMOUNT_LABELS = {
  savings: { target: 'Target amount', current: 'Saved so far' },
  expense: { target: 'Target budget', current: 'Spent so far' },
  income: { target: 'Target income', current: 'Earned so far' },
};
const NONE = 'none';

/** The goal form (GOL-01, GOL-02): short by default, and what a bucket doesn't need goes away. */
const GoalScenarioModal: React.FC<GoalScenarioModalProps> = ({ onClose, onSave, goalToEdit, financialGoals, parentId, accounts }) => {
  const isEditing = !!goalToEdit;
  const isSubGoal = !!parentId;
  const initial = useRef<GoalDraft>(goalToEdit ? draftFromGoal(goalToEdit) : emptyGoalDraft(getMainCurrency(), new Date(), parentId));
  const [draft, setDraft] = useState<GoalDraft>(initial.current);
  const update = (patch: Partial<GoalDraft>) => setDraft(prev => ({ ...prev, ...patch }));

  const isBucket = draft.category === 'bucket';
  const isOngoing = draft.timing === 'ongoing';
  const shape: Shape = isBucket ? 'bucket' : draft.timing;
  const category = (isBucket ? 'savings' : draft.category) as GoalCategory;
  const labels = AMOUNT_LABELS[category];
  const usesDay = isOngoing && (draft.frequency === 'monthly' || draft.frequency === 'yearly');

  const accountOptions = useMemo<PickerOption[]>(() => [
    { id: NONE, label: 'No account' },
    ...sortAccountsByType(goalAccounts(accounts)).map(account => ({
      id: account.id,
      label: account.name,
      description: account.type,
      group: account.type,
    })),
  ], [accounts]);

  const parentOptions = useMemo<PickerOption[]>(() => [
    { id: NONE, label: 'None' },
    ...financialGoals.filter(goal => goal.isBucket && goal.id !== goalToEdit?.id).map(goal => ({ id: goal.id, label: goal.name })),
  ], [financialGoals, goalToEdit]);

  const setShape = (next: string) => {
    if (next === 'bucket') update({ category: 'bucket' });
    else update({ category: isBucket ? 'savings' : draft.category, timing: next as GoalDraft['timing'] });
  };

  const handleSave = () => {
    const plan = planGoal(draft, goalToEdit ?? undefined);
    if ('error' in plan) {
      toast.error(plan.error);
      return;
    }
    onSave(plan.goal);
    onClose();
  };

  const title = isEditing ? `Edit ${goalToEdit.name}` : isSubGoal ? 'Add an item' : 'New goal';

  return (
    <SidePanel
      isOpen
      onClose={onClose}
      title={title}
      isDirty={JSON.stringify(draft) !== JSON.stringify(initial.current)}
      footer={close => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onPress={close}>Cancel</Button>
          <Button onPress={handleSave}>{isEditing ? 'Save changes' : 'Save goal'}</Button>
        </div>
      )}
    >
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleSave(); }}>
        {!isEditing && !isSubGoal && <SmoothTab fullWidth className="w-full" items={SHAPES} value={shape} onChange={setShape} label="Goal structure" />}
        <TextInput label={isBucket ? 'Bucket name' : 'Goal name'} value={draft.name} onChange={name => update({ name })} autoFocus />

        {isBucket ? (
          <p className="type-body text-muted">A bucket holds other goals. Its total, progress and date come from the items you add.</p>
        ) : (
          <>
            <Select label="Goal type" options={CATEGORIES} value={category} onChange={id => update({ category: id as GoalCategory })} />
            <div className="grid grid-cols-2 gap-3">
              <AmountInput label={labels.target} currency={getMainCurrency()} value={draft.amount} onChange={amount => update({ amount })} />
              <AmountInput label={labels.current} currency={getMainCurrency()} value={draft.saved} onChange={saved => update({ saved })} />
            </div>

            {isOngoing ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Select label="How often" options={FREQUENCIES.map(item => ({ id: item.value, label: item.label }))} value={draft.frequency} onChange={id => update({ frequency: id as RecurrenceFrequency })} />
                  <DateInput label="Starts" value={draft.startDate} onChange={startDate => update({ startDate })} />
                </div>
                {usesDay && <TextInput label="Day of the month" inputMode="numeric" value={draft.dayOfMonth} onChange={dayOfMonth => update({ dayOfMonth })} />}
              </>
            ) : (
              <DateInput label="Target date" value={draft.date} onChange={date => update({ date })} />
            )}

            <AmountInput
              label={isOngoing ? 'Contribution' : 'Monthly contribution'}
              currency={getMainCurrency()}
              value={draft.contribution}
              onChange={contribution => update({ contribution })}
              help={isOngoing ? undefined : 'Optional. Leave it blank to see what you would need.'}
            />
            <Select label="Account" options={accountOptions} value={draft.paymentAccountId || NONE} onChange={id => update({ paymentAccountId: id === NONE ? '' : id })} />
            {category === 'savings' && (
              <Select label="Saving into" options={accountOptions} value={draft.destinationAccountId || NONE} onChange={id => update({ destinationAccountId: id === NONE ? '' : id })} help="Optional. Contributions then show as a transfer in the forecast." />
            )}
            {!isSubGoal && parentOptions.length > 1 && <Select label="Bucket" options={parentOptions} value={draft.parentId || NONE} onChange={id => update({ parentId: id === NONE ? '' : id })} />}
          </>
        )}
      </form>
    </SidePanel>
  );
};

export default GoalScenarioModal;
