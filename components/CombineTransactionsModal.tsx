import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Transaction, Category, Account } from '../types';
import { parseLocalDate, safeRound } from '../utils';
import { categoryPickerOptions } from '../utils/categoryTree';
import { usePreferencesSelector } from '../contexts/DomainProviders';
import { getAccountBrandfetchUrl, getMerchantLogoUrl } from '../utils/brandfetch';
import Icon from './ui/Icon';
import { Button } from './ui/Actions';
import { Row } from './ui/Display';
import { DateInput, TextInput } from './ui/Fields';
import { Amount } from './ui/Money';
import { SidePanel } from './ui/Overlays';
import { Combobox } from './ui/Pickers';
import { LogoTile } from './EntityIcon';

interface CombineTransactionsModalProps {
  onClose: () => void;
  onSave: (combinedParent: Transaction, updatedSubTransactions: Transaction[]) => void;
  transactionsToCombine: Transaction[];
  incomeCategories: Category[];
  expenseCategories: Category[];
  accounts: Account[];
}

const CombineTransactionsModal: React.FC<CombineTransactionsModalProps> = ({ onClose, onSave, transactionsToCombine, incomeCategories, expenseCategories, accounts }) => {
  const firstTx = transactionsToCombine[0];

  const newestDate = useMemo(() => {
    if (!transactionsToCombine.length) return new Date().toISOString().split('T')[0];
    const dates = transactionsToCombine.map(t => new Date(t.date).getTime()).filter(n => !isNaN(n));
    return dates.length ? new Date(Math.max(...dates)).toISOString().split('T')[0] : firstTx?.date || new Date().toISOString().split('T')[0];
  }, [transactionsToCombine, firstTx]);

  const totalAmount = useMemo(() => safeRound(transactionsToCombine.reduce((sum, t) => sum + (t.amount || 0), 0), 2), [transactionsToCombine]);
  const currency = firstTx?.currency || 'EUR';

  const [description, setDescription] = useState(
    transactionsToCombine.length > 1 ? `Combined: ${transactionsToCombine[0].description} & others` : firstTx?.description || 'Combined Transaction'
  );
  const [category, setCategory] = useState(firstTx?.category || '');
  const [date, setDate] = useState(newestDate);
  const [accountId, setAccountId] = useState(firstTx?.accountId || accounts[0]?.id || '');

  const brandfetchClientId = usePreferencesSelector(p => p.brandfetchClientId || '');
  const logoOverrides = usePreferencesSelector(p => p.merchantLogoOverrides || {});

  const categoryOptions = useMemo(() => categoryPickerOptions(expenseCategories, incomeCategories), [expenseCategories, incomeCategories]);
  const accountOptions = useMemo(() => accounts.map(account => {
    const logoUrl = account.imageUrl
      || getAccountBrandfetchUrl(account, brandfetchClientId, logoOverrides)
      || (account.financialInstitution ? getMerchantLogoUrl(account.financialInstitution, brandfetchClientId, logoOverrides) : null);
    return {
      id: account.id,
      label: account.name,
      description: account.financialInstitution || account.type,
      visual: <LogoTile url={logoUrl} label={account.name} size={24} fallbackIcon="account_balance" />,
    };
  }), [accounts, brandfetchClientId, logoOverrides]);

  const handleSave = () => {
    if (!description.trim()) {
      toast.error('Add a description for the combined transaction.');
      return;
    }

    const combinedParentId = `combined-parent-${Date.now()}`;
    const combinedParent: Transaction = {
      id: combinedParentId,
      accountId,
      date,
      description: description.trim(),
      amount: safeRound(totalAmount, 2),
      category: category || firstTx?.category || 'General',
      type: totalAmount >= 0 ? 'income' : 'expense',
      currency,
      isCombinedParent: true,
      isSplitParent: false,
    };

    onSave(combinedParent, transactionsToCombine.map(t => ({ ...t, parentTransactionId: combinedParentId, isCombinedParent: false })));
  };

  return (
    <SidePanel
      isOpen
      onClose={onClose}
      title={`Combine ${transactionsToCombine.length} transactions`}
      description={<>They stay as parts of one transaction for <Amount value={totalAmount} currency={currency} tone="flow" />.</>}
      footer={close => (
        <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button variant="ghost" onPress={close}>Cancel</Button>
          <Button onPress={handleSave}>Combine</Button>
        </div>
      )}
    >
      <div className="space-y-4">
        <TextInput autoFocus label="Description" value={description} onChange={setDescription} />
        <Combobox label="Category" options={categoryOptions} value={category || null} onChange={id => setCategory(id ?? '')} placeholder="Search categories" />
        <Combobox label="Account" options={accountOptions} value={accountId} onChange={id => id && setAccountId(id)} placeholder="Search accounts" />
        <DateInput label="Date" value={date} onChange={setDate} isRequired />
        <section>
          <h3 className="type-card-title text-ink">Combining</h3>
          <ul className="divide-y divide-line">
            {transactionsToCombine.map(tx => (
              <li key={tx.id}><Row title={tx.description} context={`${tx.category}, ${parseLocalDate(tx.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}`} trailing={<Amount value={tx.amount} currency={tx.currency} tone="flow" />} /></li>
            ))}
          </ul>
        </section>
      </div>
    </SidePanel>
  );
};

export default CombineTransactionsModal;
