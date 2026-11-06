import React, { useMemo } from 'react';
import type { Account } from '../../types';
import { safeAdd, safeRound } from '../../utils';
import { computePensionAccountMetrics, computeSpareChangeAccountMetrics, isSavingsInterestTransaction } from '../../utils/accountDetailModel';
import { lastMonths, monthLabel, monthlyBalanceHistory } from '../../utils/accountPagesModel';
import { transferPartners } from '../../utils/accountLinks';
import { parseLocalDate } from '../../utils';
import { useWarrantsContext } from '../../contexts/DomainProviders';
import { Button } from '../ui/Actions';
import { Row } from '../ui/Display';
import { Amount } from '../ui/Money';
import { EmptyState } from '../ui/States';
import AccountShell from './AccountShell';
import { Bars, Figures, Section, TimeSeries } from './charts';
import { useLiveBalance } from './ConnectionsStrip';
import { addAction, bankDetails, commonActions, day, detailsTab, Grid2, money, pct, type AccountPanelProps } from './pageKit';
import { monthPeriods } from '../../utils/activityModel';
import { activityTab } from './ActivityView';
import MoneyFlowChart from './MoneyFlowChart';
import { useAccountPage } from './useAccountPage';

/**
 * Money in from your own accounts (transfers), money out to them, market moves and income, by month, for any
 * account whose balance is an investment.
 */
const useInvestmentFlows = (account: Account, props: AccountPanelProps) => {
  const page = useAccountPage(account, props);
  return useMemo(() => {
    const keys = lastMonths(24);
    const rows = new Map(keys.map(month => [month, { contributed: 0, withdrawn: 0, income: 0, market: 0 }]));
    let contributedAll = 0;
    let incomeYear = 0;
    let marketAll = 0;
    const yearStart = `${new Date().getFullYear()}-01-01`;
    page.own.forEach(tx => {
      const amount = page.convert(tx);
      const row = rows.get(tx.date.slice(0, 7));
      if (tx.isMarketAdjustment || (tx.isBalanceAdjustment && !tx.transferId)) {
        marketAll = safeAdd(marketAll, amount);
        if (row) row.market = safeAdd(row.market, amount);
      } else if (isSavingsInterestTransaction(tx, props.categories)) {
        if (tx.date >= yearStart) incomeYear = safeAdd(incomeYear, amount);
        if (row) row.income = safeAdd(row.income, amount);
      } else if (amount >= 0) {
        contributedAll = safeAdd(contributedAll, amount);
        if (row) row.contributed = safeAdd(row.contributed, amount);
      } else {
        contributedAll = safeAdd(contributedAll, amount);
        if (row) row.withdrawn = safeAdd(row.withdrawn, -amount);
      }
    });
    const months = keys.map(month => ({ month, name: monthLabel(month), ...rows.get(month)! }));
    // Cumulative net contributions at each month end, walked back from the all-time total.
    let running = contributedAll;
    const cumulative = new Map<string, number>();
    [...months].reverse().forEach(row => {
      cumulative.set(row.month, safeRound(running, 2));
      running = safeRound(running - (row.contributed - row.withdrawn), 2);
    });
    const history = monthlyBalanceHistory(page.todayBalance, page.amounts, 24).map(item => ({ date: item.date, value: item.value, contributed: cumulative.get(item.month) }));
    return { page, months, history, contributedAll: safeRound(contributedAll, 2), incomeYear: safeRound(incomeYear, 2), marketAll: safeRound(marketAll, 2) };
  }, [page, props.categories]);
};

