import React, { useMemo } from 'react';
import type { Account, Category, Transaction } from '../../types';
import { flattenCategories, getCreditCardStatementDetails, safeAdd, safeRound } from '../../utils';
import { computeCreditCardAccountMetrics } from '../../utils/accountDetailModel';
import { cumulativeSpend, isoDay, monthLabel, recentStatementPeriods, splitByLabel, statementPeriodFor, toDatedAmounts, type StatementPeriod } from '../../utils/accountPagesModel';
import { recurringForAccount } from '../../utils/accountLinks';
import { useScheduleContext } from '../../contexts/FinancialDataContext';
import CardFace from '../CardFace';
import { StatGauge } from '../ui/StatGauge';
import { Badge, Row } from '../ui/Display';
import { Amount } from '../ui/Money';
import AccountShell from './AccountShell';
import { Bars, Board, Donut, Figures, Section, TimeSeries } from './charts';
import { useLiveBalance } from './ConnectionsStrip';
import { addAction, commonActions, day, daysUntil, detailsTab, Grid2, money, pct, shortDay, type AccountPanelProps } from './pageKit';
import { activityTab } from './ActivityView';
import { useAccountPage, useAccountProjection } from './useAccountPage';

/** A card statement as the page shows it: what was charged, what was paid, and whether it was paid in time. */
interface StatementRow extends StatementPeriod {
  charged: number;
  paid: number;
  onTime: boolean | null;
}

const statementRows = (card: Account, periods: StatementPeriod[], transactions: Transaction[], today: Date): StatementRow[] =>
  periods.map(period => {
    const { statementBalance } = getCreditCardStatementDetails(card, period.start, period.end, transactions);
    const charged = Math.max(0, -statementBalance);
    // Payments for a statement land between its close and its due date.
    const paid = getCreditCardStatementDetails(card, new Date(period.end.getFullYear(), period.end.getMonth(), period.end.getDate() + 1), period.due, transactions).amountPaid;
    const isPast = period.due < today;
    return { ...period, charged: safeRound(charged, 2), paid: safeRound(paid, 2), onTime: isPast ? paid + 0.005 >= charged : null };
  });

/** The pay-from account on the due date: does it hold enough? */
const PayFrom: React.FC<{ card: Account; settlement?: Account; due: Date; amount: number; onOpenAccount: (id: string) => void }> = ({ card, settlement, due, amount, onOpenAccount }) => {
  const balanceOf = useLiveBalance();
  const today = balanceOf(settlement ?? card);
  const projection = useAccountProjection(settlement ?? card, today, Math.max(1, daysUntil(due) + 1));
  if (!settlement) return <p className="type-body text-muted">No pay-from account set. Add one in Edit so the payment shows on its forecast.</p>;
  const onDue = projection.days.find(item => item.date >= isoDay(due))?.value ?? today;
  // The forecast already takes the card payment off on its day, so add it back to see what's there before it.
  const before = onDue + amount;
  const short = Math.max(0, amount - before);
  return (
    <button type="button" onClick={() => onOpenAccount(settlement.id)} className="w-full cursor-pointer rounded-[var(--radius-lg)] bg-inset p-4 text-left hover:bg-line">
      <p className="type-caption text-muted">Pays from</p>
      <p className="type-body-strong text-ink">{settlement.name}</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="type-caption text-muted">Expected on {shortDay(due)}: <span className="type-figure-row text-ink"><Amount value={before} currency={settlement.currency} /></span></span>
        {short > 0
          ? <Badge tone="negative" icon="alert-02">Short by <Amount value={short} currency={settlement.currency} /></Badge>
          : <Badge tone="positive" icon="checkmark-circle-02">Enough to pay</Badge>}
      </div>
    </button>
  );
};

const categoryName = (categories: Category[]) => {
  const flat = flattenCategories(categories);
  return (value: string) => {
    const match = flat.find(item => item.id === value || item.name.toLowerCase() === (value || '').toLowerCase());
    const parent = match?.parentId ? flat.find(item => item.id === match.parentId) : undefined;
    return { label: (parent ?? match)?.name ?? (value || 'Uncategorised'), color: (parent ?? match)?.color };
  };
};

