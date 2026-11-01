import React, { useMemo, useState } from 'react';
import type { Account, Category, DisplayTransaction, LoanPaymentOverrides, MileageLog, ScheduledPayment, Transaction } from '../types';
import { ResponsiveContainer, Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts';
import { calculateTrendLine, convertCurrency, formatCurrency, generateAmortizationSchedule, parseLocalDate, toLocalISOYearMonth } from '../utils';
import {
  computeCashAccountMetrics,
  computeCreditCardAccountMetrics,
  computeExtraPaymentSavings,
  computeOperatingAccountMetrics,
  computePensionAccountMetrics,
  computePropertyAccountMetrics,
  computeSavingsAccountMetrics,
  computeSpareChangeAccountMetrics,
  computeVehicleAccountMetrics,
  findLinkedAssetForLoan,
} from '../utils/accountDetailModel';
import { useAccountsContext, usePreferencesSelector, useTransactionsContext } from '../contexts/DomainProviders';
import { useGoalsContext, useScheduleContext } from '../contexts/FinancialDataContext';
import { getMerchantLogoUrl } from '../utils/brandfetch';
import AccountFrame, { AccountTransactions, DetailList, LinkedGoals, MetricRow, MonthlyBars, Panel, ProgressBar, ValueChart, type FrameAction } from './AccountFrame';
import { CAR_MAKE_DOMAINS, LicensePlate } from './LicensePlate';
import MortgageAmortizationChart from './MortgageAmortizationChart';
import PaymentPlanTable from './PaymentPlanTable';
import VehicleMileageChart from './VehicleMileageChart';
import { Button, IconButton } from './ui/Actions';
import { Row } from './ui/Display';
import { Slider } from './ui/Fields';
import { Banner, EmptyState } from './ui/States';
import { Amount } from './ui/Money';

export interface AccountPanelProps {
  account: Account;
  transactions: Transaction[];
  accountTransactions: { tx: Transaction; parsedDate: Date; convertedAmount: number }[];
  displayTransactions: DisplayTransaction[];
  categories: Category[];
  accounts: Account[];
  loanOverrides: LoanPaymentOverrides;
  showBalanceAdjustments: boolean;
  onTransactionClick: (tx: DisplayTransaction) => void;
  onAddTransaction: () => void;
  onAdjustBalance: () => void;
  onBack: () => void;
  onOpenAccount: (id: string) => void;
  onSync?: () => void;
  onUpdateValuation: () => void;
  onCloseAsset: () => void;
  onRevertClosure?: () => void;
  onOverridesChange: (overrides: Record<number, Partial<ScheduledPayment>>) => void;
  onMakePayment: (payment: ScheduledPayment, description: string) => void;
  onAddLog: () => void;
  onEditLog: (log?: MileageLog) => void;
  onDeleteLog: (id: string) => void;
}

const money = (value: number, account: Account) => <Amount value={value} currency={account.currency} />;
const day = (value?: string) => (value ? parseLocalDate(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : undefined);

const commonActions = (props: AccountPanelProps, withAdjust = true): FrameAction[] => [
  ...(props.onSync ? [{ id: 'sync', label: 'Sync', icon: 'sync', onPress: props.onSync }] : []),
  ...(withAdjust ? [{ id: 'adjust', label: 'Adjust balance', icon: 'tune', onPress: props.onAdjustBalance }] : []),
];

const addAction = (props: AccountPanelProps, label = 'Add transaction'): FrameAction => ({ id: 'add', label, icon: 'add', onPress: props.onAddTransaction });

const transactionsTab = (props: AccountPanelProps) => ({
  id: 'transactions',
  label: 'Transactions',
  content: <AccountTransactions transactions={props.displayTransactions} categories={props.categories} onOpen={props.onTransactionClick} emptyAction={props.onAddTransaction} />,
});

const useRawTransactions = (props: AccountPanelProps) => useMemo(() => props.accountTransactions.map(item => item.tx), [props.accountTransactions]);

const GeneralPanel: React.FC<AccountPanelProps> = props => {
  const { account } = props;
  const { recurringTransactions, recurringTransactionOverrides, billsAndPayments, loanPaymentOverrides } = useScheduleContext();
  const { financialGoals } = useGoalsContext();
  const { transactions: allTransactions } = useTransactionsContext();
  const { accounts } = useAccountsContext();
  const conversionRates = usePreferencesSelector(p => p.conversionRates);
  const metrics = useMemo(() => computeOperatingAccountMetrics(account, accounts, allTransactions, {
    conversionRates,
    showBalanceAdjustments: props.showBalanceAdjustments,
    recurringTransactions,
    recurringTransactionOverrides,
    billsAndPayments,
    financialGoals,
    loanPaymentOverrides,
  }), [account, accounts, allTransactions, conversionRates, props.showBalanceAdjustments, recurringTransactions, recurringTransactionOverrides, billsAndPayments, financialGoals, loanPaymentOverrides]);

  return (
    <AccountFrame
      account={account}
      context={`${account.type}, ${account.financialInstitution || 'no bank set'}`}
      highlights={[
        ...(account.accountNumber ? [{ label: 'Account', value: `•••• ${account.accountNumber.slice(-4)}` }] : []),
        { label: 'Today', value: money(metrics.realTodayBalance, account) },
      ]}
      mainAction={addAction(props)}
      actions={commonActions(props)}
      onBack={props.onBack}
      transactionsForChart={props.transactions}
      tabs={[
        {
          id: 'overview',
          label: 'Overview',
          content: (
            <>
              <MetricRow metrics={[
                { label: 'Safe to spend', value: money(metrics.safeToSpend, account), context: 'After the next 14 days of payments' },
                { label: 'Lowest forecast', value: money(metrics.lowestBalanceForecast, account), context: 'Next 30 days' },
                { label: 'Monthly spending', value: money(metrics.avgMonthlySpend, account), context: 'Average of three months' },
              ]} />
              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="Coming up" subtitle="Next 14 days">
                  {metrics.upcomingPayments.length > 0 ? (
                    <ul className="divide-y divide-line">
                      {metrics.upcomingPayments.map((payment, index) => (
                        <li key={index}><Row title={payment.description} context={`${day(payment.date)}, ${payment.isRecurring ? 'recurring' : 'one-time'}`} trailing={<Amount value={-payment.amount} currency={account.currency} />} /></li>
                      ))}
                    </ul>
                  ) : <p className="type-body text-muted">Nothing due. Nice.</p>}
                </Panel>
                {(metrics.linkedCreditCards.length > 0 || metrics.linkedGoals.length > 0) && (
                  <Panel title="Linked">
                    <ul className="divide-y divide-line">
                      {metrics.linkedCreditCards.map(card => <li key={card.id}><Row title={card.name} context="Paid from this account" onPress={() => props.onOpenAccount(card.id)} /></li>)}
                    </ul>
                    {metrics.linkedGoals.length > 0 && <div className="mt-3"><LinkedGoals goals={metrics.linkedGoals} /></div>}
                  </Panel>
                )}
              </div>
            </>
          ),
        },
        transactionsTab(props),
        {
          id: 'details',
          label: 'Details',
          content: (
            <Panel title="Details">
              <DetailList items={[
                { label: 'Bank', value: account.financialInstitution },
                { label: 'Type', value: account.type },
                { label: 'Currency', value: account.currency },
                { label: 'Opened', value: day(account.openingDate) },
                { label: 'Account number', value: account.accountNumber },
                { label: 'Routing number', value: account.routingNumber },
                { label: 'Interest', value: account.apy ? `${account.apy}% APY` : undefined },
                { label: 'Name on card', value: account.cardholderName },
              ]} />
            </Panel>
          ),
        },
      ]}
    />
  );
};

const CashPanel: React.FC<AccountPanelProps> = props => {
  const { account } = props;
  const conversionRates = usePreferencesSelector(p => p.conversionRates);
  const raw = useRawTransactions(props);
  const { totalInflow, totalOutflow, netChange, lastReplenishment, flowData, burnRateMessage } = useMemo(
    () => computeCashAccountMetrics(account, raw, { conversionRates, showBalanceAdjustments: props.showBalanceAdjustments }),
    [account, raw, conversionRates, props.showBalanceAdjustments]
  );

  return (
    <AccountFrame
      account={account}
      context={`Cash, ${account.currency}`}
      highlights={[
        { label: 'This month', value: <Amount value={netChange} currency={account.currency} /> },
        { label: 'Last top-up', value: lastReplenishment ? lastReplenishment.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : 'None yet' },
      ]}
      mainAction={addAction(props)}
      actions={commonActions(props)}
      onBack={props.onBack}
      transactionsForChart={props.transactions}
      tabs={[
        {
          id: 'overview',
          label: 'Overview',
          content: (
            <>
              <MetricRow metrics={[
                { label: 'Added', value: money(totalInflow, account), context: 'Last 30 days' },
                { label: 'Spent', value: money(totalOutflow, account), context: 'Last 30 days' },
              ]} />
              <p className="type-body text-muted">{burnRateMessage}</p>
              <Panel title="In and out"><MonthlyBars data={flowData} currency={account.currency} stacked bars={[{ key: 'income', color: 'var(--money-in)' }, { key: 'expense', color: 'var(--chart-4)' }]} /></Panel>
            </>
          ),
        },
        transactionsTab(props),
        { id: 'details', label: 'Details', content: <Panel title="Details"><DetailList items={[{ label: 'Currency', value: account.currency }, { label: 'Opened', value: day(account.openingDate) }]} /></Panel> },
      ]}
    />
  );
};

const CreditCardPanel: React.FC<AccountPanelProps> = props => {
  const { account } = props;
  const conversionRates = usePreferencesSelector(p => p.conversionRates);
  const raw = useRawTransactions(props);
  const { totalSpent, totalPayments, utilization, availableCredit, spendingHistory } = useMemo(
    () => computeCreditCardAccountMetrics(account, raw, { conversionRates, showBalanceAdjustments: props.showBalanceAdjustments }),
    [account, raw, conversionRates, props.showBalanceAdjustments]
  );

  return (
    <AccountFrame
      account={account}
      context={`${account.cardNetwork || 'Credit card'}${account.last4 ? `, ending ${account.last4}` : ''}`}
      valueLabel="Owed"
      heroExtra={account.creditLimit ? <ProgressBar value={utilization} label="Credit used" tone="onHero" /> : undefined}
      highlights={[
        { label: 'Credit used', value: `${utilization.toFixed(1)}%` },
        { label: 'Limit', value: money(account.creditLimit || 0, account) },
      ]}
      mainAction={addAction(props)}
      actions={commonActions(props, false)}
      onBack={props.onBack}
      transactionsForChart={props.transactions}
      tabs={[
        {
          id: 'overview',
          label: 'Overview',
          content: (
            <>
              <MetricRow metrics={[
                { label: 'Spent', value: money(totalSpent, account), context: 'This month' },
                { label: 'Repaid', value: money(totalPayments, account), context: 'This month' },
                { label: 'Available', value: money(availableCredit, account), context: 'Unused credit' },
              ]} />
              <Panel title="Spending by month"><MonthlyBars data={spendingHistory} currency={account.currency} bars={[{ key: 'value', color: 'var(--chart-1)' }]} /></Panel>
            </>
          ),
        },
        transactionsTab(props),
        {
          id: 'billing',
          label: 'Billing',
          content: (
            <Panel title="Billing">
              <DetailList items={[
                { label: 'Statement opens', value: account.statementStartDate ? `Day ${account.statementStartDate}` : 'Not set' },
                { label: 'Payment due', value: account.paymentDate ? `Day ${account.paymentDate}` : 'Not set' },
                { label: 'Paid by', value: account.settlementAccountId ? 'Auto-pay from a linked account' : 'You, manually' },
              ]} />
            </Panel>
          ),
        },
      ]}
    />
  );
};

const SavingsPanel: React.FC<AccountPanelProps> = props => {
  const { account } = props;
  const { financialGoals } = useGoalsContext();
  const conversionRates = usePreferencesSelector(p => p.conversionRates);
  const raw = useRawTransactions(props);
  const { apy, projectedAnnualInterest, projectedMonthlyInterest, totalInterestYTD, actualInterestYTD, accruedInterestYTD, interestHistory, growthIndexLabel } = useMemo(
    () => computeSavingsAccountMetrics(account, raw, props.categories, { conversionRates, showBalanceAdjustments: props.showBalanceAdjustments }),
    [account, raw, props.categories, conversionRates, props.showBalanceAdjustments]
  );
  const goals = useMemo(() => financialGoals.filter(goal => goal.paymentAccountId === account.id), [financialGoals, account.id]);
  const interestLabel = actualInterestYTD > 0 && accruedInterestYTD === 0 ? 'Interest this year, paid' : accruedInterestYTD > 0 && actualInterestYTD === 0 ? 'Interest this year, accrued' : 'Interest this year';

  return (
    <AccountFrame
      account={account}
      context={`Savings, ${account.financialInstitution || 'no bank set'}`}
      highlights={[
        ...(apy > 0 ? [{ label: 'Yield', value: `${apy}% APY` }, { label: 'Estimated yearly return', value: money(projectedAnnualInterest, account) }] : []),
        { label: interestLabel, value: money(totalInterestYTD, account) },
      ]}
      mainAction={addAction(props)}
      actions={commonActions(props)}
      onBack={props.onBack}
      transactionsForChart={props.transactions}
      tabs={[
        {
          id: 'overview',
          label: 'Overview',
          content: (
            <>
              <MetricRow metrics={[
                { label: 'Estimated monthly', value: apy > 0 ? money(projectedMonthlyInterest, account) : '—', context: 'Projected interest' },
                { label: 'Growth', value: growthIndexLabel, context: 'Balance change, 90 days' },
              ]} />
              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="Interest by month"><MonthlyBars data={interestHistory} currency={account.currency} bars={[{ key: 'value', color: 'var(--chart-1)' }]} /></Panel>
                {goals.length > 0 && <Panel title="Linked goals"><LinkedGoals goals={goals} /></Panel>}
              </div>
            </>
          ),
        },
        transactionsTab(props),
        {
          id: 'details',
          label: 'Details',
          content: (
            <Panel title="Details">
              <DetailList items={[
                { label: 'Bank', value: account.financialInstitution },
                { label: 'Currency', value: account.currency },
                { label: 'Opened', value: day(account.openingDate) },
                { label: 'Account number', value: account.accountNumber },
                { label: 'Routing number', value: account.routingNumber },
              ]} />
            </Panel>
          ),
        },
      ]}
    />
  );
};

const LoanPanel: React.FC<AccountPanelProps> = props => {
  const { account, accounts } = props;
  const isLending = account.type === 'Lending';
  const conversionRates = usePreferencesSelector(p => p.conversionRates);
  const overrides = props.loanOverrides[account.id] || {};
  const [extra, setExtra] = useState(0);

  const details = useMemo(() => {
    const filtered = props.transactions.filter(tx => props.showBalanceAdjustments || !tx.isBalanceAdjustment);
    const schedule = generateAmortizationSchedule(account, filtered, overrides);
    const sum = (key: 'principal' | 'interest', paidOnly: boolean) => schedule.reduce((total, payment) => (!paidOnly || payment.status === 'Paid' ? total + payment[key] : total), 0);
    const paidPrincipal = sum('principal', true);
    const paidInterest = sum('interest', true);
    const outstandingPrincipal = Math.max(0, sum('principal', false) - paidPrincipal);
    const outstandingInterest = Math.max(0, sum('interest', false) - paidInterest);
    const principal = account.principalAmount || account.totalAmount || sum('principal', false) || 1;
    const linkedAsset = findLinkedAssetForLoan(account, accounts);
    const assetValue = linkedAsset ? convertCurrency(linkedAsset.balance, linkedAsset.currency, account.currency, conversionRates) : 0;
    const last = schedule[schedule.length - 1];
    return {
      schedule,
      paidPrincipal,
      paidInterest,
      outstandingPrincipal,
      outstandingInterest,
      progress: Math.min(100, Math.max(0, (paidPrincipal / principal) * 100)),
      linkedAsset,
      ltv: assetValue > 0 ? (outstandingPrincipal / assetValue) * 100 : 0,
      marketEquity: assetValue - outstandingPrincipal,
      equity: paidPrincipal + (account.downPayment || 0),
      payoffDate: last ? parseLocalDate(last.date) : null,
    };
  }, [account, props.transactions, overrides, accounts, props.showBalanceAdjustments, conversionRates]);

  const payment = account.monthlyPayment || 0;
  const whatIf = computeExtraPaymentSavings(details.outstandingPrincipal, account.interestRate || 0, payment, extra);

  return (
    <AccountFrame
      account={account}
      context={`${isLending ? 'Money you lent' : 'Loan'}${account.interestRate != null ? `, ${account.interestRate}% APR` : ''}`}
      value={details.schedule.length ? details.outstandingPrincipal + details.outstandingInterest : Math.abs(account.balance)}
      valueLabel={isLending ? 'Still to receive' : 'Left to pay'}
      heroExtra={details.schedule.length ? <ProgressBar value={details.progress} label="Paid off" tone="onHero" /> : undefined}
      highlights={!details.schedule.length ? [] : [
        { label: 'Paid off', value: `${details.progress.toFixed(0)}%` },
        { label: 'Principal', value: money(details.outstandingPrincipal, account) },
        { label: 'Future interest', value: money(details.outstandingInterest, account) },
        { label: 'Each month', value: money(payment, account) },
        { label: 'Ends', value: details.payoffDate?.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) ?? '—' },
      ]}
      mainAction={addAction(props, 'Add payment')}
      actions={commonActions(props, false)}
      onBack={props.onBack}
      transactionsForChart={props.transactions}
      tabs={[
        {
          id: 'overview',
          label: 'Overview',
          content: (
            <>
              <MetricRow metrics={[
                { label: 'Principal paid', value: money(details.paidPrincipal, account), context: 'Equity built' },
                { label: 'Interest paid', value: money(details.paidInterest, account), context: 'Cost so far' },
                { label: 'Loan to value', value: `${details.ltv.toFixed(1)}%`, context: 'Debt against the asset' },
                { label: 'Net equity', value: money(details.equity, account), context: 'Down payment plus paid' },
              ]} />
              {!isLending && payment > 0 && details.outstandingPrincipal > 0 && (
                <Panel title="What if you paid extra?">
                  <Slider
                    label="Extra each month"
                    value={extra}
                    onChange={value => setExtra(Array.isArray(value) ? value[0] : value)}
                    maxValue={Math.max(100, Math.round(payment))}
                    step={10}
                    formatOptions={{ style: 'currency', currency: account.currency === 'BTC' ? 'EUR' : account.currency, maximumFractionDigits: 0 }}
                  />
                  <p className="type-body text-ink">
                    {extra === 0 ? 'Move the slider to see what you would save.' : whatIf.monthsSaved > 0
                      ? <>You'd finish {whatIf.monthsSaved} {whatIf.monthsSaved === 1 ? 'month' : 'months'} sooner and save <Amount value={whatIf.interestSaved} currency={account.currency} className="font-bold" /> in interest.</>
                      : 'This extra amount wouldn\'t change the end date.'}
                  </p>
                  <p className="type-caption mt-1 text-muted">An estimate from today's balance and rate. It changes nothing until you record a payment.</p>
                </Panel>
              )}
              {details.schedule.length === 0 && <p className="type-body text-muted">Add the term, rate and start date in Edit to see a schedule.</p>}
              {details.schedule.length > 0 && <Panel title="Principal and interest"><MortgageAmortizationChart schedule={details.schedule} currency={account.currency} accountType={account.type} /></Panel>}
              {details.linkedAsset && (
                <Panel title="Linked asset">
                  <DetailList items={[
                    { label: 'Market value', value: money(details.linkedAsset.balance, details.linkedAsset) },
                    { label: 'Market equity', value: money(details.marketEquity, account) },
                    { label: 'Original total', value: money(account.totalAmount || 0, account) },
                  ]} />
                  <Button variant="ghost" size="sm" className="mt-2" onPress={() => props.onOpenAccount(details.linkedAsset!.id)}>Open {details.linkedAsset.name}</Button>
                </Panel>
              )}
            </>
          ),
        },
        {
          id: 'plan',
          label: 'Payment plan',
          content: <PaymentPlanTable account={account} transactions={props.transactions} onMakePayment={props.onMakePayment} overrides={overrides} onOverridesChange={props.onOverridesChange} showBalanceAdjustments={props.showBalanceAdjustments} />,
        },
        {
          id: 'details',
          label: 'Details',
          content: (
            <Panel title="Details">
              <DetailList items={[
                { label: 'Term', value: `${account.duration} months` },
                { label: 'Started', value: day(account.loanStartDate) },
                { label: 'Down payment', value: money(account.downPayment || 0, account) },
              ]} />
            </Panel>
          ),
        },
      ]}
    />
  );
};

const PensionPanel: React.FC<AccountPanelProps> = props => {
  const { account } = props;
  const conversionRates = usePreferencesSelector(p => p.conversionRates);
  const raw = useRawTransactions(props);
  const { retirementYear, yearsToRetirement, totalContributions, totalGrowth, monthlyContributionAvg, chartData, projectedValueAtRetirement } = useMemo(
    () => computePensionAccountMetrics(account, raw, { conversionRates, showBalanceAdjustments: props.showBalanceAdjustments }),
    [account, raw, conversionRates, props.showBalanceAdjustments]
  );

  return (
    <AccountFrame
      account={account}
      context={`Pension, retiring ${retirementYear}`}
      highlights={[
        { label: 'Retirement', value: retirementYear },
        { label: 'Years left', value: yearsToRetirement },
        { label: `Forecast at ${account.apy || 5}% growth`, value: money(projectedValueAtRetirement, account) },
      ]}
      mainAction={addAction(props, 'Add contribution')}
      actions={commonActions(props)}
      onBack={props.onBack}
      transactionsForChart={props.transactions}
      tabs={[
        {
          id: 'overview',
          label: 'Overview',
          content: (
            <>
              <MetricRow metrics={[
                { label: 'Growth', value: money(totalGrowth, account), context: 'Market changes and dividends' },
                { label: 'Contributions', value: money(totalContributions, account), context: 'Paid in so far' },
                { label: 'Monthly average', value: money(monthlyContributionAvg, account), context: 'Last 12 months' },
              ]} />
              <Panel title="History and forecast" subtitle="Assumes steady growth and contributions">
                <div className="h-[220px] md:h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                      <CartesianGrid vertical={false} stroke="var(--line)" />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} minTickGap={60} tickFormatter={value => String(value).split('-')[0]} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} width={56} tickFormatter={value => (value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value)} />
                      <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12 }} formatter={(value: number) => formatCurrency(value, account.currency)} />
                      <Legend verticalAlign="bottom" iconType="circle" />
                      <Area type="monotone" dataKey="balance" name="Value" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.12} strokeWidth={2} />
                      <Line type="monotone" dataKey="contributions" name="Paid in" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
                      <ReferenceLine x={toLocalISOYearMonth(new Date())} stroke="var(--line-strong)" strokeDasharray="3 3" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            </>
          ),
        },
        transactionsTab(props),
        {
          id: 'details',
          label: 'Details',
          content: (
            <Panel title="Details">
              <DetailList items={[
                { label: 'Provider', value: account.financialInstitution },
                { label: 'Currency', value: account.currency },
                { label: 'Opened', value: day(account.openingDate) },
                { label: 'Growth rate', value: account.apy ? `${account.apy}% APY` : undefined },
                { label: 'Retirement year', value: retirementYear },
                { label: 'Account number', value: account.accountNumber },
              ]} />
            </Panel>
          ),
        },
      ]}
    />
  );
};

