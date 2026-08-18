import React, { useState, useMemo } from 'react';
import Modal from './Modal';
import { Category, RegexCategorizationRule } from '../types';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, BTN_DANGER_STYLE, INPUT_BASE_STYLE, SELECT_STYLE, SELECT_ARROW_STYLE, SELECT_WRAPPER_STYLE, CHECKBOX_STYLE } from '../constants';
import { formatCurrency, parseLocalDate } from '../utils';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'motion/react';
import Icon from './ui/Icon';

interface RegexCategorizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  rules: RegexCategorizationRule[];
  onSaveRules: (rules: RegexCategorizationRule[]) => void;
  incomeCategories: Category[];
  expenseCategories: Category[];
  transactions: any[];
  onApplyHistoricalRules: () => void;
}

type MatchType = 'contains' | 'exact' | 'starts_with' | 'ends_with' | 'regex';
type TargetField = 'all' | 'description' | 'merchant' | 'notes';

interface PresetTemplate {
  name: string;
  icon: string;
  keyword: string;
  categoryName: string;
  matchType: MatchType;
  description: string;
}

const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    name: 'Streaming & Media',
    icon: 'play_circle',
    keyword: 'netflix|spotify|youtube|apple.com|disney|hbo|prime video',
    categoryName: 'Subscriptions',
    matchType: 'regex',
    description: 'Auto-categorize recurring entertainment subscriptions',
  },
  {
    name: 'Rides & Transit',
    icon: 'directions_car',
    keyword: 'uber|lyft|bolt|taxi|transit|metro|sncb|ns|ratp',
    categoryName: 'Transportation',
    matchType: 'regex',
    description: 'Auto-categorize taxis, trains, and rideshare',
  },
  {
    name: 'Food Delivery',
    icon: 'restaurant',
    keyword: 'doordash|ubereats|deliveroo|justeat|grubhub|takeaway',
    categoryName: 'Food & Dining',
    matchType: 'regex',
    description: 'Auto-categorize meal and restaurant deliveries',
  },
  {
    name: 'Supermarkets',
    icon: 'shopping_cart',
    keyword: 'lidl|aldi|carrefour|colruyt|albert heijn|tesco|whole foods|trader joe',
    categoryName: 'Groceries',
    matchType: 'regex',
    description: 'Auto-categorize grocery and supermarket runs',
  },
  {
    name: 'Coffee & Cafes',
    icon: 'local_cafe',
    keyword: 'starbucks|costa|dunkin|espresso|cafe|coffee',
    categoryName: 'Coffee & Snacks',
    matchType: 'regex',
    description: 'Auto-categorize coffee shops and cafes',
  },
  {
    name: 'Cloud & Dev Tools',
    icon: 'cloud',
    keyword: 'github|aws|google cloud|openai|digitalocean|vercel|heroku',
    categoryName: 'Software & Tools',
    matchType: 'regex',
    description: 'Auto-categorize cloud hosting and developer subscriptions',
  },
];

const CategoryOptions: React.FC<{ categories: Category[] }> = ({ categories }) => (
  <>
    {categories.map(parentCat => (
      <optgroup key={parentCat.id} label={parentCat.name}>
        <option value={parentCat.name}>{parentCat.name}</option>
        {parentCat.subCategories.map(subCat => (
          <option key={subCat.id} value={subCat.name}>
            &nbsp;&nbsp;{subCat.name}
          </option>
        ))}
      </optgroup>
    ))}
  </>
);

function buildSafePattern(keyword: string, matchType: MatchType): string {
  const trimmed = keyword.trim();
  if (matchType === 'regex') {
    return trimmed;
  }
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (matchType === 'exact') {
    return `^${escaped}$`;
  }
  if (matchType === 'starts_with') {
    return `^${escaped}`;
  }
  if (matchType === 'ends_with') {
    return `${escaped}$`;
  }
  return escaped;
}

function detectMatchType(pattern: string): { keyword: string; matchType: MatchType } {
  if (pattern.startsWith('^') && pattern.endsWith('$')) {
    const raw = pattern.slice(1, -1);
    if (!/[+?*|()\\{}]/.test(raw.replace(/\\\./g, ''))) {
      return { keyword: raw.replace(/\\/g, ''), matchType: 'exact' };
    }
  }
  if (pattern.startsWith('^')) {
    const raw = pattern.slice(1);
    if (!/[+?*|()\\{}]/.test(raw.replace(/\\\./g, ''))) {
      return { keyword: raw.replace(/\\/g, ''), matchType: 'starts_with' };
    }
  }
  if (pattern.endsWith('$')) {
    const raw = pattern.slice(0, -1);
    if (!/[+?*|()\\{}]/.test(raw.replace(/\\\./g, ''))) {
      return { keyword: raw.replace(/\\/g, ''), matchType: 'ends_with' };
    }
  }
  if (/[|()^$*+?{}]/.test(pattern)) {
    return { keyword: pattern, matchType: 'regex' };
  }
  return { keyword: pattern.replace(/\\/g, ''), matchType: 'contains' };
}

