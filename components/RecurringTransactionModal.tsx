import React, { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { Account, BillPayment, Category, RecurrenceFrequency, RecurringTransaction, WeekendAdjustment } from '../types';
import { FREQUENCIES, LIQUID_ACCOUNT_TYPES, WEEKEND_ADJUSTMENTS } from '../constants';
import { formatCurrency } from '../utils';
import { sortAccountsByType } from '../utils/accountsModel';
import { draftFromBill, draftFromSeries, emptySeriesDraft, planSeries, type SeriesDraft } from '../utils/scheduleModel';
import { Button } from './ui/Actions';
import { AmountInput, DateInput, Switch, TextInput } from './ui/Fields';
import { SidePanel } from './ui/Overlays';
import { Combobox, Select, type PickerOption } from './ui/Pickers';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  ArrowDataTransferHorizontalIcon,
} from '@hugeicons/core-free-icons';
import { SmoothTab, type SwipeTabItem } from './ui/smooth-tab';

export interface RecurringTransactionModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onSave?: (transaction: Omit<RecurringTransaction, 'id'> & { id?: string }) => void;
  onSaveBill?: (bill: Omit<BillPayment, 'id'> & { id?: string }) => void;
  accounts: Account[];
  incomeCategories?: Category[];
  expenseCategories?: Category[];
  recurringTransactionToEdit?: (Omit<RecurringTransaction, 'id'> & { id?: string }) | null;
  billToEdit?: (Omit<BillPayment, 'id'> & { id?: string }) | null;
  initialMode?: 'recurring' | 'one-time';
  initialDate?: string;
}

const KINDS: SwipeTabItem[] = [{ id: 'recurring', title: 'Recurring' }, { id: 'bill', title: 'One-time' }];
const RECURRING_TYPES: SwipeTabItem[] = [
  {
    id: 'expense',
    title: 'Payment',
    icon: () => <HugeiconsIcon icon={ArrowDown01Icon} size={16} className="shrink-0" />,
    activeColor: 'bg-red-500 dark:bg-red-600',
    activeTextColor: 'text-white',
  },
  {
    id: 'income',
    title: 'Income',
    icon: () => <HugeiconsIcon icon={ArrowUp01Icon} size={16} className="shrink-0" />,
    activeColor: 'bg-emerald-600 dark:bg-emerald-500',
    activeTextColor: 'text-white',
  },
  {
    id: 'transfer',
    title: 'Transfer',
    icon: () => <HugeiconsIcon icon={ArrowDataTransferHorizontalIcon} size={16} className="shrink-0" />,
    activeColor: 'bg-blue-600 dark:bg-blue-500',
    activeTextColor: 'text-white',
  },
];
const BILL_TYPES = RECURRING_TYPES.slice(0, 2);
const NONE = 'none';

const categoryOptions = (categories: Category[]): PickerOption[] => categories.flatMap(parent => [
  { id: parent.name, label: parent.name, icon: parent.icon, group: parent.name, level: 0 },
  ...parent.subCategories.map(sub => ({
    id: sub.name,
    label: sub.name,
    description: parent.name,
    group: parent.name,
    level: 1,
    icon: sub.icon || parent.icon,
  })),
]);

const initialDraft = (props: RecurringTransactionModalProps): SeriesDraft => {
  const { billToEdit, recurringTransactionToEdit, accounts, initialDate, initialMode } = props;
  if (billToEdit) return draftFromBill(billToEdit as BillPayment);
  if (recurringTransactionToEdit) return draftFromSeries(recurringTransactionToEdit as RecurringTransaction);
  const draft = emptySeriesDraft(accounts[0]?.id ?? '', accounts[0]?.currency ?? 'EUR', new Date());
  return { ...draft, kind: initialMode === 'one-time' ? 'bill' : 'recurring', startDate: initialDate || draft.startDate, accountId: initialMode === 'one-time' ? '' : draft.accountId };
};

