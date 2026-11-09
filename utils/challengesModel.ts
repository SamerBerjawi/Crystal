import type { Account, Budget, Category, FinancialGoal, InvestmentTransaction, LoanPaymentOverrides, Membership, Prediction, RecurringTransaction, BillPayment, Transaction, UserStats } from '../types';
import { LIQUID_ACCOUNT_TYPES, DEBT_TYPES } from '../constants';
import { calculateAccountTotals, convertCurrency, convertToEur, formatCurrency, getMainCurrency, generateAmortizationSchedule, parseLocalDate, toLocalISOString } from '../utils';
import { categoryMatches } from './reportsModel';

const eurOf = (amount: number, currency: Transaction['currency']) => convertToEur(amount, currency);
const clamp = (value: number, max: number) => Math.min(max, Math.max(0, value));
const isSpend = (tx: Transaction) => tx.type === 'expense' && !tx.transferId && !tx.isSplitParent && !tx.isCombinedParent && !tx.isBalanceAdjustment;
const openAccounts = (accounts: Account[]) => accounts.filter(account => account.status !== 'closed');

export const analyticsOnly = (accounts: Account[], transactions: Transaction[]) => {
  const included = accounts.filter(account => account.includeInAnalytics ?? true);
  const ids = new Set(included.map(account => account.id));
  return {
    accounts: included,
    transactions: transactions.filter(tx => ids.has(tx.accountId) && !tx.isSplitParent && !tx.isCombinedParent && !tx.isBalanceAdjustment),
  };
};

const hasDescendant = (cat: Category, name: string): boolean =>
  cat.name === name || (cat.subCategories ?? []).some(sub => hasDescendant(sub, name));

const parentName = (category: string, expenseCategories: Category[]) =>
  expenseCategories.find(parent => hasDescendant(parent, category))?.name ?? category;

export const challengeMetrics = (accounts: Account[], transactions: Transaction[], budgets: Budget[], expenseCategories: Category[], now: Date) => {
  const analytics = analyticsOnly(accounts, transactions);
  const totals = calculateAccountTotals(openAccounts(accounts));
  const totalDebt = eurOf(totals.totalDebt, getMainCurrency());
  const netWorth = eurOf(totals.netWorth, getMainCurrency());
  const creditCardDebt = eurOf(totals.creditCardDebt, getMainCurrency());
  const totalLimit = accounts.filter(account => account.type === 'Credit Card' && account.status !== 'closed').reduce((sum, card) => sum + eurOf(card.creditLimit || 0, card.currency), 0);
  const creditUtilization = totalLimit > 0 ? (creditCardDebt / totalLimit) * 100 : 0;

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  let income = 0;
  let expense = 0;
  const spendingByCategory: Record<string, number> = {};
  analytics.transactions.forEach(tx => {
    if (parseLocalDate(tx.date) < monthStart || tx.transferId) return;
    const value = eurOf(tx.amount, tx.currency);
    if (tx.type === 'income') income += value;
    if (tx.type === 'expense') {
      expense += Math.abs(value);
      const name = parentName(tx.category, expenseCategories);
      spendingByCategory[name] = (spendingByCategory[name] || 0) + Math.abs(value);
    }
  });
  const savingsRate = income > 0 ? (income - expense) / income : 0;

  const limitOf = (budget: Budget) => eurOf(budget.amount, budget.currency);
  const measured = budgets.filter(budget => budget.amount > 0);
  const budgetVariance = measured.length > 0 ? measured.reduce((sum, budget) => sum + Math.abs(limitOf(budget) - (spendingByCategory[budget.categoryName] || 0)) / limitOf(budget), 0) / measured.length : 1;

  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const recentSpend = analytics.transactions.filter(tx => parseLocalDate(tx.date) >= threeMonthsAgo && isSpend(tx)).reduce((sum, tx) => sum + Math.abs(eurOf(tx.amount, tx.currency)), 0);
  const averageMonthlySpend = recentSpend / 3;
  const liquidAssets = analytics.accounts.filter(account => LIQUID_ACCOUNT_TYPES.includes(account.type)).reduce((sum, account) => sum + eurOf(account.balance, account.currency), 0);

  return {
    totalDebt,
    netWorth,
    creditUtilization,
    savingsRate,
    budgetVariance,
    spendingByCategory,
    liquidityRatio: averageMonthlySpend > 0 ? liquidAssets / averageMonthlySpend : 0,
    totalInvestments: analytics.accounts.filter(account => account.type === 'Investment' && account.status !== 'closed').reduce((sum, account) => sum + eurOf(account.balance, account.currency), 0),
    accountTypes: new Set(openAccounts(analytics.accounts).map(account => account.type)).size,
  };
};