/** Brokerage, ETF, stock, crypto and other investment accounts: value against what you put in. */
export const InvestmentLayout: React.FC<AccountPanelProps & { onOpenInvestments?: () => void }> = props => {
  const { account } = props;
  const balanceOf = useLiveBalance();
  const { page, months, history, contributedAll, incomeYear } = useInvestmentFlows(account, props);
  const value = account.symbol ? balanceOf(account) : page.todayBalance;
  const totalReturn = value - contributedAll;
  const returnPct = contributedAll > 0 ? (totalReturn / contributedAll) * 100 : 0;
  const sources = useMemo(() => transferPartners(account, page.transactions, page.accounts, { since: `${lastMonths(24)[0]}-01` }), [account, page.transactions, page.accounts]);
  const year = months.slice(-12);

  return (
    <AccountShell
      account={account}
      context={`${account.subType || 'Investment'}${account.symbol ? ` · ${account.symbol}` : ''}${account.financialInstitution ? `, ${account.financialInstitution}` : ''}`}
      value={value}
      valueLabel="Value"
      heroNote={contributedAll > 0 ? <><Amount value={totalReturn} currency={account.currency} /> ({returnPct >= 0 ? '+' : '−'}{Math.abs(returnPct).toFixed(1)}%) on what you put in</> : undefined}
      kpis={[
        { label: 'Put in', value: money(contributedAll, account), context: 'Net of withdrawals' },
        { label: 'Total return', value: money(totalReturn, account), context: contributedAll > 0 ? pct(returnPct, 1) : undefined },
        { label: 'Income this year', value: money(incomeYear, account), context: 'Dividends and interest' },
        { label: 'Added, 12 months', value: money(year.reduce((sum, row) => sum + row.contributed - row.withdrawn, 0), account) },
      ]}
      links={page.links}
      siblings={page.siblings}
      onOpenAccount={props.onOpenAccount}
      onOpenGoals={props.onOpenGoals}
      mainAction={addAction(props)}
      actions={[...commonActions(props, !account.symbol), ...(props.onOpenInvestments ? [{ id: 'hub', label: 'Open Investments', icon: 'chart-line-data-01', onPress: props.onOpenInvestments }] : [])]}
      onBack={props.onBack}
      tabs={[
        {
          id: 'overview',
          label: 'Overview',
          content: (
            <>
              <Section title="Value and what you put in" subtitle="The gap between the lines is your return">
                <TimeSeries data={history} series={[{ key: 'value', label: 'Value', color: 'var(--chart-1)' }, { key: 'contributed', label: 'Put in', color: 'var(--chart-3)', dashed: true }]} currency={account.currency} />
              </Section>
              <Grid2>
                <Section title="Contributions" subtitle="Last 12 months">
                  <MoneyFlowChart periods={monthPeriods(year.map(row => ({ month: row.month, in: row.contributed, out: row.withdrawn })))} currency={account.currency} labels={{ in: 'In', out: 'Out', balance: 'Value' }} hint="Pick a month to see it" showDetail={false} />
                </Section>
                <Section title="Income" subtitle="Dividends and interest, last 12 months">
                  {year.some(row => row.income > 0)
                    ? <Bars data={year} bars={[{ key: 'income', label: 'Income', color: 'var(--chart-2)' }]} currency={account.currency} />
                    : <p className="type-body text-muted">No dividends or interest recorded in the last year.</p>}
                </Section>
              </Grid2>
              <Section title="Funded from" subtitle="Accounts that moved money here in the last two years">
                {sources.length === 0 ? <p className="type-body text-muted">No transfers from your other accounts yet.</p> : (
                  <ul className="divide-y divide-line">
                    {sources.map(source => <li key={source.account.id}><Row title={source.account.name} context={`${source.count} transfers`} trailing={<span className="type-caption text-muted">{source.account.type}</span>} onPress={() => props.onOpenAccount(source.account.id)} /></li>)}
                  </ul>
                )}
              </Section>
              {account.symbol && props.onOpenInvestments && (
                <Section title="Holdings" subtitle={`Trades and prices for ${account.symbol} live in the Investments hub`}>
                  <Button variant="secondary" icon="chart-line-data-01" onPress={props.onOpenInvestments}>Open Investments</Button>
                </Section>
              )}
            </>
          ),
        },
        activityTab(props),
        detailsTab([...bankDetails(account), { label: 'Kind', value: account.subType }, { label: 'Symbol', value: account.symbol, copy: account.symbol }]),
      ]}
    />
  );
};

