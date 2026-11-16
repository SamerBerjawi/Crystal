import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Account, SpareChangeSettings } from '../../types';
import { formatCurrency, safeAdd, safeRound } from '../../utils';
import {
  buildSpareChangeGamification,
  computePensionAccountMetrics,
  computePensionScenarioProjection,
  computeSpareChangeAccountMetrics,
  isSavingsInterestTransaction,
  SPARE_CHANGE_DEFAULT_EQUIVALENTS,
} from '../../utils/accountDetailModel';
import { lastMonths, monthLabel, monthlyBalanceHistory } from '../../utils/accountPagesModel';
import { transferPartners } from '../../utils/accountLinks';
import { parseLocalDate } from '../../utils';
import { usePreferencesContext, useWarrantsContext } from '../../contexts/DomainProviders';
import { Button } from '../ui/Actions';
import { Badge, Row } from '../ui/Display';
import { Slider, Switch, TextInput } from '../ui/Fields';
import Icon from '../ui/Icon';
import { Amount } from '../ui/Money';
import { Dialog } from '../ui/Overlays';
import SegmentedControl from '../ui/SegmentedControl';
import { EmptyState } from '../ui/States';
import AccountShell from './AccountShell';
import { Bars, Board, Figures, Section, ShareBar, TimeSeries } from './charts';
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
            <Board>
              <Section span="wide" rows={2} title="Value and what you put in" subtitle="The gap between the lines is your return">
                <TimeSeries data={history} series={[{ key: 'value', label: 'Value', color: 'var(--chart-1)' }, { key: 'contributed', label: 'Put in', color: 'var(--chart-3)', dashed: true }]} currency={account.currency} height="fill" />
              </Section>
              <Section span="side" title="Funded from" subtitle="Accounts that moved money here in the last two years">
                {sources.length === 0 ? <p className="type-body text-muted">No transfers from your other accounts yet.</p> : (
                  <ul className="divide-y divide-line">
                    {sources.map(source => <li key={source.account.id}><Row title={source.account.name} context={`${source.count} transfers`} trailing={<span className="type-caption text-muted">{source.account.type}</span>} onPress={() => props.onOpenAccount(source.account.id)} /></li>)}
                  </ul>
                )}
              </Section>
              {account.symbol && props.onOpenInvestments && (
                <Section span="side" title="Holdings" subtitle={`Trades and prices for ${account.symbol} live in the Investments hub`}>
                  <Button variant="secondary" icon="chart-line-data-01" onPress={props.onOpenInvestments}>Open Investments</Button>
                </Section>
              )}
                <Section span="wide" title="Contributions" subtitle="Last 12 months">
                  <MoneyFlowChart periods={monthPeriods(year.map(row => ({ month: row.month, in: row.contributed, out: row.withdrawn })))} currency={account.currency} labels={{ in: 'In', out: 'Out', balance: 'Value' }} hint="Pick a month to see it" showDetail={false} />
                </Section>
                <Section span="side" title="Income" subtitle="Dividends and interest, last 12 months">
                  {year.some(row => row.income > 0)
                    ? <Bars data={year} bars={[{ key: 'income', label: 'Income', color: 'var(--chart-2)' }]} currency={account.currency} />
                    : <p className="type-body text-muted">No dividends or interest recorded in the last year.</p>}
                </Section>
            </Board>
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
            <Board>
              {history.length > 1 && (
                <Section span="wide" title="Price">
                  <TimeSeries data={history} series={[{ key: 'price', label: 'Price', color: 'var(--chart-1)' }]} currency={account.currency} height="fill" />
                </Section>
              )}
              <Section span={history.length > 1 ? 'side' : 'full'} title="Grants">
                {grants.length === 0 ? <EmptyState icon="certificate-01" title="No grants" description="Add grants in the Investments hub." /> : (
                  <ul className="divide-y divide-line">
                    {grants.map(grant => <li key={grant.id}><Row title={`${grant.quantity.toLocaleString()} units`} context={`Granted ${day(grant.grantDate)} at ${grant.grantPrice}`} trailing={money(price !== null ? grant.quantity * price : grant.quantity * grant.grantPrice, account)} /></li>)}
                  </ul>
                )}
              </Section>
            </Board>
          ),
        },
        activityTab(props),
        detailsTab([{ label: 'ISIN', value: account.symbol, copy: account.symbol }, { label: 'Currency', value: account.currency }]),
      ]}
    />
  );
};

