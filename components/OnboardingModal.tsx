import React, { useState, useEffect } from 'react';
import { Account, Category, AccountType, Currency, User, AppPreferences, FinancialGoal, RecurringTransaction } from '../types';
import { DelphiLogo, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, CURRENCIES, ACCOUNT_TYPE_STYLES, ALL_ACCOUNT_TYPES, CURRENCY_OPTIONS } from '../constants';
import Card from './Card';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  saveAccount: (account: Omit<Account, 'id'>) => void;
  saveFinancialGoal: (goal: Omit<FinancialGoal, 'id'>) => void;
  saveRecurringTransaction: (rt: Omit<RecurringTransaction, 'id'>) => void;
  preferences: AppPreferences;
  setPreferences: (prefs: AppPreferences) => void;
  accounts: Account[];
  incomeCategories: Category[];
  expenseCategories: Category[];
}

const OnboardingModal: React.FC<OnboardingModalProps> = ({ 
  isOpen, 
  onClose, 
  user,
  saveAccount, 
  saveFinancialGoal,
  saveRecurringTransaction,
  preferences,
  setPreferences,
  accounts,
  incomeCategories,
  expenseCategories
}) => {
  const [step, setStep] = useState(1);
  const totalSteps = 6;

  // Step 2 state
  const [currencyPref, setCurrencyPref] = useState(preferences.currency);

  // Step 3 state
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('Checking');
  const [balance, setBalance] = useState('');
  const [accountCurrency, setAccountCurrency] = useState<Currency>('EUR');

  // Step 4 state
  const [goalName, setGoalName] = useState('');
  const [goalAmount, setGoalAmount] = useState('');
  const [goalDate, setGoalDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  });
  
  // Step 5 state
  const [rtDescription, setRtDescription] = useState('');
  const [rtAmount, setRtAmount] = useState('');
  const [rtType, setRtType] = useState<'income' | 'expense'>('income');
  const [rtAccountId, setRtAccountId] = useState<string>('');
  const [rtCategory, setRtCategory] = useState('');

  // When a new account is created, set it as the default for the recurring transaction
  useEffect(() => {
    if (accounts.length > 0 && !rtAccountId) {
      setRtAccountId(accounts[accounts.length - 1].id);
    }
  }, [accounts, rtAccountId]);


  if (!isOpen) {
    return null;
  }

  const handleNext = () => {
    if (step === 2) {
      setPreferences({ ...preferences, currency: currencyPref });
    }
    if (step === 3) {
      if (!accountName || !balance) {
        alert('Please fill in all account details.');
        return;
      }
      const newAccount: Omit<Account, 'id'> = {
        name: accountName,
        type: accountType,
        balance: parseFloat(balance),
        currency: accountCurrency,
        isPrimary: accounts.length === 0,
        icon: ACCOUNT_TYPE_STYLES[accountType]?.icon || 'wallet',
      };
      saveAccount(newAccount);
    }
    if (step === 4) {
      if (goalName && goalAmount) {
         const newGoal: Omit<FinancialGoal, 'id'> = {
            name: goalName,
            amount: parseFloat(goalAmount),
            currentAmount: 0,
            date: goalDate,
            type: 'one-time',
            transactionType: 'expense', // Assume goals are for spending/saving up
            currency: 'EUR',
         };
         saveFinancialGoal(newGoal);
      }
    }
    if (step === 5) {
      if (rtDescription && rtAmount && rtAccountId && rtCategory) {
        const selectedAccount = accounts.find(a => a.id === rtAccountId);
        const newRt: Omit<RecurringTransaction, 'id'> = {
          accountId: rtAccountId,
          description: rtDescription,
          amount: parseFloat(rtAmount),
          type: rtType,
          category: rtCategory,
          currency: selectedAccount?.currency || 'EUR',
          frequency: 'monthly',
          startDate: new Date().toISOString().split('T')[0],
          nextDueDate: new Date().toISOString().split('T')[0], // For simplicity
          weekendAdjustment: 'on',
        };
        saveRecurringTransaction(newRt);
      }
    }

    if (step < totalSteps) {
      setStep(prev => prev + 1);
    } else {
      onClose();
    }
  };
  
  const handlePrevious = () => {
    if (step > 1) {
      setStep(prev => prev - 1);
    }
  };
  
  const handleSkip = () => {
    if (step === 4 || step === 5) {
      setStep(prev => prev + 1);
    } else {
      onClose();
    }
  };

  const renderStepContent = () => {
    switch(step) {
      case 1:
        return (
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">Welcome, {user.firstName}!</h1>
            <p className="text-lg text-light-text-secondary dark:text-dark-text-secondary max-w-md mx-auto">
              Let's get your finances set up in a few simple steps.
            </p>
          </div>
        );
      case 2:
        return (
          <Card className="w-full max-w-lg">
            <h2 className="text-2xl font-bold mb-4">Set your primary currency</h2>
            <p className="text-light-text-secondary dark:text-dark-text-secondary mb-6">
              This will be the default currency for your reports and summaries.
            </p>
            <div className={SELECT_WRAPPER_STYLE}>
              <select name="currency" value={currencyPref} onChange={e => setCurrencyPref(e.target.value)} className={INPUT_BASE_STYLE}>
                {CURRENCY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
            </div>
          </Card>
        );
      case 3:
        return (
            <Card className="w-full max-w-lg">
              <h2 className="text-2xl font-bold mb-4">Add your first account</h2>
              <p className="text-light-text-secondary dark:text-dark-text-secondary mb-6">
                Start by adding a primary account, like your main checking or savings account.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">Account Name</label>
                  <input type="text" value={accountName} onChange={e => setAccountName(e.target.value)} className={INPUT_BASE_STYLE} placeholder="e.g., Main Checking" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">Account Type</label>
                  <div className={SELECT_WRAPPER_STYLE}>
                      <select value={accountType} onChange={e => setAccountType(e.target.value as AccountType)} className={INPUT_BASE_STYLE}>
                          {ALL_ACCOUNT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                      </select>
                      <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">Current Balance</label>
                    <input type="number" step="0.01" value={balance} onChange={e => setBalance(e.target.value)} className={INPUT_BASE_STYLE} placeholder="0.00" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">Currency</label>
                    <div className={SELECT_WRAPPER_STYLE}>
                      <select value={accountCurrency} onChange={e => setAccountCurrency(e.target.value as Currency)} className={INPUT_BASE_STYLE}>
                          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          );
      case 4:
         return (
          <Card className="w-full max-w-lg">
            <h2 className="text-2xl font-bold mb-4">Set a financial goal (Optional)</h2>
            <p className="text-light-text-secondary dark:text-dark-text-secondary mb-6">
              What are you saving for? Setting a goal can help you stay motivated.
            </p>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">Goal Name</label>
                    <input type="text" value={goalName} onChange={e => setGoalName(e.target.value)} className={INPUT_BASE_STYLE} placeholder="e.g., Emergency Fund, New Car" />
                </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">Target Amount (EUR)</label>
                        <input type="number" step="0.01" value={goalAmount} onChange={e => setGoalAmount(e.target.value)} className={INPUT_BASE_STYLE} placeholder="e.g., 5000" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">Target Date</label>
                        <input type="date" value={goalDate} onChange={e => setGoalDate(e.target.value)} className={INPUT_BASE_STYLE} />
                    </div>
                </div>
            </div>
          </Card>
        );
      case 5:
        const activeCategories = rtType === 'income' ? incomeCategories : expenseCategories;
        return (
          <Card className="w-full max-w-lg">
            <h2 className="text-2xl font-bold mb-4">Add a recurring transaction (Optional)</h2>
            <p className="text-light-text-secondary dark:text-dark-text-secondary mb-6">
              Automate your finances by adding a regular income or expense like your salary or rent.
            </p>
            <div className="space-y-4">
                <div className="flex bg-light-bg dark:bg-dark-bg p-1 rounded-lg">
                    <button type="button" onClick={() => setRtType('income')} className={`w-full py-2 rounded text-sm font-semibold ${rtType === 'income' ? 'bg-green-500 text-white' : ''}`}>Income</button>
                    <button type="button" onClick={() => setRtType('expense')} className={`w-full py-2 rounded text-sm font-semibold ${rtType === 'expense' ? 'bg-red-500 text-white' : ''}`}>Expense</button>
                </div>
                <div>
                    <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">Description</label>
                    <input type="text" value={rtDescription} onChange={e => setRtDescription(e.target.value)} className={INPUT_BASE_STYLE} placeholder={rtType === 'income' ? 'e.g., Monthly Salary' : 'e.g., Rent'} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">Amount</label>
                        <input type="number" step="0.01" value={rtAmount} onChange={e => setRtAmount(e.target.value)} className={INPUT_BASE_STYLE} placeholder="0.00" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">Category</label>
                         <div className={SELECT_WRAPPER_STYLE}>
                            <select value={rtCategory} onChange={e => setRtCategory(e.target.value)} className={INPUT_BASE_STYLE}>
                                <option value="">Select...</option>
                                {activeCategories.filter(c => !c.parentId).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                            </select>
                            <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                        </div>
                    </div>
                </div>
            </div>
          </Card>
        );
      case 6:
         return (
          <div className="text-center">
            <div className="w-24 h-24 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-6xl text-green-500">check_circle</span>
            </div>
            <h1 className="text-4xl font-bold mb-4">You're all set!</h1>
            <p className="text-lg text-light-text-secondary dark:text-dark-text-secondary max-w-md mx-auto">
              You can now explore your personalized Delphi dashboard.
            </p>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-light-bg dark:bg-dark-bg z-[100] flex flex-col p-6 transition-opacity duration-300">
        <header className="flex-shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <DelphiLogo theme="system" />
                <span className="text-xl font-bold">Delphi Setup</span>
            </div>
            {(step === 1 || step === 6) && (
                <button onClick={onClose} className="font-semibold text-primary-500 hover:underline">
                    {step === 1 ? 'Skip for now' : 'Go to Dashboard'}
                </button>
            )}
        </header>

        <main className="flex-grow flex items-center justify-center">
            {renderStepContent()}
        </main>
        
        <footer className="flex-shrink-0 flex items-center justify-between">
            <div>
                {step > 1 && step < totalSteps && (
                    <button onClick={handlePrevious} className={BTN_SECONDARY_STYLE}>Back</button>
                )}
            </div>
            <div className="flex items-center gap-4">
                <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Step {step} of {totalSteps}</span>
                {step === 1 ? (
                    <button onClick={handleNext} className={BTN_PRIMARY_STYLE}>Get Started</button>
                ) : step < totalSteps ? (
                    <>
                        {(step === 4 || step === 5) && <button onClick={handleSkip} className={BTN_SECONDARY_STYLE}>Skip</button>}
                        <button onClick={handleNext} className={BTN_PRIMARY_STYLE}>Next</button>
                    </>
                ) : (
                    <button onClick={onClose} className={BTN_PRIMARY_STYLE}>Finish</button>
                )}
            </div>
        </footer>
    </div>
  );
};

export default OnboardingModal;