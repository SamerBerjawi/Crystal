import React, { lazy } from 'react';
import {
  Account,
  BillPayment,
  Budget,
  Category,
  Currency,
  DisplayTransaction,
  Duration,
  FinancialGoal,
  ForecastDuration,
  Page,
  RecurringTransaction,
  RecurringTransactionOverride,
  Task,
  Transaction,
  Widget,
  LifeEvent,
} from '../../types';
import { DURATION_OPTIONS, FORECAST_DURATION_OPTIONS } from '../../constants';
import { sortAccountsByType } from '../../utils/accountsModel';
import { AssetGroup } from '../../utils/dashboardModel';
import type { SummaryFact } from '../../utils/overviewSummary';
import type { SafeToSpend } from '../../utils/safeToSpend';
import type { Insight } from '../../utils/insightsModel';
import type { HorizonTile } from '../../utils/forecastModel';
import CreditCardStatementCard from '../CreditCardStatementCard';
import PeriodFlowWidget, { type FlowBucket } from '../PeriodFlowWidget';
import CashHorizonWidget, { type HorizonNext30 } from '../CashHorizonWidget';
import CardsStackWidget from '../CardsStackWidget';
import MoneyFlowWidget from '../MoneyFlowWidget';
import SpendingCalendarWidget from '../SpendingCalendarWidget';
import GoalsRingsWidget from '../GoalsRingsWidget';
import NetWorthChart from '../NetWorthChart';
import SpendingByCategoryWidget from '../SpendingByCategoryWidget';
import TransactionList from '../TransactionList';
import AccountBreakdownCard from '../AccountBreakdownCard';
import AssetAllocationWidget from '../AssetAllocationWidget';
import TodayWidget from '../TodayWidget';
import FinancialRunwayWidget from '../FinancialRunwayWidget';
import MerchantParetoWidget from '../MerchantParetoWidget';
import WealthVelocityWidget from '../WealthVelocityWidget';
import InsightsWidget from '../InsightsWidget';
import UnifiedPendingMatcherCard from '../UnifiedPendingMatcherCard';
import MultiAccountFilter from '../MultiAccountFilter';
import DurationFilter from '../DurationFilter';
import { Button as AriaButton } from 'react-aria-components';
import { Button, IconButton } from '../ui/Actions';
import { Switch } from '../ui/Fields';
import Icon from '../ui/Icon';
import { Popover } from '../ui/Overlays';
import { MultiSelect, Select } from '../ui/Pickers';
import {
  AccountsSummary,
  KeyRatios,
  NeedsYou,
  NetWorthHero,
  SafeToSpendWidget,
  WrittenSummary,
} from '../ui/Summaries';
import { useWidgetBox } from '../ui/WidgetGrid';

import { lazyWithRetry } from '../../utils/lazyWithRetry';

const TransactionMapWidget = lazyWithRetry(() => import('../TransactionMapWidget'));
const CashflowSankey = lazyWithRetry(() => import('../CashflowSankey'));

export const CreditCardStatementsWidget: React.FC<{
  statements: any[];
  size?: 's' | 'm' | 'l';
}> = ({ statements, size = 'm' }) => {
  const box = useWidgetBox();
  if (statements.length === 0) return null;
  const fallback = size === 's' ? 1 : size === 'm' ? 2 : statements.length;
  const fitted =
    box.width > 0 && box.height > 0
      ? Math.max(1, Math.floor(box.width / 320)) * Math.max(1, Math.floor(box.height / 240))
      : fallback;
  const displayed = statements.slice(
    0,
    Math.max(1, Math.min(statements.length, box.height > 0 ? Math.max(fitted, 1) : fallback))
  );
  return (
    <div className="grid h-full grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] items-stretch gap-2.5 overflow-y-auto sm:gap-3">
      {displayed.map(statement => (
        <CreditCardStatementCard
          key={statement.accountId}
          noCard={true}
          accountName={statement.accountName}
          accountBalance={statement.accountBalance}
          creditLimit={statement.creditLimit}
          cardNetwork={statement.cardNetwork}
          financialInstitution={statement.financialInstitution}
          currency={statement.currency}
          previousStatement={{
            period: statement.previous.period,
            balance: statement.previous.balance,
            dueDate: statement.previous.paymentDue,
            amountPaid: statement.current.amountPaid,
          }}
          currentStatement={{
            period: statement.current.period,
            balance: statement.current.balance,
            dueDate: statement.current.paymentDue,
            amountPaid: statement.current.amountPaid,
            previousStatementBalance: statement.current.previousStatementBalance,
          }}
          nextStatement={{
            period: statement.future.period,
            balance: statement.future.balance,
            dueDate: statement.future.paymentDue,
          }}
        />
      ))}
    </div>
  );
};

