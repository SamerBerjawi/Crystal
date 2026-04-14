import React, { useMemo, useState, useCallback } from 'react';
import { useTransactionSelector, usePreferencesSelector } from '../contexts/DomainProviders';
import { useBudgetsContext, useCategoryContext } from '../contexts/FinancialDataContext';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE } from '../constants';
import { Category } from '../types';
import { convertToEur, parseLocalDate, toLocalISOString } from '../utils';
import { getMerchantLogoUrl, normalizeMerchantKey } from '../utils/brandfetch';
import Card from '../components/Card';
import PageHeader from '../components/PageHeader';

const SAVED_REPORTS_KEY = 'reports.savedViews.v1';

const getDefaultStartDate = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return toLocalISOString(d);
};

type GroupBy = 'merchant' | 'category';

type SavedReportView = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  merchantFilter: string;
  categoryFilter: string;
  groupBy: GroupBy;
};

type InsightItem = {
  id: string;
  tone: 'neutral' | 'positive' | 'warning';
  text: string;
};

const readSavedViews = (): SavedReportView[] => {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(SAVED_REPORTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeSavedViews = (views: SavedReportView[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SAVED_REPORTS_KEY, JSON.stringify(views));
};

const Reports: React.FC = () => {
  const transactions = useTransactionSelector(tx => tx);
  const defaultCurrency = usePreferencesSelector(p => p.currency || 'EUR');
  const brandfetchClientId = usePreferencesSelector(p => p.brandfetchClientId);
  const merchantLogoOverrides = usePreferencesSelector(p => p.merchantLogoOverrides || {});
  const merchantRules = usePreferencesSelector(p => p.merchantRules || {});
  const { budgets } = useBudgetsContext();
  const { incomeCategories, expenseCategories } = useCategoryContext();

  const [startDate, setStartDate] = useState(getDefaultStartDate());
  const [endDate, setEndDate] = useState(toLocalISOString(new Date()));
  const [merchantFilter, setMerchantFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [groupBy, setGroupBy] = useState<GroupBy>('merchant');
  const [savedViews, setSavedViews] = useState<SavedReportView[]>(() => readSavedViews());
  const [reportName, setReportName] = useState('');
  const [logoLoadErrors, setLogoLoadErrors] = useState<Record<string, true>>({});

  const allCategories = useMemo(() => [...incomeCategories, ...expenseCategories], [incomeCategories, expenseCategories]);

  const findCategoryByName = useCallback((name: string, categories: Category[]): Category | undefined => {
    for (const category of categories) {
      if (category.name === name) return category;
      if (category.subCategories?.length) {
        const nested = findCategoryByName(name, category.subCategories);
        if (nested) return nested;
      }
    }
    return undefined;
  }, []);

  const effectiveMerchantLogoOverrides = useMemo(() => {
    const ruleLogoOverrides = Object.entries(merchantRules).reduce((acc, [merchantKey, rule]) => {
      if (rule?.logo) acc[merchantKey] = rule.logo;
      return acc;
    }, {} as Record<string, string>);

    return {
      ...merchantLogoOverrides,
      ...ruleLogoOverrides,
    };
  }, [merchantLogoOverrides, merchantRules]);

  const merchantLogoUrls = useMemo(() => {
    if (!brandfetchClientId) return {} as Record<string, string>;
    return transactions.reduce((acc, tx) => {
      const key = normalizeMerchantKey(tx.merchant || tx.description);
      if (!key || acc[key]) return acc;
      const url = getMerchantLogoUrl(tx.merchant || tx.description, brandfetchClientId, effectiveMerchantLogoOverrides, {
        fallback: 'lettermark',
        type: 'icon',
        width: 64,
        height: 64,
      });
      if (url) acc[key] = url;
      return acc;
    }, {} as Record<string, string>);
  }, [brandfetchClientId, effectiveMerchantLogoOverrides, transactions]);

  const handleLogoError = useCallback((logoUrl: string) => {
    setLogoLoadErrors(prev => (prev[logoUrl] ? prev : { ...prev, [logoUrl]: true }));
  }, []);

  const merchantVisual = useCallback((merchantLabel: string) => {
    const merchantKey = normalizeMerchantKey(merchantLabel);
    const merchantLogoUrl = merchantKey ? merchantLogoUrls[merchantKey] : null;
    const showMerchantLogo = Boolean(merchantLogoUrl && !logoLoadErrors[merchantLogoUrl]);
    const merchantInitial = merchantLabel?.trim().charAt(0)?.toUpperCase() || '?';
    return { merchantLogoUrl, showMerchantLogo, merchantInitial };
  }, [merchantLogoUrls, logoLoadErrors]);

  const categories = useMemo(() => {
    const unique = Array.from(new Set<string>(transactions.filter(tx => tx.type === 'expense').map(tx => tx.category || 'Uncategorized')));
    return unique.sort((a, b) => a.localeCompare(b));
  }, [transactions]);

  const rangeDays = useMemo(() => {
    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);
    const ms = end.getTime() - start.getTime();
    return Math.max(1, Math.floor(ms / (1000 * 60 * 60 * 24)) + 1);
  }, [startDate, endDate]);

  const filteredExpenses = useMemo(() => {
    const start = startDate ? parseLocalDate(startDate).getTime() : Number.NEGATIVE_INFINITY;
    const end = endDate ? parseLocalDate(endDate).getTime() : Number.POSITIVE_INFINITY;
    const merchantQuery = merchantFilter.trim().toLowerCase();

    return transactions.filter(tx => {
      if (tx.type !== 'expense' || tx.transferId) return false;

      const txTime = parseLocalDate(tx.date).getTime();
      if (txTime < start || txTime > end) return false;

      if (categoryFilter !== 'all' && tx.category !== categoryFilter) return false;

      if (merchantQuery) {
        const merchant = (tx.merchant || tx.description || '').toLowerCase();
        if (!merchant.includes(merchantQuery)) return false;
      }

      return true;
    });
  }, [transactions, startDate, endDate, categoryFilter, merchantFilter]);

  const previousPeriodTotals = useMemo(() => {
    const start = parseLocalDate(startDate);
    const prevEnd = new Date(start);
    prevEnd.setDate(start.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevEnd.getDate() - (rangeDays - 1));

    const startTs = prevStart.getTime();
    const endTs = prevEnd.getTime();

    const totalSpendEur = transactions
      .filter(tx => tx.type === 'expense' && !tx.transferId)
      .filter(tx => {
        const txTs = parseLocalDate(tx.date).getTime();
        return txTs >= startTs && txTs <= endTs;
      })
      .reduce((sum, tx) => sum + Math.abs(convertToEur(tx.amount, tx.currency)), 0);

    return {
      start: toLocalISOString(prevStart),
      end: toLocalISOString(prevEnd),
      totalSpendEur,
    };
  }, [transactions, startDate, rangeDays]);

  const totals = useMemo(() => {
    const totalSpendEur = filteredExpenses.reduce((sum, tx) => sum + Math.abs(convertToEur(tx.amount, tx.currency)), 0);
    const averageEur = filteredExpenses.length > 0 ? totalSpendEur / filteredExpenses.length : 0;
    const changePct = previousPeriodTotals.totalSpendEur > 0
      ? ((totalSpendEur - previousPeriodTotals.totalSpendEur) / previousPeriodTotals.totalSpendEur) * 100
      : null;

    return {
      totalSpendEur,
      transactionCount: filteredExpenses.length,
      averageEur,
      changePct,
    };
  }, [filteredExpenses, previousPeriodTotals.totalSpendEur]);

  const groupedRows = useMemo(() => {
    const map = new Map<string, { label: string; totalEur: number; count: number }>();

    for (const tx of filteredExpenses) {
      const key = groupBy === 'merchant'
        ? (tx.merchant?.trim() || tx.description || 'Unknown merchant')
        : (tx.category || 'Uncategorized');

      const current = map.get(key) || { label: key, totalEur: 0, count: 0 };
      current.totalEur += Math.abs(convertToEur(tx.amount, tx.currency));
      current.count += 1;
      map.set(key, current);
    }

    return Array.from(map.values()).sort((a, b) => b.totalEur - a.totalEur);
  }, [filteredExpenses, groupBy]);

  const budgetVsActual = useMemo(() => {
    const actualByCategory = new Map<string, number>();

    for (const tx of filteredExpenses) {
      const current = actualByCategory.get(tx.category) || 0;
      actualByCategory.set(tx.category, current + Math.abs(convertToEur(tx.amount, tx.currency)));
    }

    return budgets
      .map(budget => {
        const budgetEur = Math.abs(convertToEur(budget.amount, budget.currency));
        const actualEur = actualByCategory.get(budget.categoryName) || 0;
        const varianceEur = budgetEur - actualEur;

        return {
          categoryName: budget.categoryName,
          budgetEur,
          actualEur,
          varianceEur,
        };
      })
      .sort((a, b) => Math.abs(a.varianceEur) - Math.abs(b.varianceEur));
  }, [filteredExpenses, budgets]);

  const recurringCandidates = useMemo(() => {
    const byMerchant = new Map<string, { date: string; amountEur: number }[]>();

    for (const tx of filteredExpenses) {
      const merchant = tx.merchant?.trim() || tx.description || 'Unknown merchant';
      const list = byMerchant.get(merchant) || [];
      list.push({ date: tx.date, amountEur: Math.abs(convertToEur(tx.amount, tx.currency)) });
      byMerchant.set(merchant, list);
    }

    const results: { merchant: string; frequency: string; averageEur: number; estimatedMonthlyEur: number; occurrences: number }[] = [];

    byMerchant.forEach((rows, merchant) => {
      if (rows.length < 3) return;

      const sorted = rows
        .map(r => ({ ...r, ts: parseLocalDate(r.date).getTime() }))
        .sort((a, b) => a.ts - b.ts);

      const gaps: number[] = [];
      for (let i = 1; i < sorted.length; i++) {
        const gap = Math.round((sorted[i].ts - sorted[i - 1].ts) / (1000 * 60 * 60 * 24));
        if (gap > 0) gaps.push(gap);
      }

      if (gaps.length < 2) return;

      const avgGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
      let frequency = '';
      let monthlyMultiplier = 0;

      if (avgGap >= 25 && avgGap <= 35) {
        frequency = 'Monthly';
        monthlyMultiplier = 1;
      } else if (avgGap >= 12 && avgGap <= 16) {
        frequency = 'Bi-weekly';
        monthlyMultiplier = 2.17;
      } else if (avgGap >= 6 && avgGap <= 8) {
        frequency = 'Weekly';
        monthlyMultiplier = 4.33;
      }

      if (!frequency) return;

      const averageEur = sorted.reduce((sum, row) => sum + row.amountEur, 0) / sorted.length;
      results.push({
        merchant,
        frequency,
        averageEur,
        estimatedMonthlyEur: averageEur * monthlyMultiplier,
        occurrences: sorted.length,
      });
    });

    return results.sort((a, b) => b.estimatedMonthlyEur - a.estimatedMonthlyEur);
  }, [filteredExpenses]);

  const categoryTotals = useMemo(() => {
    const totalsByCategory = new Map<string, number>();
    for (const tx of filteredExpenses) {
      totalsByCategory.set(
        tx.category,
        (totalsByCategory.get(tx.category) || 0) + Math.abs(convertToEur(tx.amount, tx.currency))
      );
    }
    return Array.from(totalsByCategory.entries())
      .map(([category, totalEur]) => ({ category, totalEur }))
      .sort((a, b) => b.totalEur - a.totalEur);
  }, [filteredExpenses]);

  const forecast = useMemo(() => {
    if (!endDate) return null;

    const end = parseLocalDate(endDate);
    const monthStart = new Date(end.getFullYear(), end.getMonth(), 1);
    const monthEnd = new Date(end.getFullYear(), end.getMonth() + 1, 0);
    const elapsedDays = Math.max(1, end.getDate());
    const totalDays = monthEnd.getDate();
    const remainingDays = Math.max(0, totalDays - elapsedDays);

    const mtdSpendEur = transactions
      .filter(tx => tx.type === 'expense' && !tx.transferId)
      .filter(tx => {
        const txDate = parseLocalDate(tx.date);
        return txDate >= monthStart && txDate <= end;
      })
      .reduce((sum, tx) => sum + Math.abs(convertToEur(tx.amount, tx.currency)), 0);

    const dailyAverage = mtdSpendEur / elapsedDays;
    const projectedMonthEnd = mtdSpendEur + (dailyAverage * remainingDays);

    return {
      monthStart: toLocalISOString(monthStart),
      monthEnd: toLocalISOString(monthEnd),
      mtdSpendEur,
      dailyAverage,
      projectedMonthEnd,
      remainingDays,
    };
  }, [transactions, endDate]);

  const anomalyCandidates = useMemo(() => {
    const rows = filteredExpenses.map(tx => ({
      id: tx.id,
      date: tx.date,
      merchant: tx.merchant?.trim() || tx.description || 'Unknown merchant',
      category: tx.category,
      amountEur: Math.abs(convertToEur(tx.amount, tx.currency)),
    }));

    if (rows.length < 8) return [];

    const amounts = rows.map(r => r.amountEur);
    const mean = amounts.reduce((sum, value) => sum + value, 0) / amounts.length;
    const variance = amounts.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev === 0) return [];

    return rows
      .map(row => ({
        ...row,
        zScore: (row.amountEur - mean) / stdDev,
      }))
      .filter(row => row.zScore >= 2)
      .sort((a, b) => b.zScore - a.zScore)
      .slice(0, 10);
  }, [filteredExpenses]);

  const insights = useMemo((): InsightItem[] => {
    const result: InsightItem[] = [];

    if (totals.changePct !== null) {
      if (totals.changePct > 15) {
        result.push({
          id: 'spend-up',
          tone: 'warning',
          text: `Spending is up ${totals.changePct.toFixed(1)}% vs the previous period.`,
        });
      } else if (totals.changePct < -10) {
        result.push({
          id: 'spend-down',
          tone: 'positive',
          text: `Spending is down ${Math.abs(totals.changePct).toFixed(1)}% vs the previous period.`,
        });
      }
    }

    const topCategory = categoryTotals[0];
    if (topCategory && totals.totalSpendEur > 0) {
      const share = (topCategory.totalEur / totals.totalSpendEur) * 100;
      result.push({
        id: 'top-category',
        tone: 'neutral',
        text: `${topCategory.category} represents ${share.toFixed(1)}% of selected spend.`,
      });
    }

    const topRecurring = recurringCandidates[0];
    if (topRecurring) {
      result.push({
        id: 'top-recurring',
        tone: 'warning',
        text: `Highest recurring impact is ${topRecurring.merchant} at ~€${topRecurring.estimatedMonthlyEur.toFixed(2)}/month.`,
      });
    }

    if (forecast) {
      result.push({
        id: 'forecast',
        tone: 'neutral',
        text: `Projected end-of-month spend is €${forecast.projectedMonthEnd.toFixed(2)} (based on current daily average).`,
      });
    }

    return result.slice(0, 4);
  }, [totals.changePct, totals.totalSpendEur, categoryTotals, recurringCandidates, forecast]);

  const handleSaveView = () => {
    const trimmedName = reportName.trim();
    if (!trimmedName) return;

    const next: SavedReportView[] = [
      {
        id: `${Date.now()}`,
        name: trimmedName,
        startDate,
        endDate,
        merchantFilter,
        categoryFilter,
        groupBy,
      },
      ...savedViews,
    ].slice(0, 15);

    setSavedViews(next);
    writeSavedViews(next);
    setReportName('');
  };

  const applyView = (view: SavedReportView) => {
    setStartDate(view.startDate);
    setEndDate(view.endDate);
    setMerchantFilter(view.merchantFilter);
    setCategoryFilter(view.categoryFilter);
    setGroupBy(view.groupBy);
  };

  const deleteView = (id: string) => {
    const next = savedViews.filter(view => view.id !== id);
    setSavedViews(next);
    writeSavedViews(next);
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in-up">
      <PageHeader
        title="Financial Reports"
        icon="analytics"
        description="Deep dive into your spending habits, budget performance, and automated financial insights."
      />

      {/* Hero Section: Key Metrics */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-[#1E1E20] p-6 shadow-sm border border-black/5 dark:border-white/10 group transition-all hover:shadow-md">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <span className="material-symbols-outlined text-6xl">payments</span>
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary mb-1">Total Spend</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-black tracking-tight">€{totals.totalSpendEur.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <div className={`flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${(totals.changePct ?? 0) <= 0 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'}`}>
              <span className="material-symbols-outlined text-[14px] mr-1">
                {(totals.changePct ?? 0) <= 0 ? 'trending_down' : 'trending_up'}
              </span>
              {totals.changePct === null ? '0%' : `${Math.abs(totals.changePct).toFixed(1)}%`}
            </div>
            <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary font-medium uppercase tracking-wider">vs last period</span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-[#1E1E20] p-6 shadow-sm border border-black/5 dark:border-white/10 group transition-all hover:shadow-md">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <span className="material-symbols-outlined text-6xl">receipt_long</span>
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary mb-1">Transactions</p>
          <h3 className="text-3xl font-black tracking-tight">{totals.transactionCount}</h3>
          <p className="mt-4 text-[10px] text-light-text-secondary dark:text-dark-text-secondary font-medium uppercase tracking-wider">Processed in range</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-[#1E1E20] p-6 shadow-sm border border-black/5 dark:border-white/10 group transition-all hover:shadow-md">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <span className="material-symbols-outlined text-6xl">calculate</span>
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary mb-1">Avg. Transaction</p>
          <h3 className="text-3xl font-black tracking-tight">€{totals.averageEur.toFixed(2)}</h3>
          <p className="mt-4 text-[10px] text-light-text-secondary dark:text-dark-text-secondary font-medium uppercase tracking-wider">Per expense item</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-[#1E1E20] p-6 shadow-sm border border-black/5 dark:border-white/10 group transition-all hover:shadow-md">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <span className="material-symbols-outlined text-6xl">event_repeat</span>
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary mb-1">Recurring Impact</p>
          <h3 className="text-3xl font-black tracking-tight">
            €{(recurringCandidates.reduce((sum, c) => sum + c.estimatedMonthlyEur, 0)).toFixed(0)}
          </h3>
          <p className="mt-4 text-[10px] text-light-text-secondary dark:text-dark-text-secondary font-medium uppercase tracking-wider">Est. Monthly Total</p>
        </div>
      </section>

      {/* Filters & Saved Views */}
      <Card className="!p-0 overflow-hidden border-none shadow-sm">
        <div className="bg-gray-50/50 dark:bg-white/5 p-4 border-b border-black/5 dark:border-white/10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">Report Configuration</h2>
            {savedViews.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {savedViews.map(view => (
                  <div key={view.id} className="group flex items-center gap-1 bg-white dark:bg-dark-surface border border-black/5 dark:border-white/10 rounded-full pl-3 pr-1 py-1 shadow-sm transition-all hover:border-primary-500/50">
                    <button onClick={() => applyView(view)} className="text-[10px] font-bold uppercase tracking-wider hover:text-primary-500">{view.name}</button>
                    <button onClick={() => deleteView(view.id)} className="w-5 h-5 flex items-center justify-center rounded-full text-light-text-secondary hover:bg-rose-500 hover:text-white transition-colors">
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`${INPUT_BASE_STYLE} !bg-white dark:!bg-dark-surface`} />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={`${INPUT_BASE_STYLE} !bg-white dark:!bg-dark-surface`} />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">Merchant</label>
              <input type="text" value={merchantFilter} onChange={(e) => setMerchantFilter(e.target.value)} placeholder="Filter by name..." className={`${INPUT_BASE_STYLE} !bg-white dark:!bg-dark-surface`} />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">Category</label>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={`${INPUT_BASE_STYLE} !bg-white dark:!bg-dark-surface`}>
                <option value="all">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">Group By</label>
              <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)} className={`${INPUT_BASE_STYLE} !bg-white dark:!bg-dark-surface`}>
                <option value="merchant">Merchant</option>
                <option value="category">Category</option>
              </select>
            </div>
          </div>
        </div>
        <div className="p-4 bg-white dark:bg-dark-card flex flex-col md:flex-row gap-3 items-center">
          <div className="relative flex-1 w-full">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-light-text-secondary text-[18px]">bookmark</span>
            <input 
              type="text" 
              value={reportName} 
              onChange={(e) => setReportName(e.target.value)} 
              className={`${INPUT_BASE_STYLE} !pl-10`} 
              placeholder="Name this report view to save it..." 
            />
          </div>
          <button onClick={handleSaveView} className={`${BTN_PRIMARY_STYLE} w-full md:w-auto whitespace-nowrap`}>
            <span className="material-symbols-outlined text-[18px] mr-2">save</span>
            Save Report
          </button>
        </div>
      </Card>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Detailed Breakdowns */}
        <div className="space-y-6">
          <Card className="!p-0 overflow-hidden">
            <div className="p-4 border-b border-black/5 dark:border-white/10 flex items-center justify-between bg-gray-50/30 dark:bg-white/5">
              <h2 className="font-bold text-sm uppercase tracking-widest">Spend Breakdown</h2>
              <span className="text-[10px] font-bold uppercase tracking-widest text-light-text-secondary">By {groupBy}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-black/5 dark:border-white/10 bg-gray-50/50 dark:bg-white/5">
                    <th className="py-3 px-4 font-bold text-[10px] uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">{groupBy}</th>
                    <th className="py-3 px-4 font-bold text-[10px] uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary text-right">Count</th>
                    <th className="py-3 px-4 font-bold text-[10px] uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary text-right">Total</th>
                    <th className="py-3 px-4 font-bold text-[10px] uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary text-right">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                  {groupedRows.map(row => {
                    const share = totals.totalSpendEur > 0 ? (row.totalEur / totals.totalSpendEur) * 100 : 0;
                    const category = findCategoryByName(row.label, allCategories);
                    const { merchantLogoUrl, showMerchantLogo, merchantInitial } = merchantVisual(row.label);
                    return (
                      <tr key={row.label} className="group hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        <td className="py-3 px-4">
                          {groupBy === 'merchant' ? (
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center overflow-hidden border border-black/5 dark:border-white/10 ${showMerchantLogo ? 'bg-white dark:bg-dark-card' : 'bg-primary-500/10 text-primary-600'}`}>
                                {showMerchantLogo && merchantLogoUrl ? (
                                  <img src={merchantLogoUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" onError={() => handleLogoError(merchantLogoUrl)} />
                                ) : (
                                  <span className="text-xs font-bold">{merchantInitial}</span>
                                )}
                              </div>
                              <span className="font-medium truncate max-w-[150px]">{row.label}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/10 flex items-center justify-center text-light-text-secondary">
                                <span className="material-symbols-outlined text-[18px]">{category?.icon || 'category'}</span>
                              </div>
                              <span className="font-medium">{row.label}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs text-light-text-secondary">{row.count}</td>
                        <td className="py-3 px-4 text-right font-bold">€{row.totalEur.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-12 h-1.5 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
                              <div className="h-full bg-primary-500" style={{ width: `${share}%` }} />
                            </div>
                            <span className="text-[10px] font-bold text-light-text-secondary w-8">{share.toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {groupedRows.length === 0 && <p className="text-sm text-light-text-secondary p-8 text-center">No transactions found for this period.</p>}
            </div>
          </Card>

          <Card className="!p-0 overflow-hidden">
            <div className="p-4 border-b border-black/5 dark:border-white/10 flex items-center justify-between bg-gray-50/30 dark:bg-white/5">
              <h2 className="font-bold text-sm uppercase tracking-widest">Budget vs Actual</h2>
              <button onClick={() => { setCategoryFilter('all'); setMerchantFilter(''); }} className="text-[10px] font-bold uppercase tracking-widest text-primary-500 hover:underline">Reset Filters</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-black/5 dark:border-white/10 bg-gray-50/50 dark:bg-white/5">
                    <th className="py-3 px-4 font-bold text-[10px] uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">Category</th>
                    <th className="py-3 px-4 font-bold text-[10px] uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary text-right">Budget</th>
                    <th className="py-3 px-4 font-bold text-[10px] uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary text-right">Actual</th>
                    <th className="py-3 px-4 font-bold text-[10px] uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary text-right">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                  {budgetVsActual.map(row => (
                    <tr key={row.categoryName} className="group hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-[18px] text-light-text-secondary">
                            {findCategoryByName(row.categoryName, allCategories)?.icon || 'category'}
                          </span>
                          <span className="font-medium">{row.categoryName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-light-text-secondary">€{row.budgetEur.toFixed(0)}</td>
                      <td className="py-3 px-4 text-right font-bold">€{row.actualEur.toFixed(0)}</td>
                      <td className={`py-3 px-4 text-right font-bold ${row.varianceEur >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {row.varianceEur >= 0 ? '+' : ''}€{row.varianceEur.toFixed(0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {budgetVsActual.length === 0 && <p className="text-sm text-light-text-secondary p-8 text-center">No budgets configured.</p>}
            </div>
          </Card>
        </div>

        {/* Right Column: Insights & Forecasts */}
        <div className="space-y-6">
          <Card className="bg-primary-600 text-white border-none shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <span className="material-symbols-outlined text-8xl">lightbulb</span>
            </div>
            <h2 className="font-bold text-sm uppercase tracking-widest mb-4 relative z-10">Smart Insights</h2>
            <div className="space-y-3 relative z-10">
              {insights.map(item => (
                <div key={item.id} className="flex items-start gap-3 bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/10">
                  <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5">
                    {item.tone === 'warning' ? 'warning' : item.tone === 'positive' ? 'check_circle' : 'info'}
                  </span>
                  <p className="text-sm font-medium leading-relaxed">{item.text}</p>
                </div>
              ))}
              {insights.length === 0 && <p className="text-sm opacity-80 italic">Gathering more data to generate insights...</p>}
            </div>
          </Card>

          <Card className="!p-0 overflow-hidden">
            <div className="p-4 border-b border-black/5 dark:border-white/10 bg-gray-50/30 dark:bg-white/5">
              <h2 className="font-bold text-sm uppercase tracking-widest">Month-End Forecast</h2>
            </div>
            <div className="p-6">
              {forecast ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-light-text-secondary mb-1">Projected Total</p>
                      <h4 className="text-3xl font-black tracking-tight">€{forecast.projectedMonthEnd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h4>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-light-text-secondary mb-1">Daily Burn Rate</p>
                      <p className="text-xl font-bold">€{forecast.dailyAverage.toFixed(0)}<span className="text-xs font-normal opacity-60">/day</span></p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                      <span>MTD: €{forecast.mtdSpendEur.toFixed(0)}</span>
                      <span>Remaining: €{(forecast.projectedMonthEnd - forecast.mtdSpendEur).toFixed(0)}</span>
                    </div>
                    <div className="h-3 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden flex">
                      <div className="h-full bg-primary-500" style={{ width: `${(forecast.mtdSpendEur / forecast.projectedMonthEnd) * 100}%` }} />
                    </div>
                    <p className="text-[10px] text-center text-light-text-secondary font-medium uppercase tracking-wider">
                      {forecast.remainingDays} days remaining in billing cycle
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-light-text-secondary text-center py-4 italic">Forecast unavailable for current selection.</p>
              )}
            </div>
          </Card>

          <Card className="!p-0 overflow-hidden">
            <div className="p-4 border-b border-black/5 dark:border-white/10 bg-gray-50/30 dark:bg-white/5">
              <h2 className="font-bold text-sm uppercase tracking-widest">Anomalies & Outliers</h2>
            </div>
            <div className="p-4 space-y-3">
              {anomalyCandidates.map(row => (
                <div key={row.id} className="flex items-center justify-between p-3 rounded-xl border border-black/5 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[20px]">warning</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold truncate max-w-[120px]">{row.merchant}</p>
                      <p className="text-[10px] text-light-text-secondary uppercase font-bold tracking-wider">{row.date}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black">€{row.amountEur.toFixed(2)}</p>
                    <p className="text-[10px] text-rose-500 font-bold uppercase tracking-widest">{row.zScore.toFixed(1)}σ Outlier</p>
                  </div>
                </div>
              ))}
              {anomalyCandidates.length === 0 && <p className="text-sm text-light-text-secondary text-center py-4 italic">No significant outliers detected.</p>}
            </div>
          </Card>

          <Card className="!p-0 overflow-hidden">
            <div className="p-4 border-b border-black/5 dark:border-white/10 bg-gray-50/30 dark:bg-white/5">
              <h2 className="font-bold text-sm uppercase tracking-widest">Recurring Patterns</h2>
            </div>
            <div className="p-4 space-y-4">
              {recurringCandidates.slice(0, 5).map(candidate => (
                <div key={candidate.merchant} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary-500/10 text-primary-600 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[18px]">event_repeat</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold">{candidate.merchant}</p>
                      <p className="text-[10px] text-light-text-secondary uppercase font-bold tracking-wider">{candidate.frequency}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black">€{candidate.estimatedMonthlyEur.toFixed(0)}<span className="text-[10px] font-normal opacity-60">/mo</span></p>
                    <p className="text-[10px] text-light-text-secondary font-bold uppercase tracking-widest">{candidate.occurrences} hits</p>
                  </div>
                </div>
              ))}
              {recurringCandidates.length === 0 && <p className="text-sm text-light-text-secondary text-center py-4 italic">No recurring patterns found.</p>}
            </div>
          </Card>
        </div>
      </div>

    </div>
  );
};

export default Reports;
