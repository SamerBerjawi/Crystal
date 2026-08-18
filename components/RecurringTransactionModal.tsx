
import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Account, 
  Category, 
  RecurringTransaction, 
  RecurrenceFrequency, 
  WeekendAdjustment,
  BillPayment 
} from '../types';
import { 
  INPUT_BASE_STYLE, 
  SELECT_STYLE, 
  BTN_PRIMARY_STYLE, 
  BTN_SECONDARY_STYLE, 
  SELECT_WRAPPER_STYLE, 
  SELECT_ARROW_STYLE, 
  FREQUENCIES, 
  WEEKEND_ADJUSTMENTS, 
  ALL_ACCOUNT_TYPES,
  LIQUID_ACCOUNT_TYPES 
} from '../constants';
import { parseLocalDate, toLocalISOString, formatCurrency } from '../utils';
import Icon from './ui/Icon';

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

const CategoryOptions: React.FC<{ categories: Category[]; showTransferOption?: boolean }> = ({ 
  categories, 
  showTransferOption 
}) => (
  <>
    <option value="">Select a category</option>
    {showTransferOption && <option value="Transfer">Transfer</option>}
    {categories.map((parentCat) => (
      <optgroup key={parentCat.id} label={parentCat.name}>
        <option value={parentCat.name}>{parentCat.name}</option>
        {parentCat.subCategories.map((subCat) => (
          <option key={subCat.id} value={subCat.name}>
            &nbsp;&nbsp;{subCat.name}
          </option>
        ))}
      </optgroup>
    ))}
  </>
);

const AccountOptions: React.FC<{ accounts: Account[] }> = ({ accounts }) => {
  const groupedAccounts = useMemo(() => {
    const groups: Record<string, Account[]> = {};
    accounts.forEach((acc) => {
      if (!groups[acc.type]) groups[acc.type] = [];
      groups[acc.type].push(acc);
    });
    return groups;
  }, [accounts]);

  return (
    <>
      {ALL_ACCOUNT_TYPES.map((type) => {
        const group = groupedAccounts[type];
        if (!group || group.length === 0) return null;
        return (
          <optgroup key={type} label={type}>
            {group.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name} ({formatCurrency(acc.balance, acc.currency)})
              </option>
            ))}
          </optgroup>
        );
      })}
    </>
  );
};