const SpareChangePanel: React.FC<AccountPanelProps> = props => {
  const { account, accounts } = props;
  const conversionRates = usePreferencesSelector(p => p.conversionRates);
  const raw = useRawTransactions(props);
  const { sourceAccount, totalRoundUps, avgRoundUp, thisMonthSaved, biggestRoundUp, monthlyData, coffeesSaved } = useMemo(
    () => computeSpareChangeAccountMetrics(account, accounts, raw, { conversionRates, showBalanceAdjustments: props.showBalanceAdjustments }),
    [account, accounts, raw, conversionRates, props.showBalanceAdjustments]
  );

  return (
    <AccountFrame
      account={account}
      context={`Round-ups from ${sourceAccount?.name || 'an external account'}`}
      highlights={[
        { label: 'Round-ups', value: totalRoundUps },
        { label: 'This month', value: <Amount value={thisMonthSaved} currency={account.currency} tone="plain" /> },
        { label: 'In coffees', value: coffeesSaved },
      ]}
      mainAction={addAction(props)}
      actions={commonActions(props)}
      onBack={props.onBack}
      transactionsForChart={props.transactions}
      tabs={[
        {
          id: 'overview',
          label: 'Overview',
          content: (
            <>
              <MetricRow metrics={[
                { label: 'Average round-up', value: money(avgRoundUp, account) },
                { label: 'Biggest round-up', value: money(biggestRoundUp, account) },
              ]} />
              <Panel title="Saved by month"><MonthlyBars data={monthlyData} currency={account.currency} bars={[{ key: 'value', color: 'var(--chart-1)' }]} /></Panel>
            </>
          ),
        },
        transactionsTab(props),
        {
          id: 'details',
          label: 'Details',
          content: (
            <Panel title="Details">
              <DetailList items={[
                { label: 'Rounds up from', value: sourceAccount?.name || 'External account' },
                { label: 'Currency', value: account.currency },
                { label: 'Opened', value: day(account.openingDate) },
                { label: 'Account number', value: account.accountNumber },
              ]} />
            </Panel>
          ),
        },
      ]}
    />
  );
};

