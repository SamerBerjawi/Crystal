import React, { useState, useMemo } from 'react';
import { AppPreferences, TransactionRule, TransactionRuleCondition, Page, Category, RuleRunBackup, RuleExecutionLog } from '../types';
import Card from '../components/Card';
import SettingsSubpageHeader from '../components/SettingsSubpageHeader';
import HeaderButton from '../components/HeaderButton';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, BTN_DANGER_STYLE, INPUT_BASE_STYLE, SELECT_STYLE, SELECT_ARROW_STYLE, SELECT_WRAPPER_STYLE, CHECKBOX_STYLE } from '../constants';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency } from '../utils';
import { normalizeMerchantKey } from '../utils/brandfetch';
import { evaluateRuleCondition, applyTransactionRulesToFields } from '../utils/rules';
import { generateSmartRuleSuggestions, SmartRuleSuggestion, convertSuggestionToTransactionRule } from '../utils/ruleSuggestions';
import Icon from '../components/ui/Icon';
import { BarChart, Bar, Grid, BarXAxis, BarYAxis, ChartTooltip } from '@/src/components/charts';


interface RulesProps {
  preferences: AppPreferences;
  setPreferences: React.Dispatch<React.SetStateAction<AppPreferences>>;
  transactions: any[];
  saveTransaction: (updatedTxs: any[], transactionsToDelete?: string[], options?: any) => void;
  incomeCategories: Category[];
  expenseCategories: Category[];
  setCurrentPage: (page: Page) => void;
}

