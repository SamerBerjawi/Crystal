import React, { useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Account, AccountType, AppPreferences, Category, FinancialGoal, RecurringTransaction, User } from '../types';
import { ACCOUNT_TYPE_STYLES, ALL_ACCOUNT_TYPES } from '../constants';
import { currencySign, normalizeCurrency, toLocalISOString } from '../utils';
import { sortAccountsByType } from '../utils/accountsModel';
import { categoryPickerOptions } from '../utils/categoryTree';
import { currencyOptions, currencyPreference } from '../utils/currencies';
import { parseAmountInput } from '../utils/scheduleModel';
import { DetailList } from './AccountFrame';
import { Button } from './ui/Actions';
import { AmountInput, DateInput, TextInput } from './ui/Fields';
import Icon from './ui/Icon';
import { FullPanel } from './ui/Overlays';
import { Combobox, Select } from './ui/Pickers';
import SegmentedControl from './ui/SegmentedControl';

const LAST_STEP = 6;

const FLOW_OPTIONS = [
  { id: 'income', label: 'Income' },
  { id: 'expense', label: 'Expense' },
];

const PLAN = [
  { icon: 'payments', text: 'Choose your main currency' },
  { icon: 'wallet', text: 'Add your first account' },
  { icon: 'flag', text: 'Set a goal, if you have one' },
  { icon: 'sync', text: 'Add something that repeats, if you like' },
];

const yearFromNow = () => {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return toLocalISOString(date);
};

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  saveAccount: (account: Omit<Account, 'id'> & { id?: string }) => void;
  saveFinancialGoal: (goal: Omit<FinancialGoal, 'id'> & { id?: string }) => void;
  saveRecurringTransaction: (rt: Omit<RecurringTransaction, 'id'> & { id?: string }) => void;
  preferences: AppPreferences;
  setPreferences: React.Dispatch<React.SetStateAction<AppPreferences>>;
  accounts: Account[];
  incomeCategories: Category[];
  expenseCategories: Category[];
}