const closureBanner = (account: Account, title: string) => account.status === 'closed' && account.closureDetails ? (
  <Banner tone="info">
    <strong>{title}</strong> {account.closureDetails.closureType} on {day(account.closureDetails.date)}, at <Amount value={account.closureDetails.value || 0} currency={account.currency} />.
    {account.closureDetails.notes && ` ${account.closureDetails.notes}`}
  </Banner>
) : undefined;

const valuationActions = (props: AccountPanelProps, closeLabel: string): FrameAction[] => {
  const isClosed = props.account.status === 'closed';
  return [
    ...(props.onSync ? [{ id: 'sync', label: 'Sync', icon: 'sync', onPress: props.onSync }] : []),
    ...(!isClosed ? [{ id: 'close', label: closeLabel, icon: 'sell', onPress: props.onCloseAsset }] : []),
    ...(isClosed && props.onRevertClosure ? [{ id: 'reopen', label: 'Reopen', icon: 'history', onPress: props.onRevertClosure }] : []),
  ];
};

const PropertyPanel: React.FC<AccountPanelProps> = props => {
  const { account, accounts } = props;
  const isClosed = account.status === 'closed';
  const conversionRates = usePreferencesSelector(p => p.conversionRates);
  const { linkedLoan, currentMarketValue, outstandingLoanBalance, purchasePrice, marketEquity, investedEquity, appreciation, appreciationPercent, ownershipPercent } = computePropertyAccountMetrics(
    account, accounts, props.transactions, props.loanOverrides, { conversionRates, showBalanceAdjustments: props.showBalanceAdjustments }
  );
  const features = [
    account.hasBasement && 'Basement',
    account.hasAttic && 'Attic',
    account.hasGarden && `Garden${account.gardenSize ? `, ${account.gardenSize} m²` : ''}`,
    account.hasTerrace && `Terrace${account.terraceSize ? `, ${account.terraceSize} m²` : ''}`,
    account.indoorParkingSpaces && `Indoor parking, ${account.indoorParkingSpaces}`,
    account.outdoorParkingSpaces && `Outdoor parking, ${account.outdoorParkingSpaces}`,
  ].filter(Boolean);

  return (
    <AccountFrame
      account={account}
      context={`${account.propertyType || 'Property'}${account.address ? `, ${account.address}` : ''}`}
      value={currentMarketValue}
      valueLabel="Estimated value"
      banner={closureBanner(account, 'Sold or closed:')}
      highlights={[
        { label: 'Equity', value: money(marketEquity, account) },
        { label: 'Debt', value: money(outstandingLoanBalance, account) },
        { label: 'Owned', value: `${ownershipPercent.toFixed(0)}%` },
        { label: 'Purchase cost', value: money(purchasePrice, account) },
      ]}
      mainAction={!isClosed ? { id: 'value', label: 'Update value', icon: 'edit', onPress: props.onUpdateValuation } : undefined}
      actions={valuationActions(props, 'Record sale')}
      onBack={props.onBack}
      transactionsForChart={props.transactions}
      tabs={[
        {
          id: 'overview',
          label: 'Overview',
          content: (
            <>
              <MetricRow metrics={[
                { label: 'Gain', value: <Amount value={appreciation} currency={account.currency} tone="flow" />, context: `${appreciationPercent >= 0 ? '+' : '−'}${Math.abs(appreciationPercent).toFixed(1)}% unrealised` },
                { label: 'Invested', value: money(investedEquity, account), context: 'Principal you own' },
                { label: 'Property tax', value: money(account.propertyTaxAmount || 0, account), context: 'Each year' },
              ]} />
              {linkedLoan ? (
                <Panel title="Mortgage">
                  <DetailList items={[
                    { label: 'Principal owed', value: money(outstandingLoanBalance, linkedLoan) },
                    { label: 'Rate', value: `${linkedLoan.interestRate}% APR` },
                    { label: 'Each month', value: linkedLoan.monthlyPayment ? money(linkedLoan.monthlyPayment, linkedLoan) : 'Not set' },
                  ]} />
                  <Button variant="ghost" size="sm" className="mt-2" onPress={() => props.onOpenAccount(linkedLoan.id)}>Open {linkedLoan.name}</Button>
                </Panel>
              ) : <p className="type-body text-muted">No mortgage linked.</p>}
            </>
          ),
        },
        {
          id: 'valuations',
          label: 'Valuations',
          content: (account.priceHistory?.length ?? 0) > 1
            ? <Panel title="Value over time"><ValueChart data={account.priceHistory as unknown as Record<string, unknown>[]} currency={account.currency} dataKey="price" /></Panel>
            : <EmptyState icon="trending_up" title="Not enough valuations yet" description="Add two or more to see a trend." actionLabel={isClosed ? undefined : 'Update value'} onAction={props.onUpdateValuation} />,
        },
        {
          id: 'details',
          label: 'Details',
          content: (
            <Panel title="Details">
              <DetailList items={[
                { label: 'Size', value: account.propertySize ? `${account.propertySize} m²` : undefined },
                { label: 'Year built', value: account.yearBuilt },
                { label: 'Floors', value: account.floors },
                { label: 'Bedrooms and bathrooms', value: `${account.bedrooms || 0} and ${account.bathrooms || 0}` },
                { label: 'Features', value: features.join(', ') },
                { label: 'Bought', value: day(account.purchaseDate) },
                { label: 'Currency', value: account.currency },
              ]} />
            </Panel>
          ),
        },
      ]}
    />
  );
};