export const RegexCategorizationModal: React.FC<RegexCategorizationModalProps> = ({
  isOpen,
  onClose,
  rules,
  onSaveRules,
  incomeCategories,
  expenseCategories,
  transactions,
  onApplyHistoricalRules,
}) => {
  const [keyword, setKeyword] = useState('');
  const [matchType, setMatchType] = useState<MatchType>('contains');
  const [targetField, setTargetField] = useState<TargetField>('all');
  const [category, setCategory] = useState(expenseCategories[0]?.name || '');
  const [description, setDescription] = useState('');
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [showSamplePeek, setShowSamplePeek] = useState(false);
  const [showConfirmApply, setShowConfirmApply] = useState(false);

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const flatCategories = useMemo(() => {
    const list: string[] = [];
    [...expenseCategories, ...incomeCategories].forEach(c => {
      list.push(c.name);
      c.subCategories?.forEach(sub => list.push(sub.name));
    });
    return list;
  }, [expenseCategories, incomeCategories]);

  // Find best matching category from presets
  const findClosestCategory = (suggested: string): string => {
    const directMatch = flatCategories.find(c => c.toLowerCase() === suggested.toLowerCase());
    if (directMatch) return directMatch;
    const partialMatch = flatCategories.find(c => c.toLowerCase().includes(suggested.toLowerCase()));
    if (partialMatch) return partialMatch;
    return expenseCategories[0]?.name || '';
  };

  // Compile active regex for current input
  const currentCompiledRegex = useMemo(() => {
    if (!keyword.trim()) return null;
    try {
      const patternString = buildSafePattern(keyword, matchType);
      return new RegExp(patternString, 'i');
    } catch {
      return null;
    }
  }, [keyword, matchType]);

  // Find matching transactions for the currently drafted rule
  const matchedTransactions = useMemo(() => {
    if (!currentCompiledRegex) return [];
    return (transactions || []).filter(tx => {
      let text = '';
      if (targetField === 'description') text = tx.description || '';
      else if (targetField === 'merchant') text = tx.merchant || '';
      else if (targetField === 'notes') text = tx.notes || '';
      else text = [tx.merchant || '', tx.description || '', tx.notes || ''].join(' ').trim();

      return currentCompiledRegex.test(text);
    });
  }, [currentCompiledRegex, targetField, transactions]);

  // Calculate matching transactions for each rule in the list
  const ruleMatchCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    rules.forEach(rule => {
      let count = 0;
      try {
        const regex = new RegExp(rule.pattern, 'i');
        (transactions || []).forEach(tx => {
          const textToMatch = [tx.merchant || '', tx.description || '', tx.notes || ''].join(' ').trim();
          if (regex.test(textToMatch)) {
            count++;
          }
        });
      } catch {
        // Skip invalid regex
      }
      counts[rule.id] = count;
    });
    return counts;
  }, [rules, transactions]);

  // Count past transactions that would be reclassified if rules are applied
  const pastTransactionsToReclassifyCount = useMemo(() => {
    const activeRules = rules.filter(r => r.isActive);
    if (activeRules.length === 0) return 0;

    let count = 0;
    (transactions || []).forEach(tx => {
      const textToMatch = [tx.merchant || '', tx.description || '', tx.notes || ''].join(' ').trim();
      for (const rule of activeRules) {
        try {
          const regex = new RegExp(rule.pattern, 'i');
          if (regex.test(textToMatch) && tx.category !== rule.category) {
            count++;
            break;
          }
        } catch {
          // ignore
        }
      }
    });
    return count;
  }, [rules, transactions]);

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    const reorderedRules = [...rules];
    const itemToMove = reorderedRules.splice(draggedIndex, 1)[0];
    reorderedRules.splice(index, 0, itemToMove);
    setDraggedIndex(index);
    onSaveRules(reorderedRules);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleApplyPreset = (preset: PresetTemplate) => {
    setKeyword(preset.keyword);
    setMatchType(preset.matchType);
    setCategory(findClosestCategory(preset.categoryName));
    setDescription(preset.description);
    setEditingRuleId(null);
    toast.info(`Loaded "${preset.name}" template`);
  };

  const handleSaveRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) {
      toast.error('Please enter a keyword or text to match.');
      return;
    }

    let patternString = '';
    try {
      patternString = buildSafePattern(keyword, matchType);
      new RegExp(patternString, 'i');
    } catch (err: any) {
      toast.error(`Invalid pattern syntax: ${err.message}`);
      return;
    }

    if (editingRuleId) {
      const updated = rules.map(r =>
        r.id === editingRuleId
          ? {
              ...r,
              pattern: patternString,
              category,
              description: description.trim() || undefined,
            }
          : r
      );
      onSaveRules(updated);
      toast.success('Rule updated successfully!');
      setEditingRuleId(null);
    } else {
      const newRule: RegexCategorizationRule = {
        id: `rule-${uuidv4().slice(0, 8)}`,
        pattern: patternString,
        category,
        isActive: true,
        description: description.trim() || undefined,
      };
      onSaveRules([newRule, ...rules]);
      toast.success('New auto-categorization rule added!');
    }

    setKeyword('');
    setDescription('');
    setShowSamplePeek(false);
  };

  const handleStartEdit = (rule: RegexCategorizationRule) => {
    const { keyword: kw, matchType: mt } = detectMatchType(rule.pattern);
    setKeyword(kw);
    setMatchType(mt);
    setCategory(rule.category);
    setDescription(rule.description || '');
    setEditingRuleId(rule.id);
  };

  const handleCancelEdit = () => {
    setEditingRuleId(null);
    setKeyword('');
    setDescription('');
    setShowSamplePeek(false);
  };

  const handleDeleteRule = (id: string) => {
    const updated = rules.filter(r => r.id !== id);
    onSaveRules(updated);
    if (editingRuleId === id) {
      handleCancelEdit();
    }
    toast.success('Rule removed.');
  };

  const handleToggleRule = (id: string) => {
    const updated = rules.map(r => (r.id === id ? { ...r, isActive: !r.isActive } : r));
    onSaveRules(updated);
    toast.success('Rule status updated.');
  };

  const labelStyle = "block text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1.5";

  return (
    <Modal onClose={onClose} title="Auto-Categorize Rules" size="2xl">
      <div className="space-y-6">
        <div>
          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
            Create simple rules to automatically categorize your transactions as soon as they appear in your ledger. Match by keyword, phrase, or advanced pattern.
          </p>
        </div>

        {/* 1-CLICK QUICK PRESET TEMPLATES */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">
              Quick Templates
            </span>
            <span className="text-2xs text-gray-400">Click to fill form</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PRESET_TEMPLATES.map(preset => (
              <button
                key={preset.name}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className="p-2.5 rounded-2xl bg-light-fill dark:bg-dark-fill/50 hover:bg-teal-500/10 border border-black/5 dark:border-white/5 hover:border-teal-500/30 text-left transition-all group flex items-center gap-2 cursor-pointer"
              >
                <div className="w-7 h-7 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Icon name={preset.icon} className="text-sm" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-light-text dark:text-dark-text truncate group-hover:text-teal-600 dark:group-hover:text-teal-400">
                    {preset.name}
                  </p>
                  <p className="text-2xs text-light-text-secondary dark:text-dark-text-secondary truncate opacity-70">
                    ➔ {preset.categoryName}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* CREATE / EDIT RULE FORM */}
        <form
          id="merchant-form"
          onSubmit={handleSaveRule}
          className="bg-light-fill dark:bg-dark-fill/50 rounded-3xl p-5 border border-black/5 dark:border-white/5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold tracking-tight text-light-text dark:text-dark-text flex items-center gap-1.5">
              <Icon name={editingRuleId ? "edit" : "add_circle"} className="text-sm text-teal-600 dark:text-teal-400" />
              <span>{editingRuleId ? 'Edit Categorization Rule' : 'Create New Rule'}</span>
            </h4>
            {editingRuleId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="text-xs text-red-500 hover:underline font-bold"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Match Type */}
            <div>
              <label className={labelStyle}>Match Condition</label>
              <div className={SELECT_WRAPPER_STYLE}>
                <select
                  value={matchType}
                  onChange={e => setMatchType(e.target.value as MatchType)}
                  className={SELECT_STYLE}
                >
                  <option value="contains">Contains keyword</option>
                  <option value="exact">Exact match</option>
                  <option value="starts_with">Starts with</option>
                  <option value="ends_with">Ends with</option>
                  <option value="regex">Advanced (RegEx)</option>
                </select>
                <div className={SELECT_ARROW_STYLE}>
                  <Icon name="expand_more" />
                </div>
              </div>
            </div>

            {/* Keyword Input */}
            <div className="sm:col-span-2">
              <label className={labelStyle}>
                {matchType === 'regex' ? 'Regular Expression Pattern' : 'Keyword / Text to Match'}
              </label>
              <input
                type="text"
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                placeholder={
                  matchType === 'regex'
                    ? 'e.g. ^(uber|lyft).*trip$'
                    : 'e.g. Netflix, Uber, Starbucks, Amazon'
                }
                className={INPUT_BASE_STYLE}
                autoFocus
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Target Category */}
            <div>
              <label className={labelStyle}>Assign Category</label>
              <div className={SELECT_WRAPPER_STYLE}>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className={SELECT_STYLE}
                  required
                >
                  <optgroup label="Expense Categories">
                    <CategoryOptions categories={expenseCategories} />
                  </optgroup>
                  <optgroup label="Income Categories">
                    <CategoryOptions categories={incomeCategories} />
                  </optgroup>
                </select>
                <div className={SELECT_ARROW_STYLE}>
                  <Icon name="expand_more" />
                </div>
              </div>
            </div>

            {/* Rule Note */}
            <div>
              <label className={labelStyle}>Rule Note / Memo (Optional)</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="e.g. Monthly streaming subscription"
                className={INPUT_BASE_STYLE}
              />
            </div>
          </div>

          {/* LIVE MATCH PREVIEW */}
          {keyword.trim() && (
            <div className="p-3 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-teal-800 dark:text-teal-300 font-bold">
                  <Icon name="bolt" className="text-sm" />
                  <span>
                    {matchedTransactions.length > 0
                      ? `Matches ${matchedTransactions.length} transaction(s) in your history`
                      : 'No past transactions match this rule yet'}
                  </span>
                </div>
                {matchedTransactions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowSamplePeek(!showSamplePeek)}
                    className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer flex items-center gap-0.5"
                  >
                    <span>{showSamplePeek ? 'Hide Preview' : 'Peek Matches'}</span>
                    <Icon name={showSamplePeek ? "expand_less" : "expand_more"} className="text-sm" />
                  </button>
                )}
              </div>

              {/* Expandable Preview List */}
              {showSamplePeek && matchedTransactions.length > 0 && (
                <div className="pt-2 border-t border-teal-500/20 space-y-1.5 max-h-36 overflow-y-auto no-scrollbar">
                  {matchedTransactions.slice(0, 5).map(tx => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-1.5 rounded-lg bg-white/60 dark:bg-black/30 text-2xs"
                    >
                      <div className="min-w-0 flex-1 mr-2 truncate">
                        <span className="font-bold text-light-text dark:text-dark-text truncate">
                          {tx.description || tx.merchant || 'Untitled'}
                        </span>
                        {tx.category && (
                          <span className="text-gray-400 ml-1.5">
                            (Currently: {tx.category})
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-light-text dark:text-dark-text shrink-0">
                        {formatCurrency(tx.amount || 0, 'EUR')}
                      </span>
                    </div>
                  ))}
                  {matchedTransactions.length > 5 && (
                    <p className="text-2xs text-center text-teal-700 dark:text-teal-300 italic pt-1">
                      + {matchedTransactions.length - 5} more matching entries
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            {editingRuleId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className={BTN_SECONDARY_STYLE}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className={`${BTN_PRIMARY_STYLE} !py-2 !px-6 text-xs shadow-xs`}
            >
              {editingRuleId ? 'Update Rule' : 'Save Rule'}
            </button>
          </div>
        </form>

        {/* ACTIVE RULES LIST */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold tracking-tight text-light-text dark:text-dark-text">
                Active Rules ({rules.length})
              </h4>
              <p className="text-2xs text-light-text-secondary dark:text-dark-text-secondary">
                Evaluated from top to bottom. Drag to reorder priority.
              </p>
            </div>

            {rules.length > 0 && (
              <button
                type="button"
                onClick={() => setShowConfirmApply(true)}
                className="px-3 py-1.5 text-xs font-bold text-teal-600 dark:text-teal-400 bg-teal-500/10 hover:bg-teal-500/20 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                title="Apply all active rules to re-categorize past transactions"
              >
                <Icon name="history" className="text-sm" />
                <span>Apply to Past Transactions</span>
              </button>
            )}
          </div>

          {/* Past Apply Confirmation Modal */}
          {showConfirmApply && (
            <div className="p-4 bg-teal-500/10 border border-teal-500/30 rounded-2xl space-y-3 animate-fade-in">
              <div className="flex items-start gap-2.5">
                <Icon name="info" className="text-teal-600 dark:text-teal-400 text-lg shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-xs font-bold text-teal-800 dark:text-teal-300">
                    Apply Rules to Past Transactions?
                  </h5>
                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5 leading-relaxed">
                    {pastTransactionsToReclassifyCount > 0 ? (
                      <>
                        We found <strong className="text-teal-600 dark:text-teal-400 font-bold">{pastTransactionsToReclassifyCount} past transactions</strong> that match active rules and will be re-categorized.
                      </>
                    ) : (
                      'All your past transactions are already categorized according to your active rules.'
                    )}
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowConfirmApply(false)}
                  className={BTN_SECONDARY_STYLE}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowConfirmApply(false);
                    onApplyHistoricalRules();
                  }}
                  className={`${BTN_PRIMARY_STYLE} bg-teal-600 hover:bg-teal-700 text-white`}
                >
                  Confirm & Apply
                </button>
              </div>
            </div>
          )}

          {rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 bg-black/[0.01] dark:bg-white/[0.01] rounded-3xl border border-dashed border-black/5 dark:border-white/5 space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                <Icon name="auto_awesome" className="text-xl" />
              </div>
              <p className="text-xs font-bold text-light-text dark:text-dark-text">
                No categorization rules yet
              </p>
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary text-center max-w-sm">
                Pick a quick template above or type a keyword to create your first automatic rule.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-black/5 dark:divide-white/5 max-h-[300px] overflow-y-auto pr-1">
              <div className="space-y-2.5">
                {rules.map((rule, idx) => {
                  const matchCount = ruleMatchCounts[rule.id] || 0;
                  const isDragging = draggedIndex === idx;
                  const { keyword: kw, matchType: mt } = detectMatchType(rule.pattern);

                  return (
                    <div
                      key={rule.id}
                      className={`p-3.5 flex items-center justify-between gap-4 group rounded-2xl transition-all duration-150 border ${
                        isDragging
                          ? 'opacity-30 bg-teal-500/10 border-teal-500/30'
                          : 'bg-white dark:bg-dark-card border-black/5 dark:border-white/5 hover:border-teal-500/30 shadow-2xs'
                      } cursor-grab active:cursor-grabbing`}
                      draggable
                      onDragStart={e => handleDragStart(e, idx)}
                      onDragOver={e => handleDragOver(e, idx)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Icon
                          name="drag_indicator"
                          className="text-base text-gray-400 select-none group-hover:text-teal-500 shrink-0"
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <code className="text-xs font-mono font-bold bg-teal-500/10 dark:bg-teal-500/20 text-teal-800 dark:text-teal-300 px-2 py-0.5 rounded-lg truncate">
                              "{kw}"
                            </code>
                            {mt !== 'contains' && (
                              <span className="text-2xs font-semibold px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/10 text-gray-500 uppercase">
                                {mt === 'exact' ? 'Exact' : mt === 'starts_with' ? 'Prefix' : mt === 'ends_with' ? 'Suffix' : 'RegEx'}
                              </span>
                            )}
                            <Icon name="arrow_forward" className="text-xs text-gray-400" />
                            <span className="text-xs font-bold text-light-text dark:text-dark-text bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-lg">
                              {rule.category}
                            </span>
                          </div>

                          {rule.description && (
                            <p className="text-2xs text-light-text-secondary dark:text-dark-text-secondary mt-1 italic truncate">
                              {rule.description}
                            </p>
                          )}

                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-2xs font-mono text-gray-400">
                              Matches {matchCount} past transaction(s)
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => handleStartEdit(rule)}
                          title="Edit this rule"
                          className="p-1.5 rounded-xl text-gray-400 hover:text-teal-600 hover:bg-teal-500/10 transition-colors cursor-pointer"
                        >
                          <Icon name="edit" className="text-sm" />
                        </button>

                        {/* Toggle Active Switch */}
                        <button
                          type="button"
                          onClick={() => handleToggleRule(rule.id)}
                          title={rule.isActive ? 'Disable rule' : 'Enable rule'}
                          className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none flex items-center cursor-pointer ${
                            rule.isActive
                              ? 'bg-teal-500 justify-end'
                              : 'bg-gray-300 dark:bg-zinc-700 justify-start'
                          }`}
                        >
                          <motion.div
                            layout
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            className="w-5 h-5 bg-white rounded-full shadow-xs"
                          />
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-1.5 rounded-xl text-red-400 hover:text-red-600 hover:bg-red-500/10 transition-all cursor-pointer"
                          title="Delete rule"
                        >
                          <Icon name="delete" className="text-sm" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default RegexCategorizationModal;