/** Set-up in a full panel. Each record keeps one id, so going back and forward edits it instead of adding another. */
const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose, user, saveAccount, saveFinancialGoal, saveRecurringTransaction, preferences, setPreferences, accounts, incomeCategories, expenseCategories }) => {
  const [step, setStep] = useState(1);
  const [ids] = useState(() => ({ account: `acc-${uuidv4()}`, goal: `goal-${uuidv4()}`, recurring: `rec-${uuidv4()}` }));
  const [isFirstAccount] = useState(accounts.length === 0);

  const [currency, setCurrency] = useState(normalizeCurrency(preferences.currency));

  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('Checking');
  const [balance, setBalance] = useState('');
  const [chosenAccountCurrency, setChosenAccountCurrency] = useState<string | null>(null);
  const accountCurrency = chosenAccountCurrency ?? currency;

  const [goalName, setGoalName] = useState('');
  const [goalAmount, setGoalAmount] = useState('');
  const [goalDate, setGoalDate] = useState(yearFromNow);
  const [paymentAccountId, setPaymentAccountId] = useState<string | null>(null);

  const [rtDescription, setRtDescription] = useState('');
  const [rtAmount, setRtAmount] = useState('');
  const [rtType, setRtType] = useState<'income' | 'expense'>('income');
  const [rtAccountId, setRtAccountId] = useState<string | null>(null);
  const [rtCategory, setRtCategory] = useState<string | null>(null);
  const [savedGoal, setSavedGoal] = useState(false);
  const [savedRt, setSavedRt] = useState(false);

  const currencyList = useMemo(currencyOptions, []);
  const typeOptions = useMemo(() => ALL_ACCOUNT_TYPES.map(type => ({ id: type, label: type })), []);
  const accountOptions = useMemo(() => {
    const options = sortAccountsByType(accounts).map(account => ({
      id: account.id,
      label: account.name,
      group: account.status === 'closed' ? 'Closed' : account.type,
    }));
    return accountName && !accounts.some(account => account.id === ids.account)
      ? [...options, { id: ids.account, label: accountName, group: 'New' }]
      : options;
  }, [accounts, accountName, ids.account]);
  const categoryOptions = useMemo(
    () => categoryPickerOptions(rtType === 'expense' ? expenseCategories : [], rtType === 'income' ? incomeCategories : []),
    [rtType, expenseCategories, incomeCategories]
  );

  const parsedBalance = parseAmountInput(balance);
  const parsedGoal = parseAmountInput(goalAmount);
  const parsedRt = parseAmountInput(rtAmount);
  const repeatAccountId = rtAccountId ?? ids.account;

  const isGoalStarted = !!goalName || !!goalAmount;
  const isRtStarted = !!rtDescription || !!rtAmount || !!rtCategory;
  const isGoalReady = !!goalName && parsedGoal > 0;
  const isRtReady = !!rtDescription && parsedRt > 0 && !!rtCategory;
  const isBlocked = (step === 3 && (!accountName.trim() || Number.isNaN(parsedBalance)))
    || (step === 4 && isGoalStarted && !isGoalReady)
    || (step === 5 && isRtStarted && !isRtReady);

  const saveStep = () => {
    if (step === 2) setPreferences(prev => ({ ...prev, currency: currencyPreference(currency) }));
    if (step === 3) {
      saveAccount({
        id: ids.account,
        name: accountName.trim(),
        type: accountType,
        balance: parsedBalance,
        currency: accountCurrency,
        isPrimary: isFirstAccount,
        icon: ACCOUNT_TYPE_STYLES[accountType]?.icon || 'wallet',
      });
    }
    if (step === 4 && isGoalReady) {
      setSavedGoal(true);
      saveFinancialGoal({
        id: ids.goal,
        name: goalName,
        amount: parsedGoal,
        currentAmount: 0,
        date: goalDate,
        type: 'one-time',
        transactionType: 'expense',
        currency,
        paymentAccountId: paymentAccountId || undefined,
      });
    }
    if (step === 5 && isRtReady) {
      const today = toLocalISOString(new Date());
      setSavedRt(true);
      saveRecurringTransaction({
        id: ids.recurring,
        accountId: repeatAccountId,
        description: rtDescription,
        amount: parsedRt,
        type: rtType,
        category: rtCategory!,
        currency: accounts.find(account => account.id === repeatAccountId)?.currency || accountCurrency,
        frequency: 'monthly',
        startDate: today,
        nextDueDate: today,
        weekendAdjustment: 'on',
      });
    }
  };

  const next = () => {
    saveStep();
    if (step < LAST_STEP) setStep(step + 1);
    else onClose();
  };

  const titles = [`Welcome, ${user.firstName}`, 'Choose your main currency', 'Add your first account', 'Set a goal', 'Add something that repeats', "You're all set"];
  const descriptions = [
    'A few steps and your money is in one place.',
    'Totals and reports appear in this currency.',
    'Your main current or savings account is a good start.',
    'Optional. What are you saving for?',
    'Optional. A regular income or expense, such as your salary or rent.',
    'Your overview is ready.',
  ];

  return (
    <FullPanel
      isOpen={isOpen}
      onClose={onClose}
      title={titles[step - 1]}
      description={step < LAST_STEP ? `Step ${step} of ${LAST_STEP}. ${descriptions[step - 1]}` : descriptions[step - 1]}
      isDirty={step > 1 && step < LAST_STEP}
      footer={close => (
        <div className="flex flex-col-reverse gap-2 md:flex-row md:items-center md:justify-end">
          {step === 1 && <Button variant="ghost" onPress={close}>Skip for now</Button>}
          {step > 1 && step < LAST_STEP && <Button variant="ghost" className="md:mr-auto" onPress={() => setStep(step - 1)}>Back</Button>}
          {(step === 4 || step === 5) && <Button variant="secondary" onPress={() => setStep(step + 1)}>Skip</Button>}
          <Button isDisabled={isBlocked} onPress={next}>{step === 1 ? 'Get started' : step === LAST_STEP ? 'Go to Overview' : 'Next'}</Button>
        </div>
      )}
    >
      <div className="max-w-[480px] space-y-4">
        {step === 1 && (
          <ul className="space-y-3">
            {PLAN.map(item => (
              <li key={item.text} className="type-body flex items-center gap-3 text-ink">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-inset text-muted"><Icon name={item.icon} size={20} /></span>
                {item.text}
              </li>
            ))}
          </ul>
        )}
        {step === 2 && <Combobox label="Main currency" options={currencyList} value={currency} onChange={id => id && setCurrency(id)} placeholder="Search currencies" />}
        {step === 3 && (
          <>
            <TextInput autoFocus label="Name" placeholder="Main account" value={accountName} onChange={setAccountName} />
            <Select label="Type" options={typeOptions} value={accountType} onChange={id => setAccountType(id as AccountType)} />
            <AmountInput label="Current balance" currency={currencySign(accountCurrency)} value={balance} onChange={setBalance} />
            <Combobox label="Currency" options={currencyList} value={accountCurrency} onChange={id => id && setChosenAccountCurrency(id)} placeholder="Search currencies" />
          </>
        )}
        {step === 4 && (
          <>
            <TextInput autoFocus label="Goal" placeholder="Emergency fund" value={goalName} onChange={setGoalName} />
            <AmountInput label="Target amount" currency={currencySign(currency)} value={goalAmount} onChange={setGoalAmount} />
            <DateInput label="Target date" value={goalDate} onChange={setGoalDate} />
            <Combobox label="Paid from" help="Optional." options={accountOptions} value={paymentAccountId} onChange={setPaymentAccountId} placeholder="Search accounts" />
          </>
        )}
        {step === 5 && (
          <>
            <SegmentedControl items={FLOW_OPTIONS} activeId={rtType} onChange={id => { setRtType(id as 'income' | 'expense'); setRtCategory(null); }} />
            <TextInput autoFocus label="Description" placeholder={rtType === 'income' ? 'Salary' : 'Rent'} value={rtDescription} onChange={setRtDescription} />
            <AmountInput label="Amount each month" currency={currencySign(accountCurrency)} value={rtAmount} onChange={setRtAmount} />
            <Combobox label="Category" options={categoryOptions} value={rtCategory} onChange={setRtCategory} placeholder="Search categories" />
            <Combobox label="Account" options={accountOptions} value={repeatAccountId} onChange={setRtAccountId} placeholder="Search accounts" />
          </>
        )}
        {step === LAST_STEP && (
          <DetailList items={[
            { label: 'Main currency', value: currency },
            { label: 'Account', value: accountName.trim() },
            { label: 'Goal', value: savedGoal ? goalName : undefined },
            { label: 'Repeats', value: savedRt ? rtDescription : undefined },
          ]} />
        )}
      </div>
    </FullPanel>
  );
};

export default OnboardingModal;