/** Credit cards: the statement and its pay-from account first, then pace, categories and the statement history. */
export const CreditCardLayout: React.FC<AccountPanelProps> = props => {
  const { account } = props;
  const page = useAccountPage(account, props);
  const { recurringTransactions } = useScheduleContext();
  const metrics = useMemo(
    () => computeCreditCardAccountMetrics(account, props.accountTransactions.map(item => item.tx), { conversionRates: page.conversionRates, showBalanceAdjustments: props.showBalanceAdjustments }),
    [account, props.accountTransactions, page.conversionRates, props.showBalanceAdjustments]
  );
  const settlement = account.settlementAccountId ? page.accounts.find(item => item.id === account.settlementAccountId) : undefined;
  const today = useMemo(() => new Date(), []);
  const hasCycle = !!(account.statementStartDate && account.paymentDate);
  const startDay = account.statementStartDate || 1;
  const dueDay = account.paymentDate || 25;

  const periods = useMemo(() => recentStatementPeriods(startDay, dueDay, 13, today), [startDay, dueDay, today]);
  const current = periods[0];
  const rows = useMemo(() => statementRows(account, periods.slice(1), page.transactions, today), [account, periods, page.transactions, today]);
  const lastClosed = rows[0];
  // The statement to pay next: the last closed one while its due date is ahead, else the open one.
  const toPay = lastClosed && lastClosed.due >= new Date(today.getFullYear(), today.getMonth(), today.getDate()) ? lastClosed : null;
  const nextDue = toPay ? toPay.due : current.due;
  const nextAmount = toPay ? Math.max(0, toPay.charged - toPay.paid) : metrics.balanceOwed;

  const spend = useMemo(() => toDatedAmounts(page.own.filter(tx => !tx.transferId && !tx.isBalanceAdjustment), page.convert), [page.own, page.convert]);
  const pace = useMemo(() => {
    const now = cumulativeSpend(spend, current, today);
    const previous = periods[1] ? cumulativeSpend(spend, periods[1]) : [];
    const older = periods.slice(1, 4).map(period => cumulativeSpend(spend, period));
    // Up to today only: each line is spending so far, at the same point of its own cycle.
    return Array.from({ length: Math.max(1, now.length) }, (_, index) => {
      const date = new Date(current.start.getFullYear(), current.start.getMonth(), current.start.getDate() + index);
      const avg = older.length ? older.reduce((sum, item) => sum + (item[Math.min(index, item.length - 1)] ?? 0), 0) / older.length : undefined;
      return {
        date,
        thisCycle: now[index] ?? 0,
        lastCycle: previous.length ? previous[Math.min(index, previous.length - 1)] : undefined,
        average: avg !== undefined ? safeRound(avg, 2) : undefined,
      };
    });
  }, [spend, current, periods, today]);

  const categories = useMemo(() => {
    const lookup = categoryName(props.categories);
    const colours = new Map<string, string | undefined>();
    const items = page.own
      .filter(tx => !tx.transferId && !tx.isBalanceAdjustment && tx.date >= isoDay(current.start) && page.convert(tx) < 0)
      .map(tx => {
        const { label, color } = lookup(tx.category);
        colours.set(label, color);
        return { label, amount: page.convert(tx) };
      });
    return splitByLabel(items).map(item => ({ ...item, color: colours.get(item.label) }));
  }, [page.own, page.convert, props.categories, current.start]);

  const history = useMemo(() => [...rows].reverse().map(row => ({ name: monthLabel(isoDay(row.end).slice(0, 7)), charged: row.charged, paid: row.paid })), [rows]);
  const recurring = useMemo(() => recurringForAccount(account.id, recurringTransactions).filter(item => item.type === 'expense' && !item.pausedAt), [account.id, recurringTransactions]);
  const yearStart = `${today.getFullYear()}-01-01`;
  const interestThisYear = page.own.filter(tx => tx.date >= yearStart && /interest|intérêts|zinsen/i.test(`${tx.category} ${tx.description}`) && tx.amount < 0).reduce((sum, tx) => safeAdd(sum, -page.convert(tx)), 0);
  const nextFee = useMemo(() => {
    const anchor = account.annualFeeDate || account.openingDate;
    if (!account.annualFee || !anchor) return null;
    const [, m, d] = anchor.split('-').map(Number);
    let next = new Date(today.getFullYear(), m - 1, d);
    if (next < today) next = new Date(today.getFullYear() + 1, m - 1, d);
    return next;
  }, [account.annualFee, account.annualFeeDate, account.openingDate, today]);

  const utilization = account.creditLimit ? metrics.utilization : 0;
  const tone = utilization > 70 ? 'loss' : utilization > 30 ? 'amber' : 'pine';
  const dueIn = daysUntil(nextDue, today);
  const onTimeCount = rows.filter(row => row.onTime === true).length;
  const judged = rows.filter(row => row.onTime !== null && row.charged > 0).length;

  return (
    <AccountShell
      account={account}
      context={`${account.cardNetwork || 'Credit card'}${account.last4 ? ` ending ${account.last4}` : ''}${account.financialInstitution ? `, ${account.financialInstitution}` : ''}`}
      value={metrics.balanceOwed}
      valueLabel="Owed now"
      heroNote={hasCycle ? <>Next payment <Amount value={nextAmount} currency={account.currency} /> due {shortDay(nextDue)}, in {dueIn} {dueIn === 1 ? 'day' : 'days'}</> : 'Set the statement and due days in Edit to track statements'}
      heroAside={<div className="aspect-[1.586] w-full max-w-[300px]"><CardFace account={account} /></div>}
      kpis={[
        { label: 'Available', value: account.creditLimit ? money(metrics.availableCredit, account) : '—', context: account.creditLimit ? <>of <Amount value={account.creditLimit} currency={account.currency} /></> : 'No limit set' },
        { label: 'Credit used', value: account.creditLimit ? pct(utilization, 1) : '—', context: utilization > 30 ? 'Above 30%' : 'Healthy' },
        { label: 'This cycle', value: money(pace.at(-1)?.thisCycle ?? 0, account), context: `Since ${shortDay(current.start)}` },
        { label: 'Paid on time', value: judged ? `${onTimeCount} of ${judged}` : '—', context: 'Last 12 statements' },
      ]}
      links={page.links}
      siblings={page.siblings}
      onOpenAccount={props.onOpenAccount}
      onOpenGoals={props.onOpenGoals}
      mainAction={addAction(props)}
      actions={commonActions(props, false)}
      onBack={props.onBack}
      tabs={[
        {
          id: 'overview',
          label: 'Overview',
          content: (
            <Board>
                <Section span="side" title={toPay ? 'Statement to pay' : 'This statement'} subtitle={hasCycle ? `${shortDay(toPay?.start ?? current.start)} to ${shortDay(toPay?.end ?? current.end)}` : undefined}>
                  <div className="flex flex-wrap items-center gap-5">
                    {account.creditLimit ? <StatGauge fill={utilization} tone={tone} display={pct(utilization)} caption="of limit" label="Credit used" size={120} /> : null}
                    <Figures className="min-w-[150px] flex-1 @4xl:grid-cols-1 @4xl:gap-2" items={[
                      { label: 'Amount', value: money(nextAmount, account) },
                      { label: 'Due', value: shortDay(nextDue), note: `${dueIn} days` },
                      ...(account.minimumPayment ? [{ label: 'Minimum', value: money(account.minimumPayment, account) }] : []),
                    ]} />
                  </div>
                  <div className="mt-4"><PayFrom card={account} settlement={settlement} due={nextDue} amount={nextAmount} onOpenAccount={props.onOpenAccount} /></div>
                </Section>
                <Section span="wide" title="Cycle pace" subtitle="Spending so far this cycle, against the same days of the last cycle and the average of three">
                  <TimeSeries
                    data={pace}
                    series={[
                      { key: 'thisCycle', label: 'This cycle', color: 'var(--chart-1)', width: 2.5 },
                      { key: 'lastCycle', label: 'Last cycle', color: 'var(--chart-3)', dashed: true },
                      { key: 'average', label: 'Average of 3', color: 'var(--muted)', dashed: true, width: 1.5 },
                    ]}
                    currency={account.currency}
                    height="fill"
                  />
                </Section>
                <Section span="side" title="Categories this cycle">
                  <Donut items={categories} currency={account.currency} centerLabel="Charged" />
                </Section>
                <Section span="wide" title="Statements" subtitle="Charged and paid, last 12">
                  <Bars data={history} bars={[{ key: 'charged', label: 'Charged', color: 'var(--chart-1)' }, { key: 'paid', label: 'Paid', color: 'var(--money-in)' }]} currency={account.currency} height="fill" />
                </Section>
                <Section span="wide" title="Recurring on this card" subtitle={recurring.length ? undefined : 'Subscriptions billed here show up here'}>
                  {recurring.length === 0 ? <p className="type-body text-muted">Nothing recurring is billed to this card.</p> : (
                    <>
                      <ul className="divide-y divide-line">
                        {recurring.slice(0, 8).map(item => <li key={item.id}><Row title={item.merchant || item.description} context={`${item.frequency}, next ${shortDay(item.nextDueDate)}`} trailing={<Amount value={-item.amount} currency={item.currency} tone="flow" />} /></li>)}
                      </ul>
                      <p className="type-caption mt-2 text-muted">About <Amount value={recurring.reduce((sum, item) => sum + (item.frequency === 'yearly' ? item.amount / 12 : item.frequency === 'weekly' ? (item.amount * 52) / 12 : item.amount), 0)} currency={account.currency} /> a month.</p>
                    </>
                  )}
                </Section>
                <Section span="side" title="Cost of the card">
                  <Figures className="@4xl:grid-cols-1 @4xl:gap-2" items={[
                    { label: 'Annual fee', value: account.annualFee ? money(account.annualFee, account) : 'None', note: nextFee ? `Next ${shortDay(nextFee)}` : undefined },
                    { label: 'Interest rate', value: account.apr != null ? `${account.apr}% APR` : '—', note: metrics.estimatedMonthlyInterest > 0 ? <>About <Amount value={metrics.estimatedMonthlyInterest} currency={account.currency} /> a month if carried</> : undefined },
                    { label: 'Interest this year', value: money(interestThisYear, account) },
                  ]} />
                </Section>
            </Board>
          ),
        },
        activityTab(props),
        {
          id: 'statements',
          label: 'Statements',
          content: (
            <Section title="Statements" subtitle="Charged in each period and paid by its due date">
              <ul className="divide-y divide-line">
                {rows.map(row => (
                  <li key={row.start.toISOString()}>
                    <Row
                      title={`${shortDay(row.start)} to ${shortDay(row.end)}`}
                      context={`Due ${shortDay(row.due)}`}
                      trailing={
                        <span className="flex items-center gap-3">
                          {row.onTime === true && <Badge tone="positive">On time</Badge>}
                          {row.onTime === false && <Badge tone="negative">Short</Badge>}
                          {row.onTime === null && <Badge>Open</Badge>}
                          <span className="type-figure-row text-ink"><Amount value={row.charged} currency={account.currency} /></span>
                        </span>
                      }
                    />
                  </li>
                ))}
              </ul>
            </Section>
          ),
        },
        detailsTab([
          { label: 'Network', value: account.cardNetwork },
          { label: 'Card ending', value: account.last4, copy: account.last4 },
          { label: 'Expires', value: account.expirationDate, copy: account.expirationDate },
          { label: 'Name on card', value: account.cardholderName },
          { label: 'Limit', value: account.creditLimit ? money(account.creditLimit, account) : undefined },
          { label: 'Statement opens', value: account.statementStartDate ? `Day ${account.statementStartDate}` : 'Not set' },
          { label: 'Payment due', value: account.paymentDate ? `Day ${account.paymentDate}` : 'Not set' },
          { label: 'Pays from', value: settlement?.name ?? 'You, manually' },
          { label: 'Interest rate', value: account.apr != null ? `${account.apr}% APR` : undefined },
          { label: 'Annual fee', value: account.annualFee ? money(account.annualFee, account) : undefined },
          { label: 'Minimum payment', value: account.minimumPayment ? money(account.minimumPayment, account) : undefined },
          { label: 'Bank', value: account.financialInstitution },
          { label: 'Opened', value: day(account.openingDate) },
        ]),
      ]}
    />
  );
};

export { statementPeriodFor };
