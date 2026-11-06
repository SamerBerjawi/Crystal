import React, { useMemo, useState } from 'react';
import type { Account } from '../../types';
import { convertCurrency, generateAmortizationSchedule, parseLocalDate, safeAdd, safeRound } from '../../utils';
import { assetForLoan } from '../../utils/accountLinks';
import { amortizationByYear, interestAlong, isoDay, monthlyBalanceHistory, monthlyFlows, payoffPath } from '../../utils/accountPagesModel';
import PaymentPlanTable from '../PaymentPlanTable';
import { Button } from '../ui/Actions';
import { Slider } from '../ui/Fields';
import { Amount } from '../ui/Money';
import { StatGauge } from '../ui/StatGauge';
import { EmptyState } from '../ui/States';
import AccountShell from './AccountShell';
import { Bars, Board, Donut, Figures, Section, ShareBar, TimeSeries } from './charts';
import { useLiveBalance } from './ConnectionsStrip';
import { addAction, commonActions, day, detailsTab, Grid2, money, pct, shortDay, type AccountPanelProps } from './pageKit';
import { monthPeriods } from '../../utils/activityModel';
import { activityTab } from './ActivityView';
import MoneyFlowChart from './MoneyFlowChart';
import { useAccountPage, useAccountProjection } from './useAccountPage';

const monthsLabel = (months: number) => {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return [years ? `${years} ${years === 1 ? 'year' : 'years'}` : '', rest ? `${rest} ${rest === 1 ? 'month' : 'months'}` : ''].filter(Boolean).join(' ') || '0 months';
};

/** The account a payment leaves from, and what it should hold on the day. */
export const PaymentAccountCard: React.FC<{ from?: Account; date: Date | null; amount: number; label: string; onOpenAccount: (id: string) => void }> = ({ from, date, amount, label, onOpenAccount }) => {
  const balanceOf = useLiveBalance();
  const today = from ? balanceOf(from) : 0;
  const days = date ? Math.max(1, Math.round((date.getTime() - Date.now()) / 86_400_000) + 1) : 1;
  const projection = useAccountProjection(from ?? ({ id: '__none__', name: '', type: 'Checking', balance: 0, currency: 'EUR' } as Account), today, days);
  if (!from) return <p className="type-body text-muted">No payment account set. Add one in Edit so payments show on its forecast.</p>;
  const onDay = date ? projection.days.find(item => item.date >= isoDay(date))?.value ?? today : today;
  return (
    <button type="button" onClick={() => onOpenAccount(from.id)} className="w-full cursor-pointer rounded-[var(--radius-lg)] bg-inset p-4 text-left hover:bg-line">
      <p className="type-caption text-muted">{label}</p>
      <p className="type-body-strong text-ink">{from.name}</p>
      <Figures className="mt-3" items={[
        { label: 'Today', value: <Amount value={today} currency={from.currency} /> },
        { label: date ? `After ${shortDay(date)}` : 'Next payment', value: <Amount value={onDay} currency={from.currency} tone="loss" />, note: <>Payment <Amount value={amount} currency={from.currency} /></> },
      ]} />
    </button>
  );
};