/** Warrants: units, today's price against the grant, and the tax still owed on them. */
export const WarrantLayout: React.FC<AccountPanelProps & { onOpenInvestments?: () => void }> = props => {
  const { account } = props;
  const page = useAccountPage(account, props);
  const balanceOf = useLiveBalance();
  const { warrants, prices } = useWarrantsContext();
  const grants = warrants.filter(item => item.isin === account.symbol);
  const units = grants.reduce((sum, item) => sum + item.quantity, 0);
  const granted = grants.reduce((sum, item) => sum + item.quantity * item.grantPrice, 0);
  const price = account.symbol ? prices[account.symbol] ?? null : null;
  const value = balanceOf(account);
  const tax = grants.reduce((sum, item) => sum + (item.taxAmount || 0), 0);
  const history = (account.priceHistory || []).map(item => ({ date: parseLocalDate(item.date), price: item.price }));
  return (
    <AccountShell
      account={account}
      context={`Warrants${account.symbol ? ` · ${account.symbol}` : ''}`}
      value={value}
      valueLabel="Value"
      heroNote={granted > 0 ? <><Amount value={value - granted} currency={account.currency} /> against the grant price</> : undefined}
      kpis={[
        { label: 'Units', value: units.toLocaleString() },
        { label: 'Price', value: price !== null ? money(price, account) : '—', context: 'Manual or bound price' },
        { label: 'Granted at', value: money(granted, account) },
        { label: 'Tax on grants', value: money(tax, account) },
      ]}
      links={page.links}
      siblings={page.siblings}
      onOpenAccount={props.onOpenAccount}
      onOpenGoals={props.onOpenGoals}
      actions={[...commonActions(props, false), ...(props.onOpenInvestments ? [{ id: 'hub', label: 'Open Investments', icon: 'chart-line-data-01', onPress: props.onOpenInvestments }] : [])]}
      onBack={props.onBack}
      tabs={[
        {
          id: 'overview',
          label: 'Overview',
          content: (
            <>
              {history.length > 1 && (
                <Section title="Price">
                  <TimeSeries data={history} series={[{ key: 'price', label: 'Price', color: 'var(--chart-1)' }]} currency={account.currency} />
                </Section>
              )}
              <Section title="Grants">
                {grants.length === 0 ? <EmptyState icon="certificate-01" title="No grants" description="Add grants in the Investments hub." /> : (
                  <ul className="divide-y divide-line">
                    {grants.map(grant => <li key={grant.id}><Row title={`${grant.quantity.toLocaleString()} units`} context={`Granted ${day(grant.grantDate)} at ${grant.grantPrice}`} trailing={money(price !== null ? grant.quantity * price : grant.quantity * grant.grantPrice, account)} /></li>)}
                  </ul>
                )}
              </Section>
            </>
          ),
        },
        activityTab(props),
        detailsTab([{ label: 'ISIN', value: account.symbol, copy: account.symbol }, { label: 'Currency', value: account.currency }]),
      ]}
    />
  );
};

/** Pensions: history and a projection to the retirement year, with contributions by year. */
export const PensionLayout: React.FC<AccountPanelProps> = props => {
  const { account } = props;
  const page = useAccountPage(account, props);
  const metrics = useMemo(
    () => computePensionAccountMetrics(account, props.accountTransactions.map(item => item.tx), { conversionRates: page.conversionRates, showBalanceAdjustments: props.showBalanceAdjustments }),
    [account, props.accountTransactions, page.conversionRates, props.showBalanceAdjustments]
  );
  const todayKey = new Date().toISOString().slice(0, 7);
  const chart = useMemo(() => {
    const rows = metrics.chartData.map(item => ({ date: parseLocalDate(`${String(item.date).slice(0, 7)}-01`), value: item.balance, contributed: item.contributions }));
    const todayIndex = Math.max(0, metrics.chartData.findIndex(item => String(item.date).slice(0, 7) > todayKey) - 1);
    return { rows, todayIndex: todayIndex < 0 ? rows.length - 1 : todayIndex };
  }, [metrics.chartData, todayKey]);
  const byYear = useMemo(() => {
    const years = new Map<string, number>();
    page.own.forEach(tx => {
      if (tx.isMarketAdjustment || tx.isBalanceAdjustment) return;
      const amount = page.convert(tx);
      if (amount > 0) years.set(tx.date.slice(0, 4), safeAdd(years.get(tx.date.slice(0, 4)) || 0, amount));
    });
    return Array.from(years.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-10).map(([year, value]) => ({ year, value }));
  }, [page.own, page.convert]);

  return (
    <AccountShell
      account={account}
      context={`Pension${metrics.retirementYear ? `, retiring ${metrics.retirementYear}` : ''}${account.financialInstitution ? `, ${account.financialInstitution}` : ''}`}
      value={metrics.realTodayBalance}
      heroNote={metrics.projectedValueAtRetirement !== null ? <>About <Amount value={metrics.projectedValueAtRetirement} currency={account.currency} /> at retirement, at {metrics.expectedReturnPct}% a year</> : 'Set the retirement year and expected growth in Edit to see a projection'}
      kpis={[
        { label: 'Paid in', value: money(metrics.totalContributions, account) },
        { label: 'Growth', value: money(metrics.totalGrowth, account), context: metrics.annualizedReturnPct !== null ? `${metrics.annualizedReturnPct}% a year` : undefined },
        { label: 'A month', value: money(metrics.monthlyContributionAvg, account), context: 'Average of 12 months' },
        { label: 'Years left', value: metrics.yearsToRetirement ?? '—' },
      ]}
      links={page.links}
      siblings={page.siblings}
      onOpenAccount={props.onOpenAccount}
      onOpenGoals={props.onOpenGoals}
      mainAction={addAction(props, 'Add contribution')}
      actions={commonActions(props)}
      onBack={props.onBack}
      tabs={[
        {
          id: 'overview',
          label: 'Overview',
          content: (
            <>
              <Section title="History and projection" subtitle="Assumes steady growth and contributions">
                <TimeSeries data={chart.rows} series={[{ key: 'value', label: 'Value', color: 'var(--chart-1)', dashFromIndex: chart.todayIndex }, { key: 'contributed', label: 'Paid in', color: 'var(--chart-3)', dashed: true }]} currency={account.currency} />
              </Section>
              <Section title="Contributions by year">
                {byYear.length ? <Bars data={byYear} xKey="year" bars={[{ key: 'value', label: 'Paid in', color: 'var(--chart-1)' }]} currency={account.currency} /> : <p className="type-body text-muted">No contributions yet.</p>}
              </Section>
            </>
          ),
        },
        activityTab(props),
        detailsTab([...bankDetails(account), { label: 'Growth rate', value: account.apy ? `${account.apy}%` : undefined }, { label: 'Retirement year', value: metrics.retirementYear ?? undefined }]),
      ]}
    />
  );
};