export type ChallengeMetrics = ReturnType<typeof challengeMetrics>;

/** Up to 100: savings rate 30, liquidity 30, debt 20, asset mix 20 (`CHL-01`). */
export const healthScore = (metrics: ChallengeMetrics) => {
  const factors = [
    { id: 'savings', label: 'Savings rate', score: clamp(metrics.savingsRate * 150, 30), max: 30, value: `${(metrics.savingsRate * 100).toFixed(1)}%`, icon: 'savings' },
    { id: 'liquidity', label: 'Cash runway', score: clamp(metrics.liquidityRatio * 10, 30), max: 30, value: `${metrics.liquidityRatio.toFixed(1)} months`, icon: 'schedule' },
    { id: 'debt', label: 'Debt', score: clamp(metrics.totalDebt === 0 ? 20 : 20 - Math.abs(metrics.totalDebt) / 1000, 20), max: 20, value: formatCurrency(convertCurrency(metrics.totalDebt, 'EUR', getMainCurrency()), getMainCurrency()), icon: 'credit_card' },
    { id: 'mix', label: 'Asset mix', score: clamp(metrics.accountTypes * 5, 20), max: 20, value: `${metrics.accountTypes} account types`, icon: 'pie_chart' },
  ];
  const score = clamp(factors.reduce((sum, factor) => sum + factor.score, 0), 100);
  const rank = score >= 90 ? 'Wealth Tycoon' : score >= 75 ? 'Money Master' : score >= 50 ? 'Wealth Builder' : score >= 30 ? 'Budget Conscious' : 'Financial Novice';
  return { score, rank, factors };
};

/** Net worth at the start of each of the last 60 months, newest first, walked back from today. */
export const netWorthHistory = (accounts: Account[], transactions: Transaction[], now: Date) => {
  const analytics = analyticsOnly(accounts, transactions);
  const rawCurrent = eurOf(calculateAccountTotals(openAccounts(analytics.accounts), analytics.transactions).netWorth, getMainCurrency());
  const signedEur = (tx: Transaction) => {
    const val = Math.abs(eurOf(tx.amount, tx.currency));
    return tx.type === 'expense' ? -val : val;
  };
  let futureDelta = 0;
  const changes = new Map<string, number>();
  analytics.transactions.forEach(tx => {
    if (tx.transferId) return;
    const date = parseLocalDate(tx.date);
    if (date > now) {
      futureDelta += signedEur(tx);
      return;
    }
    const key = toLocalISOString(date).slice(0, 7);
    changes.set(key, (changes.get(key) || 0) + signedEur(tx));
  });
  const current = rawCurrent - futureDelta;
  const history: { date: string; value: number }[] = [];
  let running = current;
  for (let month = 0; month < 60; month++) {
    if (month > 0) running -= changes.get(toLocalISOString(new Date(now.getFullYear(), now.getMonth() - month + 1, 1)).slice(0, 7)) || 0;
    history.push({ date: new Date(now.getFullYear(), now.getMonth() - month, 1).toLocaleDateString('en', { month: 'long', year: 'numeric' }), value: running });
  }
  return { current, history };
};

