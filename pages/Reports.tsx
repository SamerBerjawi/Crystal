import React, { useMemo, useState, useCallback } from 'react';
import { useTransactionSelector, usePreferencesSelector } from '../contexts/DomainProviders';
import { useBudgetsContext, useCategoryContext } from '../contexts/FinancialDataContext';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE } from '../constants';
import { Category } from '../types';
import { convertToEur, parseLocalDate, toLocalISOString } from '../utils';
import { getMerchantLogoUrl, normalizeMerchantKey } from '../utils/brandfetch';

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
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-light-text dark:text-dark-text">Reports</h1>
        <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">Phase 2: period comparison, budget vs actual, recurring spend detection, and saved report views.</p>
      </div>

      <section className="bg-light-card dark:bg-dark-card rounded-xl p-4 border border-black/5 dark:border-white/10 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs mb-1 text-light-text-secondary dark:text-dark-text-secondary">Start date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={INPUT_BASE_STYLE} />
          </div>
          <div>
            <label className="block text-xs mb-1 text-light-text-secondary dark:text-dark-text-secondary">End date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={INPUT_BASE_STYLE} />
          </div>
          <div>
            <label className="block text-xs mb-1 text-light-text-secondary dark:text-dark-text-secondary">Merchant contains</label>
            <input type="text" value={merchantFilter} onChange={(e) => setMerchantFilter(e.target.value)} placeholder="e.g. Amazon" className={INPUT_BASE_STYLE} />
          </div>
          <div>
            <label className="block text-xs mb-1 text-light-text-secondary dark:text-dark-text-secondary">Category</label>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={INPUT_BASE_STYLE}>
              <option value="all">All categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1 text-light-text-secondary dark:text-dark-text-secondary">Group results by</label>
            <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)} className={INPUT_BASE_STYLE}>
              <option value="merchant">Merchant</option>
              <option value="category">Category</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
          <input type="text" value={reportName} onChange={(e) => setReportName(e.target.value)} className={INPUT_BASE_STYLE} placeholder="Save this filter set as..." />
          <button onClick={handleSaveView} className={BTN_PRIMARY_STYLE}>Save Report View</button>
        </div>

        {savedViews.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {savedViews.map(view => (
              <div key={view.id} className="flex items-center gap-1 bg-light-fill dark:bg-dark-fill rounded-lg px-2 py-1">
                <button onClick={() => applyView(view)} className="text-sm hover:underline">{view.name}</button>
                <button onClick={() => deleteView(view.id)} className="text-xs text-red-500 hover:underline">Remove</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-light-card dark:bg-dark-card rounded-xl p-4 border border-black/5 dark:border-white/10">
          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Total spend ({defaultCurrency})</p>
          <p className="text-2xl font-bold">€{totals.totalSpendEur.toFixed(2)}</p>
        </div>
        <div className="bg-light-card dark:bg-dark-card rounded-xl p-4 border border-black/5 dark:border-white/10">
          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Transactions</p>
          <p className="text-2xl font-bold">{totals.transactionCount}</p>
        </div>
        <div className="bg-light-card dark:bg-dark-card rounded-xl p-4 border border-black/5 dark:border-white/10">
          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Average transaction (EUR)</p>
          <p className="text-2xl font-bold">€{totals.averageEur.toFixed(2)}</p>
        </div>
        <div className="bg-light-card dark:bg-dark-card rounded-xl p-4 border border-black/5 dark:border-white/10">
          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Vs previous period</p>
          <p className={`text-2xl font-bold ${(totals.changePct ?? 0) <= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {totals.changePct === null ? '—' : `${totals.changePct > 0 ? '+' : ''}${totals.changePct.toFixed(1)}%`}
          </p>
          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
            Compared to {previousPeriodTotals.start} → {previousPeriodTotals.end}
          </p>
        </div>
      </section>

      <section className="bg-light-card dark:bg-dark-card rounded-xl p-4 border border-black/5 dark:border-white/10">
        <h2 className="font-semibold mb-3">Spend breakdown by {groupBy}</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b border-black/5 dark:border-white/10">
                <th className="py-2 pr-3 font-medium capitalize">{groupBy}</th>
                <th className="py-2 pr-3 font-medium">Transactions</th>
                <th className="py-2 pr-3 font-medium">Total (EUR)</th>
                <th className="py-2 pr-3 font-medium">Share</th>
              </tr>
            </thead>
            <tbody>
              {groupedRows.map(row => {
                const share = totals.totalSpendEur > 0 ? (row.totalEur / totals.totalSpendEur) * 100 : 0;
                const category = findCategoryByName(row.label, allCategories);
                const { merchantLogoUrl, showMerchantLogo, merchantInitial } = merchantVisual(row.label);
                return (
                  <tr key={row.label} className="border-b border-black/5 dark:border-white/5">
                    <td className="py-2 pr-3">
                      {groupBy === 'merchant' ? (
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center overflow-hidden ${showMerchantLogo ? 'bg-white dark:bg-dark-card' : 'bg-primary-500/20 text-primary-700 dark:text-primary-300'}`}>
                            {showMerchantLogo && merchantLogoUrl ? (
                              <img
                                src={merchantLogoUrl}
                                alt={`${row.label} logo`}
                                className="w-full h-full object-cover"
                                onError={() => handleLogoError(merchantLogoUrl)}
                              />
                            ) : (
                              <span className="text-xs font-semibold">{merchantInitial}</span>
                            )}
                          </div>
                          <span>{row.label}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px] text-light-text-secondary dark:text-dark-text-secondary">
                            {category?.icon || 'category'}
                          </span>
                          <span>{row.label}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-2 pr-3">{row.count}</td>
                    <td className="py-2 pr-3">€{row.totalEur.toFixed(2)}</td>
                    <td className="py-2 pr-3">{share.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {groupedRows.length === 0 && <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary py-3">No matching expenses found for the selected filters.</p>}
        </div>
      </section>

      <section className="bg-light-card dark:bg-dark-card rounded-xl p-4 border border-black/5 dark:border-white/10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Budget vs Actual</h2>
          <button
            onClick={() => {
              setCategoryFilter('all');
              setMerchantFilter('');
            }}
            className={BTN_SECONDARY_STYLE}
          >
            Clear category/merchant filters
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b border-black/5 dark:border-white/10">
                <th className="py-2 pr-3 font-medium">Category</th>
                <th className="py-2 pr-3 font-medium">Budget (EUR)</th>
                <th className="py-2 pr-3 font-medium">Actual (EUR)</th>
                <th className="py-2 pr-3 font-medium">Variance</th>
              </tr>
            </thead>
            <tbody>
              {budgetVsActual.map(row => (
                <tr key={row.categoryName} className="border-b border-black/5 dark:border-white/5">
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-light-text-secondary dark:text-dark-text-secondary">
                        {findCategoryByName(row.categoryName, allCategories)?.icon || 'category'}
                      </span>
                      <span>{row.categoryName}</span>
                    </div>
                  </td>
                  <td className="py-2 pr-3">€{row.budgetEur.toFixed(2)}</td>
                  <td className="py-2 pr-3">€{row.actualEur.toFixed(2)}</td>
                  <td className={`py-2 pr-3 font-medium ${row.varianceEur >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {row.varianceEur >= 0 ? '+' : ''}€{row.varianceEur.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {budgetVsActual.length === 0 && <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary py-3">No budgets configured yet. Create budgets to see budget vs actual reporting.</p>}
        </div>
      </section>

      <section className="bg-light-card dark:bg-dark-card rounded-xl p-4 border border-black/5 dark:border-white/10">
        <h2 className="font-semibold mb-3">Automated Insights</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {insights.map(item => (
            <div
              key={item.id}
              className={`rounded-lg px-3 py-2 text-sm border ${
                item.tone === 'warning'
                  ? 'border-amber-400/40 bg-amber-500/10'
                  : item.tone === 'positive'
                    ? 'border-emerald-400/40 bg-emerald-500/10'
                    : 'border-black/10 dark:border-white/10 bg-light-fill dark:bg-dark-fill'
              }`}
            >
              {item.text}
            </div>
          ))}
        </div>
        {insights.length === 0 && (
          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
            Not enough data yet to generate insights for this filter selection.
          </p>
        )}
      </section>

      <section className="bg-light-card dark:bg-dark-card rounded-xl p-4 border border-black/5 dark:border-white/10">
        <h2 className="font-semibold mb-3">Forecast (End of Month)</h2>
        {forecast ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-black/10 dark:border-white/10 p-3">
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Month window</p>
              <p className="font-semibold">{forecast.monthStart} → {forecast.monthEnd}</p>
            </div>
            <div className="rounded-lg border border-black/10 dark:border-white/10 p-3">
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">MTD spend (EUR)</p>
              <p className="font-semibold">€{forecast.mtdSpendEur.toFixed(2)}</p>
            </div>
            <div className="rounded-lg border border-black/10 dark:border-white/10 p-3">
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Daily average (EUR)</p>
              <p className="font-semibold">€{forecast.dailyAverage.toFixed(2)}</p>
            </div>
            <div className="rounded-lg border border-black/10 dark:border-white/10 p-3">
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Projected month-end (EUR)</p>
              <p className="font-semibold">€{forecast.projectedMonthEnd.toFixed(2)}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Forecast unavailable for current selection.</p>
        )}
      </section>

      <section className="bg-light-card dark:bg-dark-card rounded-xl p-4 border border-black/5 dark:border-white/10">
        <h2 className="font-semibold mb-3">Anomaly Detection (Large Outliers)</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b border-black/5 dark:border-white/10">
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 font-medium">Merchant</th>
                <th className="py-2 pr-3 font-medium">Category</th>
                <th className="py-2 pr-3 font-medium">Amount (EUR)</th>
                <th className="py-2 pr-3 font-medium">Outlier score</th>
              </tr>
            </thead>
            <tbody>
              {anomalyCandidates.map(row => (
                <tr key={row.id} className="border-b border-black/5 dark:border-white/5">
                  <td className="py-2 pr-3">{row.date}</td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      {(() => {
                        const { merchantLogoUrl, showMerchantLogo, merchantInitial } = merchantVisual(row.merchant);
                        return (
                          <div className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center overflow-hidden ${showMerchantLogo ? 'bg-white dark:bg-dark-card' : 'bg-primary-500/20 text-primary-700 dark:text-primary-300'}`}>
                            {showMerchantLogo && merchantLogoUrl ? (
                              <img
                                src={merchantLogoUrl}
                                alt={`${row.merchant} logo`}
                                className="w-full h-full object-cover"
                                onError={() => handleLogoError(merchantLogoUrl)}
                              />
                            ) : (
                              <span className="text-xs font-semibold">{merchantInitial}</span>
                            )}
                          </div>
                        );
                      })()}
                      <span>{row.merchant}</span>
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-light-text-secondary dark:text-dark-text-secondary">
                        {findCategoryByName(row.category, allCategories)?.icon || 'category'}
                      </span>
                      <span>{row.category}</span>
                    </div>
                  </td>
                  <td className="py-2 pr-3">€{row.amountEur.toFixed(2)}</td>
                  <td className="py-2 pr-3">{row.zScore.toFixed(2)}σ</td>
                </tr>
              ))}
            </tbody>
          </table>
          {anomalyCandidates.length === 0 && (
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary py-3">
              No significant outliers detected for the selected filters.
            </p>
          )}
        </div>
      </section>

      <section className="bg-light-card dark:bg-dark-card rounded-xl p-4 border border-black/5 dark:border-white/10">
        <h2 className="font-semibold mb-3">Recurring Spend Candidates</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b border-black/5 dark:border-white/10">
                <th className="py-2 pr-3 font-medium">Merchant</th>
                <th className="py-2 pr-3 font-medium">Detected frequency</th>
                <th className="py-2 pr-3 font-medium">Occurrences</th>
                <th className="py-2 pr-3 font-medium">Avg amount (EUR)</th>
                <th className="py-2 pr-3 font-medium">Estimated monthly (EUR)</th>
              </tr>
            </thead>
            <tbody>
              {recurringCandidates.map(candidate => (
                <tr key={candidate.merchant} className="border-b border-black/5 dark:border-white/5">
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      {(() => {
                        const { merchantLogoUrl, showMerchantLogo, merchantInitial } = merchantVisual(candidate.merchant);
                        return (
                          <div className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center overflow-hidden ${showMerchantLogo ? 'bg-white dark:bg-dark-card' : 'bg-primary-500/20 text-primary-700 dark:text-primary-300'}`}>
                            {showMerchantLogo && merchantLogoUrl ? (
                              <img
                                src={merchantLogoUrl}
                                alt={`${candidate.merchant} logo`}
                                className="w-full h-full object-cover"
                                onError={() => handleLogoError(merchantLogoUrl)}
                              />
                            ) : (
                              <span className="text-xs font-semibold">{merchantInitial}</span>
                            )}
                          </div>
                        );
                      })()}
                      <span>{candidate.merchant}</span>
                    </div>
                  </td>
                  <td className="py-2 pr-3">{candidate.frequency}</td>
                  <td className="py-2 pr-3">{candidate.occurrences}</td>
                  <td className="py-2 pr-3">€{candidate.averageEur.toFixed(2)}</td>
                  <td className="py-2 pr-3">€{candidate.estimatedMonthlyEur.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {recurringCandidates.length === 0 && <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary py-3">No recurring patterns detected for this filtered period.</p>}
        </div>
      </section>
    </div>
  );
};

export default Reports;
