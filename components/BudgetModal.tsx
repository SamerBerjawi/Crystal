import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Budget, Category, Currency } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_ARROW_STYLE, SELECT_WRAPPER_STYLE, SELECT_STYLE } from '../constants';
import { toast } from 'sonner';
import Icon from './ui/Icon';

interface BudgetModalProps {
  onClose: () => void;
  onSave: (budget: Omit<Budget, 'id'> & { id?: string }) => void;
  budgetToEdit?: Budget | null;
  categoryNameToCreate?: string;
  existingBudgets: Budget[];
  expenseCategories: Category[];
}

type ActiveTabType = 'domain' | 'pacing';

const BudgetModal: React.FC<BudgetModalProps> = ({ 
  onClose, 
  onSave, 
  budgetToEdit, 
  categoryNameToCreate, 
  existingBudgets, 
  expenseCategories 
}) => {
  const isEditing = !!budgetToEdit;
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTabType>('domain');

  const [categoryName, setCategoryName] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

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

  useEffect(() => {
    if (isEditing && budgetToEdit) {
      setCategoryName(budgetToEdit.categoryName);
      setAmount(String(budgetToEdit.amount));
    } else if (categoryNameToCreate) {
      setCategoryName(categoryNameToCreate);
      setAmount('');
    } else {
      setCategoryName('');
      setAmount('');
    }
  }, [isEditing, budgetToEdit, categoryNameToCreate]);

  const availableCategories = useMemo(() => {
    return expenseCategories.filter(cat => {
      if (isEditing && cat.name === budgetToEdit?.categoryName) {
        return true;
      }
      if (categoryNameToCreate && cat.name === categoryNameToCreate) {
        return true;
      }
      return !existingBudgets.some(b => b.categoryName === cat.name);
    });
  }, [expenseCategories, isEditing, budgetToEdit, categoryNameToCreate, existingBudgets]);

  const selectedCategoryObj = useMemo(() => {
    return expenseCategories.find(c => c.name === categoryName);
  }, [expenseCategories, categoryName]);

  const dailyPacing = useMemo(() => {
    const num = parseFloat(amount);
    if (!isNaN(num) && num > 0) {
      return (num / 30).toFixed(2);
    }
    return '0.00';
  }, [amount]);

  const weeklyPacing = useMemo(() => {
    const num = parseFloat(amount);
    if (!isNaN(num) && num > 0) {
      return (num / 4.33).toFixed(2);
    }
    return '0.00';
  }, [amount]);

  const handleClearFields = () => {
    if (!isEditing && !categoryNameToCreate) {
      setCategoryName('');
    }
    setAmount('');
    setNotes('');
    toast.info('Budget fields cleared');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName) {
      toast.error('Please select an expense category domain');
      return;
    }
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      toast.error('Please enter a valid allocation amount');
      return;
    }
    
    const budgetData = {
      id: isEditing && budgetToEdit ? budgetToEdit.id : undefined,
      categoryName,
      amount: num,
      period: 'monthly' as const,
      currency: 'EUR' as const,
    };

    onSave(budgetData);
    handleCloseDrawer();
  };

  const labelStyle = "block text-xs font-bold text-gray-500 dark:text-gray-400 tracking-wider mb-1.5";

  const drawerContent = (
    <div className="fixed inset-0 z-[9999] overflow-hidden">
      {/* Backdrop Blur Overlay */}
      <div 
        className={`fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-xs transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={handleCloseDrawer}
      />

      {/* Right-Side Full Height Slide-out Drawer */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
        <div 
          className={`w-screen max-w-full sm:max-w-xl md:max-w-2xl h-screen bg-white dark:bg-[#12141a] text-gray-900 dark:text-white shadow-2xl border-l border-black/10 dark:border-white/10 flex flex-col justify-between transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isVisible ? 'translate-x-0' : 'translate-x-full'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 1. Header Ribbon & Hero Section */}
          <div className="shrink-0 border-b border-black/5 dark:border-white/5 bg-gray-50/70 dark:bg-white/[0.02]">
            {/* Top Action Ribbon */}
            <div className="flex items-center justify-between px-5 sm:px-6 pt-4 pb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded-full border border-purple-500/20">
                  <Icon name={isEditing ? 'edit' : 'pie_chart'} className="text-xs" />
                  {isEditing ? 'Edit Budget' : 'Set New Budget'}
                </span>
                {categoryName && (
                  <span className="inline-flex items-center gap-1 text-2xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10 text-gray-600 dark:text-gray-300">
                    {categoryName}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCloseDrawer}
                  className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 transition-all flex items-center gap-1 text-xs font-bold cursor-pointer"
                  title="Close panel (Esc)"
                >
                  <Icon name="close" className="text-lg" />
                  <span className="hidden sm:inline text-xs font-medium text-gray-400 font-mono">ESC</span>
                </button>
              </div>
            </div>

            {/* Hero Allocation Threshold Input Card */}
            <div className="px-5 sm:px-6 py-3 space-y-3">
              <div className="p-4.5 rounded-3xl bg-white dark:bg-white/[0.03] border border-black/5 dark:border-white/5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                      <Icon name={selectedCategoryObj?.icon || 'pie_chart'} className="text-lg" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-2xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        Monthly Allocation Threshold
                      </p>
                      <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                        {categoryName || 'Select Category Domain'}
                      </p>
                    </div>
                  </div>

                  <span className="text-2xs font-mono font-bold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    Monthly Cap
                  </span>
                </div>

                {/* Big Currency & Amount Row */}
                <div className="flex items-center justify-between gap-3 pt-2 border-t border-black/5 dark:border-white/5">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Limit Amount
                  </span>

                  <div className="relative flex items-center gap-2">
                    <span className="text-2xl font-black font-mono text-gray-400 select-none">
                      €
                    </span>
                    <input
                      id="drawer-budget-amount"
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      className="bg-transparent border-none text-right text-2xl sm:text-3xl font-black text-gray-900 dark:text-white placeholder-black/15 dark:placeholder-white/15 focus:ring-0 py-0 tracking-tight tabular-nums w-32 sm:w-40 focus:outline-hidden font-mono"
                      placeholder="0.00"
                      required
                      autoFocus
                      autoComplete="off"
                    />
                    <span className="text-xs font-mono font-bold text-gray-400 uppercase">
                      EUR
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Segmented Navigation Tabs */}
            <div className="px-5 sm:px-6 flex gap-1 border-t border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01] overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setActiveTab('domain')}
                className={`py-3 px-3.5 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'domain'
                    ? 'border-purple-500 text-purple-600 dark:text-purple-400 bg-purple-500/5'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon name="folder" className="text-sm" />
                <span>Domain & Classification</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('pacing')}
                className={`py-3 px-3.5 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'pacing'
                    ? 'border-purple-500 text-purple-600 dark:text-purple-400 bg-purple-500/5'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon name="speed" className="text-sm" />
                <span>Pacing & Guidelines</span>
              </button>
            </div>
          </div>

          {/* 2. Scrollable Body Content */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 custom-scrollbar">
            <form id="budget-form" onSubmit={handleSubmit} className="space-y-5">
              
              {/* TAB 1: DOMAIN & CLASSIFICATION */}
              {activeTab === 'domain' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="p-4.5 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-4">
                    <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
                      <div className="flex items-center gap-2">
                        <Icon name="category" className="text-sm text-purple-500" />
                        <span className="text-xs font-bold text-gray-900 dark:text-white">Expense Domain Target</span>
                      </div>
                      <span className="text-2xs text-purple-500 font-semibold uppercase">Category</span>
                    </div>

                    <div>
                      <label className={labelStyle}>Target Category / Domain</label>
                      <div className={SELECT_WRAPPER_STYLE}>
                        <select
                          value={categoryName}
                          onChange={e => setCategoryName(e.target.value)}
                          className={`${SELECT_STYLE} !h-11 font-bold text-xs`}
                          required
                          disabled={isEditing || !!categoryNameToCreate}
                        >
                          <option value="" disabled>Select category domain...</option>
                          {availableCategories.map(cat => (
                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                          ))}
                        </select>
                        <div className={SELECT_ARROW_STYLE}><Icon name="expand_more" /></div>
                      </div>

                      {(isEditing || !!categoryNameToCreate) && (
                        <div className="flex items-start gap-2.5 mt-3 p-3 bg-purple-500/5 dark:bg-purple-500/10 rounded-2xl border border-purple-500/20">
                          <Icon name="lock" className="text-purple-500 text-sm shrink-0 mt-0.5" />
                          <p className="text-xs text-purple-600 dark:text-purple-400 leading-relaxed font-medium">
                            Category domain is anchored to this budget allocation. Delete or reset to change domain classification.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Preset Amount Suggestions */}
                  <div className="p-4.5 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-3">
                    <label className={labelStyle}>Quick Allocation Presets</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[100, 250, 500, 1000].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setAmount(String(val))}
                          className={`p-2.5 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                            amount === String(val)
                              ? 'bg-purple-500 text-white border-purple-500 shadow-xs'
                              : 'bg-white dark:bg-white/[0.03] border-black/5 dark:border-white/5 hover:border-purple-500/40 text-gray-900 dark:text-white'
                          }`}
                        >
                          €{val}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: PACING & GUIDELINES */}
              {activeTab === 'pacing' && (
                <div className="space-y-4 animate-fade-in">
                  
                  {/* Pacing Breakdown Cards */}
                  <div className="p-4.5 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-4">
                    <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
                      <div className="flex items-center gap-2">
                        <Icon name="speed" className="text-sm text-purple-500" />
                        <span className="text-xs font-bold text-gray-900 dark:text-white">Pacing Velocity Guidelines</span>
                      </div>
                      <span className="text-2xs text-purple-500 font-semibold uppercase">Daily & Weekly</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3.5 rounded-2xl bg-white dark:bg-white/[0.03] border border-black/5 dark:border-white/5 space-y-1">
                        <p className="text-2xs font-bold uppercase tracking-wider text-gray-400">Safe Daily Burn Rate</p>
                        <p className="text-lg font-black text-gray-900 dark:text-white tabular-nums font-mono">
                          €{dailyPacing} <span className="text-xs font-medium text-gray-400">/ day</span>
                        </p>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-white dark:bg-white/[0.03] border border-black/5 dark:border-white/5 space-y-1">
                        <p className="text-2xs font-bold uppercase tracking-wider text-gray-400">Target Weekly Allowance</p>
                        <p className="text-lg font-black text-gray-900 dark:text-white tabular-nums font-mono">
                          €{weeklyPacing} <span className="text-xs font-medium text-gray-400">/ week</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Operational Notes / Strategic Directives */}
                  <div className="p-4 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-2">
                    <label className={labelStyle}>Budget Notes & Directives</label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      className={`${INPUT_BASE_STYLE} min-h-[96px] p-3 text-xs font-medium resize-none border-dashed bg-white dark:bg-white/[0.02] text-gray-900 dark:text-white`}
                      placeholder="Add any strategic pacing notes, rollover rules, or contextual targets..."
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* 3. Sticky Drawer Footer */}
          <div className="shrink-0 p-4 sm:p-5 border-t border-black/10 dark:border-white/10 bg-white/95 dark:bg-[#12141a]/95 backdrop-blur-md flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleClearFields}
              className="text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-rose-500 transition-colors cursor-pointer"
            >
              Clear Fields
            </button>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleCloseDrawer}
                className={`${BTN_SECONDARY_STYLE} !py-2 !px-4 !text-xs cursor-pointer`}
              >
                Dismiss
              </button>

              <button
                type="submit"
                form="budget-form"
                className={`${BTN_PRIMARY_STYLE} !py-2 !px-6 !text-xs flex items-center gap-1.5 shadow-md shadow-purple-500/20 cursor-pointer`}
              >
                <Icon name="check" className="text-xs" />
                <span>{isEditing ? 'Save Changes' : 'Deploy Budget'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(drawerContent, document.body);
};

export default BudgetModal;