export const personalRecords = (current: number, history: { date: string; value: number }[]) => {
  const peak = Math.max(current, ...history.map(point => point.value));
  const isNewRecord = current >= peak && current > 0;
  const past = history.length >= 13 ? history[12] : history[history.length - 1];
  const rows: { label: string; detail: string; value: number; changePct?: number }[] = [{ label: 'All-time high', detail: isNewRecord ? 'That is today' : 'Your peak so far', value: peak }];
  if (!isNewRecord) rows.push({ label: 'Today', detail: 'From the high', value: current, changePct: peak > 0 ? ((current - peak) / peak) * 100 : 0 });
  if (past && past.value > 0) rows.push({ label: 'A year ago', detail: past.date, value: past.value, changePct: ((current - past.value) / past.value) * 100 });
  return { rows, isNewRecord };
};

/** Debts being paid off and goals being saved for (`CHL-03`, once "battles"). */
export const debtsAndGoals = (accounts: Account[], transactions: Transaction[], goals: FinancialGoal[], loanOverrides: LoanPaymentOverrides) => {
  const analytics = analyticsOnly(accounts, transactions);
  const debts: { id: string; name: string; total: number; remaining: number; payments: { date: string; amount: number }[]; paidPrincipal: number; paidInterest: number }[] = [];
  openAccounts(analytics.accounts).filter(account => DEBT_TYPES.includes(account.type)).forEach(account => {
    let remaining = account.balance < 0 ? Math.abs(account.balance) : 0;
    let total = account.creditLimit || account.totalAmount || remaining * 1.2;
    let paidPrincipal = 0;
    let paidInterest = 0;
    if (account.type === 'Loan' && account.principalAmount && account.duration) {
      const schedule = generateAmortizationSchedule(account, analytics.transactions, loanOverrides[account.id] || {});
      const totalCost = schedule.reduce((sum, row) => sum + row.principal + row.interest, 0);
      paidPrincipal = schedule.reduce((sum, row) => (row.status === 'Paid' ? sum + row.principal : sum), 0);
      paidInterest = schedule.reduce((sum, row) => (row.status === 'Paid' ? sum + row.interest : sum), 0);
      remaining = Math.max(0, totalCost - paidPrincipal - paidInterest);
      total = totalCost;
    } else if (remaining < 1) return;
    const payments = analytics.transactions
      .filter(tx => tx.accountId === account.id && (tx.type === 'income' || tx.type === 'expense'))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)
      .map(tx => ({ date: tx.date, amount: eurOf(Math.abs(tx.amount), tx.currency) }));
    const remainingEur = eurOf(remaining, account.currency);
    const totalEur = eurOf(Math.max(total, remaining), account.currency);
    debts.push({
      id: account.id,
      name: account.name,
      total: totalEur,
      remaining: remainingEur,
      payments,
      paidPrincipal: eurOf(paidPrincipal, account.currency),
      paidInterest: eurOf(paidInterest, account.currency),
    });
  });
  const savings = goals
    .filter(goal => goal.currentAmount < goal.amount)
    .map(goal => ({
      id: goal.id,
      name: goal.name,
      total: eurOf(goal.amount, goal.currency),
      remaining: eurOf(Math.max(0, goal.amount - goal.currentAmount), goal.currency),
    }));
  return { debts, savings };
};

/** A level per budget: the less of the limit is used, the higher (`CHL-05`). */
export const budgetMastery = (budgets: Budget[], spending: Record<string, number>) =>
  budgets.map(budget => {
    const spent = spending[budget.categoryName] || 0;
    const limit = eurOf(budget.amount, budget.currency);
    const ratio = limit > 0 ? spent / limit : 0;
    const [level, title] = budget.amount <= 0 ? [0, 'No limit set'] : ratio > 1 ? [0, 'Over budget'] : ratio > 0.9 ? [1, 'Novice'] : ratio > 0.75 ? [2, 'Adept'] : ratio > 0.5 ? [3, 'Expert'] : [4, 'Master'];
    return { categoryName: budget.categoryName, amount: limit, spent, ratio, level: level as number, title: title as string };
  }).sort((a, b) => b.level - a.level);