const Rules: React.FC<RulesProps> = ({
  preferences,
  setPreferences,
  transactions,
  saveTransaction,
  incomeCategories,
  expenseCategories,
  setCurrentPage,
}) => {
  const [activeTab, setActiveTab] = useState<'rules-list' | 'merchant-overrides' | 'rules-sandbox' | 'execution-logs' | 'historical-scan'>('rules-list');
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  // Merchant Overrides State
  const [isAddingMerchantOverride, setIsAddingMerchantOverride] = useState(false);
  const [editingMerchantKey, setEditingMerchantKey] = useState<string | null>(null);
  const [overrideMerchantName, setOverrideMerchantName] = useState('');
  const [overrideCategory, setOverrideCategory] = useState('');
  const [overrideLogo, setOverrideLogo] = useState('');
  const [overrideDefaultDescription, setOverrideDefaultDescription] = useState('');
  const [overrideIsHidden, setOverrideIsHidden] = useState(false);
  const [overrideNotes, setOverrideNotes] = useState('');
  const [merchantOverrideSearch, setMerchantOverrideSearch] = useState('');
  const [merchantOverrideCategoryFilter, setMerchantOverrideCategoryFilter] = useState('ALL');

  // Sandbox State
  const [sandboxDesc, setSandboxDesc] = useState('Netflix monthly subscription');
  const [sandboxAmount, setSandboxAmount] = useState('14.99');
  const [sandboxType, setSandboxType] = useState<'expense' | 'income'>('expense');
  const [sandboxMerchant, setSandboxMerchant] = useState('Netflix, Inc.');

  // Ledger Picker Modal (for sandbox)
  const [ledgerPickerOpen, setLedgerPickerOpen] = useState(false);
  const [ledgerPickerSearch, setLedgerPickerSearch] = useState('');

  // Priority and Suggestion State
  const [rulePriority, setRulePriority] = useState<number>(0);
  const [conditionLogic, setConditionLogic] = useState<'AND' | 'OR'>('AND');
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

  // Historical Scan — per-row selection
  const [selectedScanRows, setSelectedScanRows] = useState<Set<string>>(new Set());

  // Per-rule "Test on Ledger" panel
  const [testingRuleId, setTestingRuleId] = useState<string | null>(null);

  // Simulation and Drag & Drop State
  const [isSimulateModalOpen, setIsSimulateModalOpen] = useState(false);
  const [simulationSearch, setSimulationSearch] = useState('');
  const [draggedRuleId, setDraggedRuleId] = useState<string | null>(null);
  const [dragOverRuleId, setDragOverRuleId] = useState<string | null>(null);

  // Custom Confirmation Modal State
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
  } | null>(null);

  const customConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    isDestructive: boolean = false,
    confirmText: string = 'Confirm',
    cancelText: string = 'Cancel'
  ) => {
    setConfirmConfig({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmConfig(null);
      },
      confirmText,
      cancelText,
      isDestructive
    });
  };


  // Form State
  const [ruleName, setRuleName] = useState('');
  const [conditions, setConditions] = useState<TransactionRuleCondition[]>([
    { field: 'description', operator: 'contains', value: '' }
  ]);
  const [actions, setActions] = useState<{ field: 'merchant' | 'description' | 'category'; value: string }[]>([
    { field: 'category', value: '' }
  ]);

  const existingRules = useMemo(() => preferences.transactionRules || [], [preferences.transactionRules]);

  const sortedRules = useMemo(() => {
    return [...existingRules].sort((a, b) => {
      const pA = a.priority ?? 0;
      const pB = b.priority ?? 0;
      if (pA !== pB) return pB - pA;
      return a.id.localeCompare(b.id);
    });
  }, [existingRules]);

  const merchantRules = useMemo(() => preferences.merchantRules || {}, [preferences.merchantRules]);

  // Compute Auto-generated/suggested rules based on patterns in transactions
  const autoGeneratedMerchantRules = useMemo(() => {
    const counts: Record<string, { count: number; cats: Record<string, number>; originalName: string }> = {};

    transactions.forEach(tx => {
      if (!tx.merchant) return;
      const key = normalizeMerchantKey(tx.merchant);
      if (!key) return;

      if (!counts[key]) {
        counts[key] = { count: 0, cats: {}, originalName: tx.merchant.trim() };
      }
      counts[key].count++;
      const cat = tx.category || 'Uncategorized';
      counts[key].cats[cat] = (counts[key].cats[cat] || 0) + 1;
    });

    const results: { key: string; name: string; suggestedCategory: string; count: number }[] = [];

    Object.entries(counts).forEach(([key, info]) => {
      // If already has a rule, skip
      if (merchantRules[key] && merchantRules[key].category) return;

      // Skip very generic or unrecognized names
      if (key.length <= 2) return;

      // Suggest if there are multiple transactions with consistent category
      let typicalCat = '';
      let maxCatCount = 0;
      Object.entries(info.cats).forEach(([cat, catCount]) => {
        if (catCount > maxCatCount) {
          maxCatCount = catCount;
          typicalCat = cat;
        }
      });

      if (typicalCat && typicalCat !== 'Uncategorized') {
        results.push({
          key,
          name: info.originalName,
          suggestedCategory: typicalCat,
          count: info.count
        });
      }
    });

    return results.sort((a, b) => b.count - a.count);
  }, [transactions, merchantRules]);

  // Compute live match transaction count for each merchant override
  const merchantMatchCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    transactions.forEach(tx => {
      const key = normalizeMerchantKey(tx.merchant || '');
      if (key) {
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    return counts;
  }, [transactions]);

  // Smart suggestions from uncategorized / recurring patterns
  const smartRuleSuggestions = useMemo(() => {
    return generateSmartRuleSuggestions(transactions, existingRules, merchantRules);
  }, [transactions, existingRules, merchantRules]);

  const handleDeploySmartSuggestion = (suggestion: SmartRuleSuggestion) => {
    const newRule = convertSuggestionToTransactionRule(suggestion);

    setPreferences(prev => ({
      ...prev,
      transactionRules: [newRule, ...(prev.transactionRules || [])]
    }));

    const kw = suggestion.keyword.toLowerCase();
    const matching = transactions.filter(t => 
      (t.description && t.description.toLowerCase().includes(kw)) ||
      (t.merchant && t.merchant.toLowerCase().includes(kw))
    );

    if (matching.length > 0) {
      const updated = matching.map(t => ({
        ...t,
        merchant: suggestion.suggestedMerchant || t.merchant,
        category: suggestion.suggestedCategory || t.category,
      }));
      saveTransaction(updated);
      toast.success(`Created rule and updated ${updated.length} past transaction(s) for "${suggestion.suggestedMerchant}"!`);
    } else {
      toast.success(`Created auto-categorization rule for "${suggestion.suggestedMerchant}"!`);
    }
  };

  const handleApplyAllMerchantOverridesToPastLedger = () => {
    let affectedCount = 0;
    const updatedTxs: any[] = [];

    transactions.forEach(tx => {
      const key = normalizeMerchantKey(tx.merchant || '');
      if (!key) return;
      const rule = merchantRules[key];
      if (!rule) return;

      let changed = false;
      const newTx = { ...tx };

      if (rule.category && newTx.category !== rule.category) {
        newTx.category = rule.category;
        changed = true;
      }
      if (rule.defaultDescription && newTx.description !== rule.defaultDescription) {
        newTx.description = rule.defaultDescription;
        changed = true;
      }

      if (changed) {
        affectedCount++;
        updatedTxs.push(newTx);
      }
    });

    if (affectedCount === 0) {
      toast.info('All transactions in your ledger are already up to date with your merchant rules!');
      return;
    }

    customConfirm(
      'Apply Merchant Overrides to Past Transactions',
      `This will update ${affectedCount} transaction(s) across your ledger to match your active merchant categories and descriptions. Would you like to proceed?`,
      () => {
        saveTransaction(updatedTxs);
        toast.success(`Successfully updated ${affectedCount} past transaction(s) with merchant rules!`);
      },
      false,
      `Apply to ${affectedCount} Transactions`
    );
  };

  const handleFeedFromMerchants = () => {
    // Scan unique transactions and register overrides if consistent category exists
    const nextRules = { ...merchantRules };
    let addedCount = 0;

    const candidates: Record<string, { originalName: string; cats: Record<string, number> }> = {};

    transactions.forEach(tx => {
      if (!tx.merchant) return;
      const key = normalizeMerchantKey(tx.merchant);
      if (!key) return;

      if (!candidates[key]) {
        candidates[key] = { originalName: tx.merchant.trim(), cats: {} };
      }
      if (tx.category) {
        candidates[key].cats[tx.category] = (candidates[key].cats[tx.category] || 0) + 1;
      }
    });

    Object.entries(candidates).forEach(([key, info]) => {
      if (merchantRules[key] && merchantRules[key].category) return;

      // Find typical category
      let typicalCategory = '';
      let maxCount = 0;
      Object.entries(info.cats).forEach(([cat, count]) => {
        if (count > maxCount) {
          maxCount = count;
          typicalCategory = cat;
        }
      });

      if (typicalCategory) {
        nextRules[key] = {
          category: typicalCategory,
          logo: key.includes('.') ? key : (key + '.com'),
          website: key.includes('.') ? `https://${key}` : `https://${key}.com`,
          notes: 'Fed automatically from Merchants page ledger'
        };
        addedCount++;
      }
    });

    if (addedCount === 0) {
      toast.info("All merchant configurations from your logs are already registered as rules.");
      return;
    }

    setPreferences(prev => ({
      ...prev,
      merchantRules: nextRules
    }));

    toast.success(`fed ${addedCount} merchant overrides into your rules registry!`);
  };

  const handleSaveMerchantOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideMerchantName.trim()) {
      toast.error('Merchant identity name is required');
      return;
    }

    const key = normalizeMerchantKey(overrideMerchantName)!;

    // Auto guess domain if not supplied
    let targetLogo = overrideLogo.trim();
    if (!targetLogo) {
      targetLogo = key.includes('.') ? key : `${key}.com`;
    }

    const updatedRule = {
      category: overrideCategory || undefined,
      website: targetLogo ? `https://${targetLogo.replace(/^(https?:\/\/)?(www\.)?/, '')}` : undefined,
      logo: targetLogo || undefined,
      notes: overrideNotes.trim() || undefined,
      isHidden: overrideIsHidden,
      defaultDescription: overrideDefaultDescription.trim() || undefined
    };

    setPreferences(prev => ({
      ...prev,
      merchantRules: {
        ...(prev.merchantRules || {}),
        [key]: updatedRule
      }
    }));

    toast.success(`Merchant override rule for "${overrideMerchantName}" configured successfully!`);
    resetMerchantOverrideForm();
  };

  const handleDeleteMerchantOverride = (key: string, name: string) => {
    customConfirm(
      'Delete Merchant Override Rule',
      `Are you sure you want to delete the automatically applied rule for "${name}"? This deletes the rule but keeps past transactions untouched unless rollbacks or optimization rescans are requested.`,
      () => {
        setPreferences(prev => {
          const nextRules = { ...(prev.merchantRules || {}) };
          delete nextRules[key];
          return {
            ...prev,
            merchantRules: nextRules
          };
        });
        toast.success(`Deleted override rule for "${name}" successfully.`);
      },
      true,
      'Delete Rule'
    );
  };

  const handleEditMerchantOverride = (key: string, rule: any, name: string) => {
    setEditingMerchantKey(key);
    setOverrideMerchantName(name || key.toUpperCase());
    setOverrideCategory(rule.category || '');
    setOverrideLogo(rule.logo || '');
    setOverrideDefaultDescription(rule.defaultDescription || '');
    setOverrideIsHidden(rule.isHidden || false);
    setOverrideNotes(rule.notes || '');
    setIsAddingMerchantOverride(true);
  };

  const resetMerchantOverrideForm = () => {
    setEditingMerchantKey(null);
    setOverrideMerchantName('');
    setOverrideCategory('');
    setOverrideLogo('');
    setOverrideDefaultDescription('');
    setOverrideIsHidden(false);
    setOverrideNotes('');
    setIsAddingMerchantOverride(false);
  };

  // Categories helper list
  const flatCategories = useMemo(() => {
    const list: string[] = [];
    [...incomeCategories, ...expenseCategories].forEach(cat => {
      list.push(cat.name);
      cat.subCategories.forEach(sub => {
        list.push(sub.name);
      });
    });
    return Array.from(new Set(list));
  }, [incomeCategories, expenseCategories]);

  // Form handling functions
  const addConditionField = () => {
    setConditions(prev => [...prev, { field: 'description', operator: 'contains', value: '' }]);
  };

  const removeConditionField = (index: number) => {
    if (conditions.length <= 1) return;
    setConditions(prev => prev.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, key: string, val: any) => {
    setConditions(prev => prev.map((item, i) => i === index ? { ...item, [key]: val } : item));
  };

  const addActionField = () => {
    setActions(prev => [...prev, { field: 'category', value: '' }]);
  };

  const removeActionField = (index: number) => {
    if (actions.length <= 1) return;
    setActions(prev => prev.filter((_, i) => i !== index));
  };

  const updateAction = (index: number, key: string, val: any) => {
    // If field changes to 'category', pre-fill with first flat category if empty
    let finalVal = val;
    if (key === 'field' && val === 'category') {
      const currentVal = actions[index].value;
      if (!flatCategories.includes(currentVal)) {
        finalVal = flatCategories[0] || '';
      }
    }
    setActions(prev => prev.map((item, i) => {
      if (i === index) {
        if (key === 'field') {
          return { field: val, value: val === 'category' ? finalVal : '' };
        }
        return { ...item, [key]: val };
      }
      return item;
    }));
  };

  const handleCreateOrUpdateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) {
      toast.error('Please specify a name for this rule.');
      return;
    }

    const invalidCond = conditions.some(c => !c.value.trim());
    if (invalidCond) {
      toast.error('All conditions must have a specified match value.');
      return;
    }

    const invalidAction = actions.some(a => !a.value.trim());
    if (invalidAction) {
      toast.error('All actions must have specified values.');
      return;
    }

    const nextRules = [...existingRules];
    if (editingRuleId) {
      const idx = nextRules.findIndex(r => r.id === editingRuleId);
      if (idx !== -1) {
        nextRules[idx] = {
          id: editingRuleId,
          name: ruleName.trim(),
          isActive: nextRules[idx].isActive,
          conditions: conditions.map(c => ({ ...c, value: c.value.trim() })),
          actions: actions.map(a => ({ ...a, value: a.value.trim() })),
          priority: rulePriority,
          conditionLogic,
        };
        toast.success(`Successfully updated rule "${ruleName}"`);
      }
    } else {
      const nextMaxPriority = existingRules.length > 0
        ? Math.max(...existingRules.map(r => r.priority ?? 0)) + 10
        : 10;

      nextRules.push({
        id: `rule-${uuidv4()}`,
        name: ruleName.trim(),
        isActive: true,
        conditions: conditions.map(c => ({ ...c, value: c.value.trim() })),
        actions: actions.map(a => ({ ...a, value: a.value.trim() })),
        priority: nextMaxPriority,
        conditionLogic,
      });
      toast.success(`Rule "${ruleName}" successfully created! Drag to reorder its priority.`);
    }

    setPreferences(prev => ({
      ...prev,
      transactionRules: nextRules
    }));

    resetForm();
  };

  const handleEditRule = (rule: TransactionRule) => {
    setEditingRuleId(rule.id);
    setRuleName(rule.name);
    setConditions(rule.conditions);
    setActions(rule.actions);
    setRulePriority(rule.priority ?? 0);
    setConditionLogic(rule.conditionLogic ?? 'AND');
    setIsAddingRule(true);
  };

  const handleDeleteRule = (id: string, name: string) => {
    customConfirm(
      'Delete Rule',
      `Are you sure you want to delete the rule "${name}"? This action cannot be revoked and will stop this automation from running on future transactions.`,
      () => {
        setPreferences(prev => ({
          ...prev,
          transactionRules: (prev.transactionRules || []).filter(r => r.id !== id)
        }));
        toast.success(`Deleted rule "${name}"`);
      },
      true,
      'Delete Rule'
    );
  };

  const handleToggleRuleActive = (id: string, active: boolean) => {
    setPreferences(prev => ({
      ...prev,
      transactionRules: (prev.transactionRules || []).map(r => r.id === id ? { ...r, isActive: active } : r)
    }));
    toast.success(`Rule set to ${active ? 'active' : 'inactive'}`);
  };

  const resetForm = () => {
    setRuleName('');
    setConditions([{ field: 'description', operator: 'contains', value: '' }]);
    setActions([{ field: 'category', value: flatCategories[0] || '' }]);
    setRulePriority(0);
    setConditionLogic('AND');
    setIsAddingRule(false);
    setEditingRuleId(null);
  };

  // Live calculation of transactions matching the current rule draft being built
  const liveDraftMatches = useMemo(() => {
    if (!isAddingRule || conditions.length === 0) return [];
    const validConds = conditions.filter(c => c.value && c.value.trim() !== '');
    if (validConds.length === 0) return [];

    return transactions.filter(tx => {
      const results = validConds.map(cond => evaluateRuleCondition(tx, cond));
      return conditionLogic === 'OR' ? results.some(Boolean) : results.every(Boolean);
    });
  }, [isAddingRule, conditions, conditionLogic, transactions]);

  // Run Rule scan on existing, original transaction record data
  const historicalRuleCalculations = useMemo(() => {
    const changes: {
      transaction: any;
      updates: { merchant?: string; description?: string; category?: string };
      appliedRuleId?: string;
      isFromMerchantRule?: boolean;
    }[] = [];

    transactions.forEach(tx => {
      const rawTx = {
        description: tx.description || '',
        merchant: tx.merchant || '',
        category: tx.category || '',
        amount: Number(tx.amount) || 0,
        type: tx.type || 'expense'
      };

      const result = applyTransactionRulesToFields(rawTx, merchantRules, existingRules);

      // Check if there are differences
      const diff: { merchant?: string; description?: string; category?: string } = {};
      let isDiff = false;

      if (result.merchant !== rawTx.merchant) {
        diff.merchant = result.merchant;
        isDiff = true;
      }
      if (result.description !== rawTx.description) {
        diff.description = result.description;
        isDiff = true;
      }
      if (result.category !== rawTx.category) {
        diff.category = result.category;
        isDiff = true;
      }

      if (isDiff) {
        changes.push({
          transaction: tx,
          updates: diff,
          appliedRuleId: result.appliedRuleId,
          isFromMerchantRule: result.isFromMerchantRule
        });
      }
    });

    return changes;
  }, [transactions, merchantRules, existingRules]);


  // ── Historical Scan: per-row selection helpers ────────────────────────────
  const toggleScanRow = (txId: string) => {
    setSelectedScanRows(prev => {
      const next = new Set(prev);
      if (next.has(txId)) next.delete(txId); else next.add(txId);
      return next;
    });
  };

  const toggleAllScanRows = (all: boolean) => {
    if (all) {
      setSelectedScanRows(new Set(historicalRuleCalculations.map(c => c.transaction.id)));
    } else {
      setSelectedScanRows(new Set());
    }
  };

  // Commit only the selected rows (if none selected → commit all)
  const handleApplyHistoricalChanges = () => {
    const subset = selectedScanRows.size > 0
      ? historicalRuleCalculations.filter(c => selectedScanRows.has(c.transaction.id))
      : historicalRuleCalculations;

    if (subset.length === 0) {
      toast.error('No matching transactions would be modified.');
      return;
    }

    const payload = subset.map(change => ({
      ...change.transaction,
      ...change.updates
    }));

    const nowStr = new Date().toISOString();
    const batchId = `batch-${uuidv4()}`;
    const backup: RuleRunBackup = {
      id: batchId,
      batchId,
      timestamp: nowStr,
      ruleName: 'Database Scan Optimization',
      transactions: subset.map(change2 => ({
        id: change2.transaction.id,
        originalCategory: change2.transaction.category || '',
        originalMerchant: change2.transaction.merchant || '',
        originalDescription: change2.transaction.description || ''
      }))
    };

    const newLogs: RuleExecutionLog[] = subset.map(change3 => {
      const ruleId = change3.appliedRuleId || 'merchant-override';
      const ruleName = change3.appliedRuleId
        ? (existingRules.find(r => r.id === change3.appliedRuleId)?.name || 'Custom Rule')
        : 'Merchant Override';

      const updatesList: string[] = [];
      if (change3.updates.merchant) updatesList.push(`Merchant: "${change3.transaction.merchant || ''}" ➔ "${change3.updates.merchant}"`);
      if (change3.updates.description) updatesList.push(`Desc: "${change3.transaction.description || ''}" ➔ "${change3.updates.description}"`);
      if (change3.updates.category) updatesList.push(`Category: "${change3.transaction.category || ''}" ➔ "${change3.updates.category}"`);

      return {
        id: `log-${uuidv4()}`,
        batchId,
        ruleId,
        ruleName,
        timestamp: nowStr,
        txId: change3.transaction.id,
        txDescription: change3.transaction.description || '',
        txAmount: Number(change3.transaction.amount) || 0,
        changeDetails: updatesList.join(', ')
      };
    });

    setPreferences(prev => ({
      ...prev,
      lastRuleRunBackup: backup,
      ruleExecutionHistory: [backup, ...(prev.ruleExecutionHistory || [])].slice(0, 10),
      ruleExecutionLogs: [
        ...newLogs,
        ...(prev.ruleExecutionLogs || [])
      ].slice(0, 500)
    }));

    saveTransaction(payload);
    setSelectedScanRows(new Set());
    toast.success(`Successfully applied Rule Engine updates to ${payload.length} transactions!`);
    setActiveTab('rules-list');
  };


  const handleApplyToExisting = () => {
    if (historicalRuleCalculations.length === 0) {
      toast.success('Your past transactions are already perfectly clean and aligned with your rules!');
      return;
    }

    const totalCount = historicalRuleCalculations.length;
    customConfirm(
      'Apply Rule Engine Optimization',
      `This will execute your active automated rules on your ledger and update ${totalCount} historical transactions in your database. This process generates an audit path and can be reverted anytime.`,
      () => {
        const payload = historicalRuleCalculations.map(change => ({
          ...change.transaction,
          ...change.updates
        }));

        const nowStr = new Date().toISOString();
        const batchId = `batch-${uuidv4()}`;
        const backup: RuleRunBackup = {
          id: batchId,
          batchId,
          timestamp: nowStr,
          ruleName: 'Rules Batch Run',
          transactions: historicalRuleCalculations.map(change2 => ({
            id: change2.transaction.id,
            originalCategory: change2.transaction.category || '',
            originalMerchant: change2.transaction.merchant || '',
            originalDescription: change2.transaction.description || ''
          }))
        };

        const newLogs: RuleExecutionLog[] = historicalRuleCalculations.map(change3 => {
          const ruleId = change3.appliedRuleId || 'merchant-override';
          const ruleName = change3.appliedRuleId
            ? (existingRules.find(r => r.id === change3.appliedRuleId)?.name || 'Custom Rule')
            : 'Merchant Override';

          const updatesList: string[] = [];
          if (change3.updates.merchant) updatesList.push(`Merchant: "${change3.transaction.merchant || ''}" ➔ "${change3.updates.merchant}"`);
          if (change3.updates.description) updatesList.push(`Desc: "${change3.transaction.description || ''}" ➔ "${change3.updates.description}"`);
          if (change3.updates.category) updatesList.push(`Category: "${change3.transaction.category || ''}" ➔ "${change3.updates.category}"`);

          return {
            id: `log-${uuidv4()}`,
            batchId,
            ruleId,
            ruleName,
            timestamp: nowStr,
            txId: change3.transaction.id,
            txDescription: change3.transaction.description || '',
            txAmount: Number(change3.transaction.amount) || 0,
            changeDetails: updatesList.join(', ')
          };
        });

        setPreferences(prev => ({
          ...prev,
          lastRuleRunBackup: backup,
          ruleExecutionHistory: [backup, ...(prev.ruleExecutionHistory || [])].slice(0, 10),
          ruleExecutionLogs: [
            ...newLogs,
            ...(prev.ruleExecutionLogs || [])
          ].slice(0, 500)
        }));

        saveTransaction(payload);
        toast.success(`Successfully applied rules to ${totalCount} historical transactions!`);
      },
      false,
      'Run Optimization'
    );
  };

  const handleRevertLastRun = () => {
    const backup = preferences.lastRuleRunBackup;
    if (!backup || !backup.transactions || backup.transactions.length === 0) {
      toast.error('No recent rule application found to revert.');
      return;
    }

    customConfirm(
      'Revert Last Optimization Run',
      `Are you sure you want to revert the last optimization run? This will restore ${backup.transactions.length} transactions back to their original state before the optimization run was executed.`,
      () => {
        const payload: any[] = [];
        backup.transactions.forEach(bt => {
          const realTx = transactions.find(t => t.id === bt.id);
          if (realTx) {
            payload.push({
              ...realTx,
              category: bt.originalCategory,
              merchant: bt.originalMerchant,
              description: bt.originalDescription
            });
          }
        });

        if (payload.length === 0) {
          toast.error('The transactions from the last run could not be found in your active ledger.');
          return;
        }

        saveTransaction(payload);

        const nowStr = new Date().toISOString();
        const revertLogs = payload.map(tx => ({
          id: `log-${uuidv4()}`,
          ruleId: 'rollback',
          ruleName: 'Rules Engine Rollback',
          timestamp: nowStr,
          txId: tx.id,
          txDescription: tx.description || '',
          txAmount: Number(tx.amount) || 0,
          changeDetails: `Reverted to original values (Merchant: "${tx.merchant}", Desc: "${tx.description}", Category: "${tx.category}")`
        }));

        setPreferences(prev => ({
          ...prev,
          lastRuleRunBackup: undefined,
          ruleExecutionLogs: [
            ...revertLogs,
            ...(prev.ruleExecutionLogs || [])
          ].slice(0, 500)
        }));

        toast.success(`Successfully reverted ${payload.length} transactions to their pre-run state!`);
      },
      true,
      'Revert Operations',
      'Keep Aligned'
    );
  };

  const suggestedRules = useMemo(() => {
    const occurrences: Record<string, { count: number; category: string; type: string; merchant: string }> = {};

    transactions.forEach(tx => {
      if (!tx.description || !tx.category) return;

      const rawTx = {
        description: tx.description || '',
        merchant: tx.merchant || '',
        category: tx.category || '',
        amount: Number(tx.amount) || 0,
        type: tx.type || 'expense'
      };

      const ruleRes = applyTransactionRulesToFields(rawTx, merchantRules, existingRules);
      if (ruleRes.appliedRuleId || ruleRes.isFromMerchantRule) {
        return;
      }

      const descWord = tx.description.trim();
      const normKey = descWord.toLowerCase();

      if (!occurrences[normKey]) {
        occurrences[normKey] = {
          count: 0,
          category: tx.category,
          type: tx.type || 'expense',
          merchant: tx.merchant || ''
        };
      }
      occurrences[normKey].count++;
    });

    const proposals: {
      id: string;
      name: string;
      conditions: TransactionRuleCondition[];
      actions: { field: 'merchant' | 'description' | 'category'; value: string }[];
      priority: number;
      reason: string;
    }[] = [];

    Object.entries(occurrences)
      .filter(([_, data]) => data.count >= 2)
      .slice(0, 4)
      .forEach(([normKey, data], index) => {
        const isMerchantKnown = !!data.merchant;
        const matchField = isMerchantKnown ? 'merchant' as const : 'description' as const;
        const matchVal = isMerchantKnown ? data.merchant : normKey;

        proposals.push({
          id: `suggestion-${index}-${uuidv4()}`,
          name: `Categorize ${isMerchantKnown ? data.merchant : normKey.substring(0, 16)} as ${data.category}`,
          conditions: [
            {
              field: matchField,
              operator: 'contains',
              value: matchVal
            }
          ],
          actions: [
            {
              field: 'category',
              value: data.category
            }
          ],
          priority: 10,
          reason: `Repeated pattern: Found ${data.count} manual transactions categorized as "${data.category}"`
        });
      });

    const backups = [
      {
        id: `suggestion-b1-${uuidv4()}`,
        name: `Automate Uber Rides`,
        conditions: [{ field: 'description' as const, operator: 'contains' as const, value: 'uber' }],
        actions: [{ field: 'category' as const, value: 'Transport' }],
        priority: 5,
        reason: 'Common transportation service pattern'
      },
      {
        id: `suggestion-b2-${uuidv4()}`,
        name: `Automate Amazon Purchases`,
        conditions: [{ field: 'description' as const, operator: 'contains' as const, value: 'amazon' }],
        actions: [{ field: 'category' as const, value: 'Shopping' }],
        priority: 5,
        reason: 'Common online retail/shopping merchant pattern'
      },
      {
        id: `suggestion-b3-${uuidv4()}`,
        name: `Automate Coffee Shops`,
        conditions: [{ field: 'description' as const, operator: 'contains' as const, value: 'starbucks' }],
        actions: [{ field: 'category' as const, value: 'Food & Dining' }],
        priority: 5,
        reason: 'Common dining/beverage merchant pattern'
      }
    ];

    backups.forEach(b => {
      const alreadyCovered = existingRules.some(r => r.name.toLowerCase().includes(b.name.toLowerCase()) || r.conditions.some(c => c.value.toLowerCase() === b.conditions[0].value.toLowerCase()));
      if (proposals.length < 4 && !alreadyCovered) {
        proposals.push(b);
      }
    });

    return proposals;
  }, [transactions, existingRules, merchantRules]);

  const handleAcceptSuggestedRule = (suggestion: any) => {
    const nextRules = [...existingRules];
    nextRules.push({
      id: `rule-${uuidv4()}`,
      name: suggestion.name,
      isActive: true,
      conditions: suggestion.conditions,
      actions: suggestion.actions,
      priority: suggestion.priority
    });

    setPreferences(prev => ({
      ...prev,
      transactionRules: nextRules
    }));

    toast.success(`Suggested rule "${suggestion.name}" is now live and active!`);
  };

  // Sandbox Simulator Real-Time Evaluation
  const sandboxEvaluation = useMemo(() => {
    const rawTx = {
      description: sandboxDesc,
      merchant: sandboxMerchant,
      category: '',
      amount: parseFloat(sandboxAmount) || 0,
      type: sandboxType
    };

    const evaluations: {
      rule: TransactionRule;
      isMatch: boolean;
      conditionResults: { condition: any; matched: boolean }[];
    }[] = [];

    let matchedRule: TransactionRule | null = null;
    let nextMerchant = sandboxMerchant;
    let nextDescription = sandboxDesc;
    let nextCategory = 'Uncategorized';

    const activeRules = existingRules.filter(r => r.isActive);

    for (const rule of activeRules) {
      const conditionResults = rule.conditions.map(cond => {
        const matched = evaluateRuleCondition(rawTx, cond);
        return { condition: cond, matched };
      });

      const allMatch = conditionResults.every(r => r.matched) && rule.conditions.length > 0;
      evaluations.push({
        rule,
        isMatch: allMatch,
        conditionResults
      });

      if (allMatch && !matchedRule) {
        matchedRule = rule;
        rule.actions.forEach(act => {
          if (act.field === 'merchant') nextMerchant = act.value;
          else if (act.field === 'description') nextDescription = act.value;
          else if (act.field === 'category') nextCategory = act.value;
        });
      }
    }

    return {
      evaluations,
      matchedRule,
      output: {
        merchant: nextMerchant,
        description: nextDescription,
        category: nextCategory,
      }
    };
  }, [sandboxDesc, sandboxAmount, sandboxType, sandboxMerchant, existingRules]);

  // Rule impact data mapping for BarChart
  const ruleImpactData = useMemo(() => {
    const counts: Record<string, number> = {};
    existingRules.forEach(r => {
      counts[r.id] = 0;
    });

    transactions.forEach(tx => {
      const rawTx = {
        description: tx.description || '',
        merchant: tx.merchant || '',
        category: tx.category || '',
        amount: Number(tx.amount) || 0,
        type: tx.type || 'expense'
      };

      const res = applyTransactionRulesToFields(rawTx, merchantRules, existingRules);
      if (res.appliedRuleId) {
        counts[res.appliedRuleId] = (counts[res.appliedRuleId] || 0) + 1;
      }
    });

    const colors = [
      '#14b8a6', // teal
      '#6366f1', // indigo
      '#3b82f6', // blue
      '#f59e0b', // amber
      '#ec4899', // pink
      '#8b5cf6', // purple
      '#10b981', // emerald
    ];

    return existingRules.map((rule, idx) => {
      const rawName = rule.name || 'Unnamed Rule';
      const shortName = rawName.length > 16 ? `${rawName.substring(0, 16)}...` : rawName;
      return {
        id: rule.id,
        ruleName: rawName,
        shortName,
        'Matched Count': counts[rule.id] || 0,
        color: colors[idx % colors.length]
      };
    }).sort((a, b) => b['Matched Count'] - a['Matched Count']);
  }, [transactions, existingRules, merchantRules]);


  const handleRevertBatch = (backup: RuleRunBackup) => {
    if (!backup || !backup.transactions || backup.transactions.length === 0) {
      toast.error('Selected execution batch has no transactions to revert.');
      return;
    }

    const batchName = backup.ruleName || 'Optimization Run';
    customConfirm(
      'Revert Execution Batch',
      `Revert "${batchName}" from ${new Date(backup.timestamp).toLocaleString()}? This will restore ${backup.transactions.length} transactions back to their original state prior to execution.`,
      () => {
        const payload: any[] = [];
        backup.transactions.forEach(bt => {
          const realTx = transactions.find(t => t.id === bt.id);
          if (realTx) {
            payload.push({
              ...realTx,
              category: bt.originalCategory,
              merchant: bt.originalMerchant,
              description: bt.originalDescription
            });
          }
        });

        if (payload.length === 0) {
          toast.error('The transactions from this batch could not be found in your active ledger.');
          return;
        }

        saveTransaction(payload);

        const batchIdentifier = backup.batchId || backup.id || backup.timestamp;

        setPreferences(prev => {
          const updatedLogs = (prev.ruleExecutionLogs || []).map(log => {
            if (log.batchId === batchIdentifier || log.timestamp === backup.timestamp) {
              return { ...log, isReverted: true };
            }
            return log;
          });

          const updatedHistory = (prev.ruleExecutionHistory || []).filter(b => (b.batchId || b.id || b.timestamp) !== batchIdentifier);
          const isLastRun = prev.lastRuleRunBackup?.timestamp === backup.timestamp || prev.lastRuleRunBackup?.batchId === batchIdentifier;

          return {
            ...prev,
            lastRuleRunBackup: isLastRun ? undefined : prev.lastRuleRunBackup,
            ruleExecutionHistory: updatedHistory,
            ruleExecutionLogs: updatedLogs
          };
        });

        toast.success(`Successfully reverted ${payload.length} transactions to their pre-run state!`);
      },
      true,
      'Revert Batch'
    );
  };

  // Rule Templates
  const handleApplyTemplate = (type: 'subscription' | 'commute' | 'coffee' | 'salary' | 'transfer') => {
    if (type === 'subscription') {
      setRuleName('Flag Entertainment Subscriptions');
      setConditions([
        { field: 'description', operator: 'contains', value: 'netflix' }
      ]);
      setActions([
        { field: 'category', value: 'Subscriptions' }
      ]);
    } else if (type === 'commute') {
      setRuleName('Rideshares & Transit');
      setConditions([
        { field: 'description', operator: 'contains', value: 'uber' }
      ]);
      setActions([
        { field: 'category', value: 'Transportation' }
      ]);
    } else if (type === 'coffee') {
      setRuleName('Coffee Shops & Cafes');
      setConditions([
        { field: 'description', operator: 'contains', value: 'starbucks' }
      ]);
      setActions([
        { field: 'category', value: 'Dining & Cafes' }
      ]);
    } else if (type === 'salary') {
      setRuleName('Payroll & Salary Deposits');
      setConditions([
        { field: 'description', operator: 'contains', value: 'payroll' }
      ]);
      setActions([
        { field: 'category', value: 'Income & Salary' }
      ]);
    } else if (type === 'transfer') {
      setRuleName('Identify Internal Transfers');
      setConditions([
        { field: 'description', operator: 'contains', value: 'transfer' }
      ]);
      setActions([
        { field: 'category', value: 'Transfer' }
      ]);
    }
    toast.info('Preset template pre-loaded! Review and save.');
  };

  return (
    <div className="flex-1 overflow-y-auto" id="rules-view">
      <SettingsSubpageHeader
        markerIcon="smart_toy"
        markerLabel="Rules & Automation"
        title="Rule Engine"
        subtitle="Automate your workflow with custom IF-WHEN-THEN rules for transaction processing."
        setCurrentPage={setCurrentPage}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <HeaderButton
              variant="secondary"
              icon="zap"
              onClick={() => setShowSuggestions(!showSuggestions)}
            >
              {showSuggestions ? 'Hide Suggestions' : 'Suggest Rules'}
            </HeaderButton>

            <HeaderButton
              variant="indigo"
              icon="sliders"
              id="btn-simulate-rules"
              onClick={() => setIsSimulateModalOpen(true)}
            >
              Simulate Impact
            </HeaderButton>


            <HeaderButton
              variant="primary"
              icon={isAddingRule ? 'XClose' : 'PlusCircle'}
              id="btn-add-rule"
              onClick={() => {
                if (isAddingRule) {
                  resetForm();
                } else {
                  setIsAddingRule(true);
                }
              }}
            >
              {isAddingRule ? 'Cancel' : 'New Rule'}
            </HeaderButton>
          </div>
        }
      />

      <div className="max-w-6xl mx-auto px-4 lg:px-8 py-6 space-y-6">
        {/* Statistics Indicator & Tabs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 shadow-sm p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <Icon name="sliders" className="text-2xl" />
            </div>
            <div>
              <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 tracking-wider uppercase">Engine Capacity</span>
              <h4 className="text-xl font-bold mt-0.5" id="stat-active-rules">{existingRules.length} Defined Rules</h4>
            </div>
          </Card>

          <Card className="bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 shadow-sm p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Icon name="check_circle" className="text-2xl" />
            </div>
            <div>
              <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 tracking-wider uppercase">Historical Matches</span>
              <h4 className="text-xl font-bold mt-0.5" id="stat-matched-txs">{historicalRuleCalculations.length} Pending Actions</h4>
            </div>
          </Card>

          <Card className="bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 shadow-sm p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center">
              <Icon name="building" className="text-2xl" />
            </div>
            <div>
              <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 tracking-wider uppercase">Merchant Priority</span>
              <h4 className="text-xl font-bold mt-0.5 text-teal-600 dark:text-teal-400 font-mono">Registry Active</h4>
            </div>
          </Card>
        </div>

        {/* Segmented Pill Tab Controls */}
        <div className="bg-black/5 dark:bg-white/5 p-1.5 rounded-2xl flex flex-wrap items-center gap-1 border border-black/5 dark:border-white/5">
          <button
            onClick={() => setActiveTab('rules-list')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${activeTab === 'rules-list'
                ? 'bg-white dark:bg-dark-card text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
          >
            <Icon name="sliders" className="text-base" />
            <span>Rules Workspace</span>
          </button>

          <button
            onClick={() => setActiveTab('merchant-overrides')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${activeTab === 'merchant-overrides'
                ? 'bg-white dark:bg-dark-card text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
          >
            <Icon name="building" className="text-base" />
            <span>Merchant Overrides</span>
          </button>

          <button
            onClick={() => setActiveTab('rules-sandbox')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${activeTab === 'rules-sandbox'
                ? 'bg-white dark:bg-dark-card text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
          >
            <Icon name="sliders" className="text-base" />
            <span>Interactive Sandbox</span>
          </button>

          <button
            onClick={() => setActiveTab('execution-logs')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${activeTab === 'execution-logs'
                ? 'bg-white dark:bg-dark-card text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
          >
            <Icon name="receipt" className="text-base" />
            <span>Execution History & Logs</span>
          </button>

          <button
            onClick={() => setActiveTab('historical-scan')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${activeTab === 'historical-scan'
                ? 'bg-white dark:bg-dark-card text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
          >
            <Icon name="Search01" className="text-base" />
            <span>Scan Database</span>
            {historicalRuleCalculations.length > 0 && (
              <span className="px-1.5 py-0.5 text-xs bg-amber-500 text-white rounded-full font-bold font-mono">
                {historicalRuleCalculations.length}
              </span>
            )}
          </button>
        </div>

        {/* Rule creation drawer form */}
        <AnimatePresence>
          {isAddingRule && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden mb-6"
            >
              <Card className="bg-gray-50/50 dark:bg-white/[0.01] border-2 border-dashed border-black/5 dark:border-white/5 p-6 rounded-2xl space-y-6">
                <div className="flex justify-between items-center border-b border-black/5 dark:border-white/5 pb-3">
                  <h3 className="text-sm font-bold tracking-tight text-light-text dark:text-dark-text">
                    {editingRuleId ? 'Modify Configured Rule' : 'Design Custom IF-WHEN-THEN Rule'}
                  </h3>
                  {!editingRuleId && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-gray-400 font-semibold mr-1">1-Click Presets:</span>
                      <button type="button" onClick={() => handleApplyTemplate('subscription')} className="text-xs font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-lg transition-colors">🎬 Subscriptions</button>
                      <button type="button" onClick={() => handleApplyTemplate('commute')} className="text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2 py-1 rounded-lg transition-colors">🚗 Rideshares</button>
                      <button type="button" onClick={() => handleApplyTemplate('coffee')} className="text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-lg transition-colors">☕ Coffee</button>
                      <button type="button" onClick={() => handleApplyTemplate('salary')} className="text-xs font-semibold bg-teal-500/10 hover:bg-teal-500/20 text-teal-600 dark:text-teal-400 px-2 py-1 rounded-lg transition-colors">💼 Salary</button>
                      <button type="button" onClick={() => handleApplyTemplate('transfer')} className="text-xs font-semibold bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 px-2 py-1 rounded-lg transition-colors">🔄 Transfers</button>
                    </div>
                  )}
                </div>

                <form onSubmit={handleCreateOrUpdateRule} className="space-y-6">
                  {/* Rule Name & Priority */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-400  tracking-widest mb-1.5">Rule Name</label>
                      <input
                        type="text"
                        value={ruleName}
                        onChange={e => setRuleName(e.target.value)}
                        placeholder="e.g., Automatic Food category for uber eats"
                        className={`${INPUT_BASE_STYLE} font-bold`}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400  tracking-widest mb-1.5 flex items-center justify-between">
                        <span>Rule Priority</span>
                        <span className="text-xs text-primary-500 font-semibold tracking-normal normal-case">Integrated drag & drop</span>
                      </label>
                      <div className="p-2 sm:p-2.5 bg-gray-100 dark:bg-white/[0.03] text-xs text-gray-500 dark:text-gray-400 rounded-xl leading-snug border border-black/5 dark:border-white/5 flex items-start gap-2 h-[42px] overflow-hidden select-none">
                        <Icon name="drag_indicator" className="text-sm leading-none shrink-0 text-primary-500 mt-0.5" />
                        <span>Drag & drop rules inside the workspace list below to adjust priority order anytime!</span>
                      </div>
                    </div>
                  </div>

                  {/* Conditions - WHEN Block */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-amber-500 tracking-widest flex items-center gap-1">
                          <Icon name="filter_alt" className="text-base" />
                          <span>WHEN: Conditions</span>
                        </span>
                        {/* AND / OR logic toggle — only shown when >1 condition */}
                        {conditions.length > 1 && (
                          <div className="flex items-center bg-black/5 dark:bg-white/5 rounded-lg p-0.5 text-xs font-semibold gap-0.5">
                            <button
                              type="button"
                              onClick={() => setConditionLogic('AND')}
                              className={`px-2 py-0.5 rounded transition-colors ${conditionLogic === 'AND' ? 'bg-amber-500 text-white' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                            >
                              AND
                            </button>
                            <button
                              type="button"
                              onClick={() => setConditionLogic('OR')}
                              className={`px-2 py-0.5 rounded transition-colors ${conditionLogic === 'OR' ? 'bg-amber-500 text-white' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                            >
                              OR
                            </button>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={addConditionField}
                        className="text-xs font-semibold text-primary-500 hover:underline flex items-center gap-0.5"
                      >
                        <Icon name="add_circle" className="text-sm" />
                        Add Condition
                      </button>
                    </div>

                    <div className="space-y-3">
                      {conditions.map((cond, idx) => (
                        <div key={idx} className="flex flex-col md:flex-row gap-3 items-end md:items-center bg-white dark:bg-dark-card p-3 rounded-xl border border-black/5 dark:border-white/5 shadow-xs">
                          {/* Condition field descriptor */}
                          <div className="w-full md:w-1/4">
                            <span className="block text-xs text-gray-400 font-semibold tracking-wider uppercase mb-1">Target Field</span>
                            <div className={SELECT_WRAPPER_STYLE}>
                              <select
                                value={cond.field}
                                onChange={e => updateCondition(idx, 'field', e.target.value)}
                                className={SELECT_STYLE}
                              >
                                <option value="description">Description</option>
                                <option value="merchant">Merchant</option>
                                <option value="amount">Amount</option>
                                <option value="type">Transaction Type</option>
                                <option value="category">Current Category</option>
                              </select>
                              <div className={SELECT_ARROW_STYLE} />
                            </div>
                          </div>

                          {/* Operator */}
                          <div className="w-full md:w-1/4">
                            <span className="block text-xs text-gray-400 font-semibold tracking-wider uppercase mb-1">Criteria</span>
                            <div className={SELECT_WRAPPER_STYLE}>
                              <select
                                value={cond.operator}
                                onChange={e => updateCondition(idx, 'operator', e.target.value)}
                                className={SELECT_STYLE}
                              >
                                {cond.field === 'amount' ? (
                                  <>
                                    <option value="equals">Equals</option>
                                    <option value="greater_than">Greater than</option>
                                    <option value="less_than">Less than</option>
                                  </>
                                ) : (
                                  <>
                                    <option value="contains">Contains (Case Insensitive)</option>
                                    <option value="equals">Equals (Exact)</option>
                                    <option value="starts_with">Starts with</option>
                                    <option value="ends_with">Ends with</option>
                                  </>
                                )}
                              </select>
                              <div className={SELECT_ARROW_STYLE} />
                            </div>
                          </div>

                          {/* Value */}
                          <div className="flex-1 w-full">
                            <span className="block text-xs text-gray-400 font-semibold tracking-wider uppercase mb-1">Value</span>
                            {cond.field === 'category' ? (
                              <div className={SELECT_WRAPPER_STYLE}>
                                <select
                                  value={cond.value}
                                  onChange={e => updateCondition(idx, 'value', e.target.value)}
                                  className={SELECT_STYLE}
                                >
                                  <option value="">Select category...</option>
                                  {flatCategories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                  ))}
                                </select>
                                <div className={SELECT_ARROW_STYLE} />
                              </div>
                            ) : (
                              <input
                                type={cond.field === 'amount' ? 'number' : 'text'}
                                step="any"
                                value={cond.value}
                                onChange={e => updateCondition(idx, 'value', e.target.value)}
                                placeholder={cond.field === 'type' ? 'e.g. expense, income' : 'keyword or amount...'}
                                className={INPUT_BASE_STYLE}
                                required
                              />
                            )}
                          </div>

                          {/* Delete condition */}
                          {conditions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeConditionField(idx)}
                              className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 p-2 rounded-lg"
                            >
                              <Icon name="delete" className="text-lg leading-none" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions - THEN Block */}
                  <div className="space-y-3 pt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black text-emerald-500  tracking-widest flex items-center gap-1">
                        <Icon name="bolt" className="text-base" />
                        <span>THEN: Update Transactions</span>
                      </span>
                      <button
                        type="button"
                        onClick={addActionField}
                        className="text-xs font-semibold text-primary-500 hover:underline flex items-center gap-0.5"
                      >
                        <Icon name="add_circle" className="text-sm" />
                        Add Action
                      </button>
                    </div>

                    <div className="space-y-3">
                      {actions.map((act, idx) => (
                        <div key={idx} className="flex flex-col md:flex-row gap-3 items-end md:items-center bg-white dark:bg-dark-card p-3 rounded-xl border border-black/5 dark:border-white/5 shadow-xs">
                          {/* target block */}
                          <div className="w-full md:w-1/3">
                            <span className="block text-xs text-gray-400 font-semibold tracking-wider uppercase mb-1">Action Destination</span>
                            <div className={SELECT_WRAPPER_STYLE}>
                              <select
                                value={act.field}
                                onChange={e => updateAction(idx, 'field', e.target.value)}
                                className={SELECT_STYLE}
                              >
                                <option value="category">Change Category</option>
                                <option value="merchant">Change Merchant</option>
                                <option value="description">Change Description</option>
                              </select>
                              <div className={SELECT_ARROW_STYLE} />
                            </div>
                          </div>

                          {/* Action Value Input or Dropdown for category */}
                          <div className="flex-1 w-full">
                            <span className="block text-xs text-gray-400 font-semibold tracking-wider uppercase mb-1">New Value</span>
                            {act.field === 'category' ? (
                              <div className={SELECT_WRAPPER_STYLE}>
                                <select
                                  value={act.value}
                                  onChange={e => updateAction(idx, 'value', e.target.value)}
                                  className={SELECT_STYLE}
                                  required
                                >
                                  {flatCategories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                  ))}
                                </select>
                                <div className={SELECT_ARROW_STYLE} />
                              </div>
                            ) : (
                              <input
                                type="text"
                                value={act.value}
                                onChange={e => updateAction(idx, 'value', e.target.value)}
                                placeholder="New customized value..."
                                className={INPUT_BASE_STYLE}
                                required
                              />
                            )}
                          </div>

                          {/* Delete action */}
                          {actions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeActionField(idx)}
                              className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 p-2 rounded-lg"
                            >
                              <Icon name="delete" className="text-lg leading-none" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Live Transaction Match Preview */}
                  {conditions.some(c => c.value && c.value.trim() !== '') && (
                    <div className="bg-primary-500/[0.04] dark:bg-primary-500/[0.02] border border-primary-500/20 p-4 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-primary-600 dark:text-primary-400 flex items-center gap-1.5">
                          <Icon name="bolt" className="text-base" />
                          <span>Live Impact Preview ({liveDraftMatches.length} matching transactions in your ledger)</span>
                        </span>
                        <span className="text-xs font-mono text-gray-400 uppercase tracking-wider font-semibold">Real-time Match</span>
                      </div>
                      {liveDraftMatches.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">No transactions in your database match these conditions yet.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto pt-1">
                          {liveDraftMatches.slice(0, 6).map(tx => (
                            <span key={tx.id} className="text-xs bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 px-2.5 py-1 rounded-lg text-gray-700 dark:text-gray-300 font-medium flex items-center gap-2 shadow-xs">
                              <span className="truncate max-w-[140px]">{tx.description || tx.merchant || 'Transaction'}</span>
                              <span className="font-mono text-primary-500 font-bold">({tx.amount} EUR)</span>
                            </span>
                          ))}
                          {liveDraftMatches.length > 6 && (
                            <span className="text-xs text-gray-400 self-center font-semibold px-1">+{liveDraftMatches.length - 6} more</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Submission actions */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-black/5 dark:border-white/5">
                    <button
                      type="button"
                      onClick={resetForm}
                      className={BTN_SECONDARY_STYLE}
                    >
                      Reset Form
                    </button>
                    <button
                      type="submit"
                      className={BTN_PRIMARY_STYLE}
                      id="btn-save-rule-submit"
                    >
                      {editingRuleId ? 'Confirm Updates' : 'Launch New Rule'}
                    </button>
                  </div>
                </form>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* WORKSPACE VIEW: List of defined rules */}
        {activeTab === 'rules-list' && (
          <div className="space-y-4">
            {/* SMART SUGGESTED RULES PANEL */}
            <AnimatePresence>
              {showSuggestions && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden mb-6"
                >
                  <Card className="bg-primary-500/[0.02] border-2 border-dashed border-primary-500/20 p-5 rounded-2xl space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-primary-600 dark:text-primary-400 tracking-tight flex items-center gap-1.5">
                        <Icon name="emoji_objects" className="text-base" />
                        <span>Intelligent Automation Suggestions</span>
                      </h4>
                      <p className="text-xs text-gray-400 mt-0.5">
                        We analyzed your transactions and found patterns that should be automated with IF-WHEN-THEN rules. Click "Accept and Activate" to activate a suggestion immediately.
                      </p>
                    </div>

                    {suggestedRules.length === 0 ? (
                      <p className="text-xs text-gray-400">All recurring manual transaction patterns are already mapped to active rules!</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {suggestedRules.map((sug, idx) => (
                          <div key={sug.id} className="bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 p-4 rounded-xl space-y-3 relative overflow-hidden group">
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <h5 className="font-bold text-xs text-light-text dark:text-dark-text">{sug.name}</h5>
                                <p className="text-xs text-gray-400 mt-0.5">{sug.reason}</p>
                              </div>
                              <span className="px-1.5 py-0.5 text-xs font-semibold rounded bg-primary-100 text-primary-600 dark:bg-primary-950/40 dark:text-primary-300">
                                Priority {sug.priority}
                              </span>
                            </div>

                            <div className="bg-gray-50 dark:bg-white/[0.01] border border-black/5 dark:border-white/5 p-2 rounded-lg text-xs font-mono flex items-center flex-wrap gap-x-2 gap-y-1">
                              <span className="text-xs font-semibold text-amber-500 bg-amber-500/10 px-1 py-0.5 rounded">IF</span>
                              {sug.conditions.map((c, cIdx) => (
                                <span key={cIdx}>
                                  {c.field} {c.operator.replace('_', ' ')} <strong className="text-light-text dark:text-dark-text">"{c.value}"</strong>
                                </span>
                              ))}
                              <span className="text-gray-300">➔</span>
                              <span className="text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-1 py-0.5 rounded">THEN</span>
                              {sug.actions.map((a, aIdx) => (
                                <span key={aIdx}>
                                  set {a.field} to <strong className="text-emerald-600 dark:text-emerald-400 font-bold">"{a.value}"</strong>
                                </span>
                              ))}
                            </div>

                            <button
                              onClick={() => handleAcceptSuggestedRule(sug)}
                              className="w-full py-1.5 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1"
                            >
                              <Icon name="emoji_objects" className="text-sm" />
                              <span>Accept and Activate</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {existingRules.length === 0 ? (
              <div className="py-12 px-4 text-center bg-gray-50 dark:bg-white/[0.01] rounded-2xl border-2 border-dashed border-black/5 dark:border-white/5 flex flex-col items-center justify-center">
                <Icon name="smart_toy" className="text-4xl text-gray-300" />
                <p className="font-bold text-xs text-gray-400 tracking-widest mt-3">No Rules Configured</p>
                <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">Build an automated rule right now to keep your incoming bank/CSV transactions tidy.</p>
                <button
                  onClick={() => setIsAddingRule(true)}
                  className={`${BTN_PRIMARY_STYLE} mt-4 !w-auto inline-flex items-center justify-center px-5 py-2.5 text-xs shadow-sm`}
                >
                  <Icon name="add" className="text-base mr-1" />
                  <span>Create First Rule</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Columns - Rules List */}
                <div className="lg:col-span-2 space-y-4">
                  {/* Inline Warning/Sync Banner for Apply to existing */}
                  {historicalRuleCalculations.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-amber-500/[0.04] dark:bg-amber-500/[0.01] border-2 border-dashed border-amber-500/20 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-xs"
                    >
                      <div className="flex items-start gap-3">
                        <Icon name="restore" className="text-amber-500 text-2xl shrink-0 mt-0.5" />
                        <div>
                          <h5 className="font-bold text-xs text-amber-800 dark:text-amber-400  tracking-wide">Historical Data Optimization Pending</h5>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            You have <strong>{historicalRuleCalculations.length} matching transactions</strong> in your database that would be processed by your rules.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleApplyToExisting}
                        className={`${BTN_PRIMARY_STYLE} bg-amber-600 hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-700 text-white flex items-center gap-1.5 text-xs self-stretch sm:self-auto justify-center`}
                        id="btn-apply-historical-inline"
                      >
                        <Icon name="settings_backup_restore" className="text-base" />
                        <span>Apply to existing transactions</span>
                      </button>
                    </motion.div>
                  )}

                  <div className="space-y-4">
                    {/* Visual hint for Drag and Drop */}
                    <div className="bg-gray-50 dark:bg-white/[0.01] border border-black/5 dark:border-white/5 p-3 rounded-xl flex items-center justify-between text-xs text-gray-400 select-none">
                      <div className="flex items-center gap-2">
                        <Icon name="info" className="text-sm leading-none text-primary-500 font-bold" />
                        <span>Drag items by the handle or card body to reorder priorities (top card executes first).</span>
                      </div>
                      <span className="text-xs font-semibold tracking-wider text-primary-500 font-mono bg-primary-500/10 px-2 py-0.5 rounded-sm">Drag Active</span>
                    </div>

                    {sortedRules.map((rule, index) => {
                      const isDragged = draggedRuleId === rule.id;
                      const isDragOver = dragOverRuleId === rule.id;
                      return (
                        <React.Fragment key={rule.id}>
                          <motion.div
                            layout
                            draggable={true}
                            onDragStart={(e: any) => {
                              setDraggedRuleId(rule.id);
                              if (e.dataTransfer) {
                                e.dataTransfer.effectAllowed = 'move';
                                e.dataTransfer.setData('text/plain', rule.id);
                              }
                            }}
                          onDragEnd={() => {
                            setDraggedRuleId(null);
                            setDragOverRuleId(null);
                          }}
                          onDragOver={(e: any) => {
                            e.preventDefault();
                            if (draggedRuleId && draggedRuleId !== rule.id && dragOverRuleId !== rule.id) {
                              setDragOverRuleId(rule.id);
                            }
                          }}
                          onDragLeave={() => {
                            if (dragOverRuleId === rule.id) {
                              setDragOverRuleId(null);
                            }
                          }}
                          onDrop={(e: any) => {
                            e.preventDefault();
                            if (!draggedRuleId || draggedRuleId === rule.id) return;

                            const draggedIdx = sortedRules.findIndex(r => r.id === draggedRuleId);
                            const targetIdx = sortedRules.findIndex(r => r.id === rule.id);
                            if (draggedIdx === -1 || targetIdx === -1) return;

                            const nextRules = [...sortedRules];
                            const [draggedItem] = nextRules.splice(draggedIdx, 1);
                            nextRules.splice(targetIdx, 0, draggedItem);

                            // Reallocate priorities in strictly descending order so that physical position
                            // maps perfectly to priority (index 0 is highest)
                            const updatedRules = nextRules.map((r, idx) => ({
                              ...r,
                              priority: (nextRules.length - idx) * 10
                            }));

                            setPreferences(prev => ({
                              ...prev,
                              transactionRules: updatedRules
                            }));

                            setDraggedRuleId(null);
                            setDragOverRuleId(null);
                            toast.success(`Successfully updated rule priority! "${draggedItem.name}" is now prioritized.`);
                          }}
                          className={`bg-white dark:bg-dark-card border rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 group transition-all duration-200 cursor-grab active:cursor-grabbing ${isDragged ? 'opacity-30 border-dashed border-gray-300 dark:border-white/10 scale-[0.98]' :
                              isDragOver ? 'border-2 border-dashed border-primary-500 bg-primary-500/[0.03] scale-[1.01] shadow-md' :
                                'border-black/5 dark:border-white/5 hover:border-black/10 dark:hover:border-white/10 hover:shadow-xs'
                            }`}
                        >
                          <div className="flex items-start md:items-center gap-3 flex-1 min-w-0">
                            {/* Grip drag handle icon */}
                            <div className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-primary-500 dark:text-gray-600 dark:hover:text-primary-500 transition-colors shrink-0 flex items-center justify-center p-1" title="Drag to reorder priority">
                              <Icon name="drag_indicator" className="text-xl leading-none font-bold select-none" />
                            </div>

                            <div className="space-y-3 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-black text-light-text dark:text-dark-text" id={`rule-name-${rule.id}`}>{rule.name}</span>
                                <span className={`px-2 py-0.5 text-xs font-semibold rounded ${rule.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400'}`}>
                                  {rule.isActive ? 'Active' : 'Disabled'}
                                </span>
                                <span className="px-2 py-0.5 text-xs font-semibold rounded bg-primary-100 dark:bg-primary-950/40 text-primary-600 dark:text-primary-300 flex items-center gap-0.5">
                                  <Icon name="speed" className="text-xs leading-none shrink-0 font-black" />
                                  <span>Priority {rule.priority ?? 0}</span>
                                </span>
                              </div>

                              {/* Visual Condition & Action maps */}
                              <div className="flex flex-col sm:flex-row sm:items-center gap-x-6 gap-y-2 text-xs">
                                {/* Conditions view */}
                                <div className="flex flex-wrap items-center gap-1">
                                  <span className="text-xs font-semibold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">IF</span>
                                  {rule.conditions.map((c, i) => (
                                    <span key={i} className="text-gray-400 dark:text-gray-400 font-mono text-xs bg-gray-50 dark:bg-white/[0.02] px-2 py-0.5 rounded border border-black/[0.03] dark:border-white/[0.03]">
                                      {c.field} {c.operator.replace('_', ' ')} <strong className="text-light-text dark:text-dark-text font-black font-sans">"{c.value}"</strong>
                                      {i < rule.conditions.length - 1 && ' AND'}
                                    </span>
                                  ))}
                                </div>

                                {/* Arrow flow */}
                                <span className="hidden sm:inline text-gray-300">→</span>

                                {/* Actions view */}
                                <div className="flex flex-wrap items-center gap-1">
                                  <span className="text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">THEN</span>
                                  {rule.actions.map((a, i) => (
                                    <span key={i} className="text-gray-400 dark:text-gray-400 font-mono text-xs bg-gray-50 dark:bg-white/[0.02] px-2 py-0.5 rounded border border-black/[0.03] dark:border-white/[0.03]">
                                      set {a.field} to <strong className="text-emerald-600 dark:text-emerald-400 font-black font-sans">"{a.value}"</strong>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Management buttons */}
                          <div className="flex items-center gap-2 self-end md:self-auto shrink-0 select-none">
                            {/* Logic badge */}
                            {rule.conditionLogic === 'OR' && (
                              <span className="px-1.5 py-0.5 text-xs font-semibold rounded bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">OR</span>
                            )}

                            {/* Test on Ledger button */}
                            <button
                              title="Test this rule against your real transactions"
                              onClick={() => setTestingRuleId(testingRuleId === rule.id ? null : rule.id)}
                              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${testingRuleId === rule.id ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400' : 'bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300'}`}
                            >
                              <Icon name="science" className="text-lg leading-none" />
                            </button>

                            <button
                              onClick={() => handleToggleRuleActive(rule.id, !rule.isActive)}
                              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${rule.isActive ? 'bg-green-50 hover:bg-green-100 text-green-600 dark:bg-green-950/20 dark:hover:bg-green-900/40 dark:text-green-400' : 'bg-gray-100 hover:bg-gray-200 text-gray-500 dark:bg-white/5 dark:hover:bg-white/10 dark:text-gray-400'}`}
                            >
                              <Icon name={rule.isActive ? 'toggle_on' : 'toggle_off'} className="text-lg leading-none" />
                            </button>

                            <button
                              onClick={() => handleEditRule(rule)}
                              className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 flex items-center justify-center transition-colors"
                            >
                              <Icon name="edit" className="text-lg leading-none" />
                            </button>

                            <button
                              onClick={() => handleDeleteRule(rule.id, rule.name)}
                              className="w-9 h-9 rounded-xl bg-red-100/10 hover:bg-red-100/30 text-red-500 flex items-center justify-center transition-colors"
                            >
                              <Icon name="delete" className="text-lg leading-none" />
                            </button>
                          </div>
                        </motion.div>

                        {/* Inline "Test on Ledger" panel */}
                        {testingRuleId === rule.id && (() => {
                          const logic = rule.conditionLogic ?? 'AND';
                          const ledgerMatches = transactions.filter(tx => {
                            if (rule.conditions.length === 0) return false;
                            const results = rule.conditions.map(cond => evaluateRuleCondition({
                              description: tx.description || '',
                              merchant: tx.merchant || '',
                              amount: Math.abs(Number(tx.amount) || 0),
                              type: tx.type || 'expense',
                              category: tx.category || '',
                            }, cond));
                            return logic === 'OR' ? results.some(Boolean) : results.every(Boolean);
                          });
                          return (
                            <div className="mx-1 mb-2 bg-indigo-500/[0.04] border border-indigo-500/20 rounded-2xl p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                                  <Icon name="science" className="text-sm" />
                                  <span>Live Ledger Test — <strong>{ledgerMatches.length}</strong> matching transaction{ledgerMatches.length !== 1 ? 's' : ''}</span>
                                </span>
                                <span className="font-mono text-xs bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded font-semibold">{logic} logic</span>
                              </div>
                              {ledgerMatches.length === 0 ? (
                                <p className="text-xs text-gray-400 italic">No real transactions currently match this rule's conditions.</p>
                              ) : (
                                <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
                                  {ledgerMatches.slice(0, 8).map(tx => (
                                    <span key={tx.id} className="text-xs bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 px-2.5 py-1 rounded-lg text-gray-700 dark:text-gray-300 font-medium flex items-center gap-2 shadow-xs">
                                      <span className="truncate max-w-[130px]">{tx.description || tx.merchant || 'Transaction'}</span>
                                      <span className="font-mono text-indigo-500 font-bold shrink-0">{Number(tx.amount).toFixed(2)} {tx.currency || 'EUR'}</span>
                                    </span>
                                  ))}
                                  {ledgerMatches.length > 8 && (
                                    <span className="text-xs text-gray-400 self-center font-semibold px-1">+{ledgerMatches.length - 8} more</span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </React.Fragment>
                    );
                  })}

                  </div>
                </div>

                {/* Right Column - Visual Summary Chart */}
                <div className="space-y-4">
                  <Card className="bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 p-5 shadow-sm space-y-4 lg:sticky lg:top-6">
                    <div>
                      <h4 className="text-xs font-bold text-light-text dark:text-dark-text tracking-tight flex items-center gap-1.5">
                        <Icon name="bar_chart" className="text-base text-teal-500" />
                        <span>Rule Impact Analysis</span>
                      </h4>
                      <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                        Distribution of matching historical transactions governed by each custom rule.
                      </p>
                    </div>

                    {ruleImpactData.length === 0 ? (
                      <div className="py-6 text-center text-xs text-gray-400 border border-dashed border-black/5 rounded-xl">
                        No rules active for telemetry evaluation.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Horizontal Bar Chart */}
                        <div className="h-48 w-full font-sans text-xs">
                          <BarChart
                            data={ruleImpactData}
                            xDataKey="shortName"
                            orientation="horizontal"
                            aspectRatio="auto"
                            margin={{ top: 5, right: 10, left: 70, bottom: 5 }}
                            className="w-full h-full"
                          >
                            <Grid vertical horizontal={false} strokeOpacity={0.05} />
                            <Bar
                              dataKey="Matched Count"
                              fill={(d) => (d.color as string) || '#14b8a6'}
                              lineCap="round"
                            />
                            <BarXAxis />
                            <BarYAxis />
                            <ChartTooltip
                              valueFormatter={(val: number) => `${val} matched`}
                            />
                          </BarChart>
                        </div>

                        {/* List impact breakdown panel */}
                        <div className="border-t border-black/5 dark:border-white/5 pt-3.5 space-y-2.5">
                          <span className="text-xs font-semibold text-gray-400 tracking-wider">Matched Statistics</span>
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {ruleImpactData.map((data, idx) => (
                              <div key={data.id} className="flex justify-between items-center text-xs">
                                <div className="flex items-center gap-1.5 truncate max-w-[70%]">
                                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: data.color }} />
                                  <span className="truncate text-gray-600 dark:text-gray-300" title={data.ruleName}>{data.ruleName}</span>
                                </div>
                                <span className="font-mono font-bold text-light-text dark:text-dark-text">{data['Matched Count']} records</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Efficiency Panel */}
                        <div className="bg-gray-50 dark:bg-white/[0.01] border border-black/5 dark:border-white/5 p-3 rounded-xl flex items-center justify-between text-xs">
                          <div>
                            <span className="text-gray-400 block text-xs font-semibold uppercase tracking-wider">Covered Volume</span>
                            <span className="font-extrabold text-light-text dark:text-dark-text">
                              {ruleImpactData.reduce((sum, entry) => sum + entry['Matched Count'], 0)} Transactions
                            </span>
                          </div>
                          <span className="px-2 py-1 bg-teal-500/10 text-teal-600 dark:text-teal-400 text-xs font-semibold rounded-lg">
                            Live Coverage
                          </span>
                        </div>
                      </div>
                    )}
                  </Card>
                </div>
              </div>
            )}
          </div>
        )}

        {/* RULE EXECUTION HISTORY & AUDIT LOGS VIEW */}
        {activeTab === 'execution-logs' && (
          <div className="space-y-6">
            {/* Revert Last Run Section */}
            {preferences.lastRuleRunBackup && preferences.lastRuleRunBackup.transactions && preferences.lastRuleRunBackup.transactions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-amber-500/[0.04] border border-amber-500/20 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                    <Icon name="history" className="text-2xl font-black" />
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-amber-800 dark:text-amber-400 tracking-wide">Optimization Rollback Point Available</h5>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      A rollback recovery point was captured on {new Date(preferences.lastRuleRunBackup.timestamp).toLocaleString()} with <strong>{preferences.lastRuleRunBackup.transactions.length} modified transactions</strong>.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleRevertLastRun}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 self-stretch md:self-auto shadow-sm transition-colors shrink-0"
                >
                  <Icon name="settings_backup_restore" className="text-base font-black" />
                  <span>Revert Last Run ({preferences.lastRuleRunBackup.transactions.length})</span>
                </button>
              </motion.div>
            )}

            {/* Execution Rollback Points History */}
            {preferences.ruleExecutionHistory && preferences.ruleExecutionHistory.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-light-text dark:text-dark-text flex items-center gap-1.5">
                  <Icon name="history" className="text-base text-amber-500" />
                  <span>Execution Rollback Points ({preferences.ruleExecutionHistory.length} Batches Available)</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {preferences.ruleExecutionHistory.map((batch, idx) => (
                    <div key={batch.id || idx} className="bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 p-4 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-light-text dark:text-dark-text">{batch.ruleName || 'Optimization Run'}</span>
                          <span className="text-xs font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-semibold">
                            {batch.transactions.length} modified
                          </span>
                        </div>
                        <span className="text-xs text-gray-400 font-mono mt-1 block">
                          {new Date(batch.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRevertBatch(batch)}
                        className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold text-xs rounded-xl transition-colors flex items-center gap-1 shrink-0"
                      >
                        <Icon name="undo" className="text-sm" />
                        <span>Rollback Batch</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Execution logs table */}
            <Card className="bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-black/5 dark:border-white/5 pb-3">
                <div>
                  <h4 className="text-xs font-bold text-light-text dark:text-dark-text tracking-tight">
                    Rule Execution History & Audit Logs
                  </h4>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Real-time transaction automation pipeline execution trace.
                  </p>
                </div>
                {preferences.ruleExecutionLogs && preferences.ruleExecutionLogs.length > 0 && (
                  <button
                    onClick={() => {
                      customConfirm(
                        'Clear Audit Logs',
                        'Are you sure you want to clear your execution audit logs history? This action is irreversible and clears all historical automation traces.',
                        () => {
                          setPreferences(prev => ({ ...prev, ruleExecutionLogs: [] }));
                          toast.success('Successfully cleared rule execution log history.');
                        },
                        true,
                        'Clear Logs'
                      );
                    }}
                    className="text-xs font-semibold text-red-500 hover:underline flex items-center gap-1"
                  >
                    <Icon name="delete_sweep" className="text-sm font-black" />
                    <span>Clear logs</span>
                  </button>
                )}
              </div>

              {!preferences.ruleExecutionLogs || preferences.ruleExecutionLogs.length === 0 ? (
                <div className="py-12 text-center border-2 border-dashed border-black/5 rounded-2xl">
                  <Icon name="receipt_long" className="text-4xl text-gray-300" />
                  <p className="font-bold text-xs text-gray-400 tracking-widest mt-3">Log is Empty</p>
                  <p className="text-xs text-gray-400 mt-1">No transaction rules have been run on historical or incoming ledger records yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-white/[0.02] border-b border-black/5 dark:border-white/5 font-mono text-xs tracking-wider text-gray-400">
                        <th className="p-3">Time</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Triggered Rule</th>
                        <th className="p-3">Transaction</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Field Changes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5 dark:divide-white/5">
                      {preferences.ruleExecutionLogs.map(log => (
                        <tr key={log.id} className="hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition-colors font-sans">
                          <td className="p-3 whitespace-nowrap text-gray-400 font-mono text-xs">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {log.isReverted ? (
                              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                Reverted
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                                Active
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-semibold text-light-text dark:text-dark-text max-w-[150px] truncate">
                            <span className="inline-flex items-center gap-1 bg-primary-500/10 text-primary-600 dark:text-primary-400 px-2 py-0.5 rounded text-xs font-semibold">
                              {log.ruleName}
                            </span>
                          </td>
                          <td className="p-3 font-medium text-gray-600 dark:text-gray-300 max-w-[200px] truncate" title={log.txDescription}>
                            {log.txDescription}
                          </td>
                          <td className="p-3 text-light-text dark:text-dark-text font-mono font-bold">
                            {log.txAmount.toFixed(2)} EUR
                          </td>
                          <td className="p-3 font-mono text-xs text-emerald-600 dark:text-emerald-400" title={log.changeDetails}>
                            {log.changeDetails}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* MERCHANT OVERRIDES VIEW */}
        {activeTab === 'merchant-overrides' && (
          <div className="space-y-6">
            <div className="bg-teal-500/10 border border-teal-500/20 text-teal-950 dark:text-teal-300 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                  <Icon name="storefront" className="text-xl" />
                </div>
                <div>
                  <h5 className="font-bold text-xs tracking-wider text-teal-800 dark:text-teal-400">Merchant Priority Overrides</h5>
                  <p className="text-xs mt-1 leading-relaxed text-gray-500 dark:text-gray-400 max-w-xl">
                    Merchant Overrides map specific merchant names directly to categories and metadata. They run instantly on all incoming transaction data and take absolute priority over IF-WHEN-THEN rules.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap self-stretch sm:self-auto">
                <button
                  onClick={handleApplyAllMerchantOverridesToPastLedger}
                  className={`${BTN_PRIMARY_STYLE} bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-1.5 text-xs justify-center shadow-xs`}
                >
                  <Icon name="bolt" className="text-sm" />
                  <span>Apply to Past Ledger</span>
                </button>
                <button
                  onClick={handleFeedFromMerchants}
                  className={`${BTN_SECONDARY_STYLE} border-teal-500/30 hover:border-teal-500 text-teal-600 dark:text-teal-400 flex items-center gap-1.5 text-xs justify-center`}
                >
                  <Icon name="download" className="text-sm" />
                  <span>Feed from Ledger</span>
                </button>
              </div>
            </div>

            {/* Form Drawer to create or edit an override */}
            <AnimatePresence>
              {isAddingMerchantOverride && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden mb-6"
                >
                  <Card className="bg-gray-50/50 dark:bg-white/[0.01] border-2 border-dashed border-teal-500/10 dark:border-white/5 p-6 rounded-2xl space-y-4">
                    <div className="flex justify-between items-center border-b border-black/5 dark:border-white/5 pb-3">
                      <h3 className="text-sm font-bold tracking-tight text-light-text dark:text-dark-text">
                        {editingMerchantKey ? 'Update Merchant Override' : 'Define New Merchant Override'}
                      </h3>
                      <button
                        onClick={resetMerchantOverrideForm}
                        className="text-xs font-black text-red-500 hover:underline"
                      >
                        Cancel
                      </button>
                    </div>

                    <form onSubmit={handleSaveMerchantOverride} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-gray-400 tracking-wider uppercase">Merchant Name</label>
                          <input
                            type="text"
                            placeholder="e.g. Amazon, Uber, Netflix"
                            value={overrideMerchantName}
                            onChange={(e) => setOverrideMerchantName(e.target.value)}
                            disabled={!!editingMerchantKey}
                            className={INPUT_BASE_STYLE}
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-gray-400 tracking-wider uppercase">Target Category</label>
                          <div className={SELECT_WRAPPER_STYLE}>
                            <select
                              value={overrideCategory}
                              onChange={(e) => setOverrideCategory(e.target.value)}
                              className={SELECT_STYLE}
                              required
                            >
                              <option value="">Select Target Category...</option>
                              {flatCategories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                            <span className={SELECT_ARROW_STYLE}>expand_more</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-gray-400 tracking-wider font-mono">Custom Logo domain (optional)</label>
                          <input
                            type="text"
                            placeholder="e.g. amazon.com"
                            value={overrideLogo}
                            onChange={(e) => setOverrideLogo(e.target.value)}
                            className={INPUT_BASE_STYLE}
                          />
                        </div>

                        <div className="space-y-1 col-span-2">
                          <label className="text-xs font-semibold text-gray-400 tracking-wider uppercase">Default Description Override (Optional)</label>
                          <input
                            type="text"
                            placeholder="e.g. Amazon Marketplace Order"
                            value={overrideDefaultDescription}
                            onChange={(e) => setOverrideDefaultDescription(e.target.value)}
                            className={INPUT_BASE_STYLE}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-400 tracking-wider uppercase">Custom/Audit Notes</label>
                        <input
                          type="text"
                          placeholder="Why is this rule set up etc."
                          value={overrideNotes}
                          onChange={(e) => setOverrideNotes(e.target.value)}
                          className={INPUT_BASE_STYLE}
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="chk-override-hide"
                          checked={overrideIsHidden}
                          onChange={(e) => setOverrideIsHidden(e.target.checked)}
                          className={CHECKBOX_STYLE}
                        />
                        <label htmlFor="chk-override-hide" className="text-xs font-bold text-light-text dark:text-dark-text select-none cursor-pointer">
                          Hide this merchant and transactions from main analytics dashboard views
                        </label>
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t border-black/5 dark:border-white/5">
                        <button
                          type="button"
                          onClick={resetMerchantOverrideForm}
                          className={BTN_SECONDARY_STYLE}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className={BTN_PRIMARY_STYLE}
                        >
                          {editingMerchantKey ? 'Update Override' : 'Deploy Override Rule'}
                        </button>
                      </div>
                    </form>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* SMART AUTO-CATEGORIZATION SUGGESTIONS */}
            {smartRuleSuggestions.length > 0 && (
              <Card className="bg-teal-500/[0.02] border border-dashed border-teal-500/30 p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-teal-600 dark:text-teal-400 tracking-tight flex items-center gap-1.5">
                      <Icon name="auto_awesome" className="text-base" />
                      <span>Smart Rule Suggestions ({smartRuleSuggestions.length})</span>
                    </h4>
                    <p className="text-xs mt-0.5 text-gray-500 dark:text-gray-400">
                      Discovered recurring transaction descriptions with consistent patterns. 1-click accept to automatically classify past and future entries.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {smartRuleSuggestions.slice(0, 6).map((sug) => (
                    <div key={sug.id} className="bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 p-3.5 rounded-2xl flex flex-col justify-between gap-3 shadow-xs">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-mono font-bold text-xs bg-teal-500/10 text-teal-700 dark:text-teal-300 px-2 py-0.5 rounded-lg truncate">
                            "{sug.keyword}"
                          </span>
                          <span className="text-2xs font-semibold px-1.5 py-0.2 rounded-full bg-primary-500/10 text-primary-600 dark:text-primary-400">
                            {sug.matchCount} txs
                          </span>
                        </div>
                        <p className="font-bold text-xs text-light-text dark:text-dark-text truncate mt-1">
                          ➔ {sug.suggestedMerchant}
                        </p>
                        {sug.suggestedCategory && (
                          <p className="text-2xs text-gray-400 font-mono mt-0.5 truncate">
                            Category: <span className="text-teal-600 dark:text-teal-400 font-bold">{sug.suggestedCategory}</span>
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/5">
                        <span className="text-2xs text-gray-400 font-mono">
                          Vol: {formatCurrency(sug.totalAmount, 'EUR')}
                        </span>
                        <button
                          onClick={() => handleDeploySmartSuggestion(sug)}
                          className="px-2.5 py-1 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                        >
                          <Icon name="add" className="text-xs" />
                          <span>Accept Rule</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* MANAGE ACTIVE OVERRIDES MODULE */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
                <div className="flex items-center gap-2 flex-1">
                  <div className="relative flex-1">
                    <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                    <input
                      type="text"
                      placeholder="Search override rules by name, domain, or notes..."
                      value={merchantOverrideSearch}
                      onChange={(e) => setMerchantOverrideSearch(e.target.value)}
                      className={`${INPUT_BASE_STYLE} pl-9`}
                    />
                  </div>

                  {/* Category Filter */}
                  <div className={`w-48 shrink-0 ${SELECT_WRAPPER_STYLE}`}>
                    <select
                      value={merchantOverrideCategoryFilter}
                      onChange={(e) => setMerchantOverrideCategoryFilter(e.target.value)}
                      className={SELECT_STYLE}
                    >
                      <option value="ALL">All Categories</option>
                      {flatCategories.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <span className={SELECT_ARROW_STYLE}>expand_more</span>
                  </div>
                </div>

                {!isAddingMerchantOverride && (
                  <button
                    onClick={() => setIsAddingMerchantOverride(true)}
                    className={`${BTN_PRIMARY_STYLE} flex items-center gap-1.5 justify-center leading-none`}
                  >
                    <Icon name="add" className="text-sm leading-none" />
                    <span>Add Custom Override</span>
                  </button>
                )}
              </div>

              {Object.keys(merchantRules).length === 0 ? (
                <div className="py-12 text-center bg-gray-50 dark:bg-white/[0.01] rounded-2xl border border-black/5 dark:border-white/5">
                  <Icon name="storefront" className="text-4xl text-gray-300" />
                  <p className="font-bold text-xs text-gray-400  tracking-widest mt-2">No Overrides Configured</p>
                  <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">Create rules specifically mapped to merchant names for instant automated categorization.</p>
                </div>
              ) : (
                <div className="bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 rounded-2xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-50/50 dark:bg-white/[0.02] border-b border-black/5 dark:border-white/5">
                          <th className="p-3 font-bold tracking-wider text-xs text-gray-400">Merchant Identity</th>
                          <th className="p-3 font-bold tracking-wider text-xs text-gray-400">Target Category Map</th>
                          <th className="p-3 font-bold tracking-wider text-xs text-gray-400">Visibility Status</th>
                          <th className="p-3 font-bold tracking-wider text-xs text-gray-400">Proposed Description / Notes</th>
                          <th className="p-3 font-bold tracking-wider text-xs text-gray-400 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/[0.03] dark:divide-white/[0.02]">
                        {Object.entries(merchantRules)
                          .filter(([key, rule]: [string, any]) => {
                            if (merchantOverrideCategoryFilter !== 'ALL' && rule.category !== merchantOverrideCategoryFilter) {
                              return false;
                            }
                            if (!merchantOverrideSearch) return true;
                            const search = merchantOverrideSearch.toLowerCase();
                            return key.toLowerCase().includes(search) ||
                              rule.category?.toLowerCase().includes(search) ||
                              rule.notes?.toLowerCase().includes(search) ||
                              rule.defaultDescription?.toLowerCase().includes(search);
                          })
                          .map(([key, rule]: [string, any]) => {
                            const matchCount = merchantMatchCounts[key] || 0;

                            return (
                              <tr key={key} className="hover:bg-gray-100/20 dark:hover:bg-white/[0.005]">
                                <td className="p-3">
                                  <div className="flex items-center gap-3">
                                    {rule.logo ? (
                                      <div className="w-8 h-8 rounded-lg bg-white border border-black/5 flex items-center justify-center p-1 shrink-0 overflow-hidden shadow-xs">
                                        <img
                                          src={`https://logo.clearbit.com/${rule.logo}`}
                                          alt=""
                                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                          className="w-full h-full object-contain"
                                          referrerPolicy="no-referrer"
                                        />
                                      </div>
                                    ) : (
                                      <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-xs shrink-0 ring-1 ring-black/5">
                                        {key.charAt(0).toUpperCase()}
                                      </div>
                                    )}
                                    <div className="truncate max-w-[150px]">
                                      <div className="flex items-center gap-1.5">
                                        <p className="font-bold text-light-text dark:text-dark-text text-sm capitalize truncate">{key}</p>
                                        {matchCount > 0 && (
                                          <span className="text-2xs font-mono text-teal-600 dark:text-teal-400 bg-teal-500/10 px-1.5 py-0.2 rounded-full font-semibold">
                                            {matchCount} txs
                                          </span>
                                        )}
                                      </div>
                                      {rule.website && (
                                        <a href={rule.website} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-500 hover:underline block truncate">
                                          {rule.logo || rule.website}
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                </td>

                                <td className="p-3">
                                  <span className="font-mono bg-teal-500/5 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400 px-2 py-1 rounded font-bold">
                                    {rule.category || 'Ignored'}
                                  </span>
                                </td>

                                <td className="p-3">
                                  {rule.isHidden ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 rounded-full font-semibold">
                                      <Icon name="visibility_off" className="text-xs" />
                                      <span>Hidden</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-950/20 dark:text-green-400 rounded-full font-semibold">
                                      <Icon name="visibility" className="text-xs" />
                                      <span>Visible</span>
                                    </span>
                                  )}
                                </td>

                                <td className="p-3 max-w-[200px]">
                                  {rule.defaultDescription && (
                                    <p className="text-xs font-semibold text-light-text dark:text-dark-text truncate">Auto-title: "{rule.defaultDescription}"</p>
                                  )}
                                  {rule.notes ? (
                                    <p className="text-xs text-gray-400 italic truncate" title={rule.notes}>"{rule.notes}"</p>
                                  ) : (
                                    <p className="text-xs text-gray-400 italic">No notes</p>
                                  )}
                                </td>

                                <td className="p-3 text-right">
                                  <div className="flex justify-end items-center gap-1.5">
                                    {matchCount > 0 && (
                                      <button
                                        onClick={() => {
                                          const matching = transactions.filter(t => normalizeMerchantKey(t.merchant || '') === key);
                                          const updated = matching.map(t => ({
                                            ...t,
                                            category: rule.category || t.category,
                                            description: rule.defaultDescription || t.description
                                          }));
                                          saveTransaction(updated);
                                          toast.success(`Updated ${updated.length} transactions for "${key}"!`);
                                        }}
                                        className="px-2 py-1 text-2xs font-bold text-teal-600 dark:text-teal-400 bg-teal-500/10 hover:bg-teal-500/20 rounded-lg transition-all mr-1"
                                        title={`Apply category "${rule.category}" to all ${matchCount} past transactions`}
                                      >
                                        Apply to {matchCount} past
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleEditMerchantOverride(key, rule, key)}
                                      className="p-1 text-gray-400 hover:text-primary-500 transition-colors"
                                      title="Edit fields"
                                    >
                                      <Icon name="edit" className="text-base" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteMerchantOverride(key, key)}
                                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                      title="Delete override"
                                    >
                                      <Icon name="delete" className="text-base" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* INTERACTIVE RULE TESTING SANDBOX VIEW */}
        {activeTab === 'rules-sandbox' && (
          <div className="space-y-6">
            <div className="bg-primary-500/10 border border-primary-500/20 text-primary-950 dark:text-primary-300 p-4 rounded-2xl flex items-start gap-3">
              <Icon name="science" className="text-2xl shrink-0 mt-0.5 text-primary-500" />
              <div>
                <h5 className="font-bold text-xs  tracking-wider">Interactive Automation Sandbox</h5>
                <p className="text-xs mt-1 leading-relaxed opacity-90">
                  Type or customize a simulation transaction below to watch your rules process it in real-time. This allows you to verify triggers, prioritize actions, and diagnose mappings before saving!
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Input Simulator Panel */}
              <div className="lg:col-span-1 space-y-4">
                <Card className="bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 p-5 shadow-sm space-y-4">
                  <div className="flex justify-between items-start border-b border-black/5 dark:border-white/5 pb-2">
                    <div>
                      <h4 className="text-xs font-bold text-light-text dark:text-dark-text tracking-tight">
                        Simulation Input
                      </h4>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Configure your mockup transactional values.
                      </p>
                    </div>
                    <button
                      onClick={() => setLedgerPickerOpen(true)}
                      className="px-2.5 py-1 text-xs font-semibold bg-primary-500/10 hover:bg-primary-500/20 text-primary-600 dark:text-primary-400 rounded-lg flex items-center gap-1 transition-colors shrink-0"
                    >
                      <Icon name="receipt_long" className="text-xs" />
                      <span>Pick from Ledger</span>
                    </button>
                  </div>

                  {/* Quick Load Test Presets */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-gray-400 tracking-wider uppercase block">⚡ Quick Presets</span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => {
                          setSandboxDesc('NETFLIX SUBSCRIPTION PREMIUM EX');
                          setSandboxMerchant('Netflix');
                          setSandboxAmount('14.99');
                          setSandboxType('expense');
                        }}
                        className="text-xs font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 px-2 py-1 rounded transition-colors"
                      >
                        Netflix Subscription
                      </button>
                      <button
                        onClick={() => {
                          setSandboxDesc('METRO TICKET COMMUTE METROPOLIS');
                          setSandboxMerchant('Metro');
                          setSandboxAmount('2.50');
                          setSandboxType('expense');
                        }}
                        className="text-xs font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 px-2 py-1 rounded transition-colors"
                      >
                        Subway Transit
                      </button>
                      <button
                        onClick={() => {
                          setSandboxDesc('TRANSFER AMEX CREDIT CARD ACH');
                          setSandboxMerchant('American Express');
                          setSandboxAmount('350.00');
                          setSandboxType('expense');
                        }}
                        className="text-xs font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 px-2 py-1 rounded transition-colors"
                      >
                        ACH Card Pay
                      </button>
                    </div>
                  </div>

                  {/* Form fields */}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 tracking-wider uppercase mb-1">
                        Mock Description
                      </label>
                      <input
                        type="text"
                        value={sandboxDesc}
                        onChange={e => setSandboxDesc(e.target.value)}
                        className={INPUT_BASE_STYLE}
                        placeholder="e.g. NETFLIX.COM CARD CHARGE 58"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-400 tracking-wider uppercase mb-1">
                        Mock Merchant
                      </label>
                      <input
                        type="text"
                        value={sandboxMerchant}
                        onChange={e => setSandboxMerchant(e.target.value)}
                        className={INPUT_BASE_STYLE}
                        placeholder="e.g. Netflix, Inc."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-400 tracking-wider uppercase mb-1">
                          Mock Amount
                        </label>
                        <input
                          type="number"
                          value={sandboxAmount}
                          onChange={e => setSandboxAmount(e.target.value)}
                          className={INPUT_BASE_STYLE}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-400 tracking-wider uppercase mb-1">
                          Mock Type
                        </label>
                        <div className={SELECT_WRAPPER_STYLE}>
                          <select
                            value={sandboxType}
                            onChange={e => setSandboxType(e.target.value as 'expense' | 'income')}
                            className={SELECT_STYLE}
                          >
                            <option value="expense">Expense</option>
                            <option value="income">Income</option>
                          </select>
                          <div className={SELECT_ARROW_STYLE} />
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Real-time Processing & Resulting Fields */}
              <div className="lg:col-span-2 space-y-4">
                {/* Visual Comparative Board */}
                <Card className="bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 p-5 shadow-sm space-y-4">
                  <div className="flex justify-between items-center border-b border-black/5 dark:border-white/5 pb-2">
                    <div>
                      <h4 className="text-xs font-bold text-light-text dark:text-dark-text tracking-tight">
                        Real-time Pipeline Results
                      </h4>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Compare original mockup fields to final rules pipeline transformations.
                      </p>
                    </div>

                    {sandboxEvaluation.matchedRule ? (
                      <span className="flex items-center gap-1 bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-semibold px-2.5 py-1 rounded-full font-sans animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        <span>Rule Triggered</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 bg-gray-100 text-gray-400 dark:bg-white/5 text-xs font-semibold px-2.5 py-1 rounded-full font-sans">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
                        <span>No Matches Found</span>
                      </span>
                    )}
                  </div>

                  {/* Sandbox transformation compare boxes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Input Columns */}
                    <div className="bg-gray-50/50 dark:bg-white/[0.01] border border-black/5 dark:border-white/5 p-4 rounded-xl space-y-2.5">
                      <span className="text-xs font-semibold text-gray-400 tracking-wider uppercase">Raw Input Record</span>
                      <div className="space-y-1.5 text-xs text-light-text dark:text-dark-text">
                        <p className="text-gray-400">Description: <strong className="text-light-text dark:text-dark-text font-bold break-all font-mono">{sandboxDesc || 'None'}</strong></p>
                        <p className="text-gray-400">Merchant: <strong className="text-light-text dark:text-dark-text font-bold font-mono">{sandboxMerchant || 'None'}</strong></p>
                        <p className="text-gray-400">Amount: <strong className="font-mono">{sandboxAmount || '0.00'} EUR</strong></p>
                        <p className="text-gray-400">Type: <span className=" font-mono text-xs font-semibold">{sandboxType}</span></p>
                      </div>
                    </div>

                    {/* Transformed Column */}
                    <div className={`p-4 rounded-xl space-y-2.5 border ${sandboxEvaluation.matchedRule ? 'bg-primary-500/[0.02] border-primary-500/20' : 'bg-gray-50/50 dark:bg-white/[0.01] border-black/5 dark:border-white/5'}`}>
                      <span className="text-xs font-semibold text-gray-400 tracking-wider uppercase block">Resulting Processed Output</span>
                      <div className="space-y-1.5 text-xs">
                        {/* Modified Description */}
                        <p className="text-gray-400">
                          Description:{' '}
                          <span className={`font-mono font-bold break-all ${sandboxEvaluation.output.description !== sandboxDesc ? 'text-primary-500 font-extrabold underline decoration-dashed' : 'text-light-text dark:text-dark-text'}`}>
                            {sandboxEvaluation.output.description}
                          </span>
                        </p>

                        {/* Modified Merchant */}
                        <p className="text-gray-400">
                          Merchant:{' '}
                          <span className={`font-mono font-bold ${sandboxEvaluation.output.merchant !== sandboxMerchant ? 'text-primary-500 font-extrabold underline decoration-dashed' : 'text-light-text dark:text-dark-text'}`}>
                            {sandboxEvaluation.output.merchant}
                          </span>
                        </p>

                        {/* Modified Category */}
                        <p className="text-gray-400">
                          Category:{' '}
                          <span className={`font-mono font-extrabold text-xs px-2 py-0.5 rounded-md ${sandboxEvaluation.output.category !== 'Uncategorized' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-white/5'}`}>
                            {sandboxEvaluation.output.category}
                          </span>
                        </p>

                        <div className="pt-2 text-xs">
                          {sandboxEvaluation.matchedRule ? (
                            <p className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                              <Icon name="task_alt" className="text-sm leading-none" />
                              <span>Processed via custom rule: "<strong>{sandboxEvaluation.matchedRule.name}</strong>"</span>
                            </p>
                          ) : (
                            <p className="text-gray-400 font-medium">
                              This transaction bypasses the rules engine. Fields remain unchanged.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Rules Pipeline Diagnostic Match list */}
                <Card className="bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 p-5 shadow-sm space-y-3.5">
                  <div className="border-b border-black/5 dark:border-white/5 pb-2">
                    <h4 className="text-xs font-bold text-light-text dark:text-dark-text tracking-tight">
                      Automation Pipeline Diagnostics & Trace
                    </h4>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Trace each active automated rule's matching and criteria details.
                    </p>
                  </div>

                  <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                    {sandboxEvaluation.evaluations.length === 0 ? (
                      <div className="py-6 text-center text-xs text-gray-400 border border-dashed border-black/5 rounded-xl">
                        No active custom rules exist to trace. Run "New Rule" to bootstrap of your engine.
                      </div>
                    ) : (
                      sandboxEvaluation.evaluations.map((evalObj, idx) => {
                        const { rule, isMatch, conditionResults } = evalObj;
                        return (
                          <div
                            key={rule.id}
                            className={`p-3 rounded-xl border text-xs space-y-2 relative overflow-hidden transition-all ${isMatch ? 'bg-green-500/[0.04] border-green-500/20' : 'bg-gray-50/50 dark:bg-white/[0.01] border-black/5 dark:border-white/5 opacity-80'}`}
                          >
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-1.5 font-bold">
                                <span className={`w-2 h-2 rounded-full ${isMatch ? 'bg-green-500 font-sans' : 'bg-gray-300 dark:bg-gray-600'}`} />
                                <span className="font-extrabold text-light-text dark:text-dark-text truncate max-w-[250px]">{rule.name}</span>
                              </div>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isMatch ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-gray-100 text-gray-400 dark:bg-white/5'}`}>
                                {isMatch ? 'Triggered (Match!)' : 'No Trigger'}
                              </span>
                            </div>

                            {/* Conditions check visualization */}
                            <div className="space-y-1.5 border-t border-black/[0.03] dark:border-white/[0.02] pt-2">
                              {conditionResults.map((result, cIdx) => (
                                <div key={cIdx} className="flex items-center justify-between font-mono text-xs text-gray-500">
                                  <span className="flex items-center gap-1 truncate max-w-[80%]">
                                    <span>IF</span>
                                    <strong className="text-light-text dark:text-dark-text font-black">{result.condition.field}</strong>
                                    <span>{result.condition.operator.replace('_', ' ')}</span>
                                    <span className="text-primary-500 font-black">"{result.condition.value}"</span>
                                  </span>
                                  <span className={`font-sans font-semibold flex items-center gap-0.5 text-xs ${result.matched ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                                    <Icon name={result.matched ? 'check_circle' : 'cancel'} className="text-xs font-black" />
                                    <span>{result.matched ? 'True' : 'False'}</span>
                                  </span>
                                </div>
                              ))}
                            </div>

                            {/* Result actions list */}
                            <div className="text-xs text-gray-400 font-sans flex items-center gap-1.5 bg-black/[0.02] dark:bg-white/[0.01] p-1.5 rounded-lg font-mono">
                              <span className="font-sans font-black text-emerald-500 ">THEN</span>
                              <div className="flex flex-wrap gap-x-2">
                                {rule.actions.map((act, aIdx) => (
                                  <span key={aIdx} className="truncate">
                                    set <strong className="text-light-text dark:text-dark-text">{act.field}</strong> to <strong className="text-emerald-600 dark:text-emerald-400 font-black">"{act.value}"</strong>
                                    {aIdx < rule.actions.length - 1 && ','}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* DATABASE SCANNER / HISTORICAL SCAN VIEW */}
        {activeTab === 'historical-scan' && (
          <div className="space-y-4">
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-400 p-4 rounded-2xl flex items-start gap-3">
              <Icon name="info" className="text-2xl shrink-0 mt-0.5" />
              <div>
                <h5 className="font-bold text-xs  tracking-wider">Database Synchronization Pass</h5>
                <p className="text-xs mt-1 leading-relaxed opacity-90">
                  This tool scans every recorded transaction in your files/synced accounts. If a transaction matches your custom rule conditions or configured Merchant Categories, you can quickly realign the fields automatically.
                </p>
                <p className="text-xs mt-2 font-bold flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <Icon name="lock" className="text-sm" />
                  <span>Keep in mind that Merchant categories take precedence over general Rule Engine rules.</span>
                </p>
              </div>
            </div>

            {historicalRuleCalculations.length === 0 ? (
              <div className="py-12 text-center bg-gray-50 dark:bg-white/[0.01] rounded-2xl border border-black/5 dark:border-white/5">
                <Icon name="auto_awesome" className="text-4xl text-green-500" />
                <p className="font-bold text-xs text-gray-400  tracking-widest mt-3">All Database Ledger Aligned</p>
                <p className="text-xs text-gray-400 mt-1">No transaction fields require updating based on current configured Rules or Merchant registry overrides.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-white dark:bg-dark-card p-4 rounded-xl border border-black/5 dark:border-white/5">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={historicalRuleCalculations.length > 0 && selectedScanRows.size === historicalRuleCalculations.length}
                      onChange={(e) => toggleAllScanRows(e.target.checked)}
                      className={CHECKBOX_STYLE}
                      title="Select / deselect all items"
                    />
                    <span className="text-xs font-mono text-gray-500">
                      Discovered <strong className="text-light-text dark:text-dark-text font-black font-sans">{historicalRuleCalculations.length} items</strong> with mismatched fields ({selectedScanRows.size} selected).
                    </span>
                  </div>
                  <button
                    onClick={handleApplyHistoricalChanges}
                    className={`${BTN_PRIMARY_STYLE} flex items-center gap-1 leading-none text-xs`}
                    id="btn-apply-database-changes"
                  >
                    <Icon name="check_circle" className="text-base" />
                    <span>
                      {selectedScanRows.size > 0
                        ? `Commit ${selectedScanRows.size} Selected Updates`
                        : `Commit All ${historicalRuleCalculations.length} Updates`}
                    </span>
                  </button>
                </div>

                <div className="bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-white/[0.02] border-b border-black/5 dark:border-white/5">
                        <th className="p-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={historicalRuleCalculations.length > 0 && selectedScanRows.size === historicalRuleCalculations.length}
                            onChange={(e) => toggleAllScanRows(e.target.checked)}
                            className={CHECKBOX_STYLE}
                          />
                        </th>
                        <th className="p-3 font-bold tracking-wider text-xs text-gray-400">Date / Original Description</th>
                        <th className="p-3 font-bold tracking-wider text-xs text-gray-400">Current Field Mapping</th>
                        <th className="p-3 w-8 text-center text-gray-300">→</th>
                        <th className="p-3 font-bold tracking-wider text-xs text-gray-400">Proposed Auto-Fill Map</th>
                        <th className="p-3 font-bold tracking-wider text-xs text-gray-400">Trigger Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.03] dark:divide-white/[0.02]">
                      {historicalRuleCalculations.map((change, idx) => {
                        const originalTx = change.transaction;
                        const isChecked = selectedScanRows.has(originalTx.id);
                        return (
                          <tr key={idx} className={`hover:bg-gray-50/50 dark:hover:bg-white/[0.01] ${isChecked ? 'bg-primary-500/[0.03]' : ''}`}>
                            <td className="p-3 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleScanRow(originalTx.id)}
                                className={CHECKBOX_STYLE}
                              />
                            </td>
                            <td className="p-3">
                              <p className="font-bold text-light-text dark:text-dark-text truncate max-w-[200px]" title={originalTx.description}>{originalTx.description || 'Unspecified transaction'}</p>
                              <p className="text-xs text-gray-400 font-mono mt-0.5">{originalTx.date} • {originalTx.amount} EUR</p>
                            </td>

                            {/* Current Values */}
                            <td className="p-3 space-y-1">
                              <p className="text-xs text-gray-400">Merchant: <span className="font-bold text-light-text dark:text-dark-text">{originalTx.merchant || 'None'}</span></p>
                              <p className="text-xs text-gray-400">Category: <span className="font-mono bg-gray-100 p-0.5 rounded text-gray-600 dark:bg-white/5 dark:text-gray-300">{originalTx.category || 'None'}</span></p>
                            </td>

                            {/* Direction Arrow */}
                            <td className="p-3 text-center text-primary-500 font-black">
                              ▲
                            </td>

                            {/* Proposed Values */}
                            <td className="p-3 space-y-1 bg-primary-500/[0.01]">
                              <p className="text-xs text-gray-400">
                                Merchant:{' '}
                                <span className={`font-black ${change.updates.merchant ? 'text-emerald-600 dark:text-emerald-400' : 'text-light-text dark:text-dark-text'}`}>
                                  {change.updates.merchant || originalTx.merchant || 'None'}
                                </span>
                              </p>
                              {change.updates.description && (
                                <p className="text-xs text-gray-400">
                                  Description:{' '}
                                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                    {change.updates.description}
                                  </span>
                                </p>
                              )}
                              <p className="text-xs text-gray-400">
                                Category:{' '}
                                <span className={`font-mono px-1 py-0.5 rounded font-bold ${change.updates.category ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-white/5'}`}>
                                  {change.updates.category || originalTx.category || 'None'}
                                </span>
                              </p>
                            </td>

                            {/* Trigger Source */}
                            <td className="p-3">
                              {change.isFromMerchantRule ? (
                                <span className="px-2 py-0.5 text-xs font-semibold text-teal-600 bg-teal-500/10 rounded-full">
                                  Merchant Rule (Priority)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 text-xs font-semibold text-indigo-600 bg-indigo-500/10 rounded-full truncate max-w-[120px] inline-block">
                                  {existingRules.find(r => r.id === change.appliedRuleId)?.name || 'Custom Rule'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SIMULATE RULE IMPACT MODAL */}
      <AnimatePresence>
        {isSimulateModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" id="modal-simulate-impact">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSimulateModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md"
            />

            {/* Modal Body */}
            <div className="flex min-h-full items-center justify-center p-4">
              <motion.div
                initial={{ transform: 'scale(0.95)', opacity: 0 }}
                animate={{ transform: 'scale(1)', opacity: 1 }}
                exit={{ transform: 'scale(0.95)', opacity: 0 }}
                transition={{ type: 'spring', duration: 0.3 }}
                className="relative bg-white dark:bg-dark-card border border-black/10 dark:border-white/10 rounded-3xl max-w-4xl w-full shadow-2xl p-6 sm:p-8 space-y-6 overflow-hidden max-h-[85vh] flex flex-col font-sans"
              >
                {/* Header */}
                <div className="flex justify-between items-start border-b border-black/5 dark:border-white/5 pb-4 shrink-0">
                  <div>
                    <span className="px-2.5 py-1 text-xs font-semibold tracking-wider text-indigo-700 bg-indigo-500/10 dark:text-indigo-400 rounded-full inline-flex items-center gap-1">
                      <Icon name="science" className="text-xs leading-none font-black" />
                      <span>Ledger Dry-Run Simulation</span>
                    </span>
                    <h3 className="text-lg font-bold text-light-text dark:text-dark-text mt-1.5 tracking-wide">
                      Simulate Rule IMPACT
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Preview changes to your historical ledger based on the active rules without modifying your database.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsSimulateModalOpen(false)}
                    className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 flex items-center justify-center text-gray-400 hover:text-light-text dark:hover:text-dark-text transition-colors"
                  >
                    <Icon name="close" className="text-xl leading-none" />
                  </button>
                </div>

                {/* Simulation Summary DashCards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0">
                  <div className="bg-gray-50 dark:bg-white/[0.01] border border-black/5 dark:border-white/5 p-4 rounded-2xl flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gray-500/10 text-gray-500 flex items-center justify-center shrink-0">
                      <Icon name="receipt" className="text-lg" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-400 block tracking-wider uppercase">Total Ledger</span>
                      <span className="text-sm font-black text-light-text dark:text-dark-text">{transactions.length} records</span>
                    </div>
                  </div>

                  <div className="bg-emerald-500/[0.02] border border-emerald-500/10 p-4 rounded-2xl flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                      <Icon name="published_with_changes" className="text-lg" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 block tracking-wider uppercase font-sans">Proposed Changes</span>
                      <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{historicalRuleCalculations.length} would change</span>
                    </div>
                  </div>

                  <div className="bg-indigo-500/[0.02] border border-indigo-500/10 p-4 rounded-2xl flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                      <Icon name="verified" className="text-lg" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 block tracking-wider uppercase font-sans">Healthy / Aligned</span>
                      <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{transactions.length - historicalRuleCalculations.length} clean</span>
                    </div>
                  </div>
                </div>

                {/* Main comparison trace */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-[25vh] border-t border-b border-black/5 dark:border-white/5 py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                    <span className="text-xs font-semibold tracking-wider text-gray-400 uppercase">Detailed Modification Preview</span>
                    <input
                      type="text"
                      value={simulationSearch}
                      onChange={(e) => setSimulationSearch(e.target.value)}
                      placeholder="Search transactions..."
                      className="px-3 py-1 bg-gray-50 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 rounded-xl text-xs max-w-xs focus:outline-hidden focus:ring-1 focus:ring-primary-500 search-input"
                    />
                  </div>

                  {historicalRuleCalculations.length === 0 ? (
                    <div className="py-12 text-center text-gray-400 border border-dashed border-black/5 dark:border-white/5 rounded-2xl">
                      <Icon name="task_alt" className="text-3xl text-gray-300" />
                      <p className="font-bold text-xs  tracking-widest mt-2">Zero impact modifications</p>
                      <p className="text-xs text-gray-400 mt-1">All transactions perfectly align with active rules.</p>
                    </div>
                  ) : (
                    (() => {
                      const filtered = historicalRuleCalculations.filter(change => {
                        const term = simulationSearch.toLowerCase();
                        const desc = (change.transaction?.description || '').toLowerCase();
                        const merc = (change.transaction?.merchant || '').toLowerCase();
                        return desc.includes(term) || merc.includes(term);
                      });

                      if (filtered.length === 0) {
                        return (
                          <div className="py-12 text-center text-gray-400">
                            <p className="font-bold text-xs">No simulation results match "{simulationSearch}"</p>
                          </div>
                        );
                      }

                      return (
                        <div className="overflow-x-auto rounded-xl border border-black/5 dark:border-white/5">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-gray-50 dark:bg-white/[0.02] border-b border-black/5 dark:border-white/5 font-mono text-xs tracking-wider text-gray-400">
                              <tr>
                                <th className="p-3">Record Details</th>
                                <th className="p-3">Before</th>
                                <th className="p-3">Proposed Action (AFTER)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5 dark:divide-white/5 bg-white dark:bg-dark-card">
                              {filtered.map((change, idx) => {
                                const orig = change.transaction;
                                return (
                                  <tr key={idx} className="hover:bg-black/[0.01] dark:hover:bg-white/[0.01]">
                                    <td className="p-3">
                                      <p className="font-bold text-light-text dark:text-dark-text max-w-[200px] truncate" title={orig.description}>
                                        {orig.description}
                                      </p>
                                      <p className="text-xs text-gray-400 font-mono mt-0.5">
                                        {orig.date} • <strong className="text-light-text dark:text-dark-text">{Number(orig.amount).toFixed(2)} EUR</strong>
                                      </p>
                                    </td>
                                    <td className="p-3 space-y-1 text-xs">
                                      {change.updates.merchant && (
                                        <p className="text-gray-400">Merc: <span className="text-light-text dark:text-dark-text font-serif">{orig.merchant || 'None'}</span></p>
                                      )}
                                      {change.updates.category && (
                                        <p className="text-gray-400">Cat: <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-white/5 text-gray-505 rounded text-xs font-mono">{orig.category || 'None'}</span></p>
                                      )}
                                      {change.updates.description && (
                                        <p className="text-gray-400">Desc: <span className="text-light-text dark:text-dark-text">{orig.description}</span></p>
                                      )}
                                      {!change.updates.merchant && !change.updates.category && !change.updates.description && (
                                        <span className="text-gray-400 italic text-xs">No changes</span>
                                      )}
                                    </td>
                                    <td className="p-3 space-y-1 text-xs">
                                      {change.updates.merchant && (
                                        <p className="text-gray-400">
                                          Merc: <strong className="text-emerald-600 dark:text-emerald-400">"{change.updates.merchant}"</strong>
                                        </p>
                                      )}
                                      {change.updates.category && (
                                        <p className="text-gray-400">
                                          Cat: <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded text-xs font-mono font-bold">"{change.updates.category}"</span>
                                        </p>
                                      )}
                                      {change.updates.description && (
                                        <p className="text-gray-400">
                                          Desc: <strong className="text-emerald-600 dark:text-emerald-400">"{change.updates.description}"</strong>
                                        </p>
                                      )}
                                      <div className="pt-0.5">
                                        <span className="text-xs font-semibold text-indigo-600 bg-indigo-500/10 px-1 rounded inline-block truncate max-w-[150px]">
                                          Rule: {existingRules.find(r => r.id === change.appliedRuleId)?.name || 'Merchant Override'}
                                        </span>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()
                  )}
                </div>

                {/* Footer buttons */}
                <div className="flex justify-between items-center bg-gray-50 dark:bg-white/[0.01] -mx-6 -mb-6 p-4 px-6 border-t border-black/5 dark:border-white/5 shrink-0">
                  <span className="text-xs text-gray-400 max-w-[50%] leading-snug">
                    * Rollback is supported: you can revert this execution anytime from the Execution History logs tab.
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsSimulateModalOpen(false)}
                      className={BTN_SECONDARY_STYLE}
                    >
                      Close Preview
                    </button>
                    {historicalRuleCalculations.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsSimulateModalOpen(false);
                          handleApplyToExisting();
                        }}
                        className={`${BTN_PRIMARY_STYLE} flex items-center gap-1.5`}
                      >
                        <Icon name="published_with_changes" className="text-base leading-none font-bold" />
                        <span>Accept & Apply to Past Transactions</span>
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* LEDGER TRANSACTION PICKER MODAL (FOR SANDBOX) */}
      <AnimatePresence>
        {ledgerPickerOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" id="modal-ledger-picker">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLedgerPickerOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md"
            />

            <div className="flex min-h-full items-center justify-center p-4">
              <motion.div
                initial={{ transform: 'scale(0.95)', opacity: 0 }}
                animate={{ transform: 'scale(1)', opacity: 1 }}
                exit={{ transform: 'scale(0.95)', opacity: 0 }}
                transition={{ type: 'spring', duration: 0.3 }}
                className="relative bg-white dark:bg-dark-card border border-black/10 dark:border-white/10 rounded-3xl max-w-xl w-full shadow-2xl p-6 space-y-4 max-h-[80vh] flex flex-col font-sans"
              >
                <div className="flex justify-between items-start border-b border-black/5 dark:border-white/5 pb-3 shrink-0">
                  <div>
                    <h3 className="text-base font-bold text-light-text dark:text-dark-text tracking-tight flex items-center gap-2">
                      <Icon name="receipt_long" className="text-primary-500" />
                      <span>Select Real Transaction from Ledger</span>
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Choose a real transaction record to load into the sandbox simulator.
                    </p>
                  </div>
                  <button
                    onClick={() => setLedgerPickerOpen(false)}
                    className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 flex items-center justify-center text-gray-400 hover:text-light-text dark:hover:text-dark-text transition-colors"
                  >
                    <Icon name="close" className="text-xl leading-none" />
                  </button>
                </div>

                <div className="relative shrink-0">
                  <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                  <input
                    type="text"
                    value={ledgerPickerSearch}
                    onChange={(e) => setLedgerPickerSearch(e.target.value)}
                    placeholder="Search by merchant, description, or amount..."
                    className={`${INPUT_BASE_STYLE} pl-9`}
                    autoFocus
                  />
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[30vh]">
                  {(() => {
                    const filtered = transactions.filter(tx => {
                      if (!ledgerPickerSearch.trim()) return true;
                      const q = ledgerPickerSearch.toLowerCase();
                      return (
                        (tx.description || '').toLowerCase().includes(q) ||
                        (tx.merchant || '').toLowerCase().includes(q) ||
                        (tx.category || '').toLowerCase().includes(q) ||
                        String(tx.amount || '').includes(q)
                      );
                    }).slice(0, 50);

                    if (filtered.length === 0) {
                      return (
                        <div className="py-12 text-center text-xs text-gray-400">
                          No transactions found matching "{ledgerPickerSearch}"
                        </div>
                      );
                    }

                    return filtered.map(tx => (
                      <div
                        key={tx.id}
                        onClick={() => {
                          setSandboxDesc(tx.description || '');
                          setSandboxMerchant(tx.merchant || '');
                          setSandboxAmount(String(Math.abs(Number(tx.amount) || 0)));
                          setSandboxType((tx.type as any) || 'expense');
                          setLedgerPickerOpen(false);
                          toast.success(`Loaded "${tx.description || tx.merchant}" into Sandbox simulator.`);
                        }}
                        className="p-3 rounded-xl border border-black/5 dark:border-white/5 bg-gray-50/50 hover:bg-primary-500/[0.04] hover:border-primary-500/30 dark:bg-white/[0.01] dark:hover:bg-primary-500/[0.04] transition-all cursor-pointer flex justify-between items-center gap-3 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-light-text dark:text-dark-text truncate">
                            {tx.description || tx.merchant || 'Unnamed Transaction'}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5 font-mono">
                            {tx.date} {tx.merchant ? `• ${tx.merchant}` : ''} {tx.category ? `• ${tx.category}` : ''}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono font-bold text-light-text dark:text-dark-text block">
                            {Number(tx.amount).toFixed(2)} {tx.currency || 'EUR'}
                          </span>
                          <span className="text-xs font-semibold uppercase text-gray-400 font-mono">
                            {tx.type || 'expense'}
                          </span>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* CUSTOM CONFIRMATION DIALOG MODAL */}
      <AnimatePresence>
        {confirmConfig && confirmConfig.isOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" id="modal-custom-confirm">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmConfig(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md"
            />

            {/* Modal Body */}
            <div className="flex min-h-full items-center justify-center p-4">
              <motion.div
                initial={{ transform: 'scale(0.95)', opacity: 0 }}
                animate={{ transform: 'scale(1)', opacity: 1 }}
                exit={{ transform: 'scale(0.95)', opacity: 0 }}
                transition={{ type: 'spring', duration: 0.25 }}
                className="relative bg-white dark:bg-dark-card border border-black/10 dark:border-white/10 rounded-3xl max-w-md w-full shadow-2xl p-6 sm:p-7 space-y-5 overflow-hidden font-sans"
              >
                {/* Header / Icon */}
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${confirmConfig.isDestructive
                      ? 'bg-rose-500/10 text-rose-500'
                      : 'bg-primary-500/10 text-primary-500'
                    }`}>
                    <Icon name={confirmConfig.isDestructive ? 'warning' : 'help'} className="text-xl leading-none font-bold" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-light-text dark:text-dark-text tracking-tight">
                      {confirmConfig.title}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                      {confirmConfig.message}
                    </p>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex justify-end gap-2 pt-2 border-t border-black/5 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => setConfirmConfig(null)}
                    className={BTN_SECONDARY_STYLE}
                  >
                    {confirmConfig.cancelText || 'Cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={confirmConfig.onConfirm}
                    className={`px-4 py-2 rounded-xl text-xs font-bold leading-none select-none transition-all duration-150 relative overflow-hidden ${confirmConfig.isDestructive
                        ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
                        : 'bg-primary-500 hover:bg-primary-600 text-white shadow-xs'
                      }`}
                  >
                    {confirmConfig.confirmText || 'Confirm'}
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Rules;
