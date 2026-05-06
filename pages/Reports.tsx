import React, { useMemo, useState, useCallback } from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar,
  Legend
} from 'recharts';
import { useTransactionSelector, usePreferencesSelector, useAccountSelector } from '../contexts/DomainProviders';
import { useBudgetsContext, useCategoryContext } from '../contexts/FinancialDataContext';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE } from '../constants';
import { Category, Account, MerchantRule } from '../types';
import { convertToEur, parseLocalDate, toLocalISOString } from '../utils';
import { getMerchantLogoUrl, normalizeMerchantKey } from '../utils/brandfetch';
import Card from '../components/Card';
import PageHeader from '../components/PageHeader';
import { motion } from 'motion/react';

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
  accountFilter: string;
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

const ChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-dark-card p-3 rounded-xl shadow-xl border border-black/5 dark:border-white/10 backdrop-blur-md">
        {label && (
          <p className="text-[10px] font-black uppercase tracking-widest mb-2 text-light-text-secondary dark:text-dark-text-secondary">
            {typeof label === 'number' ? `Day ${label}` : label}
          </p>
        )}
        <div className="space-y-1.5">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-light-text dark:text-dark-text opacity-80">{entry.name}:</span>
              </div>
              <span className="text-xs font-black text-light-text dark:text-dark-text privacy-blur">
                €{entry.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const Reports: React.FC = () => {
  const transactions = useTransactionSelector(tx => tx);
  const accounts = useAccountSelector(acc => acc);
  const defaultCurrency = usePreferencesSelector(p => p.currency || 'EUR');
  const brandfetchClientId = usePreferencesSelector(p => p.brandfetchClientId);
  const merchantLogoOverrides = usePreferencesSelector(p => p.merchantLogoOverrides || {});
  const merchantRules = usePreferencesSelector(p => p.merchantRules || {}) as Record<string, MerchantRule>;
  const { budgets } = useBudgetsContext();
  const { incomeCategories, expenseCategories } = useCategoryContext();

  const [startDate, setStartDate] = useState(getDefaultStartDate());
  const [endDate, setEndDate] = useState(toLocalISOString(new Date()));
  const [merchantFilter, setMerchantFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [accountFilter, setAccountFilter] = useState('all');
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

      if (accountFilter !== 'all' && tx.accountId !== accountFilter) return false;

      if (merchantQuery) {
        const merchant = (tx.merchant || tx.description || '').toLowerCase();
        if (!merchant.includes(merchantQuery)) return false;
      }

      return true;
    });
  }, [transactions, startDate, endDate, categoryFilter, accountFilter, merchantFilter]);

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
        if (accountFilter !== 'all' && tx.accountId !== accountFilter) return false;
        const txTs = parseLocalDate(tx.date).getTime();
        return txTs >= startTs && txTs <= endTs;
      })
      .reduce((sum, tx) => sum + Math.abs(convertToEur(tx.amount, tx.currency)), 0);

    return {
      start: toLocalISOString(prevStart),
      end: toLocalISOString(prevEnd),
      totalSpendEur,
    };
  }, [transactions, startDate, rangeDays, accountFilter]);

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
        if (accountFilter !== 'all' && tx.accountId !== accountFilter) return false;
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
  }, [transactions, endDate, accountFilter]);

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

  // --- NEW DATA PROCESSING FOR SUGGESTIONS ---

  const incomeTotalEur = useMemo(() => {
    const start = startDate ? parseLocalDate(startDate).getTime() : Number.NEGATIVE_INFINITY;
    const end = endDate ? parseLocalDate(endDate).getTime() : Number.POSITIVE_INFINITY;
    return transactions
      .filter(tx => tx.type === 'income' && !tx.transferId)
      .filter(tx => {
        if (accountFilter !== 'all' && tx.accountId !== accountFilter) return false;
        const txTime = parseLocalDate(tx.date).getTime();
        return txTime >= start && txTime <= end;
      })
      .reduce((sum, tx) => sum + Math.abs(convertToEur(tx.amount, tx.currency)), 0);
  }, [transactions, startDate, endDate, accountFilter]);

  const savingsRate = useMemo(() => {
    if (incomeTotalEur <= 0) return 0;
    const savings = incomeTotalEur - totals.totalSpendEur;
    return (savings / incomeTotalEur) * 100;
  }, [incomeTotalEur, totals.totalSpendEur]);

  const needsWantsData = useMemo(() => {
    const needsCategories = [
      'Housing', 'Bills & Utilities', 'Utilities', 'Groceries', 'Supermarket', 
      'Transportation', 'Public Transport', 'Transport', 'Insurance', 'Health', 
      'Rent', 'Mortgage', 'Medical', 'Pharmacy', 'Childcare', 'School Fees', 
      'Tuition', 'Taxes', 'Maintenance', 'Repair'
    ];
    const wantsCategories = [
      'Dining', 'Cafes', 'Takeaway', 'Entertainment', 'Shopping', 'Lifestyle', 
      'Travel', 'Flights', 'Accommodation', 'Hobbies', 'Gifts', 'Subscriptions', 
      'Streaming', 'Fitness', 'Gym', 'Beauty', 'Electronics', 'Clothing', 
      'Concert', 'Sports', 'Activities'
    ];
    
    let needs = 0;
    let wants = 0;
    let others = 0;

    filteredExpenses.forEach(tx => {
      const amount = Math.abs(convertToEur(tx.amount, tx.currency));
      const cat = tx.category || '';
      if (needsCategories.some(n => cat.toLowerCase().includes(n.toLowerCase()))) needs += amount;
      else if (wantsCategories.some(w => cat.toLowerCase().includes(w.toLowerCase()))) wants += amount;
      else others += amount;
    });

    const total = needs + wants + others;
    if (total === 0) return [];

    return [
      { name: 'Needs', value: needs, color: '#10B981', target: 50, description: 'Essentials: Housing, Groceries, Utilities, Health' },
      { name: 'Wants', value: wants, color: '#F59E0B', target: 30, description: 'Lifestyle: Dining, Travel, Shopping, Entertainment' },
      { name: 'Others', value: others, color: '#6366F1', target: 20, description: 'Uncategorized, Investments & Miscellaneous' }
    ];
  }, [filteredExpenses, convertToEur]);

  const velocityData = useMemo(() => {
    const dailyMap = new Map<string, number>();
    const prevDailyMap = new Map<string, number>();

    // Current Period
    filteredExpenses.forEach(tx => {
      const current = dailyMap.get(tx.date) || 0;
      dailyMap.set(tx.date, current + Math.abs(convertToEur(tx.amount, tx.currency)));
    });

    // Previous Period (for comparison)
    const start = parseLocalDate(startDate);
    const prevStart = new Date(start);
    prevStart.setDate(start.getDate() - rangeDays);
    const prevEnd = new Date(start);
    prevEnd.setDate(start.getDate() - 1);

    const prevStartTs = prevStart.getTime();
    const prevEndTs = prevEnd.getTime();

    transactions
      .filter(tx => tx.type === 'expense' && !tx.transferId)
      .filter(tx => {
        const txTs = parseLocalDate(tx.date).getTime();
        return txTs >= prevStartTs && txTs <= prevEndTs;
      })
      .forEach(tx => {
        // We need to "shift" the date to align it for comparison chart
        const txDate = parseLocalDate(tx.date);
        const diffDays = Math.floor((txDate.getTime() - prevStartTs) / (1000 * 3600 * 24));
        const key = `day-${diffDays}`;
        const current = prevDailyMap.get(key) || 0;
        prevDailyMap.set(key, current + Math.abs(convertToEur(tx.amount, tx.currency)));
      });

    // Generate combined array
    const result = [];
    const currentStartTs = parseLocalDate(startDate).getTime();
    for (let i = 0; i < rangeDays; i++) {
      const date = new Date(currentStartTs + (i * 1000 * 3600 * 24));
      const dateStr = toLocalISOString(date).split('T')[0];
      result.push({
        day: i + 1,
        date: dateStr,
        current: dailyMap.get(dateStr) || 0,
        previous: prevDailyMap.get(`day-${i}`) || 0
      });
    }
    return result;
  }, [filteredExpenses, transactions, startDate, rangeDays]);

  const merchantLoyalty = useMemo(() => {
    const map = new Map<string, { label: string; totalEur: number; count: number }>();
    filteredExpenses.forEach(tx => {
      const key = tx.merchant?.trim() || tx.description || 'Unknown';
      const current = map.get(key) || { label: key, totalEur: 0, count: 0 };
      current.totalEur += Math.abs(convertToEur(tx.amount, tx.currency));
      current.count += 1;
      map.set(key, current);
    });

    return Array.from(map.values())
      .map(m => ({
        ...m,
        avgPerVisit: m.totalEur / m.count,
        loyaltyScore: (m.count * 0.7) + (m.totalEur * 0.001) // Simple heuristic
      }))
      .sort((a, b) => b.loyaltyScore - a.loyaltyScore)
      .slice(0, 5);
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
        accountFilter,
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
    setAccountFilter(view.accountFilter || 'all');
    setGroupBy(view.groupBy);
  };

  const deleteView = (id: string) => {
    const next = savedViews.filter(view => view.id !== id);
    setSavedViews(next);
    writeSavedViews(next);
  };

  const setPredefinedPeriod = (period: string) => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    switch (period) {
      case 'last7':
        start.setDate(now.getDate() - 7);
        break;
      case 'last30':
        start.setDate(now.getDate() - 30);
        break;
      case 'thisMonth':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'lastMonth':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'thisYear':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
        break;
      case 'lastYear':
        start = new Date(now.getFullYear() - 1, 0, 1);
        end = new Date(now.getFullYear() - 1, 11, 31);
        break;
      default:
        return;
    }

    setStartDate(toLocalISOString(start));
    setEndDate(toLocalISOString(end));
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in-up">
      <PageHeader
        markerIcon="analytics"
        markerLabel="Insights"
        title="Financial Reports"
        subtitle="Deep dive into your spending habits, budget performance, and automated financial insights."
      />

      {/* Hero Section: Key Metrics */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-[#1E1E20] p-6 shadow-sm border border-black/5 dark:border-neutral-800 group transition-all hover:shadow-md">
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

        <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-[#1E1E20] p-6 shadow-sm border border-black/5 dark:border-neutral-800 group transition-all hover:shadow-md">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <span className="material-symbols-outlined text-6xl">savings</span>
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary mb-1">Savings Rate</p>
          <div className="flex items-baseline gap-2">
            <h3 className={`text-3xl font-black tracking-tight ${savingsRate >= 20 ? 'text-emerald-500' : savingsRate > 0 ? 'text-primary-500' : 'text-rose-500'}`}>
              {savingsRate.toFixed(1)}%
            </h3>
          </div>
          <p className="mt-4 text-[10px] text-light-text-secondary dark:text-dark-text-secondary font-medium uppercase tracking-wider">
            {savingsRate >= 20 ? 'Excellent saving habits' : 'Aim for 20% target'}
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-[#1E1E20] p-6 shadow-sm border border-black/5 dark:border-neutral-800 group transition-all hover:shadow-md">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <span className="material-symbols-outlined text-6xl">receipt_long</span>
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary mb-1">Transactions</p>
          <h3 className="text-3xl font-black tracking-tight">{totals.transactionCount}</h3>
          <p className="mt-4 text-[10px] text-light-text-secondary dark:text-dark-text-secondary font-medium uppercase tracking-wider">Processed in range</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-[#1E1E20] p-6 shadow-sm border border-black/5 dark:border-neutral-800 group transition-all hover:shadow-md">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <span className="material-symbols-outlined text-6xl">calculate</span>
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary mb-1">Avg. Transaction</p>
          <h3 className="text-3xl font-black tracking-tight">€{totals.averageEur.toFixed(2)}</h3>
          <p className="mt-4 text-[10px] text-light-text-secondary dark:text-dark-text-secondary font-medium uppercase tracking-wider">Per expense item</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-[#1E1E20] p-6 shadow-sm border border-black/5 dark:border-neutral-800 group transition-all hover:shadow-md">
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
      <Card className="!p-0 overflow-hidden border border-black/5 dark:border-neutral-800 shadow-sm">
        <div className="bg-gray-50/50 dark:bg-white/5 p-4 border-b border-black/5 dark:border-white/10">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">Report Configuration</h2>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Last 7 Days', value: 'last7' },
                { label: 'Last 30 Days', value: 'last30' },
                { label: 'This Month', value: 'thisMonth' },
                { label: 'Last Month', value: 'lastMonth' },
                { label: 'This Year', value: 'thisYear' },
                { label: 'Last Year', value: 'lastYear' },
              ].map(p => (
                <button
                  key={p.value}
                  onClick={() => setPredefinedPeriod(p.value)}
                  className="px-3 py-1 rounded-full bg-white dark:bg-dark-card border border-black/5 dark:border-white/10 text-[10px] font-bold uppercase tracking-wider hover:border-primary-500 transition-all"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          {savedViews.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {savedViews.map(view => (
                <div key={view.id} className="group flex items-center gap-1 bg-white dark:bg-dark-card border border-black/5 dark:border-white/10 rounded-full pl-3 pr-1 py-1 shadow-sm transition-all hover:border-primary-500/50">
                  <button onClick={() => applyView(view)} className="text-[10px] font-bold uppercase tracking-wider hover:text-primary-500">{view.name}</button>
                  <button onClick={() => deleteView(view.id)} className="w-5 h-5 flex items-center justify-center rounded-full text-light-text-secondary hover:bg-rose-500 hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">Account</label>
              <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} className={`${INPUT_BASE_STYLE} !bg-white dark:!bg-neutral-800`}>
                <option value="all">All Accounts</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`${INPUT_BASE_STYLE} !bg-white dark:!bg-neutral-800`} />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={`${INPUT_BASE_STYLE} !bg-white dark:!bg-neutral-800`} />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">Merchant</label>
              <input type="text" value={merchantFilter} onChange={(e) => setMerchantFilter(e.target.value)} placeholder="Filter by name..." className={`${INPUT_BASE_STYLE} !bg-white dark:!bg-neutral-800`} />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">Category</label>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={`${INPUT_BASE_STYLE} !bg-white dark:!bg-neutral-800`}>
                <option value="all">All Categories</option>
                <optgroup label="Expenses">
                  {expenseCategories.map(cat => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Income">
                  {incomeCategories.map(cat => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">Group By</label>
              <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)} className={`${INPUT_BASE_STYLE} !bg-white dark:!bg-neutral-800`}>
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
              className={`${INPUT_BASE_STYLE} !pl-10 !bg-white dark:!bg-neutral-800`} 
              placeholder="Name this report view to save it..." 
            />
          </div>
          <button onClick={handleSaveView} className={`${BTN_PRIMARY_STYLE} w-full md:w-auto whitespace-nowrap`}>
            <span className="material-symbols-outlined text-[18px] mr-2">save</span>
            Save Report
          </button>
        </div>
      </Card>

      {/* Visual Spending Dashboard */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 flex flex-col border border-black/5 dark:border-neutral-800">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest">Spending Velocity</h2>
              <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary font-bold uppercase tracking-wider">Daily intensity vs previous period</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-primary-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Current</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-white/20" />
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Previous</span>
              </div>
            </div>
          </div>
          <div className="h-[250px] w-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={velocityData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                <XAxis 
                  dataKey="day" 
                  axisLine={false} 
                  tickLine={false} 
                  fontSize={10} 
                  tickFormatter={(val) => `Day ${val}`}
                  opacity={0.5}
                />
                <YAxis axisLine={false} tickLine={false} fontSize={10} opacity={0.5} tickFormatter={(val) => `€${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="previous" name="Previous Period" stroke="#94a3b8" fill="transparent" strokeDasharray="5 5" strokeWidth={1} />
                <Area type="monotone" dataKey="current" name="Current Period" stroke="#6366F1" fillOpacity={1} fill="url(#colorCurrent)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="flex flex-col border border-black/5 dark:border-neutral-800">
          <h2 className="text-sm font-black uppercase tracking-widest mb-1">Allocation</h2>
          <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary font-bold uppercase tracking-wider mb-6">Top categories by volume</p>
          <div className="h-[250px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryTotals.slice(0, 5)}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="totalEur"
                  nameKey="category"
                  stroke="none"
                >
                  {categoryTotals.slice(0, 5).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#6366F1', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6'][index % 5]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Total</span>
              <span className="text-lg font-black tracking-tighter">€{totals.totalSpendEur.toFixed(0)}</span>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {categoryTotals.slice(0, 3).map((cat, i) => (
              <div key={cat.category} className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ['#6366F1', '#10B981', '#F59E0B'][i] }} />
                  <span className="opacity-60">{cat.category}</span>
                </div>
                <span>€{cat.totalEur.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* Behavioral Insights & Merchant Loyalty */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="flex flex-col border border-black/5 dark:border-neutral-800">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest">Needs vs. Wants</h2>
              <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary font-bold uppercase tracking-wider">50/30/20 Rule Analysis</p>
            </div>
            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${savingsRate >= 20 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
              {savingsRate >= 20 ? 'Balanced' : 'Over-Spending'}
            </div>
          </div>
          <div className="space-y-6">
            {needsWantsData.map(item => {
              const share = totals.totalSpendEur > 0 ? (item.value / totals.totalSpendEur) * 100 : 0;
              const isOver = share > item.target && item.name !== 'Others';
              return (
                <div key={item.name} className="space-y-2 group/item">
                  <div className="flex justify-between items-end">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase tracking-widest">{item.name}</span>
                        <div className="opacity-0 group-hover/item:opacity-100 transition-opacity">
                          <span className="text-[9px] font-bold text-light-text-secondary dark:text-dark-text-secondary bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded">
                            {(item as any).description}
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] opacity-50 font-bold uppercase tracking-widest">Target: {item.target}%</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-black ${isOver ? 'text-rose-500' : 'text-light-text dark:text-dark-text'}`}>{share.toFixed(1)}%</span>
                      <p className="text-[10px] opacity-50 font-bold uppercase tracking-widest">€{item.value.toFixed(0)}</p>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden flex">
                    <div 
                      className="h-full transition-all duration-500" 
                      style={{ width: `${share}%`, backgroundColor: item.color }} 
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-8 p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5">
            <p className="text-xs font-medium leading-relaxed opacity-80 italic">
              {(() => {
                const wants = needsWantsData.find(d => d.name === 'Wants');
                const wantsShare = wants ? (wants.value / totals.totalSpendEur) * 100 : 0;
                const needs = needsWantsData.find(d => d.name === 'Needs');
                const needsShare = needs ? (needs.value / totals.totalSpendEur) * 100 : 0;

                if (wantsShare > 30) {
                  const targetValue = totals.totalSpendEur * 0.3;
                  const potentialSavings = wants!.value - targetValue;
                  return `Your "Wants" spending is ${wantsShare.toFixed(1)}%, which is above the 30% target. Reducing this to the target level could save you €${potentialSavings.toFixed(0)} per month.`;
                } else if (needsShare > 50) {
                  return `Your "Needs" are ${needsShare.toFixed(1)}% of your expenses. Since these are often fixed costs, consider reviewing your recurring bills or subscriptions to bring this closer to the 50% benchmark.`;
                } else if (totals.totalSpendEur > 0) {
                  return `Great job! Your spending is well-balanced according to the 50/30/20 rule. You're maintaining a healthy ratio between essentials and lifestyle choices.`;
                }
                return "Start tracking your expenses to see your personalized 50/30/20 rule analysis.";
              })()}
            </p>
          </div>
        </Card>

        <Card className="flex flex-col border border-black/5 dark:border-neutral-800">
          <h2 className="text-sm font-black uppercase tracking-widest mb-1">Merchant Loyalty</h2>
          <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary font-bold uppercase tracking-wider mb-6">Frequency vs. Impact Leaderboard</p>
          <div className="space-y-4">
            {merchantLoyalty.map((m, i) => {
              const { merchantLogoUrl, showMerchantLogo, merchantInitial } = merchantVisual(m.label);
              return (
                <div key={m.label} className="flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="text-lg font-black opacity-10 group-hover:opacity-30 transition-opacity w-4">{i + 1}</div>
                    <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center overflow-hidden border border-black/5 dark:border-white/10 ${showMerchantLogo ? 'bg-white dark:bg-dark-card' : 'bg-primary-500/10 text-primary-600'}`}>
                      {showMerchantLogo && merchantLogoUrl ? (
                        <img src={merchantLogoUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" onError={() => handleLogoError(merchantLogoUrl)} />
                      ) : (
                        <span className="text-sm font-bold">{merchantInitial}</span>
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold truncate max-w-[150px]">{m.label}</h4>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">{m.count} visits</span>
                        <span className="w-1 h-1 rounded-full bg-gray-300" />
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">€{m.avgPerVisit.toFixed(0)} avg</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black tracking-tighter">€{m.totalEur.toFixed(0)}</div>
                    <div className="text-[10px] font-black text-primary-500 uppercase tracking-widest">Score: {m.loyaltyScore.toFixed(0)}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-auto pt-6">
            <button className="w-full py-2 rounded-xl border border-dashed border-black/10 dark:border-white/10 text-[10px] font-black uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity">
              View All Merchant Insights
            </button>
          </div>
        </Card>
      </section>



      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Detailed Breakdowns */}
        <div className="space-y-6">
          <Card className="!p-0 overflow-hidden border border-black/5 dark:border-neutral-800">
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
                        <td className="py-3 px-4 text-right font-bold privacy-blur">€{row.totalEur.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
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
                  <p className="text-sm font-medium leading-relaxed privacy-blur">{item.text}</p>
                </div>
              ))}
              {insights.length === 0 && <p className="text-sm opacity-80 italic">Gathering more data to generate insights...</p>}
            </div>
          </Card>

          <Card className="!p-0 overflow-hidden border border-black/5 dark:border-neutral-800">
            <div className="p-4 border-b border-black/5 dark:border-white/10 bg-gray-50/30 dark:bg-white/5">
              <h2 className="font-bold text-sm uppercase tracking-widest">Month-End Forecast</h2>
            </div>
            <div className="p-6">
              {forecast ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-light-text-secondary mb-1">Projected Total</p>
                      <h4 className="text-3xl font-black tracking-tight privacy-blur">€{forecast.projectedMonthEnd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h4>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-light-text-secondary mb-1">Daily Burn Rate</p>
                      <p className="text-xl font-bold privacy-blur">€{forecast.dailyAverage.toFixed(0)}<span className="text-xs font-normal opacity-60">/day</span></p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest privacy-blur">
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

          <Card className="!p-0 overflow-hidden border border-black/5 dark:border-neutral-800">
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
                    <p className="text-sm font-black privacy-blur">€{row.amountEur.toFixed(2)}</p>
                    <p className="text-[10px] text-rose-500 font-bold uppercase tracking-widest">{row.zScore.toFixed(1)}σ Outlier</p>
                  </div>
                </div>
              ))}
              {anomalyCandidates.length === 0 && <p className="text-sm text-light-text-secondary text-center py-4 italic">No significant outliers detected.</p>}
            </div>
          </Card>

          <Card className="!p-0 overflow-hidden border border-black/5 dark:border-neutral-800">
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
                    <p className="text-sm font-black privacy-blur">€{candidate.estimatedMonthlyEur.toFixed(0)}<span className="text-[10px] font-normal opacity-60">/mo</span></p>
                    <p className="text-[10px] text-light-text-secondary font-bold uppercase tracking-widest">{candidate.occurrences} hits</p>
                  </div>
                </div>
              ))}
              {recurringCandidates.length === 0 && <p className="text-sm text-light-text-secondary text-center py-4 italic">No recurring patterns found.</p>}
            </div>
          </Card>
          <Card className="!p-0 overflow-hidden border border-black/5 dark:border-neutral-800">
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
      </div>

    </div>
  );
};

export default Reports;
