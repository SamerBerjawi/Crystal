import React, { useMemo, useState } from 'react';
import { Account, AssetClosureDetails } from '../types';
import { currencySign, toLocalISOString } from '../utils';
import { parseAmountInput } from '../utils/scheduleModel';
import { Button } from './ui/Actions';
import { AmountInput, DateInput, Textarea } from './ui/Fields';
import { Dialog } from './ui/Overlays';
import { Select } from './ui/Pickers';

const CLOSURE_TYPES: { id: AssetClosureDetails['closureType']; label: string }[] = [
  { id: 'Sold', label: 'Sold' },
  { id: 'Returned', label: 'Returned' },
  { id: 'Gifted', label: 'Given away' },
  { id: 'Retired', label: 'Retired' },
  { id: 'Written Off', label: 'Written off' },
];

interface CloseAssetModalProps {
  onClose: () => void;
  account: Account;
  accounts: Account[];
  onConfirm: (details: AssetClosureDetails) => void;
}

const CloseAssetModal: React.FC<CloseAssetModalProps> = ({ onClose, account, accounts, onConfirm }) => {
  const [closureType, setClosureType] = useState<AssetClosureDetails['closureType']>('Sold');
  const [date, setDate] = useState(toLocalISOString(new Date()));
  const [value, setValue] = useState(account.balance.toString());
  const [incomeAccountId, setIncomeAccountId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const isSold = closureType === 'Sold';
  const accountOptions = useMemo(
    () => accounts.filter(item => item.type === 'Checking' || item.type === 'Savings').map(item => ({ id: item.id, label: item.name })),
    [accounts]
  );

  const confirm = () => {
    onConfirm({
      closureType,
      date,
      value: parseAmountInput(value) || 0,
      incomeAccountId: isSold && incomeAccountId ? incomeAccountId : undefined,
      notes,
    });
    onClose();
  };

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title={`Close ${account.name}?`}
      isDirty={!!notes}
      footer={close => (
        <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button variant="ghost" onPress={close}>Cancel</Button>
          <Button variant="destructive" isDisabled={isSold && !incomeAccountId} onPress={confirm}>Close asset</Button>
        </div>
      )}
    >
      <div className="space-y-4">
        <Select label="What happened" options={CLOSURE_TYPES} value={closureType} onChange={id => setClosureType(id as AssetClosureDetails['closureType'])} />
        <AmountInput label={isSold ? 'Sold for' : 'Final value'} currency={currencySign(account.currency)} value={value} onChange={setValue} />
        <DateInput label="Date" value={date} onChange={setDate} isRequired />
        {isSold && <Select label="Paid into" options={accountOptions} value={incomeAccountId} onChange={setIncomeAccountId} placeholder="Choose an account" />}
        <Textarea label="Notes" help="Optional." placeholder="Buyer or receipt reference" value={notes} onChange={setNotes} />
      </div>
    </Dialog>
  );
};

export default CloseAssetModal;
