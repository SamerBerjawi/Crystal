import React, { useMemo, useState } from 'react';
import { Transaction, Category } from '../types';
import { currencySign } from '../utils';
import { categoryPickerOptions } from '../utils/categoryTree';
import { amountLeft, buildSplit, initialParts, SplitPart } from '../utils/splitModel';
import { DetailList } from './AccountFrame';
import { Button, IconButton } from './ui/Actions';
import { AmountInput, TextInput } from './ui/Fields';
import { Amount } from './ui/Money';
import { Dialog } from './ui/Overlays';
import { Combobox } from './ui/Pickers';

interface SplitTransactionModalProps {
  onClose: () => void;
  onSave: (updatedParent: Transaction, subTransactions: Transaction[]) => void;
  transaction: Transaction;
  incomeCategories: Category[];
  expenseCategories: Category[];
}

const SplitTransactionModal: React.FC<SplitTransactionModalProps> = ({ onClose, onSave, transaction, incomeCategories, expenseCategories }) => {
  const [parts, setParts] = useState<SplitPart[]>(() => initialParts(transaction));
  const [isDirty, setDirty] = useState(false);

  const categoryOptions = useMemo(() => categoryPickerOptions(expenseCategories, incomeCategories), [expenseCategories, incomeCategories]);
  const left = amountLeft(transaction, parts);

  const change = (next: SplitPart[]) => {
    setParts(next);
    setDirty(true);
  };
  const update = (id: string, updates: Partial<SplitPart>) => change(parts.map(part => part.id === id ? { ...part, ...updates } : part));

  const save = () => {
    const { parent, subTransactions } = buildSplit(transaction, parts);
    onSave(parent, subTransactions);
  };

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title="Split transaction"
      description={transaction.description}
      isDirty={isDirty}
      footer={close => (
        <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button variant="ghost" onPress={close}>Cancel</Button>
          <Button isDisabled={left !== 0} onPress={save}>Split</Button>
        </div>
      )}
    >
      <div className="space-y-4">
        <DetailList items={[
          { label: 'Original amount', value: <Amount value={Math.abs(transaction.amount)} currency={transaction.currency} /> },
          { label: 'Left to assign', value: <span className={left === 0 ? undefined : 'text-money-out'}><Amount value={left} currency={transaction.currency} /></span> },
        ]} />
        {parts.map((part, index) => (
          <section key={part.id} aria-label={`Part ${index + 1}`} className="space-y-3 border-t border-line pt-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="type-card-title text-ink">Part {index + 1}</h3>
              {parts.length > 1 && <IconButton icon="delete" label={`Remove part ${index + 1}`} tooltipPlacement="left" onPress={() => change(parts.filter(item => item.id !== part.id))} />}
            </div>
            <AmountInput label="Amount" currency={currencySign(transaction.currency)} value={part.amount} onChange={amount => update(part.id, { amount })} />
            <Combobox label="Category" options={categoryOptions} value={part.category || null} onChange={id => update(part.id, { category: id ?? '' })} placeholder="Search categories" />
            <TextInput label="Description" value={part.description} onChange={description => update(part.id, { description })} />
          </section>
        ))}
        <Button variant="secondary" size="sm" icon="add" onPress={() => change([...parts, { id: Date.now().toString(), amount: left > 0 ? left.toFixed(2) : '0', category: '', description: '' }])}>Add part</Button>
      </div>
    </Dialog>
  );
};

export default SplitTransactionModal;