const RecurringTransactionModal: React.FC<RecurringTransactionModalProps> = ({
  isOpen = true,
  onClose,
  onSave,
  onSaveBill,
  accounts,
  incomeCategories = [],
  expenseCategories = [],
  recurringTransactionToEdit,
  billToEdit,
  initialMode = 'recurring',
  initialDate,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  
  // Primary mode switcher: 'recurring' | 'one-time'
  const [mode, setMode] = useState<'recurring' | 'one-time'>(() => {
    if (billToEdit) return 'one-time';
    if (recurringTransactionToEdit) return 'recurring';
    return initialMode;
  });

  // Recurring form fields
  const isEditingRecurring = !!recurringTransactionToEdit?.id;
  const [type, setType] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [accountId, setAccountId] = useState(accounts.length > 0 ? accounts[0].id : '');
  const [toAccountId, setToAccountId] = useState(accounts.length > 1 ? accounts[1].id : '');
  const [description, setDescription] = useState('');
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('monthly');
  const [frequencyInterval, setFrequencyInterval] = useState('1');
  const [startDate, setStartDate] = useState(initialDate || toLocalISOString(new Date()));
  const [endDate, setEndDate] = useState('');
  const [weekendAdjustment, setWeekendAdjustment] = useState<WeekendAdjustment>('on');
  const [dueDateOfMonth, setDueDateOfMonth] = useState('');

  // One-time bill form fields
  const isEditingBill = !!billToEdit?.id;
  const [billDescription, setBillDescription] = useState(billToEdit?.description || '');
  const [billAmount, setBillAmount] = useState(billToEdit ? String(Math.abs(billToEdit.amount)) : '');
  const [billType, setBillType] = useState<'payment' | 'deposit'>(billToEdit?.type || 'payment');
  const [billDueDate, setBillDueDate] = useState(billToEdit?.dueDate || initialDate || toLocalISOString(new Date()));
  const [billAccountId, setBillAccountId] = useState(billToEdit?.accountId || '');

  // Animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  // ESC key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
    }, 280);
  };

  // Sync state when recurringTransactionToEdit changes
  useEffect(() => {
    if (recurringTransactionToEdit) {
      setMode('recurring');
      setType(recurringTransactionToEdit.type);
      setAccountId(recurringTransactionToEdit.accountId);
      if (recurringTransactionToEdit.type === 'transfer') {
        setToAccountId(recurringTransactionToEdit.toAccountId || '');
      }
      setDescription(recurringTransactionToEdit.description);
      setMerchant(recurringTransactionToEdit.merchant || '');
      setAmount(String(recurringTransactionToEdit.amount));
      setCategory(recurringTransactionToEdit.category || '');
      setFrequency(recurringTransactionToEdit.frequency);
      setFrequencyInterval(String(recurringTransactionToEdit.frequencyInterval || '1'));
      setStartDate(recurringTransactionToEdit.startDate);
      setEndDate(recurringTransactionToEdit.endDate || '');
      setWeekendAdjustment(recurringTransactionToEdit.weekendAdjustment || 'on');
      setDueDateOfMonth(String(recurringTransactionToEdit.dueDateOfMonth || ''));
    }
  }, [recurringTransactionToEdit]);

  // Sync state when billToEdit changes
  useEffect(() => {
    if (billToEdit) {
      setMode('one-time');
      setBillDescription(billToEdit.description || '');
      setBillAmount(String(Math.abs(billToEdit.amount)));
      setBillType(billToEdit.type || 'payment');
      setBillDueDate(billToEdit.dueDate || toLocalISOString(new Date()));
      setBillAccountId(billToEdit.accountId || '');
    }
  }, [billToEdit]);

  const activeCategories = useMemo(() => {
    return type === 'income' ? incomeCategories : expenseCategories;
  }, [type, incomeCategories, expenseCategories]);

  const availableAccounts = useMemo(() => {
    return accounts.filter((acc) => acc.status !== 'closed' || acc.id === accountId || acc.id === toAccountId);
  }, [accounts, accountId, toAccountId]);

  const liquidPaymentAccounts = useMemo(() => {
    return accounts.filter((a) => LIQUID_ACCOUNT_TYPES.includes(a.type) || a.id === billAccountId);
  }, [accounts, billAccountId]);

  useEffect(() => {
    if (!isEditingRecurring) {
      if (type === 'transfer') {
        setCategory('Transfer');
      } else {
        setCategory('');
      }
    }
  }, [type, isEditingRecurring]);

  useEffect(() => {
    if (frequency === 'daily') {
      setFrequencyInterval('1');
    }
  }, [frequency]);

  const handleRecurringSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const isTransfer = type === 'transfer';
    const isMissingCategory = !isTransfer && !category;
    const isMissingToAccount = isTransfer && !toAccountId;
    const interval = parseInt(frequencyInterval, 10);

    if (!amount || !accountId || !startDate || isMissingCategory || isMissingToAccount || !interval || interval < 1) {
      alert('Please fill in all required fields with valid values.');
      return;
    }

    const fromAccount = accounts.find((acc) => acc.id === accountId);
    if (!fromAccount) {
      alert("Selected 'from' account is invalid.");
      return;
    }

    const start = parseLocalDate(startDate);
    let nextDue = new Date(start);

    if ((frequency === 'monthly' || frequency === 'yearly') && dueDateOfMonth) {
      const day = parseInt(dueDateOfMonth, 10);
      nextDue.setDate(day);
      if (nextDue < start) {
        nextDue.setMonth(nextDue.getMonth() + 1);
      }
    }

    const firstDueDate = toLocalISOString(nextDue);

    const dataToSave: Omit<RecurringTransaction, 'id'> & { id?: string } = {
      id: recurringTransactionToEdit?.id,
      accountId,
      toAccountId: isTransfer ? toAccountId : undefined,
      description: description.trim() || merchant.trim() || 'Recurring Transaction',
      merchant: merchant.trim() || undefined,
      amount: parseFloat(amount),
      category: isTransfer ? 'Transfer' : category,
      type,
      currency: fromAccount.currency,
      frequency,
      frequencyInterval: interval,
      startDate,
      endDate: endDate || undefined,
      nextDueDate: firstDueDate,
      dueDateOfMonth: (frequency === 'monthly' || frequency === 'yearly') && dueDateOfMonth ? parseInt(dueDateOfMonth, 10) : undefined,
      weekendAdjustment,
    };

    if (onSave) {
      onSave(dataToSave);
    }
    handleClose();
  };

  const handleBillSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const numAmount = parseFloat(billAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    const billToSave: Omit<BillPayment, 'id'> & { id?: string } = {
      id: billToEdit?.id,
      description: billDescription.trim() || (billType === 'payment' ? 'One-time Bill' : 'One-time Income'),
      amount: billType === 'payment' ? -Math.abs(numAmount) : Math.abs(numAmount),
      type: billType,
      currency: 'EUR',
      dueDate: billDueDate,
      status: billToEdit?.status || 'unpaid',
      accountId: billAccountId || undefined,
    };

    if (onSaveBill) {
      onSaveBill(billToSave);
    }
    handleClose();
  };

  const labelStyle = 'block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-1.5';

  const isEditing = mode === 'recurring' ? isEditingRecurring : isEditingBill;

  if (!isOpen) return null;

  const content = (
    <div className="fixed inset-0 z-[9999] overflow-hidden">
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      {/* Slide-out Sidebar Drawer Container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10 pointer-events-none">
        <div 
          className={`pointer-events-auto w-screen max-w-full sm:max-w-xl md:max-w-2xl h-screen bg-white/90 dark:bg-[#16171a]/90 backdrop-blur-2xl text-light-text dark:text-white shadow-2xl border-l border-black/10 dark:border-white/10 flex flex-col justify-between transform transition-transform duration-300 ease-out ${
            isVisible ? 'translate-x-0' : 'translate-x-full'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Ambient Top Glow */}
          <div className="absolute top-0 right-0 left-0 h-40 bg-gradient-to-b from-primary-500/10 via-teal-500/5 to-transparent pointer-events-none" />

        {/* Header matching CategoryModal */}
        <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-gradient-to-r from-primary-500/5 to-transparent shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-primary-500 flex items-center justify-center text-white shrink-0 shadow-md transition-transform hover:scale-105">
              <Icon name={mode === 'recurring' ? 'refresh' : 'receipt'} className="text-2xl" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-light-text dark:text-dark-text tracking-tight truncate">
                  {isEditing ? (mode === 'recurring' ? 'Edit Recurring Series' : 'Edit Obligation') : 'Scheduled Obligation'}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20">
                  {mode === 'recurring' ? 'Series' : 'One-Time'}
                </span>
              </div>
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate mt-0.5 font-medium">
                {mode === 'recurring' 
                  ? 'Automated cashflow rules, subscriptions & recurring payroll' 
                  : 'Single maturity bills, invoices & upcoming settlements'}
              </p>
            </div>
          </div>

          <button 
            onClick={handleClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
            aria-label="Close drawer"
          >
            <Icon name="close" className="text-lg" />
          </button>
        </div>

        {/* 2. TOP MODE SWITCHER TABS */}
        <div className="px-6 pt-4 pb-2 shrink-0">
          <div className="p-1 bg-black/5 dark:bg-white/5 rounded-2xl flex items-center gap-1 border border-black/5 dark:border-white/5">
            <button
              type="button"
              onClick={() => setMode('recurring')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                mode === 'recurring'
                  ? 'bg-white dark:bg-dark-card text-primary-600 dark:text-primary-400 shadow-sm border border-black/5 dark:border-white/10'
                  : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              <Icon name="refresh" className="text-sm" />
              <span>Recurring Series</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('one-time')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                mode === 'one-time'
                  ? 'bg-white dark:bg-dark-card text-teal-600 dark:text-teal-400 shadow-sm border border-black/5 dark:border-white/10'
                  : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              <Icon name="receipt" className="text-sm" />
              <span>One-Time Obligation</span>
            </button>
          </div>
        </div>

        {/* 3. SCROLLABLE FORM BODY */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 custom-scrollbar">
          {mode === 'recurring' ? (
            /* ============================================================ */
            /* RECURRING FORM                                               */
            /* ============================================================ */
            <form id="recurring-obligation-form" onSubmit={handleRecurringSubmit} className="space-y-6">
              {/* Type Segmented Control */}
              <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-2xl border border-black/5 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setType('expense')}
                  className={`flex-1 py-2 text-xs font-bold tracking-wider uppercase rounded-xl transition-all ${
                    type === 'expense'
                      ? 'bg-white dark:bg-dark-card text-rose-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  Expense
                </button>
                <button
                  type="button"
                  onClick={() => setType('income')}
                  className={`flex-1 py-2 text-xs font-bold tracking-wider uppercase rounded-xl transition-all ${
                    type === 'income'
                      ? 'bg-white dark:bg-dark-card text-emerald-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  Income
                </button>
                <button
                  type="button"
                  onClick={() => setType('transfer')}
                  className={`flex-1 py-2 text-xs font-bold tracking-wider uppercase rounded-xl transition-all ${
                    type === 'transfer'
                      ? 'bg-white dark:bg-dark-card text-blue-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  Transfer
                </button>
              </div>

              {/* Hero Amount Input */}
              <div className="p-6 rounded-3xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 flex flex-col items-center">
                <label htmlFor="rec-amount" className="text-2xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary opacity-70 mb-2">
                  Recurring Amount Per Cycle
                </label>
                <div className="relative w-full max-w-[280px]">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-3xl font-black text-gray-400 pointer-events-none">
                    €
                  </span>
                  <input
                    id="rec-amount"
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-transparent border-none text-center text-5xl font-black text-light-text dark:text-white tabular-nums placeholder-gray-300 dark:placeholder-gray-700 focus:outline-none focus:ring-0 py-2 pl-8"
                    placeholder="0.00"
                    required
                    autoFocus
                  />
                  <div className="mt-2 w-12 h-1 bg-primary-500/30 mx-auto rounded-full" />
                </div>
              </div>

              {/* Core Logistics Section */}
              <div className="space-y-4 p-5 rounded-3xl bg-black/[0.015] dark:bg-white/[0.015] border border-black/5 dark:border-white/5">
                <h4 className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                  <Icon name="tag" className="text-primary-500 text-sm" />
                  <span>Entity & Taxonomy</span>
                </h4>

                {type !== 'transfer' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="rec-merchant" className={labelStyle}>
                        Merchant / Payee
                      </label>
                      <input
                        id="rec-merchant"
                        type="text"
                        value={merchant}
                        onChange={(e) => setMerchant(e.target.value)}
                        className={`${INPUT_BASE_STYLE} h-12 font-bold`}
                        placeholder="e.g. Netflix, Gym, Landlord"
                      />
                    </div>
                    <div>
                      <label htmlFor="rec-description" className={labelStyle}>
                        Internal Memo / Title
                      </label>
                      <input
                        id="rec-description"
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className={`${INPUT_BASE_STYLE} h-12`}
                        placeholder="e.g. Monthly Standard Subscription"
                        required
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label htmlFor="rec-description" className={labelStyle}>
                      Transfer Description
                    </label>
                    <input
                      id="rec-description"
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className={`${INPUT_BASE_STYLE} h-12 font-bold`}
                      placeholder="e.g. Monthly Savings Allocation"
                      required
                    />
                  </div>
                )}

                {type !== 'transfer' && (
                  <div>
                    <label htmlFor="rec-category" className={labelStyle}>
                      Ledger Category
                    </label>
                    <div className={SELECT_WRAPPER_STYLE}>
                      <select
                        id="rec-category"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className={`${SELECT_STYLE} h-12 font-medium`}
                        required
                      >
                        <CategoryOptions categories={activeCategories} />
                      </select>
                      <div className={SELECT_ARROW_STYLE}>
                        <Icon name="expand_more" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Capital Accounts Section */}
              <div className="space-y-4 p-5 rounded-3xl bg-black/[0.015] dark:bg-white/[0.015] border border-black/5 dark:border-white/5">
                <h4 className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                  <Icon name="wallet" className="text-teal-500 text-sm" />
                  <span>Linked Accounts</span>
                </h4>

                {type === 'transfer' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                    <div>
                      <label htmlFor="rec-from-account" className={labelStyle}>
                        From Account
                      </label>
                      <div className={SELECT_WRAPPER_STYLE}>
                        <select
                          id="rec-from-account"
                          value={accountId}
                          onChange={(e) => setAccountId(e.target.value)}
                          className={`${SELECT_STYLE} h-12 font-bold`}
                          required
                        >
                          <option value="" disabled>
                            Select source account
                          </option>
                          <AccountOptions accounts={availableAccounts.filter((a) => a.id !== toAccountId)} />
                        </select>
                        <div className={SELECT_ARROW_STYLE}>
                          <Icon name="expand_more" />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="rec-to-account" className={labelStyle}>
                        To Account
                      </label>
                      <div className={SELECT_WRAPPER_STYLE}>
                        <select
                          id="rec-to-account"
                          value={toAccountId}
                          onChange={(e) => setToAccountId(e.target.value)}
                          className={`${SELECT_STYLE} h-12 font-bold`}
                          required
                        >
                          <option value="" disabled>
                            Select target account
                          </option>
                          <AccountOptions accounts={availableAccounts.filter((a) => a.id !== accountId)} />
                        </select>
                        <div className={SELECT_ARROW_STYLE}>
                          <Icon name="expand_more" />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label htmlFor="rec-account" className={labelStyle}>
                      Primary Settlement Account
                    </label>
                    <div className={SELECT_WRAPPER_STYLE}>
                      <select
                        id="rec-account"
                        value={accountId}
                        onChange={(e) => setAccountId(e.target.value)}
                        className={`${SELECT_STYLE} h-12 font-bold`}
                        required
                      >
                        <option value="" disabled>
                          Select an account
                        </option>
                        <AccountOptions accounts={availableAccounts} />
                      </select>
                      <div className={SELECT_ARROW_STYLE}>
                        <Icon name="expand_more" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Recurrence Engine Section */}
              <div className="space-y-4 p-5 rounded-3xl bg-black/[0.015] dark:bg-white/[0.015] border border-black/5 dark:border-white/5">
                <h4 className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                  <Icon name="calendar" className="text-amber-500 text-sm" />
                  <span>Recurrence Engine & Timing</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="rec-frequency" className={labelStyle}>
                      Frequency Interval
                    </label>
                    <div className="flex items-center gap-2">
                      {frequency !== 'daily' && (
                        <input
                          type="number"
                          value={frequencyInterval}
                          onChange={(e) => setFrequencyInterval(e.target.value)}
                          className={`${INPUT_BASE_STYLE} w-20 text-center font-black h-12`}
                          min="1"
                          title="Every X periods"
                        />
                      )}
                      <div className={`${SELECT_WRAPPER_STYLE} flex-1`}>
                        <select
                          id="rec-frequency"
                          value={frequency}
                          onChange={(e) => setFrequency(e.target.value as RecurrenceFrequency)}
                          className={`${SELECT_STYLE} font-bold h-12`}
                        >
                          {FREQUENCIES.map((f) => (
                            <option key={f.value} value={f.value}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                        <div className={SELECT_ARROW_STYLE}>
                          <Icon name="expand_more" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="rec-weekend-adjustment" className={labelStyle}>
                      Weekend Settlement Rule
                    </label>
                    <div className={SELECT_WRAPPER_STYLE}>
                      <select
                        id="rec-weekend-adjustment"
                        value={weekendAdjustment}
                        onChange={(e) => setWeekendAdjustment(e.target.value as WeekendAdjustment)}
                        className={`${SELECT_STYLE} h-12 font-medium`}
                      >
                        {WEEKEND_ADJUSTMENTS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <div className={SELECT_ARROW_STYLE}>
                        <Icon name="expand_more" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="rec-start-date" className={labelStyle}>
                      Series Start Date
                    </label>
                    <input
                      id="rec-start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className={`${INPUT_BASE_STYLE} h-12 font-semibold`}
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="rec-end-date" className={labelStyle}>
                      End Date (Optional)
                    </label>
                    <input
                      id="rec-end-date"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className={`${INPUT_BASE_STYLE} h-12 font-semibold`}
                      placeholder="Indefinite"
                    />
                  </div>
                </div>

                {(frequency === 'monthly' || frequency === 'yearly') && (
                  <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 flex items-center gap-3.5">
                    <div className="shrink-0">
                      <label htmlFor="rec-due-date" className={labelStyle}>
                        Billing Day
                      </label>
                      <input
                        id="rec-due-date"
                        type="number"
                        min="1"
                        max="31"
                        value={dueDateOfMonth}
                        onChange={(e) => setDueDateOfMonth(e.target.value)}
                        className={`${INPUT_BASE_STYLE} w-20 text-center font-black h-11`}
                        placeholder="Day"
                      />
                    </div>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-relaxed opacity-75">
                      Explicit day of month (1-31). If left blank, it defaults to the day matching the series start date.
                    </p>
                  </div>
                )}
              </div>
            </form>
          ) : (
            /* ============================================================ */
            /* ONE-TIME OBLIGATION FORM                                     */
            /* ============================================================ */
            <form id="one-time-obligation-form" onSubmit={handleBillSubmit} className="space-y-6">
              {/* Type Segmented Control */}
              <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-2xl border border-black/5 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setBillType('payment')}
                  className={`flex-1 py-2 text-xs font-bold tracking-wider uppercase rounded-xl transition-all ${
                    billType === 'payment'
                      ? 'bg-white dark:bg-dark-card text-rose-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  Expenditure / Outflow
                </button>
                <button
                  type="button"
                  onClick={() => setBillType('deposit')}
                  className={`flex-1 py-2 text-xs font-bold tracking-wider uppercase rounded-xl transition-all ${
                    billType === 'deposit'
                      ? 'bg-white dark:bg-dark-card text-emerald-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  Acquisition / Inflow
                </button>
              </div>

              {/* Hero Amount Input */}
              <div className="p-6 rounded-3xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 flex flex-col items-center">
                <label htmlFor="bill-amount" className="text-2xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary opacity-70 mb-2">
                  Settlement Value
                </label>
                <div className="relative w-full max-w-[280px]">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-3xl font-black text-gray-400 pointer-events-none">
                    €
                  </span>
                  <input
                    id="bill-amount"
                    type="number"
                    step="0.01"
                    value={billAmount}
                    onChange={(e) => setBillAmount(e.target.value)}
                    className="w-full bg-transparent border-none text-center text-5xl font-black text-light-text dark:text-white tabular-nums placeholder-gray-300 dark:placeholder-gray-700 focus:outline-none focus:ring-0 py-2 pl-8"
                    placeholder="0.00"
                    required
                    autoFocus
                  />
                  <div className="mt-2 w-12 h-1 bg-teal-500/30 mx-auto rounded-full" />
                </div>
              </div>

              {/* Obligation Details */}
              <div className="space-y-4 p-5 rounded-3xl bg-black/[0.015] dark:bg-white/[0.015] border border-black/5 dark:border-white/5">
                <h4 className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                  <Icon name="receipt" className="text-teal-500 text-sm" />
                  <span>Obligation Logistics</span>
                </h4>

                <div>
                  <label htmlFor="bill-desc" className={labelStyle}>
                    Description / Entity Memo
                  </label>
                  <input
                    id="bill-desc"
                    type="text"
                    value={billDescription}
                    onChange={(e) => setBillDescription(e.target.value)}
                    className={`${INPUT_BASE_STYLE} h-12 font-bold text-base`}
                    placeholder="e.g. Q3 Estimated Taxes, Annual Insurance, Invoice #1042"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="bill-dueDate" className={labelStyle}>
                      Maturity / Due Date
                    </label>
                    <input
                      id="bill-dueDate"
                      type="date"
                      value={billDueDate}
                      onChange={(e) => setBillDueDate(e.target.value)}
                      className={`${INPUT_BASE_STYLE} h-12 font-semibold`}
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="bill-account" className={labelStyle}>
                      Linked Capital Account
                    </label>
                    <div className={SELECT_WRAPPER_STYLE}>
                      <select
                        id="bill-account"
                        value={billAccountId}
                        onChange={(e) => setBillAccountId(e.target.value)}
                        className={`${SELECT_STYLE} h-12 font-bold`}
                      >
                        <option value="">Default Liquidity Account</option>
                        <AccountOptions accounts={liquidPaymentAccounts.length > 0 ? liquidPaymentAccounts : accounts} />
                      </select>
                      <div className={SELECT_ARROW_STYLE}>
                        <Icon name="expand_more" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* 4. DRAWER STICKY FOOTER */}
        <div className="p-6 border-t border-black/5 dark:border-white/5 flex items-center justify-between shrink-0 bg-white/80 dark:bg-[#16171a]/80 backdrop-blur-md z-20">
          <button
            type="button"
            onClick={handleClose}
            className={BTN_SECONDARY_STYLE}
          >
            Cancel
          </button>

          <button
            type="submit"
            form={mode === 'recurring' ? 'recurring-obligation-form' : 'one-time-obligation-form'}
            className={`${BTN_PRIMARY_STYLE} !py-2.5 !px-8 text-xs font-black tracking-wider uppercase shadow-md shadow-primary-500/20`}
          >
            {isEditing
              ? (mode === 'recurring' ? 'Update Series' : 'Update Obligation')
              : (mode === 'recurring' ? 'Commit Recurring Series' : 'Save Obligation')}
          </button>
        </div>
      </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default RecurringTransactionModal;