/** Pensions: history, interactive scenario projection with return bands, and annual contributions vs. growth. */
export const PensionLayout: React.FC<AccountPanelProps> = props => {
  const { account } = props;
  const page = useAccountPage(account, props);
  const metrics = useMemo(
    () => computePensionAccountMetrics(account, props.accountTransactions.map(item => item.tx), { conversionRates: page.conversionRates, showBalanceAdjustments: props.showBalanceAdjustments }),
    [account, props.accountTransactions, page.conversionRates, props.showBalanceAdjustments]
  );

  const currentYear = new Date().getFullYear();
  const savedContrib = Math.round(metrics.monthlyContributionAvg);
  const savedRate = metrics.expectedReturnPct ?? 6;
  const savedRetireYear = metrics.retirementYear ?? currentYear + 20;

  const [monthlyContrib, setMonthlyContrib] = useState(savedContrib);
  const [returnRate, setReturnRate] = useState(savedRate);
  const [targetYear, setTargetYear] = useState(savedRetireYear);
  const [showBand, setShowBand] = useState(true);
  const [viewMode, setViewMode] = useState<'trajectory' | 'yearly'>('trajectory');

  useEffect(() => {
    setMonthlyContrib(Math.round(metrics.monthlyContributionAvg));
    setReturnRate(metrics.expectedReturnPct ?? 6);
    setTargetYear(metrics.retirementYear ?? new Date().getFullYear() + 20);
  }, [account.id, metrics.monthlyContributionAvg, metrics.expectedReturnPct, metrics.retirementYear]);

  const historicalRows = useMemo(
    () => metrics.chartData.filter(item => item.type === 'History').map(item => ({ date: item.date, balance: item.balance, contributions: item.contributions })),
    [metrics.chartData]
  );

  const scenario = useMemo(
    () => computePensionScenarioProjection({
      currentBalance: metrics.realTodayBalance,
      currentContributions: metrics.totalContributions,
      historicalData: historicalRows,
      monthlyContribution: monthlyContrib,
      annualReturnPct: returnRate,
      retirementYear: targetYear,
      showBand,
    }),
    [metrics.realTodayBalance, metrics.totalContributions, historicalRows, monthlyContrib, returnRate, targetYear, showBand]
  );

  const byYear = useMemo(() => {
    const years = new Map<string, number>();
    page.own.forEach(tx => {
      if (tx.isMarketAdjustment || tx.isBalanceAdjustment) return;
      const amount = page.convert(tx);
      if (amount > 0) years.set(tx.date.slice(0, 4), safeAdd(years.get(tx.date.slice(0, 4)) || 0, amount));
    });
    return Array.from(years.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-10).map(([year, value]) => ({ year, value }));
  }, [page.own, page.convert]);

  const isScenarioModified = monthlyContrib !== savedContrib || returnRate !== savedRate || targetYear !== savedRetireYear;
  const accountSettingsChanged = returnRate !== (account.apy ?? 0) || targetYear !== (account.expectedRetirementYear ?? 0);
  const safeCurrency = account.currency === 'BTC' ? 'EUR' : account.currency;
  const maxSliderContrib = Math.max(2500, Math.ceil(Math.max(500, savedContrib * 3) / 100) * 100);

  return (
    <AccountShell
      account={account}
      context={`Pension${metrics.retirementYear ? `, retiring ${metrics.retirementYear}` : ''}${account.financialInstitution ? `, ${account.financialInstitution}` : ''}`}
      value={metrics.realTodayBalance}
      heroNote={metrics.projectedValueAtRetirement !== null ? <>About <Amount value={metrics.projectedValueAtRetirement} currency={account.currency} /> at retirement, at {metrics.expectedReturnPct}% a year</> : 'Use the growth explorer below or set a retirement year and return in Edit'}
      kpis={[
        { label: 'Paid in', value: money(metrics.totalContributions, account) },
        { label: 'Growth', value: money(metrics.totalGrowth, account), context: metrics.annualizedReturnPct !== null ? `${metrics.annualizedReturnPct}% XIRR` : undefined },
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
            <Board>
              <Section
                span="wide"
                rows={2}
                title="Growth & retirement projection"
                subtitle="Recorded history up to today; dashed lines illustrate your selected assumptions"
                action={(
                  <SegmentedControl
                    items={[{ id: 'trajectory', label: 'Trajectory' }, { id: 'yearly', label: 'Contributions vs. growth' }]}
                    activeId={viewMode}
                    onChange={id => setViewMode(id as 'trajectory' | 'yearly')}
                  />
                )}
              >
                <div className="flex h-full flex-col gap-4">
                  <Figures
                    items={[
                      {
                        label: `Projected (${targetYear})`,
                        value: money(scenario.projectedAtRetirement, account),
                        note: `${returnRate}% return · ${formatCurrency(monthlyContrib, account.currency)}/mo`,
                      },
                      {
                        label: 'Compounded growth',
                        value: money(scenario.totalGrowthAtRetirement, account),
                        note: `${pct(scenario.growthSharePct)} of final pot`,
                      },
                      {
                        label: 'Est. 4% drawdown',
                        value: <><Amount value={scenario.sustainableMonthlyDrawdown} currency={account.currency} /><span className="type-caption text-muted">/mo</span></>,
                        note: scenario.crossoverYear ? `Growth exceeds paid-in by ${scenario.crossoverYear}` : undefined,
                      },
                    ]}
                  />
                  <div className="min-h-[240px] flex-1">
                    {viewMode === 'trajectory' ? (
                      <TimeSeries
                        height="fill"
                        data={scenario.points}
                        currency={account.currency}
                        markers={[{ date: new Date(), title: 'Today', color: 'var(--muted)' }]}
                        series={[
                          { key: 'value', label: 'Projected value', color: 'var(--chart-1)', dashFromIndex: scenario.todayIndex },
                          { key: 'contributed', label: 'Paid in', color: 'var(--chart-3)', dashed: true },
                          { key: 'growth', label: 'Investment growth', color: 'var(--money-in)', dashFromIndex: scenario.todayIndex },
                          ...(showBand ? [
                            { key: 'optimistic', label: `${returnRate + 2}% scenario`, color: 'var(--teal)', dashed: true, width: 1.5 },
                            { key: 'conservative', label: `${Math.max(0, returnRate - 2)}% scenario`, color: 'var(--amber)', dashed: true, width: 1.5 },
                          ] : []),
                        ]}
                      />
                    ) : (
                      <Bars
                        data={scenario.yearlyBars}
                        xKey="year"
                        stacked
                        bars={[
                          { key: 'contributed', label: 'Contributions', color: 'var(--chart-3)' },
                          { key: 'growth', label: 'Investment growth', color: 'var(--money-in)' },
                        ]}
                        currency={account.currency}
                        height="fill"
                      />
                    )}
                  </div>
                </div>
              </Section>

              <Section span="side" title="Growth assumptions" subtitle="Illustrative planner — explore different paces and return rates">
                <div className="space-y-4">
                  <Slider
                    label="Monthly contribution"
                    value={monthlyContrib}
                    minValue={0}
                    maxValue={maxSliderContrib}
                    step={25}
                    onChange={val => setMonthlyContrib(Array.isArray(val) ? val[0] : val)}
                    formatOptions={{ style: 'currency', currency: safeCurrency, maximumFractionDigits: 0 }}
                  />
                  <Slider
                    label="Expected annual return (%)"
                    value={returnRate}
                    minValue={0}
                    maxValue={14}
                    step={0.5}
                    onChange={val => setReturnRate(Array.isArray(val) ? val[0] : val)}
                    formatOptions={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }}
                  />
                  <Slider
                    label="Target retirement year"
                    value={targetYear}
                    minValue={currentYear + 1}
                    maxValue={currentYear + 45}
                    step={1}
                    onChange={val => setTargetYear(Array.isArray(val) ? val[0] : val)}
                    formatOptions={{ useGrouping: false }}
                  />
                  <Switch isSelected={showBand} onChange={setShowBand}>Show ±2% return sensitivity band</Switch>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {isScenarioModified && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() => {
                          setMonthlyContrib(savedContrib);
                          setReturnRate(savedRate);
                          setTargetYear(savedRetireYear);
                        }}
                      >
                        Reset
                      </Button>
                    )}
                    {props.onSaveAccount && accountSettingsChanged && (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon="tick-02"
                        onPress={() => {
                          props.onSaveAccount!({ ...account, apy: returnRate, expectedRetirementYear: targetYear });
                          toast.success('Pension return & retirement year saved');
                        }}
                      >
                        Save to account
                      </Button>
                    )}
                  </div>
                </div>
              </Section>

              <Section span="side" title="Recorded contributions by year">
                {byYear.length ? <Bars data={byYear} xKey="year" bars={[{ key: 'value', label: 'Paid in', color: 'var(--chart-1)' }]} currency={account.currency} /> : <p className="type-body text-muted">No contributions recorded yet.</p>}
              </Section>
            </Board>
          ),
        },
        activityTab(props),
        detailsTab([...bankDetails(account), { label: 'Growth rate', value: account.apy ? `${account.apy}%` : undefined }, { label: 'Retirement year', value: metrics.retirementYear ?? undefined }]),
      ]}
    />
  );
};

