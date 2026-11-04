import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Account, AccountType, EnableBankingAccount, EnableBankingLinkPayload } from '../types';
import { Button } from './ui/Actions';
import { DateInput, TextInput } from './ui/Fields';
import { Dialog } from './ui/Overlays';
import { Select } from './ui/Pickers';
import { SmoothTab, type SwipeTabItem } from './ui/smooth-tab';

const BANK_LINK_MODES: SwipeTabItem[] = [
  { id: 'existing', title: 'Existing account' },
  { id: 'create', title: 'New account' },
];

const ACCOUNT_TYPES: AccountType[] = ['Checking', 'Savings', 'Credit Card', 'Investment', 'Loan', 'Property', 'Vehicle', 'Other Assets', 'Other Liabilities', 'Lending'];
const PRESETS = [30, 60, 90, 365];

interface BankLinkDialogProps {
  account: EnableBankingAccount | null;
  accounts: Account[];
  /** Crystal accounts already linked to another bank account. */
  takenAccountIds: Set<string>;
  minDate: string;
  maxDate: string;
  onClose: () => void;
  onSave: (payload: EnableBankingLinkPayload) => void;
}

const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

/** Maps one account at the bank to a Crystal account, new or existing. */
const BankLinkDialog: React.FC<BankLinkDialogProps> = ({ account, accounts, takenAccountIds, minDate, maxDate, onClose, onSave }) => {
  const [mode, setMode] = useState<'existing' | 'create'>('create');
  const [accountId, setAccountId] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('Checking');
  const defaultStart = daysAgo(90) >= minDate ? daysAgo(90) : minDate;
  const [startDate, setStartDate] = useState(defaultStart);

  useEffect(() => {
    if (!account) return;
    setMode(account.linkedAccountId ? 'existing' : 'create');
    setAccountId(account.linkedAccountId ?? '');
    setName(account.name);
    setType('Checking');
    const fallbackStart = daysAgo(90) >= minDate ? daysAgo(90) : minDate;
    setStartDate(account.syncStartDate && account.syncStartDate >= minDate ? account.syncStartDate : fallbackStart);
  }, [account, minDate]);

  const accountOptions = useMemo(
    () => accounts
      .filter(item => !takenAccountIds.has(item.id) || item.id === account?.linkedAccountId)
      .map(item => ({ id: item.id, label: item.name, description: item.currency })),
    [account?.linkedAccountId, accounts, takenAccountIds],
  );

  const pickDate = (value: string) => setStartDate(value < minDate ? minDate : value > maxDate ? maxDate : value);

  const save = () => {
    if (!account) return;
    if (mode === 'existing') {
      if (!accountId) return void toast.error('Choose an account to link.');
      onSave({ linkedAccountId: accountId, syncStartDate: startDate });
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) return void toast.error('Name the new account.');
    onSave({ newAccount: { name: trimmed, type, balance: account.balance, currency: account.currency }, syncStartDate: startDate });
  };

  return (
    <Dialog
      isOpen={!!account}
      onClose={onClose}
      title={account ? `Link ${account.name}` : 'Link account'}
      footer={close => (
        <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button variant="ghost" onPress={close}>Cancel</Button>
          <Button onPress={save}>Save link</Button>
        </div>
      )}
    >
      <div className="space-y-4">
        <SmoothTab
          fullWidth
          className="w-full"
          items={BANK_LINK_MODES}
          value={mode}
          onChange={id => setMode(id as 'existing' | 'create')}
          label="Bank account link mode"
        />
        {mode === 'existing' ? (
          <Select label="Crystal account" options={accountOptions} value={accountId || null} onChange={setAccountId} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="Account name" value={name} onChange={setName} />
            <Select label="Account type" options={ACCOUNT_TYPES.map(item => ({ id: item, label: item }))} value={type} onChange={id => setType(id as AccountType)} />
          </div>
        )}
        <div>
          <DateInput label="Sync from" help="Up to 2 years back." value={startDate} onChange={pickDate} />
          <div className="mt-2 flex flex-wrap gap-2">
            {PRESETS.map(days => (
              <Button key={days} variant="secondary" size="sm" onPress={() => pickDate(daysAgo(days))}>{days === 365 ? '1 year' : `${days} days`}</Button>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
};

export default BankLinkDialog;