export const BADGE_GROUPS = ['Getting set up', 'Wealth', 'Habits', 'Planning', 'Predictions'] as const;

interface BadgeInputs {
  accounts: Account[];
  budgets: Budget[];
  goals: FinancialGoal[];
  metrics: ChallengeMetrics;
  memberships: Membership[];
  bills: BillPayment[];
  recurring: RecurringTransaction[];
  investmentTransactions: InvestmentTransaction[];
  stats: UserStats;
  predictions: Prediction[];
  now: Date;
}

export const challengeBadges = ({ accounts, budgets, goals, metrics, memberships, bills, recurring, investmentTransactions, stats, predictions, now }: BadgeInputs) => {
  const { netWorth, totalInvestments, savingsRate, liquidityRatio, totalDebt, creditUtilization, budgetVariance, accountTypes } = metrics;
  const hasOverdueBills = bills.some(bill => bill.status === 'unpaid' && parseLocalDate(bill.dueDate) < now);
  const holdings = new Set(investmentTransactions.map(trade => trade.symbol)).size;
  const crypto = accounts.filter(account => account.type === 'Investment' && account.subType === 'Crypto').reduce((sum, account) => sum + eurOf(account.balance, account.currency), 0);
  const hasCard = accounts.some(account => account.type === 'Credit Card');
  const hasProperty = accounts.some(account => account.type === 'Property');
  const hasSpareChange = accounts.some(account => account.subType === 'Spare Change');
  const fundedGoal = goals.some(goal => goal.currentAmount >= goal.amount);
  const predicted = predictions.length > 0 || (stats.predictionTotal || 0) > 0;
  const wins = stats.predictionWins || 0;
  const rows = [
    { id: 'novice', group: 'Getting set up', title: 'Novice Explorer', description: 'Add your first account.', icon: 'search', unlocked: accounts.length > 0, progress: accounts.length * 100 },
    { id: 'diversified', group: 'Getting set up', title: 'Diversified', description: 'Hold 4 or more types of account.', icon: 'pie_chart', unlocked: accountTypes >= 4, progress: (accountTypes / 4) * 100 },
    { id: 'real_estate', group: 'Getting set up', title: 'Real Estate Mogul', description: 'Add a property.', icon: 'home', unlocked: hasProperty, progress: hasProperty ? 100 : 0 },
    { id: 'penny_pincher', group: 'Getting set up', title: 'Penny Pincher', description: 'Turn on a Spare Change account.', icon: 'savings', unlocked: hasSpareChange, progress: hasSpareChange ? 100 : 0 },
    { id: 'loyalist', group: 'Getting set up', title: 'Loyalist', description: 'Add 3 or more loyalty cards.', icon: 'credit_card', unlocked: memberships.length >= 3, progress: (memberships.length / 3) * 100 },
    { id: 'high_roller', group: 'Wealth', title: 'High Roller', description: 'Reach €100,000 net worth.', icon: 'payments', unlocked: netWorth >= 100000, progress: netWorth / 1000 },
    { id: '1percent', group: 'Wealth', title: 'The 1%', description: 'Reach €1M net worth.', icon: 'star', unlocked: netWorth >= 1000000, progress: netWorth / 10000 },
    { id: 'investor', group: 'Wealth', title: 'Investor', description: 'Hold €5,000 in investments.', icon: 'trending_up', unlocked: totalInvestments >= 5000, progress: totalInvestments / 50 },
    { id: 'crypto_whale', group: 'Wealth', title: 'Crypto Whale', description: 'Hold €10,000 in crypto.', icon: 'payments', unlocked: crypto >= 10000, progress: crypto / 100 },
    { id: 'collector', group: 'Wealth', title: 'Collector', description: 'Hold 5 or more different assets.', icon: 'nav_investments', unlocked: holdings >= 5, progress: (holdings / 5) * 100 },
    { id: 'crystal', group: 'Habits', title: 'Crystal Clear', description: 'Save over 20% of your income.', icon: 'savings', unlocked: savingsRate >= 0.2, progress: (savingsRate / 0.2) * 100 },
    { id: 'safety', group: 'Habits', title: 'Safety Net', description: 'Hold 3 months of spending in cash.', icon: 'schedule', unlocked: liquidityRatio >= 3, progress: (liquidityRatio / 3) * 100 },
    { id: 'streak', group: 'Habits', title: 'Streak Master', description: 'Open Crystal 7 days in a row.', icon: 'calendar_today', unlocked: stats.currentStreak >= 7, progress: (stats.currentStreak / 7) * 100 },
    { id: 'debtfree', group: 'Habits', title: 'Debt Destroyer', description: 'Owe nothing.', icon: 'check_circle', unlocked: totalDebt === 0, progress: totalDebt === 0 ? 100 : (1 - Math.min(totalDebt, 10000) / 10000) * 50 },
    { id: 'credit_ace', group: 'Habits', title: 'Credit Ace', description: 'Use under 30% of your card limits.', icon: 'credit_card', unlocked: hasCard && creditUtilization < 30, progress: !hasCard ? 0 : creditUtilization < 30 ? 100 : (30 / creditUtilization) * 100 },
    { id: 'bill_crusher', group: 'Habits', title: 'Bill Crusher', description: 'Have no overdue bills.', icon: 'receipt', unlocked: bills.length > 0 && !hasOverdueBills, progress: bills.length > 0 && !hasOverdueBills ? 100 : 0 },
    { id: 'architect', group: 'Planning', title: 'Budget Architect', description: 'Create 3 budgets.', icon: 'balance', unlocked: budgets.length >= 3, progress: (budgets.length / 3) * 100 },
    { id: 'oracle', group: 'Planning', title: 'Oracle', description: 'Land within 5% of your budgets.', icon: 'visibility', unlocked: budgets.length > 0 && budgetVariance <= 0.05, progress: budgets.length === 0 ? 0 : budgetVariance <= 0.05 ? 100 : (0.05 / budgetVariance) * 100 },
    { id: 'automator', group: 'Planning', title: 'Automator', description: 'Set up 5 recurring items.', icon: 'refresh', unlocked: recurring.length >= 5, progress: (recurring.length / 5) * 100 },
    { id: 'goal_setter', group: 'Planning', title: 'Goal Setter', description: 'Create your first goal.', icon: 'flag', unlocked: goals.length > 0, progress: goals.length * 100 },
    { id: 'goal_getter', group: 'Planning', title: 'Goal Getter', description: 'Fully fund a goal.', icon: 'star', unlocked: fundedGoal, progress: fundedGoal ? 100 : 50 },
    { id: 'forecaster', group: 'Predictions', title: 'Forecaster', description: 'Make a prediction.', icon: 'visibility', unlocked: predicted, progress: predicted ? 100 : 0 },
    { id: 'prophet', group: 'Predictions', title: 'Prophet', description: 'Win 5 predictions.', icon: 'star', unlocked: wins >= 5, progress: (wins / 5) * 100 },
  ];
  return rows.map(row => ({ ...row, progress: clamp(row.progress, 100) }));
};

