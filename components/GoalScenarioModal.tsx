import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { FinancialGoal, GoalType, GoalCategory, RecurrenceFrequency, Account } from '../types';
import { INPUT_BASE_STYLE, SELECT_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, FREQUENCIES, ALL_ACCOUNT_TYPES } from '../constants';
import { toLocalISOString } from '../utils';
import { toast } from 'sonner';
import Icon from './ui/Icon';

interface GoalScenarioModalProps {
  onClose: () => void;
  onSave: (goal: Omit<FinancialGoal, 'id'> & { id?: string }) => void;
  goalToEdit?: FinancialGoal | null;
  financialGoals: FinancialGoal[];
  parentId?: string;
  accounts: Account[];
}

type ActiveTabType = 'strategy' | 'timeline' | 'linkage';

const GoalScenarioModal: React.FC<GoalScenarioModalProps> = ({ 
  onClose, 
  onSave, 
  goalToEdit, 
  financialGoals, 
  parentId: preselectedParentId, 
  accounts 
}) => {
  const isEditing = !!goalToEdit;
  const isSubGoal = !!preselectedParentId;

  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTabType>('strategy');

  const [name, setName] = useState('');
  const [type, setType] = useState<GoalType>('one-time');
  const [goalCategory, setGoalCategory] = useState<GoalCategory>('savings');
  const [transactionType, setTransactionType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('0');
  const [date, setDate] = useState(toLocalISOString(new Date()));
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('monthly');
  const [startDate, setStartDate] = useState(toLocalISOString(new Date()));
  const [monthlyContribution, setMonthlyContribution] = useState('');
  const [dueDateOfMonth, setDueDateOfMonth] = useState('');
  const [isBucket, setIsBucket] = useState(false);
  const [parentId, setParentId] = useState<string | undefined>(preselectedParentId);
  const [paymentAccountId, setPaymentAccountId] = useState<string | undefined>();

  // Smooth slide-in transition on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  // Handle ESC key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseDrawer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCloseDrawer = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
    }, 250);
  };

  const parentGoalOptions = useMemo(() => 
    financialGoals.filter(g => (g.isBucket || !g.parentId) && g.id !== goalToEdit?.id),
  [financialGoals, goalToEdit]);
  
  const groupedAccounts = useMemo(() => {
    const groups: Record<string, Account[]> = {};
    accounts.forEach(acc => {
      if (!groups[acc.type]) groups[acc.type] = [];
      groups[acc.type].push(acc);
    });
    return groups;
  }, [accounts]);

  useEffect(() => {
    if (isEditing && goalToEdit) {
      setName(goalToEdit.name);
      setType(goalToEdit.type);
      setGoalCategory(goalToEdit.goalCategory || (goalToEdit.transactionType === 'income' ? 'income' : 'savings'));
      setTransactionType(goalToEdit.transactionType);
      setAmount(String(goalToEdit.amount));
      setCurrentAmount(String(goalToEdit.currentAmount || 0));
      setDate(goalToEdit.date || toLocalISOString(new Date()));
      setFrequency(goalToEdit.frequency || 'monthly');
      setStartDate(goalToEdit.startDate || toLocalISOString(new Date()));
      setMonthlyContribution(String(goalToEdit.monthlyContribution || ''));
      setDueDateOfMonth(String(goalToEdit.dueDateOfMonth || ''));
      setIsBucket(!!goalToEdit.isBucket);
      setParentId(goalToEdit.parentId);
      setPaymentAccountId(goalToEdit.paymentAccountId);
    } else {
      setName('');
      setType('one-time');
      setGoalCategory('savings');
      setTransactionType('expense');
      setAmount('');
      setCurrentAmount('0');
      setDate(toLocalISOString(new Date()));
      setFrequency('monthly');
      setStartDate(toLocalISOString(new Date()));
      setMonthlyContribution('');
      setDueDateOfMonth('');
      setIsBucket(false);
      setParentId(preselectedParentId);
      setPaymentAccountId(undefined);
    }
  }, [isEditing, goalToEdit, preselectedParentId]);

  const handleClearFields = () => {
    setName('');
    setAmount('');
    setCurrentAmount('0');
    setMonthlyContribution('');
    setDueDateOfMonth('');
    toast.info('Goal fields reset');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter a goal alias');
      return;
    }
    if (!isBucket && (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0)) {
      toast.error('Please enter a valid target amount');
      return;
    }

    const goalData = {
      id: isEditing && goalToEdit ? goalToEdit.id : undefined,
      name: name.trim(),
      type: isBucket ? 'one-time' : type,
      goalCategory: isBucket ? 'savings' : goalCategory,
      transactionType: (isBucket ? 'expense' : (goalCategory === 'income' ? 'income' : 'expense')) as 'income' | 'expense',
      amount: isBucket ? 0 : parseFloat(amount),
      currentAmount: isBucket ? 0 : (currentAmount !== '' ? parseFloat(currentAmount) : 0),
      currency: 'EUR' as const,
      date: isBucket ? undefined : type === 'one-time' ? date : undefined,
      frequency: isBucket ? undefined : type === 'recurring' ? frequency : undefined,
      startDate: isBucket ? undefined : type === 'recurring' ? startDate : undefined,
      monthlyContribution: isBucket ? undefined : monthlyContribution ? parseFloat(monthlyContribution) : undefined,
      dueDateOfMonth: isBucket ? undefined : type === 'recurring' && (frequency === 'monthly' || frequency === 'yearly') && dueDateOfMonth ? parseInt(dueDateOfMonth) : undefined,
      isBucket,
      parentId: isBucket ? undefined : parentId,
      paymentAccountId: isBucket ? undefined : paymentAccountId,
    };

    onSave(goalData);
    handleCloseDrawer();
  };

  const labelStyle = "block text-xs font-bold text-gray-500 dark:text-gray-400 tracking-wider mb-1.5";

  const getAmountLabels = () => {
    switch (goalCategory) {
      case 'expense': return { target: 'Target Budget', current: 'Spent So Far' };
      case 'income': return { target: 'Target Income', current: 'Earned So Far' };
      default: return { target: 'Target Amount', current: 'Saved So Far' };
    }
  };
  const amountLabels = getAmountLabels();

  const modalTitle = isEditing 
    ? (isBucket ? 'Edit Goal Bucket' : 'Edit Goal') 
    : (isBucket ? 'New Goal Bucket' : (isSubGoal ? 'Add Item to Goal' : 'New Financial Goal'));

  const drawerContent = (
    <div className="fixed inset-0 z-[9999] overflow-hidden">
      {/* Backdrop Blur Overlay */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={handleCloseDrawer}
      />

      {/* Right-Side Full Height Slide-out Drawer */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
        <div 
          className={`w-screen max-w-full sm:max-w-xl md:max-w-2xl h-screen bg-white/90 dark:bg-[#16171a]/90 backdrop-blur-2xl text-gray-900 dark:text-white shadow-2xl border-l border-black/10 dark:border-white/10 flex flex-col justify-between transform transition-transform duration-300 ease-out ${
            isVisible ? 'translate-x-0' : 'translate-x-full'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header matching CategoryModal */}
          <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-gradient-to-r from-teal-500/5 to-transparent shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-teal-500 flex items-center justify-center text-white shrink-0 shadow-md transition-transform hover:scale-105">
                <Icon name={isEditing ? 'edit' : (isBucket ? 'folder' : 'flag')} className="text-2xl" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-light-text dark:text-dark-text tracking-tight truncate">
                    {modalTitle}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                    {isBucket ? 'Bucket' : 'Goal'}
                  </span>
                  {isSubGoal && (
                    <span className="px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                      Sub-Goal
                    </span>
                  )}
                </div>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate mt-0.5 font-medium">
                  Define capital milestones, targets & funding plans
                </p>
              </div>
            </div>
            <button 
              onClick={handleCloseDrawer}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
              aria-label="Close drawer"
            >
              <Icon name="close" className="text-lg" />
            </button>
          </div>

            {/* Hero Mode Selector & Target Card */}
            <div className="px-5 sm:px-6 py-3 space-y-3">
              {/* Mode Switcher */}
              {!isEditing && !isSubGoal && (
                <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-2xl border border-black/5 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => { setIsBucket(false); setType('one-time'); }}
                    className={`flex-1 py-2 text-xs font-bold tracking-wide rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      !isBucket && type === 'one-time'
                        ? 'bg-white dark:bg-dark-card text-teal-600 dark:text-teal-400 shadow-xs'
                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon name="event" className="text-xs" />
                    <span>Target Date</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setIsBucket(false); setType('recurring'); }}
                    className={`flex-1 py-2 text-xs font-bold tracking-wide rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      !isBucket && type === 'recurring'
                        ? 'bg-white dark:bg-dark-card text-teal-600 dark:text-teal-400 shadow-xs'
                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon name="sync_alt" className="text-xs" />
                    <span>Recurring</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsBucket(true)}
                    className={`flex-1 py-2 text-xs font-bold tracking-wide rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      isBucket
                        ? 'bg-white dark:bg-dark-card text-teal-600 dark:text-teal-400 shadow-xs'
                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon name="folder" className="text-xs" />
                    <span>Goal Bucket</span>
                  </button>
                </div>
              )}

              {/* Goal Identity & Target Amount Card */}
              <div className="p-4 rounded-3xl bg-white dark:bg-white/[0.03] border border-black/5 dark:border-white/5 shadow-2xs space-y-3">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-500 flex items-center justify-center shrink-0">
                    <Icon name={isBucket ? 'folder' : (goalCategory === 'income' ? 'monetization_on' : (goalCategory === 'expense' ? 'shopping_cart' : 'flag'))} className="text-xl" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <label htmlFor="drawer-goal-name" className="text-2xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 block mb-0.5">
                      {isBucket ? 'Bucket Alias' : (isSubGoal ? 'Objective Component' : 'Goal Alias')}
                    </label>
                    <input
                      id="drawer-goal-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-transparent border-none text-xl sm:text-2xl font-black text-gray-900 dark:text-white placeholder-black/20 dark:placeholder-white/20 focus:ring-0 p-0 tracking-tight"
                      placeholder={isBucket ? "e.g. Tactical Reserve" : "e.g. Vacation Fund, Dream Home"}
                      required
                      autoFocus
                      autoComplete="off"
                    />
                  </div>
                </div>

                {!isBucket && (
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-black/5 dark:border-white/5">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {amountLabels.target}
                    </span>

                    <div className="relative flex items-center gap-2">
                      <span className="text-2xl font-black font-mono text-gray-400 select-none">
                        €
                      </span>
                      <input
                        id="drawer-goal-amount"
                        type="number"
                        step="0.01"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        className="bg-transparent border-none text-right text-2xl sm:text-3xl font-black text-gray-900 dark:text-white placeholder-black/15 dark:placeholder-white/15 focus:ring-0 py-0 tracking-tight tabular-nums w-32 sm:w-40 focus:outline-hidden font-mono"
                        placeholder="0.00"
                        required
                        autoComplete="off"
                      />
                      <span className="text-xs font-mono font-bold text-gray-400 uppercase">
                        EUR
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Segmented Navigation Tabs */}
            <div className="px-5 sm:px-6 flex gap-1 border-t border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01] overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setActiveTab('strategy')}
                className={`py-3 px-3.5 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'strategy'
                    ? 'border-teal-500 text-teal-600 dark:text-teal-400 bg-teal-500/5'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon name="donut_large" className="text-sm" />
                <span>Strategy & Progress</span>
              </button>

              {!isBucket && (
                <button
                  type="button"
                  onClick={() => setActiveTab('timeline')}
                  className={`py-3 px-3.5 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    activeTab === 'timeline'
                      ? 'border-teal-500 text-teal-600 dark:text-teal-400 bg-teal-500/5'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Icon name="event" className="text-sm" />
                  <span>Timeline & Schedule</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setActiveTab('linkage')}
                className={`py-3 px-3.5 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'linkage'
                    ? 'border-teal-500 text-teal-600 dark:text-teal-400 bg-teal-500/5'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon name="account_tree" className="text-sm" />
                <span>Funding & Hierarchy</span>
              </button>
            </div>

          {/* 2. Scrollable Body Content */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 custom-scrollbar">
            <form id="goal-form" onSubmit={handleSubmit} className="space-y-5">
              
              {/* TAB 1: STRATEGY & PROGRESS */}
              {activeTab === 'strategy' && (
                <div className="space-y-4 animate-fade-in">
                  {!isBucket ? (
                    <div className="p-4.5 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-4">
                      <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
                        <div className="flex items-center gap-2">
                          <Icon name="donut_large" className="text-sm text-teal-500" />
                          <span className="text-xs font-bold text-gray-900 dark:text-white">Classification & Progress</span>
                        </div>
                        <span className="text-2xs text-teal-500 font-semibold uppercase">Strategy</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={labelStyle}>Logical Classification</label>
                          <div className={SELECT_WRAPPER_STYLE}>
                            <select
                              value={goalCategory}
                              onChange={e => setGoalCategory(e.target.value as GoalCategory)}
                              className={`${SELECT_STYLE} !h-10 text-xs font-bold`}
                            >
                              <option value="savings">Saving Strategy</option>
                              <option value="expense">Spending Target</option>
                              <option value="income">Income Objective</option>
                            </select>
                            <div className={SELECT_ARROW_STYLE}><Icon name="expand_more" /></div>
                          </div>
                        </div>

                        <div>
                          <label className={labelStyle}>{amountLabels.current}</label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              value={currentAmount}
                              onChange={e => setCurrentAmount(e.target.value)}
                              className={`${INPUT_BASE_STYLE} !h-10 text-xs font-black tabular-nums pl-8`}
                              placeholder="0.00"
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">€</span>
                          </div>
                        </div>

                        <div className="col-span-1 sm:col-span-2">
                          <label className={labelStyle}>
                            {type === 'one-time' ? 'Projected Monthly Contribution' : 'Recurrent Contribution'}
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              value={monthlyContribution}
                              onChange={e => setMonthlyContribution(e.target.value)}
                              className={`${INPUT_BASE_STYLE} !h-10 text-xs font-black tabular-nums pl-8`}
                              placeholder={type === 'one-time' ? "Auto-computed if blank" : "e.g. 250.00"}
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">€</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4.5 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-3">
                      <div className="flex items-center gap-2">
                        <Icon name="folder" className="text-teal-500 text-base" />
                        <h4 className="text-xs font-bold text-gray-900 dark:text-white">Goal Bucket Aggregator</h4>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
                        Goal buckets aggregate multiple sub-goals and target items. Their target amount, progress, and forecast completion automatically calculate from all assigned sub-goals.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: TIMELINE & SCHEDULE */}
              {activeTab === 'timeline' && !isBucket && (
                <div className="space-y-4 animate-fade-in">
                  <div className="p-4.5 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-4">
                    <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
                      <div className="flex items-center gap-2">
                        <Icon name="event" className="text-sm text-teal-500" />
                        <span className="text-xs font-bold text-gray-900 dark:text-white">Temporal Configuration</span>
                      </div>
                      <span className="text-2xs text-teal-500 font-semibold uppercase">{type}</span>
                    </div>

                    {type === 'one-time' ? (
                      <div>
                        <label className={labelStyle}>Deployment / Target Due Date</label>
                        <input
                          type="date"
                          value={date}
                          onChange={e => setDate(e.target.value)}
                          className={`${INPUT_BASE_STYLE} !h-10 text-xs font-medium`}
                          required
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={labelStyle}>Recurrence Frequency</label>
                          <div className={SELECT_WRAPPER_STYLE}>
                            <select
                              value={frequency}
                              onChange={e => setFrequency(e.target.value as RecurrenceFrequency)}
                              className={`${SELECT_STYLE} !h-10 text-xs font-bold`}
                            >
                              {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                            </select>
                            <div className={SELECT_ARROW_STYLE}><Icon name="expand_more" /></div>
                          </div>
                        </div>

                        <div>
                          <label className={labelStyle}>Start Sequence Date</label>
                          <input
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className={`${INPUT_BASE_STYLE} !h-10 text-xs font-medium`}
                            required
                          />
                        </div>

                        {(frequency === 'monthly' || frequency === 'yearly') && (
                          <div className="col-span-1 sm:col-span-2">
                            <label className={labelStyle}>Ordinal Due Day of Month</label>
                            <input
                              type="number"
                              min="1"
                              max="31"
                              value={dueDateOfMonth}
                              onChange={e => setDueDateOfMonth(e.target.value)}
                              className={`${INPUT_BASE_STYLE} !h-10 text-xs font-bold text-center`}
                              placeholder="Day (1-31)"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: FUNDING & HIERARCHY */}
              {activeTab === 'linkage' && (
                <div className="space-y-4 animate-fade-in">
                  {!isBucket && (
                    <div className="p-4.5 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-4">
                      <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
                        <div className="flex items-center gap-2">
                          <Icon name="account_balance_wallet" className="text-sm text-teal-500" />
                          <span className="text-xs font-bold text-gray-900 dark:text-white">Funding Source Linkage</span>
                        </div>
                        <span className="text-2xs text-teal-500 font-semibold uppercase">Account</span>
                      </div>

                      <div>
                        <label className={labelStyle}>Funding Source Ledger</label>
                        <div className={SELECT_WRAPPER_STYLE}>
                          <select
                            value={paymentAccountId || ''}
                            onChange={e => setPaymentAccountId(e.target.value || undefined)}
                            className={`${SELECT_STYLE} !h-10 text-xs font-bold`}
                          >
                            <option value="">Decoupled Status (No Linked Account)</option>
                            {Object.entries(groupedAccounts).map(([accType, group]) => (
                              <optgroup key={accType} label={accType}>
                                {group.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                              </optgroup>
                            ))}
                          </select>
                          <div className={SELECT_ARROW_STYLE}><Icon name="expand_more" /></div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Parent Bucket Linkage */}
                  {!isBucket && parentGoalOptions.length > 0 && (
                    <div className="p-4.5 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className={labelStyle}>Parent Goal Bucket Association</label>
                        {parentId && (
                          <span className="text-2xs text-teal-500 font-bold">Linked</span>
                        )}
                      </div>

                      <div className={SELECT_WRAPPER_STYLE}>
                        <select
                          value={parentId || ''}
                          onChange={e => setParentId(e.target.value || undefined)}
                          className={`${SELECT_STYLE} !h-10 text-xs font-bold`}
                        >
                          <option value="">Standalone Goal (No Parent Bucket)</option>
                          {parentGoalOptions.map(pg => (
                            <option key={pg.id} value={pg.id}>
                              {pg.name} {pg.isBucket ? '(Bucket)' : ''}
                            </option>
                          ))}
                        </select>
                        <div className={SELECT_ARROW_STYLE}><Icon name="expand_more" /></div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </form>
          </div>

          {/* 3. Sticky Drawer Footer */}
          <div className="p-6 border-t border-black/5 dark:border-white/5 bg-light-card/80 dark:bg-dark-card/80 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={handleClearFields}
              className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary hover:text-rose-500 transition-colors cursor-pointer"
            >
              Clear Fields
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCloseDrawer}
                className={`${BTN_SECONDARY_STYLE} h-12 px-6 text-xs font-bold uppercase tracking-wider cursor-pointer`}
              >
                Cancel
              </button>

              <button
                type="submit"
                form="goal-form"
                className={`${BTN_PRIMARY_STYLE} h-12 px-8 text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-teal-500/20 active:scale-95 cursor-pointer`}
              >
                <span>{isEditing ? 'Commit Objective' : 'Deploy Goal'}</span>
                <Icon name="check" className="text-base" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(drawerContent, document.body);
};

export default GoalScenarioModal;
