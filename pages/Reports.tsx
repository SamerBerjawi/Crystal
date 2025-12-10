import React, { useMemo } from 'react';
import {
  useAccountsContext,
  useInvoicesContext,
  usePreferencesContext,
  useTransactionsContext,
} from '../contexts/DomainProviders';
import { useBudgetsContext, useScheduleContext } from '../contexts/FinancialDataContext';
import { calculateAccountTotals, convertToEur, formatCurrency, getDateRange, parseDateAsUTC } from '../utils';
import { Currency } from '../types';
import Card from '../components/Card';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const palette = ['#6366F1', '#22C55E', '#F97316', '#06B6D4', '#E11D48', '#8B5CF6', '#14B8A6', '#0EA5E9'];

const StatCard: React.FC<{ title: string; value: string; subtitle?: string; icon: string }> = ({ title, value, subtitle, icon }) => (
  <Card className="h-full">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary">{title}</p>
        <p className="mt-2 text-2xl font-bold text-light-text dark:text-dark-text privacy-blur">{value}</p>
        {subtitle && <p className="mt-1 text-sm text-light-text-secondary dark:text-dark-text-secondary">{subtitle}</p>}
      </div>
      <div className="rounded-xl bg-primary-50 p-3 text-primary-600 dark:bg-primary-900/20 dark:text-primary-300">
        <span className="material-symbols-outlined text-2xl">{icon}</span>
      </div>
    </div>
  </Card>
);

const formatAmount = (amount: number, currency: Currency) => formatCurrency(amount, currency, { showPlusSign: amount > 0 });