export interface SprintDefinition {
  id: string;
  title: string;
  description: string;
  durationDays: number;
  targetType: 'category' | 'global' | 'transaction_limit';
  /** Words matched against category names, so "Restaurants" counts for dining. */
  keywords?: string[];
  limitAmount: number;
  icon: string;
}

export const SPRINTS: SprintDefinition[] = [
  { id: 'zero_day', title: 'The Zero Day', description: 'Spend nothing for 24 hours.', durationDays: 1, targetType: 'global', limitAmount: 0, icon: 'cancel-circle' },
  { id: 'weekend_warrior', title: 'Weekend Warrior', description: 'Spend nothing for 2 days.', durationDays: 2, targetType: 'global', limitAmount: 0, icon: 'calendar-03' },
  { id: 'coffee_break', title: 'The Coffee Break', description: 'Spend under €15 on coffee in a week.', durationDays: 7, targetType: 'category', keywords: ['cafe', 'café', 'coffee'], limitAmount: 15, icon: 'clock-01' },
  { id: 'dining_detox', title: 'Dining Detox', description: 'Spend nothing on restaurants for 7 days.', durationDays: 7, targetType: 'category', keywords: ['dining', 'restaurant', 'takeaway'], limitAmount: 0, icon: 'cancel-circle' },
  { id: 'grocery_gauntlet', title: 'Grocery Gauntlet', description: 'Keep groceries under €50 for a week.', durationDays: 7, targetType: 'category', keywords: ['supermarket', 'grocer'], limitAmount: 50, icon: 'receipt' },
  { id: 'transport_trim', title: 'Transport Trim', description: 'Spend under €20 on fuel and transit in a week.', durationDays: 7, targetType: 'category', keywords: ['transport', 'fuel', 'transit'], limitAmount: 20, icon: 'car-01' },
  { id: 'entertainment_fast', title: 'Entertainment Fast', description: 'Spend nothing on movies or games for 2 weeks.', durationDays: 14, targetType: 'category', keywords: ['entertainment', 'cinema', 'movie', 'game'], limitAmount: 0, icon: 'cancel-circle' },
  { id: 'shopping_ban', title: 'Shopping Ban', description: 'Buy no clothes or gadgets for 30 days.', durationDays: 30, targetType: 'category', keywords: ['shopping', 'clothing', 'electronics'], limitAmount: 0, icon: 'cancel-circle' },
  { id: 'low_cost_living', title: 'Low Cost Living', description: 'Spend under €200 in total in a week.', durationDays: 7, targetType: 'global', limitAmount: 200, icon: 'balance-scale' },
  { id: 'ten_euro_challenge', title: 'The €10 Challenge', description: 'Spend under €10 in total over 3 days.', durationDays: 3, targetType: 'global', limitAmount: 10, icon: 'coins-01' },
  { id: 'impulse_control', title: 'Impulse Control', description: 'Make no single payment over €50 for a week.', durationDays: 7, targetType: 'transaction_limit', limitAmount: 50, icon: 'credit-card' },
];