/** Spare change: what round-ups saved, from which account, and where they go. */
export const SpareChangeLayout: React.FC<AccountPanelProps> = props => {
  const { account } = props;
  const page = useAccountPage(account, props);
  const metrics = useMemo(
    () => computeSpareChangeAccountMetrics(account, page.accounts, props.accountTransactions.map(item => item.tx), { conversionRates: page.conversionRates, showBalanceAdjustments: props.showBalanceAdjustments }),
    [account, page.accounts, props.accountTransactions, page.conversionRates, props.showBalanceAdjustments]
  );
  return (
    <AccountShell
      account={account}
      context={`Round-ups from ${metrics.sourceAccount?.name || 'an external account'}`}
      value={metrics.realTodayBalance}
      heroNote={`${metrics.totalRoundUps} round-ups so far, about ${metrics.coffeesSaved} coffees`}
      kpis={[
        { label: 'This month', value: money(metrics.thisMonthSaved, account) },
        { label: 'Average round-up', value: money(metrics.avgRoundUp, account) },
        { label: 'Biggest', value: money(metrics.biggestRoundUp, account) },
        { label: 'Added by hand', value: money(metrics.manualDeposits, account) },
      ]}
      links={page.links}
      siblings={page.siblings}
      onOpenAccount={props.onOpenAccount}
      onOpenGoals={props.onOpenGoals}
      mainAction={addAction(props)}
      actions={commonActions(props)}
      onBack={props.onBack}
      tabs={[
        {
          id: 'overview',
          label: 'Overview',
          content: (
            <Grid2>
              <Section title="Saved by month">
                <Bars data={metrics.monthlyData as unknown as Record<string, unknown>[]} bars={[{ key: 'value', label: 'Saved', color: 'var(--chart-1)' }]} currency={account.currency} />
              </Section>
              <Section title="Where round-ups come from">
                {metrics.sourceAccount ? (
                  <div className="space-y-3">
                    <Figures items={[{ label: 'Source', value: metrics.sourceAccount.name }, { label: 'Saved in all', value: money(metrics.totalRoundUpSaved, account) }]} />
                    <Button variant="secondary" size="sm" icon="arrow-right-01" onPress={() => props.onOpenAccount(metrics.sourceAccount!.id)}>Open {metrics.sourceAccount.name}</Button>
                  </div>
                ) : <p className="type-body text-muted">No source account linked. Set one in Edit.</p>}
              </Section>
            </Grid2>
          ),
        },
        activityTab(props),
        detailsTab([{ label: 'Rounds up from', value: metrics.sourceAccount?.name || 'External account' }, ...bankDetails(account)]),
      ]}
    />
  );
};