export interface BuildDashboardWidgetsParams {
  income: number;
  expenses: number;
  incomeChange: string | null;
  expenseChange: string | null;
  periodFlowBuckets: FlowBucket[];
  preferredCurrency: Currency;
  eurToDisplay: (eur: number) => number;
  displayToEur: (val: number) => number;
  toPreferred: (amount: number, from: Currency) => number;
  safeToSpend: SafeToSpend;
  setCushion: (amount: number) => void;
  accounts: Account[];
  transactions: Transaction[];
  conversionRates?: Record<string, number>;
  onOpenAccount: (id: string) => void;
  setCurrentPage: (page: Page, tab?: string | null) => void;
  keyRatios: any[];
  assetAllocationData: { name: string; value: number; color: string }[];
  assetGroups: Record<string, AssetGroup>;
  liabilityGroups: Record<string, AssetGroup>;
  globalTotalAssets: number;
  globalTotalDebt: number;
  globalAssetBreakdown: { name: string; value: number; color: string }[];
  globalDebtBreakdown: { name: string; value: number; color: string }[];
  tasks: Task[];
  allRecurringItems: RecurringTransaction[];
  billsAndPayments: BillPayment[];
  financialGoals: FinancialGoal[];
  recurringTransactionOverrides: RecurringTransactionOverride[];
  saveTask: (task: Omit<Task, 'id'> & { id?: string }) => void;
  handleProcessItem: (item: RecurringTransaction | BillPayment) => void;
  next30: HorizonNext30;
  lowestBalanceForecasts: HorizonTile[];
  creditCardStatements: any[];
  analyticsTransactions: Transaction[];
  analyticsSelectedAccountIds: string[];
  expenseCategories: Category[];
  incomeCategories: Category[];
  allCategories: Category[];
  handleCategoryClick: (categoryName: string) => void;
  calendarTransactions: Transaction[];
  handleCalendarDay: (date: string) => void;
  netWorthData: { name: string; value?: number; forecast?: number }[];
  netWorthTrendColor: string;
  showForecast: boolean;
  showGoals: boolean;
  /** Life events to mark on the net-worth line. Empty when the chart option is off. */
  lifeEvents: LifeEvent[];
  selectedAccountIds: string[];
  budgets: Budget[];
  duration: Duration;
  handleBudgetClick: () => void;
  recentTransactions: DisplayTransaction[];
  handleTransactionClick: (clickedTx: DisplayTransaction) => void;
  filteredTransactions: Transaction[];
  activeInsights: Insight[];
  dismissInsight: (id: string) => void;
}