export interface ActiveSprint { id: string; startDate: string }

export const sprintProgress = (active: ActiveSprint[], accounts: Account[], transactions: Transaction[], now: Date) => {
  const analytics = analyticsOnly(accounts, transactions);
  return active.flatMap(item => {
    const sprint = SPRINTS.find(candidate => candidate.id === item.id);
    if (!sprint) return [];
    const start = parseLocalDate(item.startDate);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + sprint.durationDays);
    const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000));
    const timeProgress = clamp(((now.getTime() - start.getTime()) / (sprint.durationDays * 86400000)) * 100, 100);
    const counted = analytics.transactions.filter(tx => {
      const date = parseLocalDate(tx.date);
      if (date < start || date > now || !isSpend(tx)) return false;
      if (sprint.targetType === 'global') return true;
      if (sprint.targetType === 'transaction_limit') return Math.abs(eurOf(tx.amount, tx.currency)) > sprint.limitAmount;
      return sprint.keywords!.some(word => tx.category.toLowerCase().includes(word));
    });
    const spent = counted.reduce((sum, tx) => sum + Math.abs(eurOf(tx.amount, tx.currency)), 0);
    const failed = sprint.targetType === 'transaction_limit' ? counted.length > 0 : spent > sprint.limitAmount;
    const status: 'active' | 'failed' | 'completed' = failed ? 'failed' : daysLeft === 0 ? 'completed' : 'active';
    return [{ ...sprint, startDate: item.startDate, spent, daysLeft, timeProgress, status }];
  });
};

