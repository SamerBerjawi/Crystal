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
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE, SELECT_STYLE } from '../constants';
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
          <p className="text-[10px] font-bold tracking-widest mb-2 text-light-text-secondary dark:text-dark-text-secondary">
            {typeof label === 'number' ? `Day ${label}` : label}
          </p>
        )}
        <div className="space-y-1.5">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
                <span className="text-[10px] font-bold tracking-wider text-light-text dark:text-dark-text opacity-80">{entry.name}:</span>
              </div>
              <span className="text-xs font-bold text-light-text dark:text-dark-text privacy-blur">
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

const MetricCard = React.memo(function MetricCard({ label, value, colorClass = "text-light-text dark:text-dark-text", icon, subtitle, glowColor = "rgba(99, 102, 241, 0.15)" }: { label: string; value: string; colorClass?: string; icon: string; subtitle?: string; glowColor?: string }) {
    return (
        <div className="group relative bg-white dark:bg-dark-card p-5 rounded-2xl border border-black/5 dark:border-white/5 flex flex-col justify-between transition-all duration-300 hover:-translate-y-0.5 overflow-hidden h-full shadow-sm"
             style={{ boxShadow: `0 8px 30px -10px ${glowColor}` }}>
            {/* Inner Glow Effect */}
            <div 
                className="absolute inset-0 pointer-events-none rounded-2xl overflow-hidden"
                style={{ 
                    background: `radial-gradient(circle at 0% 0%, ${glowColor} 0%, transparent 50%)`,
                    opacity: 0.6
                }}
            />
            
            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary border border-black/5 dark:border-white/5 transition-transform group-hover:scale-110">
                        <span className="material-symbols-outlined text-lg">{icon}</span>
                    </div>
                    <p className="text-sm font-bold text-light-text-secondary dark:text-dark-text-secondary">{label}</p>
                </div>
                
                <div className="flex flex-col">
                    <p className={`text-2xl font-bold tracking-tight ${colorClass}`}>{value}</p>
                    {subtitle && <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1 font-bold opacity-60">{subtitle}</p>}
                </div>
            </div>
            
            {/* Background Icon Accent */}
            <div className="absolute -right-4 -bottom-4 text-current opacity-[0.03] dark:opacity-[0.05] transition-transform group-hover:scale-110 duration-500 pointer-events-none">
                <span className="material-symbols-outlined text-8xl">{icon}</span>
            </div>
        </div>
    );
});

const Reports: React.FC = () => {
  const transactions = useTransactionSelector(tx => tx);
  const accounts = useAccountSelector(acc => acc);
  const defaultCurrency = usePreferencesSelector(p => p.currency || 'EUR');
  const brandfetchClientId = usePreferencesSelector(p => p.brandfetchClientId);
  const merchantLogoOverrides = usePreferencesSelector(p => p.merchantLogoOverrides || {});
  const merchantRules = usePreferencesSelector(p => p.merchantRules || {}) as Record<string, MerchantRule>;
  const showBalanceAdjustments = usePreferencesSelector(p => p.showBalanceAdjustments ?? true);
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
      if (!showBalanceAdjustments && tx.isBalanceAdjustment) return false;
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
      .filter(tx => {
          if (!showBalanceAdjustments && tx.isBalanceAdjustment) return false;
          return tx.type === 'expense' && !tx.transferId;
      })
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
      .filter(tx => {
          if (!showBalanceAdjustments && tx.isBalanceAdjustment) return false;
          return tx.type === 'expense' && !tx.transferId;
      })
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
      .filter(tx => {
          if (!showBalanceAdjustments && tx.isBalanceAdjustment) return false;
          return tx.type === 'income' && !tx.transferId;
      })
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
      .filter(tx => {
          if (!showBalanceAdjustments && tx.isBalanceAdjustment) return false;
          return tx.type === 'expense' && !tx.transferId;
      })
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
    <div className="space-y-6 pb-8 animate-fade-in-up">
      <PageHeader
        markerIcon="analytics"
        markerLabel="Insights"
        title="Financial Reports"
        subtitle="Deep dive into your spending habits, budget performance, and automated financial insights."
      />

      {/* Hero Section: Key Metrics */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <MetricCard
          label="Total Spend"
          value={`€${totals.totalSpendEur.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon="payments"
          subtitle={`vs last period`}
          colorClass="text-light-text dark:text-dark-text"
          glowColor="rgba(99, 102, 241, 0.15)"
        />

        <MetricCard
          label="Savings Rate"
          value={`${savingsRate.toFixed(1)}%`}
          icon="savings"
          subtitle={savingsRate >= 20 ? 'Excellent saving' : 'Aim for 20% target'}
          colorClass={savingsRate >= 20 ? 'text-emerald-500' : savingsRate > 0 ? 'text-primary-500' : 'text-rose-500'}
          glowColor={savingsRate >= 20 ? "rgba(16, 185, 129, 0.15)" : "rgba(99, 102, 241, 0.15)"}
        />

        <MetricCard
          label="Transactions"
          value={totals.transactionCount.toString()}
          icon="receipt_long"
          subtitle="Processed in range"
          glowColor="rgba(99, 102, 241, 0.15)"
        />

        <MetricCard
          label="Avg. Transaction"
          value={`€${totals.averageEur.toFixed(2)}`}
          icon="calculate"
          subtitle="Per expense item"
          glowColor="rgba(99, 102, 241, 0.15)"
        />

        <MetricCard
          label="Recurring Impact"
          value={`€${(recurringCandidates.reduce((sum, c) => sum + c.estimatedMonthlyEur, 0)).toFixed(0)}`}
          icon="event_repeat"
          subtitle="Est. Monthly Total"
          glowColor="rgba(244, 63, 94, 0.15)"
        />
      </section>

      {/* Filters & Saved Views */}
      <Card className="!p-0 overflow-hidden border border-black/5 dark:border-white/5 shadow-2xl rounded-[2rem]">
        <div className="bg-black/5 dark:bg-white/5 p-8 border-b border-black/5 dark:border-white/10 relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10 relative z-10">
            <div>
              <h2 className="text-xs font-bold tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary opacity-60 mb-1">Configuration</h2>
              <p className="text-lg font-bold text-light-text dark:text-dark-text tracking-tight">Report parameters</p>
            </div>
            
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
                  className="px-4 py-2 rounded-xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/10 text-[10px] font-bold tracking-[0.15em] hover:border-primary-500 hover:text-primary-500 transition-all shadow-sm"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {savedViews.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-4 relative z-10">
              {savedViews.map(view => (
                <div key={view.id} className="group flex items-center gap-2 bg-white dark:bg-dark-card border border-black/5 dark:border-white/10 rounded-xl pl-4 pr-2 py-2 shadow-sm transition-all hover:border-primary-500/50 hover:shadow-lg hover:shadow-primary-500/10">
                  <button 
                    onClick={() => applyView(view)} 
                    className="text-[10px] font-bold tracking-[0.15em] text-light-text dark:text-dark-text hover:text-primary-500 transition-colors"
                  >
                    {view.name}
                  </button>
                  <button 
                    onClick={() => deleteView(view.id)} 
                    className="w-6 h-6 flex items-center justify-center rounded-lg text-light-text-secondary dark:text-dark-text-secondary hover:bg-rose-500 hover:text-white transition-all transform scale-90 group-hover:scale-100"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 relative z-10">
            <div className="space-y-2">
              <label className="block text-xs font-bold tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary opacity-60">Account</label>
              <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} className={`${SELECT_STYLE} !bg-white dark:!bg-dark-card !rounded-xl !border-black/10 dark:!border-white/10 !text-sm font-bold uppercase tracking-tight`}>
                <option value="all">All Accounts</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary opacity-60">Start date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`${INPUT_BASE_STYLE} !bg-white dark:!bg-dark-card !rounded-xl !border-black/10 dark:!border-white/10 !text-sm font-bold uppercase tracking-tight`} />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary opacity-60">End date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={`${INPUT_BASE_STYLE} !bg-white dark:!bg-dark-card !rounded-xl !border-black/10 dark:!border-white/10 !text-sm font-bold uppercase tracking-tight`} />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary opacity-60">Merchant</label>
              <input type="text" value={merchantFilter} onChange={(e) => setMerchantFilter(e.target.value)} placeholder="Filter by name..." className={`${INPUT_BASE_STYLE} !bg-white dark:!bg-dark-card !rounded-xl !border-black/10 dark:!border-white/10 !text-sm font-bold uppercase tracking-tight`} />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary opacity-60">Category</label>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={`${SELECT_STYLE} !bg-white dark:!bg-dark-card !rounded-xl !border-black/10 dark:!border-white/10 !text-sm font-bold uppercase tracking-tight`}>
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
            <div className="space-y-2">
              <label className="block text-xs font-bold tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary opacity-60">Group by</label>
              <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)} className={`${SELECT_STYLE} !bg-white dark:!bg-dark-card !rounded-xl !border-black/10 dark:!border-white/10 !text-sm font-bold uppercase tracking-tight`}>
                <option value="merchant">Merchant</option>
                <option value="category">Category</option>
              </select>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-dark-card flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full space-y-2">
            <label className="block text-xs font-bold tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary opacity-60">Save report settings</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-light-text-secondary text-[18px]">bookmark</span>
              <input 
                type="text" 
                value={reportName} 
                onChange={(e) => setReportName(e.target.value)} 
                className={`${INPUT_BASE_STYLE} !pl-12 !bg-black/5 dark:!bg-white/5 !border-none !rounded-xl !text-sm font-bold tracking-tight h-12`} 
                placeholder="Name this report view to save it..." 
              />
            </div>
          </div>
          <button onClick={handleSaveView} className={`${BTN_PRIMARY_STYLE} w-full md:w-auto h-12 !rounded-xl !px-8 flex items-center justify-center gap-2 group`}>
            <span className="material-symbols-outlined text-[20px] transition-transform group-hover:rotate-12">save</span>
            <span className="text-[11px] font-bold tracking-widest">Save settings</span>
          </button>
        </div>
      </Card>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 flex flex-col border border-black/5 dark:border-white/5 rounded-2xl shadow-xl p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none group-hover:bg-primary-500/10 transition-colors duration-500"></div>
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 relative z-10 gap-4">
            <div>
              <h2 className="text-xs font-bold tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary opacity-60 mb-1">Spending Velocity</h2>
              <p className="text-base font-bold text-light-text dark:text-dark-text tracking-tight">Daily intensity vs previous period</p>
            </div>
            <div className="flex items-center gap-6 bg-black/5 dark:bg-white/5 p-3 rounded-2xl border border-black/5 dark:border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-3 h-1.5 rounded-full bg-primary-500 shadow-sm shadow-primary-500/40" />
                <span className="text-[10px] font-bold tracking-widest text-light-text dark:text-dark-text opacity-60">Current</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-1.5 rounded-full bg-gray-300 dark:bg-white/20" />
                <span className="text-[10px] font-bold tracking-widest text-light-text dark:text-dark-text opacity-60">Previous</span>
              </div>
            </div>
          </div>
          <div className="h-[300px] w-full flex-1 relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={velocityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.05} />
                <XAxis 
                  dataKey="day" 
                  axisLine={false} 
                  tickLine={false} 
                  fontSize={10} 
                  tickFormatter={(val) => `D${val}`}
                  tick={{ fill: 'currentColor', opacity: 0.4, fontWeight: 'bold' }}
                />
                <YAxis axisLine={false} tickLine={false} fontSize={10} tick={{ fill: 'currentColor', opacity: 0.4, fontWeight: 'bold' }} tickFormatter={(val) => `€${val >= 1000 ? (val/1000).toFixed(1) + 'k' : val}`} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(99, 102, 241, 0.2)', strokeWidth: 2 }} />
                <Area type="monotone" dataKey="previous" name="Previous Period" stroke="currentColor" fill="transparent" strokeDasharray="6 4" strokeWidth={1.5} opacity={0.2} />
                <Area type="monotone" dataKey="current" name="Current Period" stroke="#6366F1" fillOpacity={1} fill="url(#colorCurrent)" strokeWidth={3} animationDuration={1500} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="flex flex-col border border-black/5 dark:border-white/5 rounded-2xl shadow-xl p-5 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[100px] -ml-32 -mt-32 pointer-events-none group-hover:bg-emerald-500/10 transition-colors duration-500"></div>
          
          <div className="mb-6 relative z-10">
            <h2 className="text-xs font-bold tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary opacity-60 mb-1">Allocation</h2>
            <p className="text-base font-bold text-light-text dark:text-dark-text tracking-tight">Top categories by volume</p>
          </div>

          <div className="h-[240px] w-full relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryTotals.slice(0, 5)}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={95}
                  paddingAngle={8}
                  dataKey="totalEur"
                  nameKey="category"
                  stroke="none"
                  animationDuration={1500}
                >
                  {categoryTotals.slice(0, 5).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#6366F1', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6'][index % 5]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[9px] font-bold tracking-[0.2em] opacity-40">Total</span>
              <span className="text-2xl font-bold tracking-tighter">€{totals.totalSpendEur.toFixed(0)}</span>
            </div>
          </div>

          <div className="mt-8 space-y-3 relative z-10">
            {categoryTotals.slice(0, 4).map((cat, i) => (
              <div key={cat.category} className="flex items-center justify-between p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 group/row hover:bg-white dark:hover:bg-dark-card transition-colors duration-300">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: ['#6366F1', '#10B981', '#F59E0B', '#EC4899'][i % 4] }} />
                  <span className="text-[10px] font-bold tracking-wider text-light-text dark:text-dark-text opacity-60 group-hover/row:opacity-100 transition-opacity">{cat.category}</span>
                </div>
                <span className="text-[11px] font-bold text-light-text dark:text-dark-text">€{cat.totalEur.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* Behavioral Insights & Merchant Loyalty */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Card className="h-fit flex flex-col border border-black/5 dark:border-white/5 rounded-2xl shadow-xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none transition-colors duration-500"></div>
            
            <div className="flex items-center justify-between mb-6 relative z-10">
              <div>
                <h2 className="text-xs font-bold tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary opacity-60 mb-1">Needs vs. wants</h2>
                <p className="text-base font-bold text-light-text dark:text-dark-text tracking-tight">50/30/20 Rule Analysis</p>
              </div>
              <div className={`px-4 py-2 rounded-xl text-[10px] font-bold tracking-[0.15em] border border-black/5 dark:border-white/5 ${savingsRate >= 20 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600 shadow-sm shadow-rose-500/10'}`}>
                {savingsRate >= 20 ? 'Balanced' : 'Over-Spending'}
              </div>
            </div>
          <div className="space-y-6 relative z-10">
            {needsWantsData.map(item => {
              const share = totals.totalSpendEur > 0 ? (item.value / totals.totalSpendEur) * 100 : 0;
              const isOver = share > item.target && item.name !== 'Others';
              return (
                <div key={item.name} className="space-y-3 group/item">
                  <div className="flex justify-between items-end">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-bold tracking-[0.1em] text-light-text dark:text-dark-text">{item.name}</span>
                        <div className="opacity-0 group-hover/item:opacity-100 transition-opacity duration-300">
                          <span className="text-[8px] font-bold text-light-text-secondary dark:text-dark-text-secondary bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-lg border border-black/5 dark:border-white/5 tracking-wider">
                            {(item as any).description}
                          </span>
                        </div>
                      </div>
                      <p className="text-[9px] opacity-40 font-bold tracking-widest leading-none">Target: {item.target}%</p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      <span className={`text-base font-bold tracking-tighter ${isOver ? 'text-rose-500 animate-pulse' : 'text-light-text dark:text-dark-text'}`}>{share.toFixed(1)}%</span>
                      <p className="text-[9px] opacity-40 font-bold tracking-widest leading-none">€{item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden flex shadow-inner">
                    <div 
                      className="h-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(0,0,0,0.1)]" 
                      style={{ width: `${share}%`, backgroundColor: item.color }} 
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-auto pt-10">
            <div className="p-5 bg-black/5 dark:bg-white/5 rounded-[1.5rem] border border-dashed border-black/10 dark:border-white/10 relative group-hover:border-primary-500/30 transition-colors">
              <div className="absolute top-4 right-4 text-primary-500/20 group-hover:text-primary-500/40 transition-colors">
                <span className="material-symbols-outlined text-2xl">auto_awesome</span>
              </div>
              <p className="text-[11px] font-bold leading-relaxed text-light-text-secondary dark:text-dark-text-secondary opacity-70 group-hover:opacity-100 transition-opacity">
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
                    return `Your "Needs" are ${needsShare.toFixed(1)}% of your expenses. Consider reviewing recurring bills to bring this closer to the 50% benchmark.`;
                  } else if (totals.totalSpendEur > 0) {
                    return `Excellent balance! Your spending follows the 50/30/20 rule perfectly. You're maintaining a healthy ratio.`;
                  }
                  return "Start tracking your expenses to see your personalized analysis.";
                })()}
              </p>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col border border-black/5 dark:border-white/5 rounded-[2rem] shadow-xl p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none transition-colors duration-500"></div>
          
          <div className="mb-10 relative z-10">
            <h2 className="text-xs font-bold tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary opacity-60 mb-1">Merchant loyalty</h2>
            <p className="text-base font-bold text-light-text dark:text-dark-text tracking-tight">Frequency vs. impact leaderboard</p>
          </div>
          
          <div className="space-y-5 relative z-10">
            {merchantLoyalty.map((m, i) => {
              const { merchantLogoUrl, showMerchantLogo, merchantInitial } = merchantVisual(m.label);
              return (
                <div key={m.label} className="flex items-center justify-between p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 group/row hover:bg-white dark:hover:bg-dark-card transition-all duration-300 hover:shadow-xl hover:shadow-black/5">
                  <div className="flex items-center gap-4">
                    <div className="text-xs font-bold opacity-20 group-hover/row:opacity-50 transition-opacity w-3">{i + 1}</div>
                    <div className={`w-12 h-12 rounded-[1rem] shrink-0 flex items-center justify-center overflow-hidden border border-black/5 dark:border-white/10 shadow-sm ${showMerchantLogo ? 'bg-white dark:bg-dark-card' : 'bg-primary-500/10 text-primary-600'}`}>
                      {showMerchantLogo && merchantLogoUrl ? (
                        <img src={merchantLogoUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" onError={() => handleLogoError(merchantLogoUrl)} />
                      ) : (
                        <span className="text-base font-bold">{merchantInitial}</span>
                      )}
                    </div>
                    <div>
                      <h4 className="text-[13px] font-bold tracking-tight truncate max-w-[150px] leading-none mb-2">{m.label}</h4>
                      <div className="flex items-center gap-3">
                        <span className="text-[9px] font-bold tracking-widest opacity-40">{m.count} visits</span>
                        <span className="w-0.5 h-0.5 rounded-full bg-black/20 dark:bg-white/20" />
                        <span className="text-[9px] font-bold tracking-widest opacity-40">€{m.avgPerVisit.toFixed(0)} avg</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end justify-center">
                    <div className="text-base font-bold tracking-tighter leading-none mb-1">€{m.totalEur.toFixed(0)}</div>
                    <div className="text-[8px] font-bold text-primary-500 tracking-widest px-2 py-0.5 rounded-full bg-primary-500/10">Score: {m.loyaltyScore.toFixed(0)}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-10 relative z-10">
            <button className="w-full py-4 rounded-2xl border border-dashed border-black/10 dark:border-white/10 text-[9px] font-bold tracking-[0.2em] opacity-40 hover:opacity-100 hover:border-primary-500/50 hover:bg-primary-500/5 transition-all">
              View detailed profile leaderboard
            </button>
          </div>
        </Card>
      </section>



      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10 mb-8">
        {/* Left Column: Detailed Breakdowns */}
        <div className="space-y-8">
          <Card className="!p-0 overflow-hidden border border-black/5 dark:border-white/5 rounded-[2rem] shadow-xl">
            <div className="p-8 border-b border-black/5 dark:border-white/10 flex items-center justify-between bg-black/5 dark:bg-white/5">
              <div>
                <h2 className="text-xs font-bold tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary opacity-60 mb-1">Spend breakdown</h2>
                <p className="text-base font-bold text-light-text dark:text-dark-text tracking-tight">By {groupBy}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-black/5 dark:border-white/10 bg-black/5 dark:bg-white/5">
                    <th className="py-5 px-8 font-bold text-xs tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary opacity-60">{groupBy === 'merchant' ? 'Merchant' : 'Category'}</th>
                    <th className="py-5 px-8 font-bold text-xs tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary opacity-60 text-right">Qty</th>
                    <th className="py-5 px-8 font-bold text-xs tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary opacity-60 text-right">Total</th>
                    <th className="py-5 px-8 font-bold text-xs tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary opacity-60 text-right">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                  {groupedRows.map(row => {
                    const share = totals.totalSpendEur > 0 ? (row.totalEur / totals.totalSpendEur) * 100 : 0;
                    const category = findCategoryByName(row.label, allCategories);
                    const { merchantLogoUrl, showMerchantLogo, merchantInitial } = merchantVisual(row.label);
                    return (
                      <tr key={row.label} className="group hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-300">
                        <td className="py-4 px-8">
                          {groupBy === 'merchant' ? (
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center overflow-hidden border border-black/5 dark:border-white/10 shadow-sm ${showMerchantLogo ? 'bg-white dark:bg-dark-card' : 'bg-primary-500/10 text-primary-600'}`}>
                                {showMerchantLogo && merchantLogoUrl ? (
                                  <img src={merchantLogoUrl} alt="" className="w-full h-full object-cover shadow-inner" referrerPolicy="no-referrer" onError={() => handleLogoError(merchantLogoUrl)} />
                                ) : (
                                  <span className="text-xs font-bold tracking-widest">{merchantInitial}</span>
                                )}
                              </div>
                              <span className="text-[13px] font-bold tracking-tight text-light-text dark:text-dark-text truncate max-w-[150px]">{row.label}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 flex items-center justify-center text-light-text-secondary">
                                <span className="material-symbols-outlined text-[20px]" style={{ color: category?.color }}>{category?.icon || 'category'}</span>
                              </div>
                              <span className="text-[13px] font-bold tracking-tight text-light-text dark:text-dark-text">{row.label}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-8 text-right font-bold text-xs opacity-40 tracking-widest">{row.count}</td>
                        <td className="py-4 px-8 text-right font-bold text-sm tracking-tighter privacy-blur tracking-widest">€{row.totalEur.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                        <td className="py-4 px-8 text-right">
                          <div className="flex items-center justify-end gap-4">
                            <div className="w-16 h-1.5 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 overflow-hidden shadow-inner">
                              <div className="h-full bg-primary-500 shadow-sm shadow-primary-500/40" style={{ width: `${share}%` }} />
                            </div>
                            <span className="text-[10px] font-bold text-light-text-secondary w-8 tracking-widest opacity-60">{share.toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {groupedRows.length === 0 && (
                <div className="p-20 text-center flex flex-col items-center gap-4 opacity-30">
                  <span className="material-symbols-outlined text-6xl">search_off</span>
                  <p className="text-[10px] font-bold tracking-[0.2em]">No transactions matched filters</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: Insights & Forecasts */}
        <div className="space-y-4">
          <Card className="bg-primary-600 dark:bg-primary-800 text-white border-none shadow-2xl rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 transition-transform group-hover:scale-125 duration-700">
              <span className="material-symbols-outlined text-[8rem]">lightbulb</span>
            </div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-[100px] -ml-24 -mb-24"></div>
            
            <div className="mb-4 relative z-10">
              <h2 className="text-xs font-bold tracking-[0.2em] text-white/60 mb-1">Smart Engine</h2>
              <p className="text-base font-bold tracking-tight text-white">AI-powered insights</p>
            </div>
            
            <div className="space-y-2 relative z-10">
              {insights.map((item, idx) => (
                <div key={item.id} className="flex items-start gap-4 bg-white/10 backdrop-blur-3xl rounded-xl p-4 border border-white/10 shadow-lg shadow-black/10 transition-transform hover:scale-[1.02] duration-300" 
                     style={{ animationDelay: `${idx * 150}ms` }}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-white/10 ${item.tone === 'warning' ? 'bg-amber-500/20 text-amber-300' : item.tone === 'positive' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/20 text-white'}`}>
                    <span className="material-symbols-outlined text-base">
                      {item.tone === 'warning' ? 'warning' : item.tone === 'positive' ? 'check_circle' : 'info'}
                    </span>
                  </div>
                  <p className="text-xs font-bold leading-relaxed privacy-blur drop-shadow-sm">{item.text}</p>
                </div>
              ))}
              {insights.length === 0 && <p className="text-[11px] font-bold tracking-widest opacity-60 text-center py-6">Listening for financial signals...</p>}
            </div>
          </Card>

          <Card className="!p-0 overflow-hidden border border-black/5 dark:border-white/5 bg-white dark:bg-dark-card rounded-2xl shadow-xl group">
            <div className="p-5 border-b border-black/5 dark:border-white/10 bg-black/5 dark:bg-white/5 flex items-center justify-between">
              <p className="text-xs font-bold tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary opacity-60">Month-end forecast</p>
              <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse shadow-sm shadow-primary-500/50"></div>
            </div>
            <div className="p-5 relative">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary-500/5 rounded-full blur-[60px] pointer-events-none"></div>
              {forecast ? (
                <div className="space-y-6 relative z-10">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold tracking-[0.2em] text-light-text-secondary mb-1 opacity-60">Projected total</p>
                      <h4 className="text-3xl font-bold tracking-tighter privacy-blur leading-none">€{forecast.projectedMonthEnd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h4>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold tracking-[0.2em] text-light-text-secondary mb-1 opacity-60">Daily burn</p>
                      <p className="text-xl font-bold tracking-tighter privacy-blur leading-none">€{forecast.dailyAverage.toFixed(0)}<span className="text-[10px] font-bold opacity-30 tracking-widest ml-1">/d</span></p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-[9px] font-bold tracking-[0.15em] opacity-60 privacy-blur">
                      <span>MTD: €{forecast.mtdSpendEur.toLocaleString()}</span>
                      <span>Runway: €{(forecast.projectedMonthEnd - forecast.mtdSpendEur).toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 overflow-hidden flex shadow-inner">
                      <div className="h-full bg-primary-500 shadow-sm shadow-primary-500/40 transition-all duration-1000" style={{ width: `${(forecast.mtdSpendEur / forecast.projectedMonthEnd) * 100}%` }} />
                    </div>
                    <div className="flex items-center justify-center gap-2">
                       <span className="material-symbols-outlined text-[12px] opacity-30">calendar_month</span>
                       <p className="text-[8px] text-light-text-secondary font-bold tracking-[0.2em] opacity-40">
                         {forecast.remainingDays} Days remaining in cycle
                       </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center flex flex-col items-center gap-2 opacity-30">
                  <span className="material-symbols-outlined text-3xl">query_stats</span>
                  <p className="text-[10px] font-bold tracking-[0.2em]">Projection data pending</p>
                </div>
              )}
            </div>
          </Card>

          <Card className="!p-0 overflow-hidden border border-black/5 dark:border-white/5 bg-white dark:bg-dark-card rounded-2xl shadow-xl group">
            <div className="p-5 border-b border-black/5 dark:border-white/10 bg-black/5 dark:bg-white/5 flex items-center justify-between">
              <p className="text-xs font-bold tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary opacity-60">Anomalies & outliers</p>
              <div className="w-10 h-1 rounded-full bg-rose-500/20"></div>
            </div>
            <div className="p-4 space-y-2">
              {anomalyCandidates.map(row => (
                <div key={row.id} className="flex items-center justify-between p-3 rounded-xl border border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5 hover:bg-white dark:hover:bg-dark-card transition-all duration-300 hover:shadow-lg hover:shadow-black/5 group/anomaly">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0 border border-rose-500/10 group-hover/anomaly:scale-110 transition-transform">
                      <span className="material-symbols-outlined text-xl">warning</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold tracking-tight truncate max-w-[120px] leading-none mb-1">{row.merchant}</p>
                      <p className="text-[8px] text-light-text-secondary font-bold tracking-widest opacity-40">{row.date}</p>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <p className="text-xs font-bold tracking-tighter privacy-blur leading-none">€{row.amountEur.toFixed(2)}</p>
                    <p className="text-[7px] text-rose-500 font-bold tracking-widest px-1.5 py-0.5 rounded-full bg-rose-500/10 mt-1">{row.zScore.toFixed(1)}σ</p>
                  </div>
                </div>
              ))}
              {anomalyCandidates.length === 0 && (
                <div className="p-6 text-center flex flex-col items-center gap-2 opacity-30">
                  <span className="material-symbols-outlined text-3xl">verified</span>
                  <p className="text-[10px] font-bold tracking-[0.2em]">All data within normal range</p>
                </div>
              )}
            </div>
          </Card>

          <Card className="!p-0 overflow-hidden border border-black/5 dark:border-white/5 bg-white dark:bg-dark-card rounded-2xl shadow-xl group">
            <div className="p-5 border-b border-black/5 dark:border-white/10 bg-black/5 dark:bg-white/5 flex items-center justify-between">
              <p className="text-xs font-bold tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary opacity-60">Recurring patterns</p>
              <span className="material-symbols-outlined text-base opacity-20">autorenew</span>
            </div>
            <div className="p-5 space-y-4">
              {recurringCandidates.slice(0, 5).map(candidate => (
                <div key={candidate.merchant} className="flex items-center justify-between group/recurring">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary-500/10 text-primary-500 flex items-center justify-center shrink-0 border border-primary-500/10 group-hover/recurring:rotate-12 transition-transform">
                      <span className="material-symbols-outlined text-base">event_repeat</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold tracking-tight leading-none mb-1">{candidate.merchant}</p>
                      <p className="text-[8px] text-light-text-secondary font-bold tracking-widest opacity-40">{candidate.frequency}</p>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <p className="text-xs font-bold tracking-tighter privacy-blur leading-none">€{candidate.estimatedMonthlyEur.toFixed(0)}<span className="text-[8px] font-bold opacity-30 ml-0.5">/mo</span></p>
                    <p className="text-[7px] text-light-text-secondary font-bold tracking-widest opacity-40 mt-1">{candidate.occurrences} hits</p>
                  </div>
                </div>
              ))}
              {recurringCandidates.length === 0 && (
                <div className="p-6 text-center flex flex-col items-center gap-2 opacity-30">
                  <span className="material-symbols-outlined text-3xl">fingerprint</span>
                  <p className="text-[10px] font-bold tracking-[0.2em]">Monitoring for patterns</p>
                </div>
              )}
            </div>
          </Card>
          <Card className="!p-0 overflow-hidden border border-black/5 dark:border-white/5 bg-white dark:bg-dark-card rounded-2xl shadow-xl relative group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary-500/5 rounded-full blur-[60px] pointer-events-none"></div>
            <div className="p-6 border-b border-black/5 dark:border-white/10 flex items-center justify-between bg-black/5 dark:bg-white/5">
               <div className="relative z-10">
                <p className="text-xs font-bold tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary opacity-60 mb-0.5">Performance</p>
                <h2 className="text-sm font-bold tracking-tight">Budget vs actual</h2>
              </div>
              <button 
                onClick={() => { setCategoryFilter('all'); setMerchantFilter(''); }} 
                className="relative z-10 text-[9px] font-bold tracking-[0.1em] text-primary-500 hover:text-primary-600 bg-primary-500/5 px-3 py-1.5 rounded-lg transition-all hover:bg-primary-500/10 active:scale-95"
              >
                Reset
              </button>
            </div>
            <div className="overflow-x-auto relative z-10">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-black/5 dark:border-white/10 bg-black/5 dark:bg-white/5">
                    <th className="py-2 px-4 font-bold text-xs tracking-[0.15em] text-light-text-secondary opacity-60">Category</th>
                    <th className="py-2 px-4 font-bold text-xs tracking-[0.15em] text-light-text-secondary opacity-60 text-right">Limit</th>
                    <th className="py-2 px-4 font-bold text-xs tracking-[0.15em] text-light-text-secondary opacity-60 text-right">Actual</th>
                    <th className="py-2 px-4 font-bold text-xs tracking-[0.15em] text-light-text-secondary opacity-60 text-right">Delta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                  {budgetVsActual.map(row => (
                    <tr key={row.categoryName} className="group hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-300">
                      <td className="py-2 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 flex items-center justify-center text-light-text-secondary group-hover:bg-white dark:group-hover:bg-neutral-800 transition-colors shadow-sm">
                            <span className="material-symbols-outlined text-[16px]">
                              {findCategoryByName(row.categoryName, allCategories)?.icon || 'category'}
                            </span>
                          </div>
                          <span className="text-xs font-bold tracking-tight">{row.categoryName}</span>
                        </div>
                      </td>
                      <td className="py-2 px-4 text-right font-bold text-[10px] opacity-40 tracking-widest">€{row.budgetEur.toFixed(0)}</td>
                      <td className="py-2 px-4 text-right font-bold text-xs tracking-tighter">€{row.actualEur.toFixed(0)}</td>
                      <td className={`py-2 px-4 text-right`}>
                        <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-widest shadow-sm ${row.varianceEur >= 0 ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/10' : 'bg-rose-500/10 text-rose-600 border border-rose-500/10'}`}>
                          {row.varianceEur >= 0 ? '+' : ''}€{row.varianceEur.toFixed(0)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {budgetVsActual.length === 0 && (
                <div className="p-10 text-center flex flex-col items-center gap-3 opacity-30">
                  <span className="material-symbols-outlined text-4xl">list_alt_off</span>
                  <p className="text-[10px] font-bold tracking-[0.2em]">No budget configurations detected</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

    </div>
  );
};

export default Reports;