export const buildDashboardWidgets = (p: BuildDashboardWidgetsParams): Widget[] => [
  {
    id: 'financialOverview',
    name: 'This period',
    icon: 'pulse-01',
    description: 'What you kept, what came in and went out, and how it compares',
    defaultW: 6,
    defaultH: 2,
    component: PeriodFlowWidget,
    props: {
      income: p.eurToDisplay(p.income),
      expenses: p.eurToDisplay(p.expenses),
      incomeChange: p.incomeChange,
      expenseChange: p.expenseChange,
      buckets: p.periodFlowBuckets,
      currency: p.preferredCurrency,
    },
  },
  {
    id: 'safeToSpend',
    name: 'Safe to spend',
    icon: 'shield-01',
    description: 'What is left until your next income',
    defaultW: 2,
    defaultH: 3,
    component: SafeToSpendWidget,
    props: {
      data: p.safeToSpend,
      currency: p.preferredCurrency,
      toDisplay: p.eurToDisplay,
      fromDisplay: p.displayToEur,
      countUp: true,
      onCushionChange: p.setCushion,
    },
  },
  {
    id: 'accountsSummary',
    name: 'Accounts',
    icon: 'wallet-02',
    description: 'Your biggest accounts',
    defaultW: 2,
    defaultH: 4,
    component: AccountsSummary,
    props: {
      accounts: p.accounts,
      transactions: p.transactions,
      conversionRates: p.conversionRates,
      toDisplay: p.toPreferred,
      currency: p.preferredCurrency,
      onOpen: p.onOpenAccount,
      onAll: () => p.setCurrentPage('Accounts'),
    },
  },
  {
    id: 'overviewKpis',
    name: 'Key ratios',
    icon: 'balance-scale',
    description: 'Liquidity, savings, debt and net flow',
    defaultW: 6,
    defaultH: 2,
    component: KeyRatios,
    props: { items: p.keyRatios },
  },
  {
    id: 'assetAllocation',
    name: 'Asset allocation',
    icon: 'safe',
    description: 'Assets and debts by group',
    defaultW: 6,
    defaultH: 7,
    component: AssetAllocationWidget,
    props: {
      allocation: p.assetAllocationData,
      assetGroups: p.assetGroups,
      liabilityGroups: p.liabilityGroups,
      totalAssets: p.globalTotalAssets,
      totalDebt: p.globalTotalDebt,
      currency: p.preferredCurrency,
      toDisplay: p.eurToDisplay,
    },
  },
  {
    id: 'todayWidget',
    name: "Today's Agenda",
    icon: 'calendar-check-in-01',
    description: 'Upcoming tasks and payments',
    defaultW: 6,
    defaultH: 2,
    component: TodayWidget,
    props: {
      tasks: p.tasks,
      recurringTransactions: p.allRecurringItems,
      bills: p.billsAndPayments,
      goals: p.financialGoals,
      overrides: p.recurringTransactionOverrides,
      onTaskUpdate: p.saveTask,
      onProcessItem: p.handleProcessItem,
      currency: p.preferredCurrency,
      toDisplay: p.eurToDisplay,
    },
  },
  {
    id: 'forecastHorizon',
    name: 'Next 30 days',
    icon: 'clock-01',
    description: 'Your balance with every planned payment applied, and the lowest point',
    defaultW: 6,
    defaultH: 2,
    component: CashHorizonWidget,
    props: {
      next30: p.next30,
      forecasts: p.lowestBalanceForecasts,
      currency: p.preferredCurrency,
      toDisplay: p.eurToDisplay,
    },
  },
  {
    id: 'cardsStack',
    name: 'Cards',
    icon: 'credit-card',
    description: 'Every card in a deck: tap one to see its spend or credit used',
    defaultW: 6,
    defaultH: 3,
    component: CardsStackWidget,
    props: {
      accounts: p.accounts,
      transactions: p.transactions,
      currency: p.preferredCurrency,
      toDisplay: p.toPreferred,
      onOpen: p.onOpenAccount,
      onAll: () => p.setCurrentPage('Accounts', 'cards'),
    },
  },
  {
    id: 'creditCardStatements',
    name: 'Credit Card Statements',
    icon: 'credit-card',
    description: 'This statement and the next, for each card',
    defaultW: 6,
    defaultH: 2,
    component: CreditCardStatementsWidget,
    props: { statements: p.creditCardStatements },
  },
  {
    id: 'moneyFlow',
    name: 'Money flow',
    icon: 'chart-column',
    description: 'Money in and out by week, month or quarter, with the balance line',
    defaultW: 6,
    defaultH: 3,
    component: MoneyFlowWidget,
    props: {
      accounts: p.accounts,
      transactions: p.analyticsTransactions,
      selectedAccountIds: p.analyticsSelectedAccountIds,
      expenseCategories: p.expenseCategories,
      currency: p.preferredCurrency,
      toDisplay: p.eurToDisplay,
      onCategoryClick: p.handleCategoryClick,
    },
  },
  {
    id: 'spendingCalendar',
    name: 'Spending calendar',
    icon: 'calendar-03',
    description: 'A dot for every day, coloured by what went out',
    defaultW: 6,
    defaultH: 3,
    component: SpendingCalendarWidget,
    props: {
      transactions: p.calendarTransactions,
      currency: p.preferredCurrency,
      toDisplay: p.eurToDisplay,
      onDayClick: p.handleCalendarDay,
    },
  },
  {
    id: 'goalsRings',
    name: 'Goals',
    icon: 'target-01',
    description: 'Progress towards each goal',
    defaultW: 6,
    defaultH: 3,
    component: GoalsRingsWidget,
    props: {
      goals: p.financialGoals,
      currency: p.preferredCurrency,
      toDisplay: p.toPreferred,
      onOpenGoals: () => p.setCurrentPage('Goals'),
    },
  },
  {
    id: 'netWorthOverTime',
    name: 'Net Worth Over Time',
    icon: 'chart-line-data-01',
    description: 'How your net worth has changed',
    defaultW: 12,
    defaultH: 2,
    component: NetWorthChart,
    props: {
      data: p.netWorthData,
      lineColor: p.netWorthTrendColor,
      showForecast: p.showForecast,
      showGoals: p.showGoals,
      goals: p.financialGoals.filter(
        g => g.date && (!g.paymentAccountId || p.selectedAccountIds.includes(g.paymentAccountId))
      ),
      lifeEvents: p.lifeEvents,
    },
  },
  {
    id: 'outflowsByCategory',
    name: 'Spending by category',
    icon: 'pie-chart-01',
    description: 'Where your money went, against your budgets',
    defaultW: 6,
    defaultH: 2,
    component: SpendingByCategoryWidget,
    props: {
      selectedAccountIds: p.analyticsSelectedAccountIds,
      budgets: p.budgets,
      transactions: p.transactions,
      expenseCategories: p.expenseCategories,
      accounts: p.accounts,
      duration: p.duration,
      onCategoryClick: p.handleCategoryClick,
      onBudgetClick: p.handleBudgetClick,
    },
  },
  {
    id: 'recentActivity',
    name: 'Recent Activity',
    icon: 'clock-03',
    description: 'Latest transactions',
    defaultW: 12,
    defaultH: 3,
    component: TransactionList,
    props: {
      transactions: p.recentTransactions,
      allCategories: p.allCategories,
      onTransactionClick: p.handleTransactionClick,
      maxItems: 15,
    },
  },
  {
    id: 'assetBreakdown',
    name: 'Asset Breakdown',
    icon: 'bank',
    description: 'What you own, by account type',
    defaultW: 6,
    defaultH: 2,
    component: AccountBreakdownCard,
    props: {
      title: 'Assets',
      totalValue: p.globalTotalAssets,
      breakdownData: p.globalAssetBreakdown,
    },
  },
  {
    id: 'liabilityBreakdown',
    name: 'Liability Breakdown',
    icon: 'receipt',
    description: 'What you owe, by account type',
    defaultW: 6,
    defaultH: 2,
    component: AccountBreakdownCard,
    props: {
      title: 'Liabilities',
      totalValue: Math.abs(p.globalTotalDebt),
      breakdownData: p.globalDebtBreakdown,
    },
  },
  {
    id: 'transactionMap',
    name: 'Transaction Map',
    icon: 'maps',
    description: 'Where you spent, on a map',
    defaultW: 6,
    defaultH: 2,
    component: TransactionMapWidget,
    props: { transactions: p.filteredTransactions },
  },
  {
    id: 'cashflowSankey',
    name: 'Cash Flow Sankey',
    icon: 'hierarchy-square-01',
    description: 'How money flows from income to spending',
    defaultW: 12,
    defaultH: 2,
    component: CashflowSankey,
    props: {
      transactions: p.filteredTransactions,
      incomeCategories: p.incomeCategories,
      expenseCategories: p.expenseCategories,
    },
  },
  {
    id: 'financialRunway',
    name: 'Financial Runway',
    icon: 'timer-01',
    description: 'How many months your cash would last',
    defaultW: 6,
    defaultH: 2,
    component: FinancialRunwayWidget,
    props: { accounts: p.accounts, transactions: p.analyticsTransactions },
  },
  {
    id: 'merchantPareto',
    name: 'Merchant Pareto',
    icon: 'store-01',
    description: 'Where most of your spending goes',
    defaultW: 6,
    defaultH: 2,
    component: MerchantParetoWidget,
    props: {
      transactions: p.analyticsTransactions,
      currency: p.preferredCurrency,
      toDisplay: p.eurToDisplay,
    },
  },
  {
    id: 'wealthVelocity',
    name: 'Wealth Velocity',
    icon: 'flash',
    description: 'What you saved each month',
    defaultW: 6,
    defaultH: 2,
    component: WealthVelocityWidget,
    props: {
      transactions: p.analyticsTransactions,
      accounts: p.accounts,
      currency: p.preferredCurrency,
      toDisplay: p.eurToDisplay,
    },
  },
  {
    id: 'insights',
    name: 'Insights',
    icon: 'lightbulb',
    description: 'Low balances ahead, idle cash and unusual spending',
    defaultW: 6,
    defaultH: 2,
    component: InsightsWidget,
    props: {
      insights: p.activeInsights,
      onDismiss: p.dismissInsight,
      onNavigate: p.setCurrentPage,
    },
  },
];

