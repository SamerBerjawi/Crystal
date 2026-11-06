import React, { useMemo } from 'react';
import type { Account, Category, Transaction } from '../../types';
import { flattenCategories, getCreditCardStatementDetails, parseLocalDate, safeAdd, safeRound } from '../../utils';
import { accountHasCard, computeAccountDisplayBalance, isMealVoucherAccount, topMerchantsThisMonth } from '../../utils/accountsModel';
import { computeOperatingAccountMetrics, computeSavingsAccountMetrics, isSavingsInterestTransaction } from '../../utils/accountDetailModel';
import { dailyBalanceHistory, isoMonth, lastMonths, monthLabel, monthlyBalanceHistory, monthlyFlows, splitByLabel, statementPeriodFor } from '../../utils/accountPagesModel';
import { transferPartners } from '../../utils/accountLinks';
import { liveSeries } from '../../utils/scheduleModel';
import { warrantTaxBills } from '../../utils/forecastModel';
import { usePreferencesSelector, useWarrantsContext } from '../../contexts/DomainProviders';
import { useScheduleContext } from '../../contexts/FinancialDataContext';
import { useInsightsView } from '../../contexts/InsightsViewContext';
import CardFace from '../CardFace';
import { MerchantLogo } from '../EntityIcon';
import { Row } from '../ui/Display';
import { Amount } from '../ui/Money';
import { EmptyState } from '../ui/States';
import AccountShell from './AccountShell';
import { Bars, Donut, Figures, ProgressRings, Section, ShareBar, TimeSeries } from './charts';
import { activityTab, addAction, bankDetails, commonActions, day, daysUntil, detailsTab, Grid2, money, shortDay, type AccountPanelProps } from './pageKit';
import { useAccountPage, useAccountProjection, useBalanceChange } from './useAccountPage';

const categoryLookup = (categories: Category[]) => {
  const flat = flattenCategories(categories);
  return (value: string) => {
    const match = flat.find(item => item.id === value || item.name.toLowerCase() === (value || '').toLowerCase());
    const parent = match?.parentId ? flat.find(item => item.id === match.parentId) : undefined;
    return { label: (parent ?? match)?.name ?? (value || 'Uncategorised'), color: (parent ?? match)?.color };
  };
};

const thisMonth = () => isoMonth(new Date());

/** Spending by top-level category this month, in the account's currency. */
const useCategorySplit = (own: Transaction[], convert: (tx: Transaction) => number, categories: Category[]) =>
  useMemo(() => {
    const lookup = categoryLookup(categories);
    const month = thisMonth();
    const colours = new Map<string, string | undefined>();
    const items = own
      .filter(tx => tx.date.startsWith(month) && convert(tx) < 0 && !tx.transferId && !tx.isBalanceAdjustment)
      .map(tx => {
        const { label, color } = lookup(tx.category);
        colours.set(label, color);
        return { label, amount: convert(tx) };
      });
    return splitByLabel(items, 6).map(item => ({ ...item, color: colours.get(item.label) }));
  }, [own, convert, categories]);

/** Last 30 days of balance and the next 30 from the forecast, with what moves it pinned on the line. */
const Runway: React.FC<{ account: Account; todayBalance: number; amounts: { date: string; amount: number }[]; onOpenAccount: (id: string) => void }> = ({ account, todayBalance, amounts }) => {
  const projection = useAccountProjection(account, todayBalance, 30);
  const { points, todayIndex, markers } = useMemo(() => {
    const history = dailyBalanceHistory(todayBalance, amounts, 31);
    const ahead = projection.days.map(item => ({ date: parseLocalDate(item.date), balance: item.value }));
    const all = [...history.map(item => ({ date: item.date, balance: item.value })), ...ahead];
    const pins = [...projection.events]
      .sort((a, b) => Math.abs(b.own) - Math.abs(a.own))
      .slice(0, 8)
      .map(event => ({ date: parseLocalDate(event.date), title: event.description, description: `${event.own > 0 ? '+' : ''}${Math.round(event.own)} ${account.currency}`, color: event.own > 0 ? 'var(--money-in)' : 'var(--money-out)' }));
    if (projection.lowest && projection.lowest.value < todayBalance) pins.push({ date: parseLocalDate(projection.lowest.date), title: 'Lowest point ahead', description: `${Math.round(projection.lowest.value)} ${account.currency}`, color: 'var(--amber)' });
    return { points: all, todayIndex: history.length - 1, markers: pins };
  }, [todayBalance, amounts, projection, account.currency]);
  return (
    <Section
      title="Cash runway"
      subtitle="The last 30 days, and the next 30 from your schedule, bills, cards, loans and goals"
      action={projection.lowest ? <span className="type-caption text-right text-muted">Lowest ahead<br /><span className="type-figure-row text-ink"><Amount value={projection.lowest.value} currency={account.currency} tone="loss" /></span> {shortDay(projection.lowest.date)}</span> : undefined}
    >
      <TimeSeries data={points} series={[{ key: 'balance', label: 'Balance', color: 'var(--chart-1)', dashFromIndex: todayIndex }]} currency={account.currency} markers={markers} terminalKey="balance" showLegend={false} />
    </Section>
  );
};