/** Spare change: relatable equivalents, streak & milestones, and round-up source details. */
export const SpareChangeLayout: React.FC<AccountPanelProps> = props => {
  const { account } = props;
  const page = useAccountPage(account, props);
  const { preferences, setPreferences } = usePreferencesContext();
  const metrics = useMemo(
    () => computeSpareChangeAccountMetrics(account, page.accounts, props.accountTransactions.map(item => item.tx), { conversionRates: page.conversionRates, showBalanceAdjustments: props.showBalanceAdjustments }),
    [account, page.accounts, props.accountTransactions, page.conversionRates, props.showBalanceAdjustments]
  );

  const gamification = useMemo(
    () => buildSpareChangeGamification(metrics, preferences.spareChange),
    [metrics, preferences.spareChange]
  );

  const [isCustomOpen, setCustomOpen] = useState(false);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [customLabel, setCustomLabel] = useState('');
  const [customPrice, setCustomPrice] = useState('');

  const openCustomDialog = () => {
    const drafts: Record<string, string> = {};
    SPARE_CHANGE_DEFAULT_EQUIVALENTS.forEach(item => {
      drafts[item.id] = String(preferences.spareChange?.customPrices?.[item.id] ?? item.defaultPrice);
    });
    setPriceDrafts(drafts);
    setCustomLabel(preferences.spareChange?.customItem?.label ?? '');
    setCustomPrice(preferences.spareChange?.customItem?.unitPrice ? String(preferences.spareChange.customItem.unitPrice) : '');
    setCustomOpen(true);
  };

  const saveCustomSettings = () => {
    const customPrices: Record<string, number> = {};
    SPARE_CHANGE_DEFAULT_EQUIVALENTS.forEach(item => {
      const parsed = parseFloat((priceDrafts[item.id] ?? '').replace(',', '.'));
      if (Number.isFinite(parsed) && parsed > 0 && Math.abs(parsed - item.defaultPrice) > 0.001) {
        customPrices[item.id] = safeRound(parsed, 2);
      }
    });
    const parsedCustom = parseFloat(customPrice.replace(',', '.'));
    const nextSettings: SpareChangeSettings = {
      customPrices: Object.keys(customPrices).length ? customPrices : undefined,
      customItem: customLabel.trim() && Number.isFinite(parsedCustom) && parsedCustom > 0
        ? { label: customLabel.trim(), unitPrice: safeRound(parsedCustom, 2), icon: 'sparkles' }
        : undefined,
    };
    setPreferences(prev => ({ ...prev, spareChange: nextSettings }));
    setCustomOpen(false);
    toast.success('Equivalents personalized');
  };

  const leadEq = gamification.equivalents[0];
  const heroEquivalentText = leadEq && leadEq.count > 0
    ? `enough for ${leadEq.count} ${leadEq.pluralLabel}`
    : `${gamification.unlockedCount}/${gamification.milestones.length} milestones unlocked`;

  return (
    <>
      <AccountShell
        account={account}
        context={`Round-ups from ${metrics.sourceAccount?.name || 'an external account'}`}
        value={metrics.realTodayBalance}
        heroNote={`${metrics.totalRoundUps} round-ups captured · ${heroEquivalentText}`}
        kpis={[
          { label: 'This month', value: money(metrics.thisMonthSaved, account) },
          { label: 'Average round-up', value: money(metrics.avgRoundUp, account) },
          { label: 'Biggest capture', value: money(metrics.biggestRoundUp, account) },
          { label: 'Active streak', value: `${gamification.activeMonthStreak} ${gamification.activeMonthStreak === 1 ? 'month' : 'months'}`, context: <>~{money(gamification.projectedYearlySavings, account)}/yr pace</> },
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
              <Board>
                <Section
                  span="wide"
                  title="What your spare change buys"
                  subtitle="Relatable equivalents calculated from your real round-up savings"
                  action={
                    <Button size="sm" variant="secondary" icon="sliders-horizontal" onPress={openCustomDialog}>
                      Customize
                    </Button>
                  }
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {gamification.equivalents.map(eq => (
                      <div
                        key={eq.id}
                        className="flex flex-col justify-between gap-2.5 rounded-[var(--radius-lg)] border border-line bg-inset p-3.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-primary-soft text-primary">
                            <Icon name={eq.icon} size={18} />
                          </span>
                          {eq.thisMonthCount > 0 && (
                            <Badge tone="positive">+{eq.thisMonthCount} this mo</Badge>
                          )}
                        </div>
                        <div>
                          <p className="type-figure-row text-ink tabular-nums">
                            {eq.count} <span className="type-body text-muted">{eq.pluralLabel}</span>
                          </p>
                          <p className="type-caption text-muted">
                            At <Amount value={eq.unitPrice} currency={account.currency} /> each
                          </p>
                        </div>
                        <div className="space-y-1">
                          <ShareBar value={eq.progressPct} label={`Progress to next ${eq.label}`} />
                          <p className="type-caption text-muted">
                            <Amount value={eq.amountToNext} currency={account.currency} /> to #{eq.count + 1}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>

                <Section
                  span="side"
                  title="Milestones & momentum"
                  subtitle={`${gamification.unlockedCount} of ${gamification.milestones.length} unlocked`}
                  action={
                    <Badge tone={gamification.unlockedCount === gamification.milestones.length ? 'positive' : 'attention'} icon="award">
                      {gamification.unlockedCount}/{gamification.milestones.length}
                    </Badge>
                  }
                >
                  <div className="space-y-3">
                    {gamification.nextMilestone ? (
                      <div className="rounded-[var(--radius-lg)] border border-line bg-inset p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="type-caption font-semibold text-ink">Next: {gamification.nextMilestone.title}</span>
                          <Badge tone="attention">{gamification.nextMilestone.badgeText}</Badge>
                        </div>
                        <p className="type-caption mt-0.5 text-muted">{gamification.nextMilestone.description}</p>
                        <div className="mt-2">
                          <ShareBar value={gamification.nextMilestone.progressPct} label={gamification.nextMilestone.title} tone="warn" />
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-[var(--radius-lg)] bg-money-in-soft p-3 text-ink">
                        <div className="flex items-center gap-2 font-semibold">
                          <Icon name="sparkles" size={16} className="text-money-in" />
                          <span className="type-body-strong">All round-up milestones unlocked!</span>
                        </div>
                        <p className="type-caption mt-0.5 text-muted">Every badge earned from steady micro-savings.</p>
                      </div>
                    )}

                    <ul className="space-y-2">
                      {gamification.milestones.map(m => (
                        <li
                          key={m.id}
                          className="flex items-center gap-2.5 rounded-[var(--radius-md)] border border-line px-3 py-2"
                        >
                          <span
                            className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
                              m.unlocked ? 'bg-money-in-soft text-money-in' : 'bg-inset text-muted'
                            }`}
                          >
                            <Icon name={m.unlocked ? 'tick-02' : m.icon} size={14} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="type-caption font-semibold truncate text-ink">{m.title}</p>
                            <p className="type-caption truncate text-muted">{m.description}</p>
                          </div>
                          <Badge tone={m.unlocked ? 'positive' : 'neutral'}>{m.badgeText}</Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Section>

                <Section span="wide" title="Saved by month">
                  <Bars data={metrics.monthlyData as unknown as Record<string, unknown>[]} bars={[{ key: 'value', label: 'Saved', color: 'var(--chart-1)' }]} currency={account.currency} />
                </Section>

                <Section span="side" title="Where round-ups come from">
                  {metrics.sourceAccount ? (
                    <div className="space-y-3">
                      <Figures items={[{ label: 'Source', value: metrics.sourceAccount.name }, { label: 'Saved in all', value: money(metrics.totalRoundUpSaved, account) }, { label: 'Added by hand', value: money(metrics.manualDeposits, account) }]} />
                      <Button variant="secondary" size="sm" icon="arrow-right-01" onPress={() => props.onOpenAccount(metrics.sourceAccount!.id)}>Open {metrics.sourceAccount.name}</Button>
                    </div>
                  ) : <p className="type-body text-muted">No source account linked. Set one in Edit.</p>}
                </Section>
              </Board>
            ),
          },
          activityTab(props),
          detailsTab([{ label: 'Rounds up from', value: metrics.sourceAccount?.name || 'External account' }, ...bankDetails(account)]),
        ]}
      />

      <Dialog
        isOpen={isCustomOpen}
        onClose={() => setCustomOpen(false)}
        title="Customize equivalents"
        description={`Adjust prices in ${account.currency} or add a personal treat you're saving toward.`}
        footer={(
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onPress={() => {
                setPreferences(prev => ({ ...prev, spareChange: undefined }));
                setCustomOpen(false);
                toast.success('Reset equivalents to defaults');
              }}
            >
              Reset defaults
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onPress={() => setCustomOpen(false)}>Cancel</Button>
              <Button onPress={saveCustomSettings}>Save</Button>
            </div>
          </div>
        )}
      >
        <div className="space-y-5">
          <div className="space-y-3 rounded-[var(--radius-lg)] border border-line bg-inset p-3.5">
            <h4 className="type-label text-muted">Your custom treat or goal</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput
                label="Item label (plural)"
                value={customLabel}
                onChange={setCustomLabel}
                placeholder="e.g. concert tickets"
              />
              <TextInput
                label={`Price (${account.currency})`}
                inputMode="decimal"
                value={customPrice}
                onChange={setCustomPrice}
                placeholder="e.g. 65"
              />
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="type-label text-muted">Everyday items ({account.currency})</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {SPARE_CHANGE_DEFAULT_EQUIVALENTS.map(item => (
                <TextInput
                  key={item.id}
                  label={item.label}
                  inputMode="decimal"
                  value={priceDrafts[item.id] ?? String(item.defaultPrice)}
                  onChange={val => setPriceDrafts(prev => ({ ...prev, [item.id]: val }))}
                />
              ))}
            </div>
          </div>
        </div>
      </Dialog>
    </>
  );
};