const VehiclePanel: React.FC<AccountPanelProps> = props => {
  const { account, accounts } = props;
  const isClosed = account.status === 'closed';
  const isLeased = account.ownership === 'Leased';
  const brandfetchClientId = usePreferencesSelector(p => (p.brandfetchClientId || '').trim());
  const logoOverrides = usePreferencesSelector(p => p.merchantLogoOverrides || {});
  const conversionRates = usePreferencesSelector(p => p.conversionRates);

  const { outstandingLoanBalance, sortedMileageLogs, currentMileage, leaseStats } = useMemo(
    () => computeVehicleAccountMetrics(account, accounts, props.transactions, props.loanOverrides, { conversionRates, showBalanceAdjustments: props.showBalanceAdjustments }),
    [account, accounts, props.transactions, props.loanOverrides, conversionRates, props.showBalanceAdjustments]
  );
  const newestFirst = useMemo(() => [...sortedMileageLogs].reverse(), [sortedMileageLogs]);
  const priceHistory = useMemo(() => {
    if (!account.priceHistory?.length) return [];
    const trend = calculateTrendLine(account.priceHistory, 'price');
    return account.priceHistory.map((point, index) => ({ ...point, trend: trend[index] }));
  }, [account.priceHistory]);
  const brandLogo = useMemo(() => {
    if (!brandfetchClientId || !account.make) return null;
    const key = account.make.trim().toLowerCase();
    return getMerchantLogoUrl(CAR_MAKE_DOMAINS[key] || (key.includes('.') ? key : `${key}.com`), brandfetchClientId, logoOverrides, { type: 'icon', fallback: 'transparent', width: 96, height: 96 });
  }, [account.make, brandfetchClientId, logoOverrides]);

  const target = isLeased ? leaseStats?.totalAllowance || 0 : 150000;

  return (
    <AccountFrame
      account={account}
      context={`${account.ownership || 'Owned'}, ${account.fuelType || 'vehicle'}`}
      valueLabel="Estimated value"
      banner={closureBanner(account, 'Retired:')}
      heroExtra={<>
        {account.imageUrl && <img src={account.imageUrl} alt={account.name} referrerPolicy="no-referrer" className="h-40 w-full rounded-[var(--radius-lg)] object-cover" />}
        {target > 0 && <ProgressBar value={(currentMileage / target) * 100} label="Mileage" tone="onHero" />}
      </>}
      highlights={[
        { label: 'Odometer', value: `${currentMileage.toLocaleString()} km` },
        { label: isLeased ? 'Lease allowance' : 'Lifespan target', value: `${target.toLocaleString()} km` },
        { label: 'Model year', value: account.year || '—' },
      ]}
      mainAction={!isClosed ? { id: 'value', label: 'Update value', icon: 'edit', onPress: props.onUpdateValuation } : undefined}
      actions={[{ id: 'log', label: 'Add reading', icon: 'add', onPress: props.onAddLog }, ...valuationActions(props, 'Retire vehicle')]}
      onBack={props.onBack}
      transactionsForChart={props.transactions}
      tabs={[
        {
          id: 'overview',
          label: 'Overview',
          content: (
            <>
              <MetricRow metrics={[
                { label: 'Equity', value: money(account.balance - outstandingLoanBalance, account), context: 'After linked loans' },
                { label: 'Daily use', value: `${Math.round(currentMileage / 365).toLocaleString()} km`, context: 'Estimated' },
                { label: 'Debt', value: money(outstandingLoanBalance, account), context: 'Linked loan' },
              ]} />
              {isLeased && leaseStats && (
                <Panel title="Lease" subtitle={account.leaseProvider || leaseStats.mileageStatus}>
                  <ProgressBar value={leaseStats.progress} label="Lease elapsed" className="mb-3" />
                  <DetailList items={[
                    { label: 'Status', value: leaseStats.mileageStatus },
                    { label: 'Time used', value: `${leaseStats.progress.toFixed(0)}%` },
                    { label: 'Days left', value: leaseStats.daysRemaining },
                    { label: 'Against allowance', value: `${leaseStats.mileageDiff > 0 ? '−' : '+'}${Math.abs(Math.round(leaseStats.mileageDiff)).toLocaleString()} km` },
                    { label: 'Projected final', value: `${Math.round(leaseStats.projectedMileage).toLocaleString()} km` },
                  ]} />
                </Panel>
              )}
            </>
          ),
        },
        {
          id: 'valuations',
          label: 'Valuations',
          content: (account.priceHistory?.length ?? 0) > 1
            ? <Panel title="Value over time"><ValueChart data={priceHistory} currency={account.currency} dataKey="price" trendKey="trend" /></Panel>
            : <EmptyState icon="trending_up" title="Not enough valuations yet" description="Add two or more to see a trend." actionLabel={isClosed ? undefined : 'Update value'} onAction={props.onUpdateValuation} />,
        },
        {
          id: 'mileage',
          label: 'Mileage',
          content: (
            <>
              <Panel title="Mileage"><VehicleMileageChart logs={sortedMileageLogs} /></Panel>
              <Panel title="Readings">
                {newestFirst.length === 0 && <p className="type-body text-muted">No readings yet.</p>}
                <ul className="divide-y divide-line">
                  {newestFirst.map((log, index) => {
                    const previous = newestFirst[index + 1];
                    const added = previous ? log.reading - previous.reading : 0;
                    return (
                      <li key={log.id} className="flex min-h-12 items-center gap-2">
                        <span className="type-body min-w-0 flex-1 truncate text-ink">{day(log.date)}</span>
                        {added > 0 && <span className="type-caption text-muted">+{added.toLocaleString()} km</span>}
                        <span className="type-figure-row text-ink">{log.reading.toLocaleString()} km</span>
                        <IconButton icon="edit" label={`Edit the reading from ${day(log.date)}`} onPress={() => props.onEditLog(log)} />
                        <IconButton icon="delete" label={`Delete the reading from ${day(log.date)}`} onPress={() => props.onDeleteLog(log.id)} />
                      </li>
                    );
                  })}
                </ul>
              </Panel>
            </>
          ),
        },
        {
          id: 'details',
          label: 'Details',
          content: (
            <Panel title="Details">
              {brandLogo && <img src={brandLogo} alt={account.make} referrerPolicy="no-referrer" onError={e => { e.currentTarget.style.display = 'none'; }} className="mb-3 size-10 rounded-[var(--radius-sm)]" />}
              <DetailList items={[
                { label: 'Make and model', value: `${account.make || ''} ${account.model || ''}`.trim() },
                { label: 'Plate', value: account.licensePlate ? <LicensePlate plate={account.licensePlate} countryCode={account.registrationCountryCode} /> : undefined },
                { label: 'VIN', value: account.vin },
                { label: 'Bought', value: day(account.purchaseDate) },
                { label: 'Currency', value: account.currency },
              ]} />
            </Panel>
          ),
        },
      ]}
    />
  );
};

/** Picks the panel for the account's type. Every panel renders the same frame. */
const AccountPanels: React.FC<AccountPanelProps> = props => {
  const { account } = props;
  if (account.type === 'Other Assets' && account.otherSubType === 'Cash') return <CashPanel {...props} />;
  switch (account.type) {
    case 'Property': return <PropertyPanel {...props} />;
    case 'Loan':
    case 'Lending': return <LoanPanel {...props} />;
    case 'Vehicle': return <VehiclePanel {...props} />;
    case 'Credit Card': return <CreditCardPanel {...props} />;
    case 'Savings': return <SavingsPanel {...props} />;
    case 'Investment':
      if (account.subType === 'Pension Fund') return <PensionPanel {...props} />;
      if (account.subType === 'Spare Change') return <SpareChangePanel {...props} />;
      return <GeneralPanel {...props} />;
    default: return <GeneralPanel {...props} />;
  }
};

export default AccountPanels;