/** The recurring and one-time form (SCH-08, SCH-09). Keeps its name, because Forecast and Subscriptions open it too. */
const RecurringTransactionModal: React.FC<RecurringTransactionModalProps> = props => {
  const { onClose, onSave, onSaveBill, accounts, incomeCategories = [], expenseCategories = [], recurringTransactionToEdit, billToEdit } = props;
  const initial = useRef(initialDraft(props));
  const [draft, setDraft] = useState<SeriesDraft>(initial.current);
  const update = (patch: Partial<SeriesDraft>) => setDraft(prev => ({ ...prev, ...patch }));

  const isEditing = !!(recurringTransactionToEdit?.id || billToEdit?.id);
  const isBill = draft.kind === 'bill';
  const isTransfer = draft.type === 'transfer';
  const usesDay = draft.frequency === 'monthly' || draft.frequency === 'yearly';

  const accountOptions = useMemo<PickerOption[]>(() => {
    const filtered = accounts.filter(account => (isBill ? LIQUID_ACCOUNT_TYPES.includes(account.type) : account.status !== 'closed') || account.id === draft.accountId || account.id === draft.toAccountId);
    return sortAccountsByType(filtered).map(account => ({
      id: account.id,
      label: account.name,
      description: formatCurrency(account.balance, account.currency),
      group: account.status === 'closed' ? 'Closed' : account.type,
    }));
  }, [accounts, isBill, draft.accountId, draft.toAccountId]);

  const categories = useMemo(() => categoryOptions(draft.type === 'income' ? incomeCategories : expenseCategories), [draft.type, incomeCategories, expenseCategories]);

  const setKind = (kind: string) => update({ kind: kind as SeriesDraft['kind'], type: draft.type === 'transfer' ? 'expense' : draft.type });

  const handleSave = () => {
    if (!isBill && !isTransfer && !draft.category) {
      toast.error('Choose a category');
      return;
    }
    const currency = accounts.find(account => account.id === draft.accountId)?.currency ?? draft.currency;
    const plan = planSeries({ ...draft, currency }, recurringTransactionToEdit?.id || billToEdit?.id, billToEdit as BillPayment | undefined);
    if ('error' in plan) {
      toast.error(plan.error);
      return;
    }
    if (plan.kind === 'bill') onSaveBill?.(plan.bill);
    else onSave?.({ ...(recurringTransactionToEdit ?? {}), ...plan.series });
    onClose();
  };

  return (
    <SidePanel
      isOpen
      onClose={onClose}
      title={isEditing ? `Edit ${draft.description || 'item'}` : isBill ? 'New one-time item' : 'New recurring item'}
      isDirty={JSON.stringify(draft) !== JSON.stringify(initial.current)}
      footer={close => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onPress={close}>Cancel</Button>
          <Button onPress={handleSave}>{isEditing ? 'Save changes' : 'Save'}</Button>
        </div>
      )}
    >
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleSave(); }}>
        {!isEditing && <SmoothTab fullWidth className="w-full" items={KINDS} value={draft.kind} onChange={setKind} label="Transaction recurrence" />}
        <SmoothTab fullWidth className="w-full" items={isBill ? BILL_TYPES : RECURRING_TYPES} value={draft.type} onChange={type => update({ type: type as SeriesDraft['type'], ...(isEditing ? {} : { category: '' }) })} label="Transaction type" />
        <AmountInput label="Amount" value={draft.amount} onChange={amount => update({ amount })} />
        <TextInput label="Name" value={draft.description} onChange={description => update({ description })} />
        {!isBill && <TextInput label="Merchant" value={draft.merchant} onChange={merchant => update({ merchant })} help="Optional." />}
        {!isBill && !isTransfer && <Combobox label="Category" options={categories} value={draft.category || null} onChange={id => update({ category: id ?? '' })} placeholder="Search categories" />}

        {isTransfer ? (
          <div className="grid grid-cols-2 gap-3">
            <Combobox label="From" options={accountOptions} value={draft.accountId || null} onChange={id => update({ accountId: id ?? '' })} placeholder="Search accounts" />
            <Combobox label="To" options={accountOptions} value={draft.toAccountId || null} onChange={id => update({ toAccountId: id ?? '' })} placeholder="Search accounts" />
          </div>
        ) : isBill ? (
          <Select label="Account" options={[{ id: NONE, label: 'No account' }, ...accountOptions]} value={draft.accountId || NONE} onChange={id => update({ accountId: id === NONE ? '' : id })} />
        ) : (
          <Combobox label="Account" options={accountOptions} value={draft.accountId || null} onChange={id => update({ accountId: id ?? '' })} placeholder="Search accounts" />
        )}

        {isBill ? (
          <DateInput label="Due date" value={draft.startDate} onChange={startDate => update({ startDate })} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Select label="How often" options={FREQUENCIES.map(item => ({ id: item.value, label: item.label }))} value={draft.frequency} onChange={id => update({ frequency: id as RecurrenceFrequency, ...(id === 'daily' ? { frequencyInterval: '1' } : {}) })} />
              {draft.frequency !== 'daily' && <TextInput label="Every" inputMode="numeric" value={draft.frequencyInterval} onChange={frequencyInterval => update({ frequencyInterval })} />}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DateInput label="Starts" value={draft.startDate} onChange={startDate => update({ startDate })} />
              <DateInput label="Ends" value={draft.endDate} onChange={endDate => update({ endDate })} />
            </div>
            {usesDay && <TextInput label="Day of the month" inputMode="numeric" value={draft.dueDateOfMonth} onChange={dueDateOfMonth => update({ dueDateOfMonth })} help="Optional. Leave it blank to use the start date." />}
            <Select label="If it lands on a weekend" options={WEEKEND_ADJUSTMENTS.map(item => ({ id: item.value, label: item.label }))} value={draft.weekendAdjustment} onChange={id => update({ weekendAdjustment: id as WeekendAdjustment })} />
            {draft.type !== 'income' && (
              <>
                <Switch isSelected={draft.autopay} onChange={autopay => update({ autopay })}>Pays itself (autopay)</Switch>
                <TextInput label="Payment link" inputMode="url" value={draft.paymentUrl} onChange={paymentUrl => update({ paymentUrl })} help="Optional. Where you pay or manage it online." />
                <div className="grid grid-cols-2 gap-3">
                  <TextInput label="Remind me (days before)" inputMode="numeric" value={draft.notifyDaysBefore} onChange={notifyDaysBefore => update({ notifyDaysBefore })} help="Default 3." />
                  <TextInput label="Grace period (days)" inputMode="numeric" value={draft.overdueGraceDays} onChange={overdueGraceDays => update({ overdueGraceDays })} help="Overdue only after this." />
                </div>
                <DateInput label="Free trial ends" value={draft.trialEndsOn} onChange={trialEndsOn => update({ trialEndsOn })} />
              </>
            )}
          </>
        )}
      </form>
    </SidePanel>
  );
};

export default RecurringTransactionModal;
