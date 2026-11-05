import { getMainCurrency } from '../utils';
import type { Budget, Category, Transaction } from '../types';
import { convertToMain, formatCurrency, parseLocalDate, toLocalISOString } from '../utils';

export type GroupBy = 'merchant' | 'category';

export interface ReportFilters {
  startDate: string;
  endDate: string;
  merchant: string;
  category: string;
  accountId: string;
}

export interface SavedReportView extends ReportFilters {
  id: string;
  name: string;
  groupBy: GroupBy;
}

export type ReportId = 'summary' | 'spending' | 'categories' | 'usual' | 'needs' | 'breakdown' | 'cashflow' | 'budget' | 'recurring' | 'unusual' | 'forecast';

export const NO_FILTERS = { merchant: '', category: 'all', accountId: 'all' };
export const MAX_SAVED_VIEWS = 15;
const USUAL_PERIODS = 3;
const AVERAGE_MONTH_DAYS = 30.44;

const NEEDS = ['Housing', 'Bills & Utilities', 'Utilities', 'Groceries', 'Supermarket', 'Transportation', 'Public Transport', 'Transport', 'Insurance', 'Health', 'Rent', 'Mortgage', 'Medical', 'Pharmacy', 'Childcare', 'School Fees', 'Tuition', 'Taxes', 'Maintenance', 'Repair'];
const WANTS = ['Dining', 'Cafes', 'Takeaway', 'Entertainment', 'Shopping', 'Lifestyle', 'Travel', 'Flights', 'Accommodation', 'Hobbies', 'Gifts', 'Subscriptions', 'Streaming', 'Fitness', 'Gym', 'Beauty', 'Electronics', 'Clothing', 'Concert', 'Sports', 'Activities'];

export const addDays = (date: string, days: number) => {
  const day = parseLocalDate(date);
  return toLocalISOString(new Date(day.getFullYear(), day.getMonth(), day.getDate() + days));
};

/** Days from start to end, both included. */
export const daysBetween = (startDate: string, endDate: string) =>
  Math.max(1, Math.round((parseLocalDate(endDate).getTime() - parseLocalDate(startDate).getTime()) / 86400000) + 1);

const amountOf = (tx: Transaction) => Math.abs(convertToMain(tx.amount, tx.currency));
const merchantOf = (tx: Transaction, fallback = 'Unknown merchant') => tx.merchant?.trim() || tx.description || fallback;
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

const isCounted = (tx: Transaction, showAdjustments: boolean) =>
  !tx.isSplitParent && !tx.isCombinedParent && (showAdjustments || !tx.isBalanceAdjustment) && !tx.transferId;

const collectDescendantNames = (cat: Category, out: Set<string>) => {
  out.add(cat.name);
  (cat.subCategories ?? []).forEach(sub => collectDescendantNames(sub, out));
};

const findCategoryNode = (categories: Category[], name: string): Category | undefined => {
  for (const cat of categories) {
    if (cat.name === name) return cat;
    const found = findCategoryNode(cat.subCategories ?? [], name);
    if (found) return found;
  }
  return undefined;
};

export const categoryMatches = (txCategory: string, targetCategory: string, categories?: Category[]): boolean => {
  if (targetCategory === 'all' || txCategory === targetCategory) return true;
  if (!categories || categories.length === 0) return false;
  const node = findCategoryNode(categories, targetCategory);
  if (!node) return false;
  const descendants = new Set<string>();
  collectDescendantNames(node, descendants);
  return descendants.has(txCategory);
};

export const inScope = (tx: Transaction, filters: ReportFilters, categories?: Category[]) => {
  if (filters.accountId !== 'all' && tx.accountId !== filters.accountId) return false;
  if (filters.category !== 'all' && !categoryMatches(tx.category, filters.category, categories)) return false;
  const query = filters.merchant.trim().toLowerCase();
  return !query || (tx.merchant || tx.description || '').toLowerCase().includes(query);
};

/** Spending in a period. Comparisons use this too, so they cover the same accounts, categories and merchants. */
export const expensesIn = (
  transactions: Transaction[],
  filters: ReportFilters,
  showAdjustments: boolean,
  startDate = filters.startDate,
  endDate = filters.endDate,
  categories?: Category[],
) =>
  transactions.filter(tx => tx.type === 'expense' && isCounted(tx, showAdjustments) && tx.date >= startDate && tx.date <= endDate && inScope(tx, filters, categories));