/** Loans and money you lent: the balance over the term, the plan, what an overpayment would change, and what secures it. */
export const LoanLayout: React.FC<AccountPanelProps> = props => {
  const { account } = props;
  const isLending = account.type === 'Lending';
  const page = useAccountPage(account, props);
  const overrides = props.loanOverrides[account.id] || {};
  const [extra, setExtra] = useState(0);
  const [lump, setLump] = useState(0);

  const plan = useMemo(() => {
    const filtered = props.transactions.filter(tx => props.showBalanceAdjustments || !tx.isBalanceAdjustment);
    const schedule = generateAmortizationSchedule(account, filtered, overrides);
    const sum = (key: 'principal' | 'interest', paidOnly: boolean) => schedule.reduce((total, payment) => (!paidOnly || payment.status === 'Paid' ? safeAdd(total, payment[key]) : total), 0);
    const paidPrincipal = sum('principal', true);
    const paidInterest = sum('interest', true);
    const outstandingPrincipal = Math.max(0, sum('principal', false) - paidPrincipal);
    const outstandingInterest = Math.max(0, sum('interest', false) - paidInterest);
    const principal = account.principalAmount || account.totalAmount || sum('principal', false) || 1;
    const next = schedule.find(payment => payment.status !== 'Paid');
    const last = schedule[schedule.length - 1];
    return { schedule, paidPrincipal, paidInterest, outstandingPrincipal, outstandingInterest, principal, next, payoff: last ? parseLocalDate(last.date) : null, progress: Math.min(100, Math.max(0, (paidPrincipal / principal) * 100)) };
  }, [account, props.transactions, props.showBalanceAdjustments, overrides]);

  const hasSchedule = plan.schedule.length > 0;
  const outstanding = hasSchedule ? plan.outstandingPrincipal : Math.abs(account.balance);
  const asset = !isLending ? assetForLoan(account, page.accounts) : undefined;
  const assetValue = asset ? convertCurrency(asset.balance, asset.currency, account.currency, page.conversionRates) : 0;
  const ltv = assetValue > 0 ? (outstanding / assetValue) * 100 : 0;
  const payFrom = account.linkedAccountId ? page.accounts.find(item => item.id === account.linkedAccountId) : undefined;
  const payment = account.monthlyPayment || plan.next?.totalPayment || 0;
  const rate = account.interestRate || 0;

  const whatIf = useMemo(() => {
    const base = payoffPath(outstanding, rate, payment);
    const faster = payoffPath(outstanding, rate, payment, extra, lump);
    return {
      base,
      faster,
      monthsSaved: Math.max(0, base.length - faster.length),
      interestSaved: Math.max(0, interestAlong(outstanding, rate, payment) - interestAlong(outstanding, rate, payment, extra, lump)),
    };
  }, [outstanding, rate, payment, extra, lump]);

  const termChart = useMemo(() => {
    if (!hasSchedule) return null;
    const today = isoDay(new Date());
    const start = account.loanStartDate ? parseLocalDate(account.loanStartDate) : parseLocalDate(plan.schedule[0].date);
    const rows: Record<string, unknown>[] = [{ date: start, plan: safeRound(plan.principal, 2) }];
    plan.schedule.forEach(item => rows.push({ date: parseLocalDate(item.date), plan: item.outstandingBalance }));
    const todayIndex = rows.findIndex(row => isoDay(row.date as Date) > today);
    if ((extra > 0 || lump > 0) && whatIf.faster.length > 1) {
      const from = Math.max(0, todayIndex - 1);
      whatIf.faster.forEach((value, index) => {
        const row = rows[from + index];
        if (row) row.faster = value;
      });
    }
    return { rows, todayIndex: Math.max(0, todayIndex - 1) };
  }, [hasSchedule, plan, account.loanStartDate, extra, lump, whatIf.faster]);

  const years = useMemo(() => amortizationByYear(plan.schedule), [plan.schedule]);

  return (
    <AccountShell
      account={account}
      context={`${isLending ? `Money you lent${account.counterparty ? ` to ${account.counterparty}` : ''}` : 'Loan'}${account.interestRate != null ? `, ${account.interestRate}%` : ''}${account.financialInstitution ? `, ${account.financialInstitution}` : ''}`}
      value={outstanding}
      valueLabel={isLending ? 'Still owed to you' : 'Still to pay'}
      heroNote={hasSchedule ? <>{pct(plan.progress)} paid off{plan.payoff ? `, done ${plan.payoff.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}` : ''}</> : 'Add the term, rate and start date in Edit to see the schedule'}
      kpis={[
        { label: 'Paid off', value: pct(plan.progress), visual: <ShareBar value={plan.progress} label="Paid off" onHero /> },
        { label: isLending ? 'Next repayment' : 'Next payment', value: plan.next ? money(plan.next.totalPayment, account) : '—', context: plan.next ? shortDay(plan.next.date) : undefined },
        { label: 'Interest to come', value: money(plan.outstandingInterest, account), context: <>Paid <Amount value={plan.paidInterest} currency={account.currency} /></> },
        asset ? { label: 'Loan to value', value: pct(ltv, 1), context: asset.name } : { label: 'Term', value: account.duration ? monthsLabel(account.duration) : '—' },
      ]}
      links={page.links}
      siblings={page.siblings}
      onOpenAccount={props.onOpenAccount}
      onOpenGoals={props.onOpenGoals}
      mainAction={addAction(props, isLending ? 'Add repayment' : 'Add payment')}
      actions={commonActions(props, false)}
      onBack={props.onBack}
      tabs={[
        {
          id: 'overview',
          label: 'Overview',
          content: hasSchedule ? (
            <Board>
              {termChart && (
                <Section span="wide" title="Balance over the term" subtitle={extra || lump ? 'The plan, and with your overpayment' : 'What is left after each payment, today marked by the dashes'}>
                  <TimeSeries
                    data={termChart.rows}
                    series={[
                      { key: 'plan', label: 'Plan', color: 'var(--chart-1)', dashFromIndex: termChart.todayIndex },
                      ...(extra || lump ? [{ key: 'faster', label: 'With overpayment', color: 'var(--money-in)' }] : []),
                    ]}
                    currency={account.currency}
                    markers={[{ date: new Date(), title: 'Today', color: 'var(--muted)' }]}
                    height="fill"
                  />
                </Section>
              )}
              {!isLending && payment > 0 && outstanding > 0 ? (
                  <Section span="side" title="Overpayment planner" subtitle="An estimate from today's balance and rate. It changes nothing until you record a payment">
                    <div className="space-y-4">
                      <Slider label="Extra each month" value={extra} onChange={value => setExtra(Array.isArray(value) ? value[0] : value)} maxValue={Math.max(100, Math.round(payment))} step={10} formatOptions={{ style: 'currency', currency: account.currency === 'BTC' ? 'EUR' : account.currency, maximumFractionDigits: 0 }} />
                      <Slider label="One payment today" value={lump} onChange={value => setLump(Array.isArray(value) ? value[0] : value)} maxValue={Math.max(1000, Math.round(outstanding / 4 / 100) * 100)} step={100} formatOptions={{ style: 'currency', currency: account.currency === 'BTC' ? 'EUR' : account.currency, maximumFractionDigits: 0 }} />
                      <Figures className="@4xl:grid-cols-1 @4xl:gap-2" items={[
                        { label: 'Done sooner by', value: extra || lump ? monthsLabel(whatIf.monthsSaved) : '—' },
                        { label: 'Interest saved', value: money(whatIf.interestSaved, account) },
                        { label: 'New end', value: extra || lump ? new Date(new Date().getFullYear(), new Date().getMonth() + whatIf.faster.length - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '—' },
                      ]} />
                    </div>
                  </Section>
                ) : (
                  <Section span="side" title="Repayments" subtitle="Principal and interest received">
                    <Figures className="@4xl:grid-cols-1 @4xl:gap-2" items={[
                      { label: 'Principal back', value: money(plan.paidPrincipal, account) },
                      { label: 'Interest earned', value: money(plan.paidInterest, account) },
                      { label: 'Still to come', value: money(plan.outstandingPrincipal + plan.outstandingInterest, account) },
                    ]} />
                  </Section>
                )}
                <Section span="side" title="Where the money goes" subtitle="Principal and interest, paid and to come">
                  <Donut
                    centerLabel="Total"
                    currency={account.currency}
                    items={[
                      { label: 'Principal paid', value: plan.paidPrincipal, color: 'var(--chart-1)' },
                      { label: 'Interest paid', value: plan.paidInterest, color: 'var(--chart-4)' },
                      { label: 'Principal to come', value: plan.outstandingPrincipal, color: 'var(--chart-2)' },
                      { label: 'Interest to come', value: plan.outstandingInterest, color: 'var(--chart-5)' },
                    ]}
                  />
                </Section>
              <Section span="wide" title="Principal and interest by year">
                <Bars data={years} xKey="year" stacked bars={[{ key: 'principal', label: 'Principal', color: 'var(--chart-1)' }, { key: 'interest', label: 'Interest', color: 'var(--chart-4)' }]} height="fill" currency={account.currency} />
              </Section>
                {!isLending && (
                  <Section span="half" title="Secured by" subtitle={asset ? undefined : 'Link a property or vehicle in Edit to see its equity'}>
                    {asset ? (
                      <div className="flex items-center gap-5">
                        <StatGauge fill={ltv} tone={ltv > 90 ? 'loss' : ltv > 75 ? 'amber' : 'pine'} display={pct(ltv)} caption="loan to value" label="Loan to value" size={120} />
                        <div className="min-w-0 flex-1 space-y-3">
                          <Figures items={[{ label: asset.name, value: money(assetValue, account) }, { label: 'Equity', value: money(assetValue - outstanding, account, 'flow') }]} />
                          <Button variant="secondary" size="sm" icon="arrow-right-01" onPress={() => props.onOpenAccount(asset.id)}>Open {asset.name}</Button>
                        </div>
                      </div>
                    ) : <p className="type-body text-muted">No asset linked.</p>}
                  </Section>
                )}
                <Section span="half" title={isLending ? 'Repaid into' : 'Paid from'}>
                  <PaymentAccountCard from={payFrom} date={plan.next ? parseLocalDate(plan.next.date) : null} amount={plan.next?.totalPayment ?? payment} label={isLending ? 'Repayments arrive in' : 'Payments leave from'} onOpenAccount={props.onOpenAccount} />
                </Section>
            </Board>
          ) : (
            <EmptyState icon="calendar-01" title="No schedule yet" description="Add the amount, term, rate and start date in Edit to see the plan, the payoff date and an overpayment planner." actionLabel={props.onEditAccount ? 'Edit loan' : undefined} onAction={props.onEditAccount} />
          ),
        },
        {
          id: 'plan',
          label: isLending ? 'Repayment plan' : 'Payment plan',
          content: <PaymentPlanTable account={account} transactions={props.transactions} onMakePayment={props.onMakePayment} overrides={overrides} onOverridesChange={props.onOverridesChange} showBalanceAdjustments={props.showBalanceAdjustments} />,
        },
        activityTab(props),
        detailsTab([
          { label: isLending ? 'Lent' : 'Borrowed', value: account.principalAmount ? money(account.principalAmount, account) : undefined },
          { label: 'Down payment', value: account.downPayment ? money(account.downPayment, account) : undefined },
          { label: 'Rate', value: account.interestRate != null ? `${account.interestRate}%` : undefined },
          { label: 'Term', value: account.duration ? monthsLabel(account.duration) : undefined },
          { label: 'Started', value: day(account.loanStartDate) },
          { label: 'Payment day', value: account.paymentDayOfMonth ? `Day ${account.paymentDayOfMonth}` : undefined },
          { label: 'Each month', value: account.monthlyPayment ? money(account.monthlyPayment, account) : undefined },
          { label: 'Counterparty', value: account.counterparty },
          { label: 'Lender', value: account.financialInstitution },
          { label: 'Account number', value: account.accountNumber, copy: account.accountNumber },
        ]),
      ]}
    />
  );
};

/** Other debts (tax, a private loan): what's left, the pace you pay it at, and when that pace clears it. */
export const LiabilityLayout: React.FC<AccountPanelProps> = props => {
  const { account } = props;
  const page = useAccountPage(account, props);
  const owed = Math.abs(Math.min(0, page.todayBalance));
  const flows = useMemo(() => monthlyFlows(page.amounts, 12), [page.amounts]);
  const flowPeriodsByMonth = useMemo(() => monthPeriods(flows), [flows]);
  const paidTotal = page.amounts.filter(item => item.amount > 0).reduce((sum, item) => safeAdd(sum, item.amount), 0);
  const pace = flows.slice(-6).reduce((sum, row) => sum + row.in, 0) / 6;
  const monthsLeft = pace > 0 ? Math.ceil(owed / pace) : null;

  const chart = useMemo(() => {
    const history = monthlyBalanceHistory(page.todayBalance, page.amounts, 24).map(item => ({ date: item.date, owed: Math.abs(Math.min(0, item.value)) }));
    const ahead: { date: Date; owed: number }[] = [];
    if (pace > 0) {
      let left = owed;
      for (let index = 1; index <= Math.min(60, monthsLeft ?? 0); index++) {
        left = Math.max(0, left - pace);
        ahead.push({ date: new Date(new Date().getFullYear(), new Date().getMonth() + index + 1, 0), owed: safeRound(left, 2) });
      }
    }
    return { points: [...history, ...ahead], todayIndex: history.length - 1 };
  }, [page.todayBalance, page.amounts, owed, pace, monthsLeft]);

  return (
    <AccountShell
      account={account}
      context={`${account.otherSubType || 'Debt'}${account.counterparty ? `, owed to ${account.counterparty}` : ''}`}
      value={owed}
      valueLabel="Owed"
      heroNote={monthsLeft ? `At your pace of the last 6 months, cleared in ${monthsLabel(monthsLeft)}` : 'No payments in the last 6 months'}
      kpis={[
        { label: 'Paid so far', value: money(paidTotal, account) },
        { label: 'Paid a month', value: money(pace, account), context: 'Average of 6 months' },
        { label: 'Due', value: account.maturityDate ? day(account.maturityDate) : '—' },
        { label: 'Owed to', value: account.counterparty || '—' },
      ]}
      links={page.links}
      siblings={page.siblings}
      onOpenAccount={props.onOpenAccount}
      onOpenGoals={props.onOpenGoals}
      mainAction={addAction(props, 'Add payment')}
      actions={commonActions(props)}
      onBack={props.onBack}
      tabs={[
        {
          id: 'overview',
          label: 'Overview',
          content: (
            <Board>
              <Section span="side" title="What's left" subtitle="24 months back, and ahead at your current pace">
                <TimeSeries data={chart.points} series={[{ key: 'owed', label: 'Owed', color: 'var(--chart-4)', dashFromIndex: chart.todayIndex }]} currency={account.currency} showLegend={false} height="fill" />
              </Section>
              <Section span="wide" title="Payments by month" subtitle="Last 12 months">
                <MoneyFlowChart periods={flowPeriodsByMonth} currency={account.currency} labels={{ in: 'Paid', out: 'Added', balance: 'Owed' }} hint="Pick a month to see it" showDetail={false} />
              </Section>
            </Board>
          ),
        },
        activityTab(props),
        detailsTab([
          { label: 'Kind', value: account.otherSubType },
          { label: 'Owed to', value: account.counterparty },
          { label: 'Currency', value: account.currency },
          { label: 'Opened', value: day(account.openingDate) },
          { label: 'Notes', value: account.notes },
        ]),
      ]}
    />
  );
};
