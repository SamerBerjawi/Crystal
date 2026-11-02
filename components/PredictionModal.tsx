import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Account, Category, InvestmentTransaction, Prediction, PredictionType, Warrant } from '../types';
import { toLocalISOString } from '../utils';
import { sortAccountsByType } from '../utils/accountsModel';
import { Button } from './ui/Actions';
import { AmountInput, DateInput } from './ui/Fields';
import { Dialog } from './ui/Overlays';
import { Select, type PickerOption } from './ui/Pickers';
import SegmentedControl from './ui/SegmentedControl';

const ALL_NET_WORTH = 'all_net_worth';
const KINDS = [{ id: 'spending_cap', label: 'Spending' }, { id: 'net_worth_goal', label: 'Net worth' }, { id: 'price_target', label: 'Price' }];
const TARGET_LABELS: Record<PredictionType, string> = { spending_cap: 'Category', net_worth_goal: 'Account', price_target: 'Holding' };
const AMOUNT_LABELS: Record<PredictionType, string> = { spending_cap: 'Limit', net_worth_goal: 'Balance to reach', price_target: 'Price to reach' };

const flatten = (categories: Category[], parent?: string): PickerOption[] =>
  categories.flatMap(category => [
    {
      id: category.name,
      label: category.name,
      description: parent,
      group: parent || category.name,
      level: parent ? 1 : 0,
    },
    ...flatten(category.subCategories ?? [], category.name),
  ]);

interface PredictionModalProps {
  onClose: () => void;
  onSave: (prediction: Omit<Prediction, 'id'> & { id?: string }) => void;
  accounts: Account[];
  expenseCategories: Category[];
  investmentTransactions?: InvestmentTransaction[];
  warrants?: Warrant[];
}

const PredictionModal: React.FC<PredictionModalProps> = ({ onClose, onSave, accounts, expenseCategories, investmentTransactions = [], warrants = [] }) => {
  const [type, setType] = useState<PredictionType>('spending_cap');
  const [targetId, setTargetId] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    return toLocalISOString(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  });

  const options = useMemo((): PickerOption[] => {
    if (type === 'spending_cap') return flatten(expenseCategories);
    if (type === 'net_worth_goal') {
      return [
        { id: ALL_NET_WORTH, label: 'Total net worth' },
        ...sortAccountsByType(accounts).map(account => ({
          id: account.id,
          label: account.name,
          description: account.type,
          group: account.status === 'closed' ? 'Closed' : account.type,
        })),
      ];
    }
    const symbols = new Set<string>([...investmentTransactions.map(trade => trade.symbol), ...warrants.map(grant => grant.isin), ...accounts.filter(account => account.type === 'Investment' && account.symbol).map(account => account.symbol!)]);
    return [...symbols].sort().map(symbol => ({ id: symbol, label: symbol }));
  }, [type, expenseCategories, accounts, investmentTransactions, warrants]);

  const save = () => {
    const amount = parseFloat(targetAmount);
    if (!targetId) {
      toast.error(`Choose ${type === 'spending_cap' ? 'a category' : type === 'net_worth_goal' ? 'an account' : 'a holding'}`);
      return;
    }
    if (!Number.isFinite(amount)) {
      toast.error('Enter an amount');
      return;
    }
    const isTotal = targetId === ALL_NET_WORTH;
    onSave({
      type,
      targetId: isTotal ? undefined : targetId,
      targetName: isTotal ? 'Total Net Worth' : options.find(option => option.id === targetId)?.label ?? targetId,
      targetAmount: amount,
      startDate: toLocalISOString(new Date()),
      endDate,
      status: 'active',
    });
    onClose();
  };

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title="New prediction"
      description="Crystal checks it after the end date, the next time you open Challenges."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onPress={onClose}>Cancel</Button>
          <Button onPress={save}>Save</Button>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); save(); }}>
        <SegmentedControl className="w-full" items={KINDS} activeId={type} onChange={id => { setType(id as PredictionType); setTargetId(''); }} />
        <Select label={TARGET_LABELS[type]} options={options} value={targetId || null} onChange={setTargetId} />
        <AmountInput label={AMOUNT_LABELS[type]} value={targetAmount} onChange={setTargetAmount} />
        <DateInput label="End date" value={endDate} onChange={setEndDate} />
      </form>
    </Dialog>
  );
};

export default PredictionModal;