const Reports: React.FC = () => {
  const { accounts } = useAccountsContext();
  const { preferences } = usePreferencesContext();
  const { transactions } = useTransactionsContext();
  const { budgets } = useBudgetsContext();
  const { invoices } = useInvoicesContext();
  const { billsAndPayments = [] } = useScheduleContext();

  const displayCurrency = useMemo(() => (accounts[0]?.currency || 'EUR') as Currency, [accounts]);

  const netWorth = useMemo(() => calculateAccountTotals(accounts, transactions).netWorth, [accounts, transactions]);

  const mtdRange = useMemo(() => getDateRange('MTD', transactions), [transactions]);
  const mtdTotals = useMemo(() => {
    const { start, end } = mtdRange;
    const inRange = transactions.filter((tx) => {
      const date = parseDateAsUTC(tx.date);
      return date >= start && date <= end;
    });

    const income = inRange
      .filter((tx) => tx.type === 'income')
      .reduce((sum, tx) => sum + convertToEur(Math.abs(tx.amount), tx.currency), 0);
    const expenses = inRange
      .filter((tx) => tx.type === 'expense')
      .reduce((sum, tx) => sum + convertToEur(Math.abs(tx.amount), tx.currency), 0);

    return { income, expenses, net: income - expenses };
  }, [mtdRange, transactions]);

  const monthlyCashflow = useMemo(() => {
    const buckets: Record<string, { label: string; income: number; expense: number; timestamp: number }> = {};

    transactions.forEach((tx) => {
      const date = parseDateAsUTC(tx.date);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      if (!buckets[key]) {
        buckets[key] = {
          label: date.toLocaleString('default', { month: 'short', year: '2-digit' }),
          income: 0,
          expense: 0,
          timestamp: new Date(date.getFullYear(), date.getMonth(), 1).getTime(),
        };
      }

      const amount = convertToEur(Math.abs(tx.amount), tx.currency);
      if (tx.type === 'income') {
        buckets[key].income += amount;
      } else {
        buckets[key].expense += amount;
      }
    });

    return Object.values(buckets)
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-6);
  }, [transactions]);

  const categoryBreakdown = useMemo(() => {
    const spend: Record<string, number> = {};

    transactions
      .filter((tx) => tx.type === 'expense')
      .forEach((tx) => {
        spend[tx.category] = (spend[tx.category] || 0) + convertToEur(Math.abs(tx.amount), tx.currency);
      });

    const sorted = Object.entries(spend)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([category, value], idx) => ({
        name: category,
        value,
        color: palette[idx % palette.length],
      }));

    const topTotal = sorted.reduce((sum, item) => sum + item.value, 0);
    const remainder = Object.values(spend).reduce((sum, val) => sum + val, 0) - topTotal;

    if (remainder > 0) {
      sorted.push({ name: 'Other', value: remainder, color: '#CBD5E1' });
    }

    return sorted;
  }, [transactions]);

  const currentMonth = useMemo(() => {
    const now = new Date();
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0) };
  }, []);

  const budgetPerformance = useMemo(() => {
    const { start, end } = currentMonth;

    return budgets
      .map((budget, idx) => {
        const spent = transactions
          .filter((tx) => tx.type === 'expense' && tx.category === budget.categoryName)
          .filter((tx) => {
            const date = parseDateAsUTC(tx.date);
            return date >= start && date <= end;
          })
          .reduce((sum, tx) => sum + convertToEur(Math.abs(tx.amount), tx.currency), 0);

        const planned = convertToEur(budget.amount, budget.currency);
        const variance = planned - spent;

        return {
          ...budget,
          spent,
          planned,
          variance,
          color: palette[idx % palette.length],
        };
      })
      .sort((a, b) => b.spent - a.spent);
  }, [budgets, currentMonth, transactions]);

  const invoiceSummary = useMemo(() => {
    const sentInvoices = invoices.filter((inv) => inv.direction === 'sent');
    const outstanding = sentInvoices.filter((inv) => inv.status !== 'paid');
    const overdue = outstanding.filter((inv) => inv.status === 'overdue');

    const totalOutstanding = outstanding.reduce((sum, inv) => sum + convertToEur(inv.total, inv.currency), 0);

    const statusData = ['draft', 'sent', 'paid', 'overdue'].map((status, idx) => ({
      status,
      count: sentInvoices.filter((inv) => inv.status === status).length,
      color: palette[idx % palette.length],
    }));

    return { totalOutstanding, overdueCount: overdue.length, statusData };
  }, [invoices]);

  const billOverview = useMemo(() => {
    const upcoming = billsAndPayments.filter((bill) => bill.status === 'unpaid');
    const dueSoon = upcoming.filter((bill) => {
      const due = parseDateAsUTC(bill.dueDate);
      const now = new Date();
      const diffDays = Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays <= 14;
    });

    const totalDue = upcoming.reduce((sum, bill) => sum + convertToEur(Math.abs(bill.amount), bill.currency), 0);

    return { upcomingCount: upcoming.length, dueSoonCount: dueSoon.length, totalDue };
  }, [billsAndPayments]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-500">Reports</p>
          <h1 className="mt-1 text-3xl font-bold text-light-text dark:text-dark-text">Financial intelligence</h1>
          <p className="text-light-text-secondary dark:text-dark-text-secondary">Automated insights built from your existing data.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Net worth" value={formatAmount(netWorth, displayCurrency)} subtitle="All assets and liabilities" icon="account_balance" />
        <StatCard title="MTD income" value={formatAmount(mtdTotals.income, displayCurrency)} subtitle="Month-to-date inflows" icon="trending_up" />
        <StatCard title="MTD expenses" value={formatAmount(-mtdTotals.expenses, displayCurrency)} subtitle="Month-to-date outflows" icon="shopping_bag" />
        <StatCard
          title="Outstanding invoices"
          value={formatAmount(-invoiceSummary.totalOutstanding, displayCurrency)}
          subtitle={`${invoiceSummary.overdueCount} overdue`}
          icon="request_quote"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary">
                Cashflow trend
              </p>
              <p className="text-lg font-bold text-light-text dark:text-dark-text">Last 6 months</p>
            </div>
            <div className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-600 dark:bg-primary-900/30 dark:text-primary-200">
              {preferences.defaultPeriod || 'MTD'} focus
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={monthlyCashflow} stackOffset="sign">
                <CartesianGrid strokeDasharray="3 3" className="opacity-40" />
                <XAxis dataKey="label" stroke="currentColor" className="text-sm" />
                <YAxis tickFormatter={(val) => formatAmount(val, displayCurrency)} stroke="currentColor" className="text-sm" />
                <Tooltip formatter={(value: number) => formatAmount(value, displayCurrency)} />
                <Legend />
                <Bar dataKey="income" name="Income" fill="#22C55E" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary">
                Top spending categories
              </p>
              <p className="text-lg font-bold text-light-text dark:text-dark-text">Where your money goes</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={categoryBreakdown} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                    {categoryBreakdown.map((entry, index) => (
                      <Cell key={entry.name} fill={entry.color || palette[index % palette.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatAmount(value, displayCurrency)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {categoryBreakdown.map((item) => (
                <div key={item.name} className="flex items-center justify-between rounded-lg bg-light-surface px-3 py-2 dark:bg-white/5">
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-sm font-medium text-light-text dark:text-dark-text">{item.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-light-text dark:text-dark-text privacy-blur">
                    {formatAmount(item.value, displayCurrency)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary">Budget performance</p>
              <p className="text-lg font-bold text-light-text dark:text-dark-text">Current month</p>
            </div>
          </div>
          <div className="space-y-4">
            {budgetPerformance.length === 0 && (
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">No budgets have been configured yet.</p>
            )}
            {budgetPerformance.map((budget) => {
              const progress = budget.planned > 0 ? Math.min(100, Math.round((budget.spent / budget.planned) * 100)) : 0;
              return (
                <div key={budget.id} className="rounded-lg bg-light-surface p-4 dark:bg-white/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-xl text-primary-500">pie_chart</span>
                      <div>
                        <p className="text-sm font-semibold text-light-text dark:text-dark-text">{budget.categoryName}</p>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                          {formatAmount(budget.spent, displayCurrency)} spent of {formatAmount(budget.planned, displayCurrency)} budgeted
                        </p>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold ${budget.variance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {budget.variance >= 0 ? '+' : ''}{formatAmount(budget.variance, displayCurrency)}
                    </span>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                    <div className="h-full rounded-full bg-primary-500" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary">Receivables</p>
              <p className="text-lg font-bold text-light-text dark:text-dark-text">Invoice status</p>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={invoiceSummary.statusData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-40" />
                <XAxis dataKey="status" stroke="currentColor" className="text-sm capitalize" />
                <YAxis allowDecimals={false} stroke="currentColor" className="text-sm" />
                <Tooltip formatter={(value: number, name) => [`${value} invoices`, name]} />
                <Area type="monotone" dataKey="count" stroke="#6366F1" fill="#6366F1" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary">Outstanding</p>
              <p className="text-lg font-bold text-light-text dark:text-dark-text privacy-blur">
                {formatAmount(-invoiceSummary.totalOutstanding, displayCurrency)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary">Overdue</p>
              <p className="text-lg font-bold text-red-600 dark:text-red-400">{invoiceSummary.overdueCount}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary">Bills due soon</p>
              <p className="text-lg font-bold text-light-text dark:text-dark-text">{billOverview.dueSoonCount}</p>
            </div>
          </div>
          <div className="mt-3 rounded-lg bg-light-surface p-3 text-sm text-light-text-secondary dark:bg-white/5 dark:text-dark-text-secondary">
            {billOverview.upcomingCount > 0
              ? `${billOverview.upcomingCount} scheduled bills pending • ${formatAmount(-billOverview.totalDue, displayCurrency)} due`
              : 'No unpaid bills on the schedule.'}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Reports;