const totalOf = (rows: Transaction[]) => sum(rows.map(amountOf));

const categoryTotals = (rows: Transaction[]) => {
  const totals = new Map<string, number>();
  rows.forEach(tx => totals.set(tx.category, (totals.get(tx.category) || 0) + amountOf(tx)));
  return totals;
};

/** Ready-made reports: the year so far, this month so far and the five months before it (D-027). */
export const automaticReports = (today: string, financialYearStartMonth = 1) => {
  const now = parseLocalDate(today);
  const monthName = (date: Date) => date.toLocaleDateString('en', { month: 'long', year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
  const yearStart = new Date(now.getMonth() + 1 >= financialYearStartMonth ? now.getFullYear() : now.getFullYear() - 1, financialYearStartMonth - 1, 1);
  const reports = [
    { id: 'year', name: 'Year to date', startDate: toLocalISOString(yearStart), endDate: today },
    { id: 'month-0', name: `${monthName(now)} so far`, startDate: toLocalISOString(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: today },
  ];
  for (let back = 1; back <= 5; back++) {
    const first = new Date(now.getFullYear(), now.getMonth() - back, 1);
    reports.push({ id: `month-${back}`, name: monthName(first), startDate: toLocalISOString(first), endDate: toLocalISOString(new Date(first.getFullYear(), first.getMonth() + 1, 0)) });
  }
  return reports;
};

/** Daily spending from start to end, for a tile's sparkline. */
export const dailySpend = (rows: Transaction[], startDate: string, endDate: string) => {
  const byDay = new Map<string, number>();
  rows.forEach(tx => byDay.set(tx.date, (byDay.get(tx.date) || 0) + amountOf(tx)));
  return Array.from({ length: daysBetween(startDate, endDate) }, (_, index) => ({ value: byDay.get(addDays(startDate, index)) || 0 }));
};

export const spendingVelocity = (rows: Transaction[], previous: Transaction[], startDate: string, endDate: string) => {
  const days = daysBetween(startDate, endDate);
  const previousStart = addDays(startDate, -days);
  const byDay = new Map<string, number>();
  rows.forEach(tx => byDay.set(tx.date, (byDay.get(tx.date) || 0) + amountOf(tx)));
  const byOffset = new Map<number, number>();
  previous.forEach(tx => {
    const offset = daysBetween(previousStart, tx.date) - 1;
    byOffset.set(offset, (byOffset.get(offset) || 0) + amountOf(tx));
  });
  return Array.from({ length: days }, (_, index) => ({ day: index + 1, date: addDays(startDate, index), current: byDay.get(addDays(startDate, index)) || 0, previous: byOffset.get(index) || 0 }));
};

/** Each category against its average over the three periods before, counting only periods with spending. */
export const comparedWithUsual = (rows: Transaction[], transactions: Transaction[], filters: ReportFilters, showAdjustments: boolean, categories?: Category[]) => {
  const days = daysBetween(filters.startDate, filters.endDate);
  const past = Array.from({ length: USUAL_PERIODS }, (_, index) => {
    const end = addDays(filters.startDate, -(days * index) - 1);
    return categoryTotals(expensesIn(transactions, filters, showAdjustments, addDays(end, -(days - 1)), end, categories));
  }).filter(period => period.size > 0);
  if (past.length === 0) return [];
  const actual = categoryTotals(rows);
  const names = new Set([...actual.keys(), ...past.flatMap(period => [...period.keys()])]);
  return [...names].map(category => {
    const usual = sum(past.map(period => period.get(category) || 0)) / past.length;
    const spent = actual.get(category) || 0;
    return { category, spent, usual, difference: spent - usual };
  }).sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
};

export const needsAndWants = (rows: Transaction[]) => {
  const includes = (list: string[], category: string) => list.some(name => category.toLowerCase().includes(name.toLowerCase()));
  const parts = { Needs: 0, Wants: 0, Others: 0 };
  rows.forEach(tx => {
    const category = tx.category || '';
    parts[includes(NEEDS, category) ? 'Needs' : includes(WANTS, category) ? 'Wants' : 'Others'] += amountOf(tx);
  });
  if (parts.Needs + parts.Wants + parts.Others === 0) return [];
  return [
    { name: 'Needs', value: parts.Needs, target: 50, description: 'Housing, groceries, utilities and health' },
    { name: 'Wants', value: parts.Wants, target: 30, description: 'Dining, travel, shopping and entertainment' },
    { name: 'Others', value: parts.Others, target: 20, description: 'Uncategorised, investments and the rest' },
  ];
};

export const groupedSpend = (rows: Transaction[], groupBy: GroupBy) => {
  const groups = new Map<string, { label: string; totalEur: number; count: number }>();
  rows.forEach(tx => {
    const label = groupBy === 'merchant' ? merchantOf(tx) : tx.category || 'Uncategorized';
    const group = groups.get(label) || { label, totalEur: 0, count: 0 };
    group.totalEur += amountOf(tx);
    group.count += 1;
    groups.set(label, group);
  });
  return [...groups.values()].sort((a, b) => b.totalEur - a.totalEur);
};

export const merchantLoyalty = (rows: Transaction[]) =>
  groupedSpend(rows, 'merchant')
    .map(merchant => ({ ...merchant, avgPerVisit: merchant.totalEur / merchant.count, loyaltyScore: merchant.count * 0.7 + merchant.totalEur * 0.001 }))
    .sort((a, b) => b.loyaltyScore - a.loyaltyScore)
    .slice(0, 5);

/** How many monthly budgets fit the period: whole calendar months count as they are, anything else by days. */
export const monthsInPeriod = (startDate: string, endDate: string) => {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  const endsMonth = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate() === end.getDate();
  if (start.getDate() === 1 && endsMonth) return (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1;
  return daysBetween(startDate, endDate) / AVERAGE_MONTH_DAYS;
};

export const budgetAgainstActual = (rows: Transaction[], budgets: Budget[], startDate: string, endDate: string, categories?: Category[]) => {
  const actual = categoryTotals(rows);
  const months = monthsInPeriod(startDate, endDate);
  return budgets.map(budget => {
    const monthlyBudgetEur = Math.abs(convertToMain(budget.amount, budget.currency));
    const budgetEur = monthlyBudgetEur * months;
    let actualEur = 0;
    if (categories && categories.length > 0) {
      actual.forEach((val, catName) => {
        if (categoryMatches(catName, budget.categoryName, categories)) {
          actualEur += val;
        }
      });
    } else {
      actualEur = actual.get(budget.categoryName) || 0;
    }
    return { categoryName: budget.categoryName, budgetEur, actualEur, varianceEur: budgetEur - actualEur };
  }).sort((a, b) => a.varianceEur - b.varianceEur);
};

export const recurringPatterns = (rows: Transaction[]) => {
  const byMerchant = new Map<string, { date: string; amountEur: number }[]>();
  rows.forEach(tx => {
    const merchant = merchantOf(tx);
    byMerchant.set(merchant, [...(byMerchant.get(merchant) || []), { date: tx.date, amountEur: amountOf(tx) }]);
  });
  const results: { merchant: string; frequency: string; averageEur: number; estimatedMonthlyEur: number; occurrences: number }[] = [];
  byMerchant.forEach((visits, merchant) => {
    if (visits.length < 3) return;
    const sorted = [...visits].sort((a, b) => a.date.localeCompare(b.date));
    const gaps = sorted.slice(1).map((visit, index) => daysBetween(sorted[index].date, visit.date) - 1).filter(gap => gap > 0);
    if (gaps.length < 2) return;
    const averageGap = sum(gaps) / gaps.length;
    const pattern = averageGap >= 25 && averageGap <= 35 ? ['Monthly', 1] as const
      : averageGap >= 12 && averageGap <= 16 ? ['Every two weeks', 2.17] as const
      : averageGap >= 6 && averageGap <= 8 ? ['Weekly', 4.33] as const : null;
    if (!pattern) return;
    const averageEur = sum(sorted.map(visit => visit.amountEur)) / sorted.length;
    results.push({ merchant, frequency: pattern[0], averageEur, estimatedMonthlyEur: averageEur * pattern[1], occurrences: sorted.length });
  });
  return results.sort((a, b) => b.estimatedMonthlyEur - a.estimatedMonthlyEur);
};

export const unusualSpending = (rows: Transaction[]) => {
  if (rows.length < 8) return [];
  const amounts = rows.map(amountOf);
  const mean = sum(amounts) / amounts.length;
  const deviation = Math.sqrt(sum(amounts.map(value => (value - mean) ** 2)) / amounts.length);
  if (deviation === 0) return [];
  return rows
    .map(tx => ({ id: tx.id, date: tx.date, merchant: merchantOf(tx), category: tx.category, amountEur: amountOf(tx), zScore: (amountOf(tx) - mean) / deviation }))
    .filter(row => row.zScore >= 2)
    .sort((a, b) => b.zScore - a.zScore)
    .slice(0, 10);
};

/** The month of the period's end, projected from its daily average so far. A period ending later than today stops at today. */
export const monthEndForecast = (transactions: Transaction[], filters: ReportFilters, showAdjustments: boolean, today: string, categories?: Category[]) => {
  const last = filters.endDate > today ? today : filters.endDate;
  const end = parseLocalDate(last);
  const monthStart = toLocalISOString(new Date(end.getFullYear(), end.getMonth(), 1));
  const totalDays = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
  const mtdSpendEur = totalOf(expensesIn(transactions, filters, showAdjustments, monthStart, last, categories));
  const dailyAverage = mtdSpendEur / end.getDate();
  const remainingDays = totalDays - end.getDate();
  return { mtdSpendEur, dailyAverage, projectedMonthEnd: mtdSpendEur + dailyAverage * remainingDays, remainingDays };
};

export const buildReport = (
  transactions: Transaction[],
  budgets: Budget[],
  filters: ReportFilters,
  showAdjustments: boolean,
  groupBy: GroupBy,
  today: string,
  categoriesList?: Category[],
) => {
  const { startDate, endDate } = filters;
  const days = daysBetween(startDate, endDate);
  const rows = expensesIn(transactions, filters, showAdjustments, startDate, endDate, categoriesList);
  const previousRows = expensesIn(transactions, filters, showAdjustments, addDays(startDate, -days), addDays(startDate, -1), categoriesList);
  const totalSpend = totalOf(rows);
  const previousSpend = totalOf(previousRows);
  const income = sum(transactions
    .filter(tx => tx.type === 'income' && isCounted(tx, showAdjustments) && tx.date >= startDate && tx.date <= endDate && inScope(tx, filters, categoriesList))
    .map(amountOf));
  const categories = [...categoryTotals(rows).entries()].map(([category, totalEur]) => ({ category, totalEur })).sort((a, b) => b.totalEur - a.totalEur);
  const recurring = recurringPatterns(rows);
  return {
    rows,
    totalSpend,
    previousSpend,
    income,
    changePct: previousSpend > 0 ? ((totalSpend - previousSpend) / previousSpend) * 100 : null,
    savingsRate: income > 0 ? ((income - totalSpend) / income) * 100 : 0,
    count: rows.length,
    average: rows.length > 0 ? totalSpend / rows.length : 0,
    recurringImpact: sum(recurring.map(item => item.estimatedMonthlyEur)),
    categories,
    velocity: spendingVelocity(rows, previousRows, startDate, endDate),
    usual: comparedWithUsual(rows, transactions, filters, showAdjustments, categoriesList),
    needs: needsAndWants(rows),
    groups: groupedSpend(rows, groupBy),
    loyalty: merchantLoyalty(rows),
    budget: budgetAgainstActual(rows, budgets, startDate, endDate, categoriesList),
    recurring,
    unusual: unusualSpending(rows),
    forecast: monthEndForecast(transactions, filters, showAdjustments, today, categoriesList),
  };
};

export const exportReportCsv = (report: Report, filters: ReportFilters): string => {
  const escape = (val: string | number) => {
    const str = String(val ?? '');
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = [
    ['Period Start', 'Period End', 'Total Spend (EUR)', 'Total Income (EUR)', 'Savings Rate (%)', 'Transactions Count'].map(escape).join(','),
    [filters.startDate, filters.endDate, report.totalSpend.toFixed(2), report.income.toFixed(2), report.savingsRate.toFixed(1), report.count].map(escape).join(','),
    '',
    ['Date', 'Merchant / Description', 'Category', 'Amount', 'Currency', 'Amount (EUR)'].map(escape).join(','),
    ...report.rows.map(tx => [
      tx.date,
      tx.merchant || tx.description,
      tx.category,
      tx.amount,
      tx.currency,
      amountOf(tx).toFixed(2),
    ].map(escape).join(',')),
  ];
  return lines.join('\n');
};

export type Report = ReturnType<typeof buildReport>;

const eur = (value: number) => formatCurrency(value, getMainCurrency());
const percent = (value: number) => `${value.toFixed(1)}%`;

/** Rule-based observations (`RPT-09`). */
export const reportInsights = (report: Report) => {
  const lines: string[] = [];
  if (report.changePct !== null && report.changePct > 15) lines.push(`Spending is up ${percent(report.changePct)} on the period before.`);
  if (report.changePct !== null && report.changePct < -10) lines.push(`Spending is down ${percent(Math.abs(report.changePct))} on the period before.`);
  const top = report.categories[0];
  if (top && report.totalSpend > 0) lines.push(`${top.category} is ${percent((top.totalEur / report.totalSpend) * 100)} of what you spent.`);
  const recurring = report.recurring[0];
  if (recurring) lines.push(`${recurring.merchant} is your biggest repeat cost, about ${eur(recurring.estimatedMonthlyEur)} a month.`);
  lines.push(`At this pace the month ends on ${eur(report.forecast.projectedMonthEnd)}.`);
  return lines.slice(0, 4);
};

/** A tile's headline and the report's "What it says" sentence (D-027). */
export const reportTiles = (report: Report): Record<ReportId, { value: string; says: string }> => {
  const biggestGap = report.usual[0];
  const over = report.budget.filter(row => row.varianceEur < 0);
  const needs = report.needs.find(part => part.name === 'Needs');
  const needsShare = needs ? (needs.value / report.totalSpend) * 100 : 0;
  const topGroup = report.groups[0];
  const topCategory = report.categories[0];
  return {
    summary: {
      value: eur(report.totalSpend),
      says: report.count === 0 ? 'There is no spending in this period.' : `You spent ${eur(report.totalSpend)} across ${report.count} payments, about ${eur(report.average)} each.`,
    },
    spending: {
      value: report.changePct === null ? 'No comparison' : `${report.changePct >= 0 ? '+' : '−'}${percent(Math.abs(report.changePct))}`,
      says: report.changePct === null ? 'There is nothing in the period before to compare with.' : `That is ${eur(Math.abs(report.totalSpend - report.previousSpend))} ${report.totalSpend >= report.previousSpend ? 'more' : 'less'} than the same number of days before.`,
    },
    categories: {
      value: topCategory?.category ?? 'None',
      says: topCategory ? `${topCategory.category} took ${percent((topCategory.totalEur / Math.max(report.totalSpend, 1)) * 100)} of your spending, out of ${report.categories.length} categories.` : 'There is no spending in this period.',
    },
    usual: {
      value: biggestGap ? `${biggestGap.difference >= 0 ? '+' : '−'}${eur(Math.abs(biggestGap.difference))}` : 'No history',
      says: biggestGap ? `${biggestGap.category} moved most: ${eur(Math.abs(biggestGap.difference))} ${biggestGap.difference >= 0 ? 'over' : 'under'} your usual.` : 'Usual spending needs at least one earlier period with spending.',
    },
    needs: {
      value: needs ? `${needsShare.toFixed(0)}% needs` : 'None',
      says: needs ? `Needs took ${needsShare.toFixed(0)}% of spending, against a guide of 50%. The split comes from category names.` : 'There is no spending in this period.',
    },
    breakdown: {
      value: topGroup?.label ?? 'None',
      says: topGroup ? `${topGroup.label} leads with ${eur(topGroup.totalEur)} over ${topGroup.count} ${topGroup.count === 1 ? 'payment' : 'payments'}.` : 'There is no spending in this period.',
    },
    cashflow: {
      value: eur(report.income - report.totalSpend),
      says: `${eur(report.income)} came in and ${eur(report.totalSpend)} went out.`,
    },
    budget: {
      value: report.budget.length === 0 ? 'No budgets' : `${over.length} over`,
      says: report.budget.length === 0 ? 'You have no budgets yet.' : `${over.length} of ${report.budget.length} budgets went over. Monthly limits are scaled to this period.`,
    },
    recurring: {
      value: `${eur(report.recurringImpact)} a month`,
      says: report.recurring.length === 0 ? 'Nothing here repeats on a steady schedule.' : `${report.recurring.length} ${report.recurring.length === 1 ? 'merchant repeats' : 'merchants repeat'} on a steady schedule.`,
    },
    unusual: {
      value: `${report.unusual.length} found`,
      says: report.unusual.length === 0 ? 'Nothing stands out, or there are too few payments to tell.' : 'These payments are far above your average in this period.',
    },
    forecast: {
      value: eur(report.forecast.projectedMonthEnd),
      says: `You've spent ${eur(report.forecast.mtdSpendEur)} this month at about ${eur(report.forecast.dailyAverage)} a day, with ${report.forecast.remainingDays} days left.`,
    },
  };
};