/** What leaves or arrives in the next 30 days, each linked to the account it pays. */
const ComingUp: React.FC<{ account: Account; todayBalance: number; onOpenAccount: (id: string) => void; accounts: Account[] }> = ({ account, todayBalance, onOpenAccount, accounts }) => {
  const projection = useAccountProjection(account, todayBalance, 30);
  const items = projection.events.slice(0, 10);
  return (
    <Section title="Coming up" subtitle="Next 30 days">
      {items.length === 0 ? <p className="type-body text-muted">Nothing scheduled. Nice.</p> : (
        <ul className="divide-y divide-line">
          {items.map(event => {
            const otherId = event.accountId === account.id ? event.toAccountId : event.accountId;
            const other = otherId ? accounts.find(item => item.id === otherId) : undefined;
            return (
              <li key={event.key}>
                <Row
                  leading={<MerchantLogo description={event.description} isTransfer={!!other} size={36} account={account} />}
                  title={event.description}
                  context={`${shortDay(event.date)}${other ? ` · ${event.own < 0 ? 'to' : 'from'} ${other.name}` : ''}`}
                  trailing={<Amount value={event.own} currency={account.currency} tone="flow" />}
                  onPress={other ? () => onOpenAccount(other.id) : undefined}
                />
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
};

/** The account's own card and every credit card it pays, with each card's next statement. */
const CardsOnAccount: React.FC<{ account: Account; accounts: Account[]; transactions: Transaction[]; onOpenAccount: (id: string) => void }> = ({ account, accounts, transactions, onOpenAccount }) => {
  const cards = accounts.filter(item => item.type === 'Credit Card' && item.settlementAccountId === account.id && item.status !== 'closed');
  if (!accountHasCard(account) && cards.length === 0) return null;
  return (
    <Section title="Cards on this account" subtitle={cards.length ? `${cards.length} ${cards.length === 1 ? 'card is' : 'cards are'} paid from here` : 'Its debit card'}>
      <div className="grid gap-4 sm:grid-cols-2">
        {accountHasCard(account) && <div className="aspect-[1.586] w-full max-w-[280px]"><CardFace account={account} /></div>}
        {cards.map(card => {
          const period = card.statementStartDate && card.paymentDate ? statementPeriodFor(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 30), card.statementStartDate, card.paymentDate) : null;
          const statement = period ? getCreditCardStatementDetails(card, period.start, period.end, transactions) : null;
          return (
            <button key={card.id} type="button" onClick={() => onOpenAccount(card.id)} className="cursor-pointer space-y-2 rounded-[var(--radius-lg)] p-1 text-left hover:bg-inset">
              <div className="aspect-[1.586] w-full max-w-[280px]"><CardFace account={card} /></div>
              <p className="type-body-strong text-ink">{card.name}</p>
              {statement && period && (
                <p className="type-caption text-muted">
                  <Amount value={Math.abs(statement.statementBalance)} currency={card.currency} /> due {shortDay(period.due)}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </Section>
  );
};

const TopMerchants: React.FC<{ account: Account; own: Transaction[] }> = ({ account, own }) => {
  const top = useMemo(() => topMerchantsThisMonth(own, 5, new Date(), account.currency), [own, account.currency]);
  return (
    <Section title="Top merchants" subtitle="This month">
      {top.length === 0 ? <p className="type-body text-muted">No spending yet this month.</p> : (
        <ul className="divide-y divide-line">
          {top.map(item => <li key={item.name}><Row leading={<MerchantLogo merchant={item.name} description={item.name} size={36} />} title={item.name} trailing={<Amount value={-item.amount} currency={account.currency} tone="flow" />} /></li>)}
        </ul>
      )}
    </Section>
  );
};

/** Checking accounts and cash: a runway first, then where the money went and what is still to come. */
export const CheckingLayout: React.FC<AccountPanelProps> = props => {
  const { account } = props;
  const page = useAccountPage(account, props);
  const { recurringTransactions: everySeries, recurringTransactionOverrides, billsAndPayments, loanPaymentOverrides } = useScheduleContext();
  const { warrants } = useWarrantsContext();
  const { activeGoalIds } = useInsightsView();
  const recurringTransactions = useMemo(() => liveSeries(everySeries), [everySeries]);
  const operating = useMemo(() => computeOperatingAccountMetrics(account, page.accounts, page.transactions, {
    conversionRates: page.conversionRates,
    showBalanceAdjustments: props.showBalanceAdjustments,
    recurringTransactions,
    recurringTransactionOverrides,
    billsAndPayments: [...billsAndPayments, ...warrantTaxBills(warrants, [], page.accounts)],
    financialGoals: page.goals,
    activeGoalIds,
    loanPaymentOverrides,
  }), [account, page.accounts, page.transactions, page.conversionRates, props.showBalanceAdjustments, recurringTransactions, recurringTransactionOverrides, billsAndPayments, warrants, page.goals, activeGoalIds, loanPaymentOverrides]);
  const { change } = useBalanceChange(page.todayBalance, page.amounts, 30);
  const flows = useMemo(() => monthlyFlows(page.amounts, 12), [page.amounts]);
  const current = flows[flows.length - 1];
  const categories = useCategorySplit(page.own, page.convert, props.categories);
  const isCash = account.type === 'Other Assets';

  return (
    <AccountShell
      account={account}
      context={isCash ? `Cash, ${account.currency}` : `${account.type}${account.financialInstitution ? `, ${account.financialInstitution}` : ''}${account.isPrimary ? ' · Primary' : ''}`}
      value={page.todayBalance}
      heroNote={<><Amount value={change} currency={account.currency} /> in the last 30 days</>}
      kpis={[
        { label: 'Safe to spend', value: money(operating.safeToSpend, account), context: 'After the next 14 days' },
        { label: 'In this month', value: money(current?.in ?? 0, account) },
        { label: 'Out this month', value: money(current?.out ?? 0, account) },
        { label: 'Monthly spending', value: money(operating.avgMonthlySpend, account), context: 'Average of 3 months' },
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
            <>
              <Runway account={account} todayBalance={page.todayBalance} amounts={page.amounts} onOpenAccount={props.onOpenAccount} />
              <Grid2>
                <Section title="In and out" subtitle="Last 12 months">
                  <Bars data={flows as unknown as Record<string, unknown>[]} bars={[{ key: 'in', label: 'In', color: 'var(--money-in)' }, { key: 'out', label: 'Out', color: 'var(--chart-4)' }]} currency={account.currency} />
                </Section>
                <Section title="Where it went" subtitle="Spending by category this month">
                  <Donut items={categories} currency={account.currency} centerLabel="Spent" />
                </Section>
              </Grid2>
              <Grid2>
                <ComingUp account={account} todayBalance={page.todayBalance} onOpenAccount={props.onOpenAccount} accounts={page.accounts} />
                <TopMerchants account={account} own={page.own} />
              </Grid2>
              <CardsOnAccount account={account} accounts={page.accounts} transactions={page.transactions} onOpenAccount={props.onOpenAccount} />
            </>
          ),
        },
        activityTab(props),
        detailsTab(bankDetails(account)),
      ]}
    />
  );
};

/** Savings: how it grows, where deposits come from, the goals it holds, and a fixed term if it has one. */
export const SavingsLayout: React.FC<AccountPanelProps> = props => {
  const { account } = props;
  const page = useAccountPage(account, props);
  const savings = useMemo(
    () => computeSavingsAccountMetrics(account, props.accountTransactions.map(item => item.tx), props.categories, { conversionRates: page.conversionRates, showBalanceAdjustments: props.showBalanceAdjustments }),
    [account, props.accountTransactions, props.categories, page.conversionRates, props.showBalanceAdjustments]
  );

  const growth = useMemo(() => {
    const keys = lastMonths(12);
    const rows = new Map(keys.map(month => [month, { deposits: 0, withdrawals: 0, interest: 0 }]));
    page.own.forEach(tx => {
      const row = rows.get(tx.date.slice(0, 7));
      if (!row || tx.isBalanceAdjustment) return;
      const amount = page.convert(tx);
      if (isSavingsInterestTransaction(tx, props.categories)) row.interest = safeAdd(row.interest, amount);
      else if (amount >= 0) row.deposits = safeAdd(row.deposits, amount);
      else row.withdrawals = safeAdd(row.withdrawals, -amount);
    });
    return keys.map(month => ({ month, name: monthLabel(month), ...rows.get(month)! }));
  }, [page.own, page.convert, props.categories]);

  const yearStart = `${new Date().getFullYear()}-01`;
  const savedThisYear = growth.filter(row => row.month >= yearStart).reduce((sum, row) => safeAdd(sum, row.deposits - row.withdrawals), 0);
  const avgNetDeposit = growth.slice(-6).reduce((sum, row) => sum + row.deposits - row.withdrawals, 0) / 6;

  const chart = useMemo(() => {
    const history = monthlyBalanceHistory(page.todayBalance, page.amounts, 24).map(item => ({ date: item.date, balance: item.value }));
    const rate = (savings.apy || 0) / 100 / 12;
    let running = page.todayBalance;
    const ahead = Array.from({ length: 12 }, (_, index) => {
      running = running * (1 + rate) + avgNetDeposit;
      const date = new Date(new Date().getFullYear(), new Date().getMonth() + index + 2, 0);
      return { date, balance: safeRound(running, 2) };
    });
    return { points: [...history, ...ahead], todayIndex: history.length - 1, inAYear: ahead[ahead.length - 1]?.balance ?? page.todayBalance };
  }, [page.todayBalance, page.amounts, savings.apy, avgNetDeposit]);

  const goals = useMemo(() => page.goals.filter(goal => goal.destinationAccountId === account.id || (!goal.destinationAccountId && goal.paymentAccountId === account.id)), [page.goals, account.id]);
  const sources = useMemo(() => {
    const since = `${lastMonths(12)[0]}-01`;
    const partners = transferPartners(account, page.transactions, page.accounts, { since });
    return partners.map(partner => {
      const total = page.transactions
        .filter(tx => tx.accountId === account.id && tx.transferId && tx.date >= since && tx.amount > 0 && page.transactions.some(other => other.transferId === tx.transferId && other.accountId === partner.account.id))
        .reduce((sum, tx) => safeAdd(sum, page.convert(tx)), 0);
      return { account: partner.account, total };
    }).filter(item => item.total > 0);
  }, [account, page.transactions, page.accounts, page.convert]);

  const maturity = account.maturityDate ? parseLocalDate(account.maturityDate) : null;
  const maturityDays = maturity ? daysUntil(maturity) : null;

  return (
    <AccountShell
      account={account}
      context={`Savings${account.financialInstitution ? `, ${account.financialInstitution}` : ''}`}
      value={page.todayBalance}
      heroNote={savings.apy > 0 ? `${savings.apy}% APY · about ${Math.round(savings.projectedMonthlyInterest)} ${account.currency} a month in interest` : 'No interest rate set'}
      kpis={[
        { label: 'Interest this year', value: money(savings.totalInterestYTD, account) },
        { label: 'Saved this year', value: money(savedThisYear, account), context: 'Deposits less withdrawals' },
        { label: 'In 12 months', value: money(chart.inAYear, account), context: 'At this pace and rate' },
        maturity ? { label: 'Matures', value: shortDay(maturity), context: maturityDays !== null && maturityDays >= 0 ? `In ${maturityDays} days` : 'Matured' } : { label: 'Growth, 90 days', value: savings.growthIndexLabel },
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
            <>
              <Section title="Balance and projection" subtitle={`24 months back and 12 ahead, at ${savings.apy || 0}% and your average deposit of the last 6 months`}>
                <TimeSeries data={chart.points} series={[{ key: 'balance', label: 'Balance', color: 'var(--chart-1)', dashFromIndex: chart.todayIndex }]} currency={account.currency} terminalKey="balance" showLegend={false} />
              </Section>
              <Grid2>
                <Section title="Growth by month" subtitle="Last 12 months">
                  <Bars data={growth as unknown as Record<string, unknown>[]} stacked bars={[{ key: 'deposits', label: 'Deposits', color: 'var(--chart-1)' }, { key: 'interest', label: 'Interest', color: 'var(--chart-2)' }, { key: 'withdrawals', label: 'Withdrawals', color: 'var(--chart-4)' }]} currency={account.currency} />
                </Section>
                <Section title="Goals held here" subtitle={goals.length ? undefined : 'Point a goal at this account to see it here'}>
                  {goals.length ? <ProgressRings items={goals.map(goal => ({ label: goal.name, value: goal.currentAmount, max: goal.amount }))} currency={account.currency} /> : <EmptyState icon="target-01" title="No goals here yet" description="A goal whose money sits here shows its progress." actionLabel={props.onOpenGoals ? 'Open goals' : undefined} onAction={props.onOpenGoals} />}
                </Section>
              </Grid2>
              <Grid2>
                <Section title="Where deposits come from" subtitle="Last 12 months">
                  {sources.length === 0 ? <p className="type-body text-muted">No transfers in from your other accounts yet.</p> : (
                    <ul className="divide-y divide-line">
                      {sources.map(source => <li key={source.account.id}><Row title={source.account.name} context={source.account.type} trailing={money(source.total, account)} onPress={() => props.onOpenAccount(source.account.id)} /></li>)}
                    </ul>
                  )}
                </Section>
                {maturity ? (
                  <Section title="Fixed term" subtitle={account.rollsOver ? 'Rolls into a new term at maturity' : 'Paid out at maturity'}>
                    <Figures items={[
                      { label: 'Matures', value: day(account.maturityDate) },
                      { label: 'Days left', value: maturityDays !== null && maturityDays >= 0 ? maturityDays : 'Matured' },
                      { label: 'Interest to maturity', value: money(Math.max(0, (maturityDays ?? 0) / 365) * page.todayBalance * (savings.apy / 100), account) },
                    ]} />
                    {account.openingDate && maturityDays !== null && (
                      <div className="mt-4"><ShareBar value={(1 - Math.max(0, maturityDays) / Math.max(1, daysUntil(maturity, parseLocalDate(account.openingDate)))) * 100} label="Term elapsed" /></div>
                    )}
                  </Section>
                ) : (
                  <Section title="Withdrawals" subtitle="Last 6 months">
                    <Figures items={[
                      { label: 'Times money left', value: growth.slice(-6).filter(row => row.withdrawals > 0).length },
                      { label: 'Taken out', value: money(growth.slice(-6).reduce((sum, row) => sum + row.withdrawals, 0), account) },
                      { label: 'Put in', value: money(growth.slice(-6).reduce((sum, row) => sum + row.deposits, 0), account) },
                    ]} />
                  </Section>
                )}
              </Grid2>
            </>
          ),
        },
        activityTab(props),
        detailsTab([...bankDetails(account), { label: 'Interest', value: account.apy ? `${account.apy}% APY` : undefined }, { label: 'Matures', value: day(account.maturityDate) }]),
      ]}
    />
  );
};

/** Meal vouchers: the month's top-up against what's spent, per working day. */
export const MealVoucherLayout: React.FC<AccountPanelProps> = props => {
  const { account } = props;
  const page = useAccountPage(account, props);
  const flows = useMemo(() => monthlyFlows(page.amounts, 12), [page.amounts]);
  const current = flows[flows.length - 1] ?? { in: 0, out: 0 };
  const today = new Date();
  const workingDays = (from: Date, to: Date) => {
    let count = 0;
    for (const d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) if (d.getDay() !== 0 && d.getDay() !== 6) count++;
    return count;
  };
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const daysSoFar = Math.max(1, workingDays(monthStart, today));
  const daysLeft = workingDays(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1), monthEnd);
  return (
    <AccountShell
      account={account}
      context={`Meal voucher${account.financialInstitution ? `, ${account.financialInstitution}` : ''}`}
      value={page.todayBalance}
      heroAside={<div className="aspect-[1.586] w-full max-w-[280px]"><CardFace account={account} /></div>}
      kpis={[
        { label: 'Topped up', value: money(current.in, account), context: 'This month' },
        { label: 'Spent', value: money(current.out, account), context: 'This month' },
        { label: 'Per working day', value: money(current.out / daysSoFar, account) },
        { label: 'Can spend per day', value: money(daysLeft > 0 ? Math.max(0, page.todayBalance) / daysLeft : 0, account), context: `${daysLeft} working days left` },
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
              <Section title="Top-ups and spending" subtitle="Last 12 months">
                <Bars data={flows as unknown as Record<string, unknown>[]} bars={[{ key: 'in', label: 'Topped up', color: 'var(--money-in)' }, { key: 'out', label: 'Spent', color: 'var(--chart-4)' }]} currency={account.currency} />
              </Section>
              <TopMerchants account={account} own={page.own} />
            </Grid2>
          ),
        },
        activityTab(props),
        detailsTab(bankDetails(account)),
      ]}
    />
  );
};

export const isCashLike = (account: Account) => account.type === 'Checking' || (account.type === 'Other Assets' && account.otherSubType === 'Cash');
export { isMealVoucherAccount, computeAccountDisplayBalance };