interface PredictionContext {
  accounts: Account[];
  transactions: Transaction[];
  prices: Record<string, number | null>;
  expenseCategories?: Category[];
}

/** Where a prediction stands now. The card and the result both use this, so they can't disagree. Null when there's no price yet. */
export const predictionValue = (prediction: Prediction, { accounts, transactions, prices, expenseCategories }: PredictionContext, endDate?: string): number | null => {
  const analytics = analyticsOnly(accounts, transactions);
  if (prediction.type === 'spending_cap') {
    return analytics.transactions
      .filter(tx => isSpend(tx) && categoryMatches(tx.category, prediction.targetName, expenseCategories) && tx.date >= prediction.startDate && (!endDate || tx.date <= endDate))
      .reduce((sum, tx) => sum + Math.abs(eurOf(tx.amount, tx.currency)), 0);
  }
  if (prediction.type === 'net_worth_goal') {
    if (prediction.targetId) {
      const account = analytics.accounts.find(item => item.id === prediction.targetId);
      return account ? eurOf(account.balance, account.currency) : 0;
    }
    return eurOf(calculateAccountTotals(openAccounts(analytics.accounts), analytics.transactions).netWorth, getMainCurrency());
  }
  const price = prediction.targetId ? prices[prediction.targetId] : null;
  return price ?? null;
};

/** Pure daily check-in streak updater (`ENH-CHL-01`). */
export const updateActivityStreak = (stats: UserStats, todayIso: string): UserStats => {
  if (!todayIso) return stats;
  if (stats.lastLogDate === todayIso) return stats;
  if (!stats.lastLogDate) {
    const initialStreak = Math.max(1, stats.currentStreak || 1);
    return {
      ...stats,
      currentStreak: initialStreak,
      longestStreak: Math.max(stats.longestStreak || 0, initialStreak),
      lastLogDate: todayIso,
    };
  }
  const lastDate = parseLocalDate(stats.lastLogDate);
  const todayDate = parseLocalDate(todayIso);
  const diffDays = Math.round((todayDate.getTime() - lastDate.getTime()) / 86400000);
  if (diffDays <= 0) return stats;
  const nextStreak = diffDays === 1 ? (stats.currentStreak || 0) + 1 : 1;
  return {
    ...stats,
    currentStreak: nextStreak,
    longestStreak: Math.max(stats.longestStreak || 0, nextStreak),
    lastLogDate: todayIso,
  };
};

/** Settles predictions whose end date has passed. One with no price yet waits. */
export const resolvePredictions = (predictions: Prediction[], context: PredictionContext, today: string) =>
  predictions.flatMap(prediction => {
    if (prediction.status !== 'active' || prediction.endDate >= today) return [];
    const finalAmount = predictionValue(prediction, context, prediction.endDate);
    if (finalAmount === null) return [];
    const won = prediction.type === 'spending_cap' ? finalAmount <= prediction.targetAmount : finalAmount >= prediction.targetAmount;
    return [{ ...prediction, status: won ? 'won' as const : 'lost' as const, finalAmount }];
  });

/** A prediction's label and how far along it is. For a cap, lower is better. */
export const predictionState = (prediction: Prediction, value: number) => {
  const progress = prediction.targetAmount !== 0 ? (value / prediction.targetAmount) * 100 : 0;
  if (prediction.status === 'won') return { label: 'Won', tone: 'positive' as const, progress };
  if (prediction.status === 'lost') return { label: 'Lost', tone: 'negative' as const, progress };
  if (prediction.type === 'spending_cap') {
    if (progress > 100) return { label: 'Over the limit', tone: 'negative' as const, progress };
    return progress > 80 ? { label: 'At risk', tone: 'attention' as const, progress } : { label: 'On track', tone: 'positive' as const, progress };
  }
  if (progress >= 100) return { label: 'Goal met', tone: 'positive' as const, progress };
  return progress > 80 ? { label: 'Close', tone: 'blue' as const, progress } : { label: 'In progress', tone: 'neutral' as const, progress };
};