export const DashboardSummarySection: React.FC<{
  summaryFacts: SummaryFact[];
  isPrivate: boolean;
  isFirstVisit: boolean;
  setCurrentPage: (page: Page, tab?: string | null) => void;
  openMatches: (filter?: 'all' | 'transfer' | 'bill') => void;
  openReview: () => void;
  totalPendingMatchesCount: number;
  transferCount: number;
  billCount: number;
  likelyCount: number;
  dismissAllMatches: () => void;
  confirmLikelyMatches: () => void;
  netWorthDisplay: number;
  netWorthChangeDisplay: number | null;
  periodLabel: string;
  heroParts: { label: string; value: number }[];
  debtsDisplay: number;
  preferredCurrency: Currency;
  toCategorise: number;
  billsDue: number;
  tasksDue: number;
}> = ({
  summaryFacts,
  isPrivate,
  isFirstVisit,
  setCurrentPage,
  openMatches,
  openReview,
  totalPendingMatchesCount,
  transferCount,
  billCount,
  likelyCount,
  dismissAllMatches,
  confirmLikelyMatches,
  netWorthDisplay,
  netWorthChangeDisplay,
  periodLabel,
  heroParts,
  debtsDisplay,
  preferredCurrency,
  toCategorise,
  billsDue,
  tasksDue,
}) => (
  <>
    <WrittenSummary
      facts={summaryFacts}
      isPrivate={isPrivate}
      className="!mt-1 md:!mt-2"
      onFact={fact => {
        if (fact === 'bills') setCurrentPage('Schedule & Bills');
        else if (fact === 'tasks') setCurrentPage('Tasks');
        else if (fact === 'income') setCurrentPage('Transactions');
        else openMatches('all');
      }}
    />

    {totalPendingMatchesCount > 0 && (
      <div className="!mt-3 md:!mt-4">
        <UnifiedPendingMatcherCard
          transferCount={transferCount}
          billCount={billCount}
          highConfidenceCount={likelyCount}
          onReview={openMatches}
          onDismissAll={dismissAllMatches}
          onQuickReconcileHighConfidence={confirmLikelyMatches}
        />
      </div>
    )}

    <div
      className={`grid gap-6 max-md:gap-4 lg:grid-cols-3 ${
        isFirstVisit ? 'crystal-stagger' : ''
      }`}
    >
      <div className="lg:col-span-2">
        <NetWorthHero
          value={netWorthDisplay}
          change={netWorthChangeDisplay}
          period={periodLabel}
          parts={heroParts}
          debts={debtsDisplay}
          currency={preferredCurrency}
          countUp
          onOpen={() => setCurrentPage('Accounts')}
        />
      </div>
      <NeedsYou
        items={[
          { id: 'categorise', label: 'To categorise', count: toCategorise, onOpen: openReview },
          {
            id: 'transfers',
            label: 'Transfers to match',
            count: transferCount,
            onOpen: () => openMatches('transfer'),
          },
          {
            id: 'bill-matches',
            label: 'Bills to match',
            count: billCount,
            onOpen: () => openMatches('bill'),
          },
          {
            id: 'bills',
            label: 'Bills due soon',
            count: billsDue,
            onOpen: () => setCurrentPage('Schedule & Bills'),
          },
          {
            id: 'tasks',
            label: 'Tasks due',
            count: tasksDue,
            onOpen: () => setCurrentPage('Tasks'),
          },
        ]}
        footer={
          totalPendingMatchesCount > 0 && (
            <>
              {likelyCount > 0 && (
                <Button size="sm" variant="soft" onPress={confirmLikelyMatches}>
                  Confirm {likelyCount} likely
                </Button>
              )}
              <Button size="sm" variant="ghost" onPress={() => openMatches('all')}>
                Review matches
              </Button>
            </>
          )
        }
      />
    </div>
  </>
);

