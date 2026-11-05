import React, { useMemo, useState } from 'react';
import { Account } from '../types';
import { currencySign, round2, toLocalISOString } from '../utils';
import { computeAccountDisplayBalance, computeBalanceAdjustmentDelta } from '../utils/accountsModel';
import { parseAmountInput } from '../utils/scheduleModel';
import { usePreferencesSelector, useTransactionsContext } from '../contexts/DomainProviders';
import { useScheduleContext } from '../contexts/FinancialDataContext';
import { DetailList } from './AccountFrame';
import { Button } from './ui/Actions';
import { AmountInput, Checkbox, DateInput, TextInput } from './ui/Fields';
import { Amount } from './ui/Money';
import { Dialog } from './ui/Overlays';

const QUICK_CHANGES = [50, 100, 500, -50, -100];

interface BalanceAdjustmentModalProps {
  onClose: () => void;
  onSave: (adjustmentAmount: number, date: string, notes: string, isMarketAdjustment?: boolean) => void;
  account: Account;
}

const BalanceAdjustmentModal: React.FC<BalanceAdjustmentModalProps> = ({ onClose, onSave, account }) => {
  const { transactions } = useTransactionsContext();
  const { loanPaymentOverrides } = useScheduleContext();
  const conversionRates = usePreferencesSelector(p => p.conversionRates);
  const accountTransactions = useMemo(() => transactions.filter(t => t.accountId === account.id), [transactions, account.id]);
  const displayBalance = useMemo(() => computeAccountDisplayBalance(account, accountTransactions, loanPaymentOverrides, { conversionRates }), [account, accountTransactions, loanPaymentOverrides, conversionRates]);

  const [newBalance, setNewBalance] = useState(String(displayBalance));
  const [date, setDate] = useState(toLocalISOString(new Date()));
  const [notes, setNotes] = useState('');
  const [isMarketAdjustment, setIsMarketAdjustment] = useState(false);

  const typed = parseAmountInput(newBalance);
  const delta = Number.isNaN(typed) ? 0 : computeBalanceAdjustmentDelta(account, accountTransactions, typed, date, conversionRates as Record<string, number> | undefined);
  const change = delta !== null ? delta : (Number.isNaN(typed) ? 0 : round2(typed - displayBalance));

  const nudge = (deltaVal: number) => setNewBalance(String(round2((Number.isNaN(typed) ? displayBalance : typed) + deltaVal)));

  const save = () => {
    onSave(change, date, notes, isMarketAdjustment);
    onClose();
  };

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title="Adjust balance"
      description={account.name}
      isDirty={change !== 0 || !!notes}
      footer={close => (
        <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button variant="ghost" onPress={close}>Cancel</Button>
          <Button isDisabled={change === 0} onPress={save}>Save adjustment</Button>
        </div>
      )}
    >
      <div className="space-y-4">
        <AmountInput autoFocus label="New balance" currency={currencySign(account.currency)} value={newBalance} onChange={setNewBalance} />
        <div className="flex flex-wrap gap-2">
          {QUICK_CHANGES.map(delta => <Button key={delta} variant="secondary" size="sm" onPress={() => nudge(delta)}>{delta > 0 ? `+${delta}` : `−${-delta}`}</Button>)}
          <Button variant="ghost" size="sm" onPress={() => setNewBalance(String(displayBalance))}>Reset</Button>
          <Button variant="ghost" size="sm" onPress={() => setNewBalance('0')}>Zero</Button>
        </div>
        <DetailList items={[
          { label: 'Current balance', value: <Amount value={displayBalance} currency={account.currency} /> },
          { label: 'Change', value: <Amount value={change} currency={account.currency} tone="flow" /> },
        ]} />
        <DateInput label="Date" value={date} onChange={setDate} isRequired />
        <TextInput label="Reason" help="Optional." placeholder="Month-end statement" value={notes} onChange={setNotes} />
        {(account.type === 'Investment' || account.type === 'Other Assets') && (
          <Checkbox isSelected={isMarketAdjustment} onChange={setIsMarketAdjustment}>This is a market gain or loss, not money in or out</Checkbox>
        )}
      </div>
    </Dialog>
  );
};

export default BalanceAdjustmentModal;