export const DashboardFilterToolbar: React.FC<{
  isMobile: boolean;
  accounts: Account[];
  selectedAccountIds: string[];
  setSelectedAccountIds: (ids: string[]) => void;
  duration: Duration;
  setDuration: (d: Duration) => void;
  forecastDuration: ForecastDuration;
  setForecastDuration: (d: ForecastDuration) => void;
  showForecast: boolean;
  setShowForecast: (v: boolean) => void;
  showGoals: boolean;
  setShowGoals: (v: boolean) => void;
  showLifeEvents: boolean;
  setShowLifeEvents: (v: boolean) => void;
  onManageLifeEvents: () => void;
  isEditMode: boolean;
  setIsEditMode: (v: boolean) => void;
  setIsAddWidgetModalOpen: (v: boolean) => void;
  setPhoneEditOpen: (v: boolean) => void;
}> = ({
  isMobile,
  accounts,
  selectedAccountIds,
  setSelectedAccountIds,
  duration,
  setDuration,
  forecastDuration,
  setForecastDuration,
  showForecast,
  setShowForecast,
  showGoals,
  setShowGoals,
  showLifeEvents,
  setShowLifeEvents,
  onManageLifeEvents,
  isEditMode,
  setIsEditMode,
  setIsAddWidgetModalOpen,
  setPhoneEditOpen,
}) => {
  const chartOptions = (close: () => void) => (
    <div className="flex flex-col gap-2">
      <Select
        label="Forecast period"
        options={FORECAST_DURATION_OPTIONS.map(option => ({
          id: option.value,
          label: option.label,
        }))}
        value={forecastDuration}
        onChange={id => setForecastDuration(id as ForecastDuration)}
      />
      <Switch isSelected={showForecast} onChange={setShowForecast}>
        Show forecast
      </Switch>
      <Switch isSelected={showGoals} onChange={setShowGoals}>
        Show goals
      </Switch>
      <Switch isSelected={showLifeEvents} onChange={setShowLifeEvents}>
        Show life events
      </Switch>
      <Button variant="soft" size="sm" icon="flag" onPress={() => { close(); onManageLifeEvents(); }}>
        Manage life events
      </Button>
    </div>
  );

  return (
    <div className="relative z-30 flex flex-wrap items-center justify-between gap-2">
      {isMobile ? (
        <Popover
          title="Filters"
          trigger={
            <AriaButton className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-sm font-bold text-ink">
              <Icon name="filter_list" size={20} />
              Filter
            </AriaButton>
          }
        >
          {close => (
          <div className="flex flex-col gap-4">
            <MultiSelect
              label="Accounts"
              options={sortAccountsByType(accounts).map(account => ({
                id: account.id,
                label: account.name,
                group: account.status === 'closed' ? 'Closed' : account.type,
              }))}
              value={selectedAccountIds}
              onChange={setSelectedAccountIds}
            />
            <Select
              label="Period"
              options={DURATION_OPTIONS.map(option => ({ id: option.value, label: option.label }))}
              value={duration}
              onChange={id => setDuration(id as Duration)}
            />
            {chartOptions(close)}
          </div>
          )}
        </Popover>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <MultiAccountFilter
            accounts={accounts}
            selectedAccountIds={selectedAccountIds}
            setSelectedAccountIds={setSelectedAccountIds}
          />
          <DurationFilter selectedDuration={duration} onDurationChange={setDuration} />
          <Popover
            title="Chart options"
            trigger={<IconButton icon="more-horizontal" label="Chart options" />}
          >
            {close => <div className="w-64">{chartOptions(close)}</div>}
          </Popover>
        </div>
      )}
      <div className="flex items-center gap-2">
        {isEditMode && (
          <Button variant="secondary" icon="add" onPress={() => setIsAddWidgetModalOpen(true)}>
            Add widget
          </Button>
        )}
        {isMobile ? (
          <Button
            variant="ghost"
            icon="dashboard-square-edit"
            onPress={() => setPhoneEditOpen(true)}
          >
            Customise
          </Button>
        ) : (
          <Button
            variant={isEditMode ? 'primary' : 'ghost'}
            icon={isEditMode ? 'check' : 'dashboard-square-edit'}
            onPress={() => setIsEditMode(!isEditMode)}
          >
            {isEditMode ? 'Done' : 'Customise'}
          </Button>
        )}
      </div>
    </div>
  );
};
