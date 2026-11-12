import React, { useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { IconButton } from '../components/ui/Actions';
import { Amount } from '../components/ui/Money';
import { EmptyState } from '../components/ui/States';
import { useAccountSelector, useTransactionSelector } from '../contexts/DomainProviders';
import { useBudgetsContext, useCategoryContext, useScheduleContext } from '../contexts/FinancialDataContext';
import { convertToMain, getMainCurrency } from '../utils';
import { buildRecap, shiftWeek, weekOf, type RecapShare } from '../utils/weeklyRecap';

const CARD = 'surface-card min-w-0 rounded-[var(--radius-xl)] p-5 border border-line';
const day = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const weekday = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const pct = (v: number) => `${v < 0 ? '−' : '+'}${Math.abs(v * 100).toFixed(0)}%`;

const Shares: React.FC<{ rows: RecapShare[]; currency: string }> = ({ rows, currency }) => (
  <ul className="space-y-3">
    {rows.map(row => (
      <li key={row.label}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="type-body truncate text-ink">{row.label}</span>
          <span className="type-body shrink-0 text-ink"><Amount value={row.total} currency={currency} className="type-body" /> <span className="type-caption text-muted">{Math.round(row.share * 100)}%</span></span>
        </div>
        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-inset" aria-hidden><span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(2, row.share * 100)}%` }} /></span>
      </li>
    ))}
  </ul>
);

/** One Monday-to-Sunday week: what came in and went out, where it went, and what is coming. */
const WeeklyRecap: React.FC = () => {
  const transactions = useTransactionSelector(tx => tx);
  const accounts = useAccountSelector(acc => acc);
  const { expenseCategories } = useCategoryContext();
  const { budgets } = useBudgetsContext();
  const { recurringTransactions } = useScheduleContext();
  const currency = getMainCurrency();
  const today = useMemo(() => new Date(), []);
  const thisWeek = useMemo(() => weekOf(today), [today]);
  // A link can open any week with ?week=YYYY-MM-DD; otherwise the last full week.
  const [week, setWeekState] = useState(() => {
    const asked = new URLSearchParams(window.location.search).get('week');
    return /^\d{4}-\d{2}-\d{2}$/.test(asked ?? '') ? weekOf(new Date(`${asked}T00:00:00`)) : shiftWeek(weekOf(new Date()), -1);
  });
  const setWeek = (next: typeof week) => {
    setWeekState(next);
    try { window.history.replaceState(null, '', `${window.location.pathname}?week=${next.start}`); } catch { /* the address is a convenience */ }
  };

  const recap = useMemo(
    () => buildRecap({ transactions, accounts, categories: expenseCategories || [], budgets, recurring: recurringTransactions, convert: (amount, from) => convertToMain(amount, from), week, today }),
    [transactions, accounts, expenseCategories, budgets, recurringTransactions, week, today],
  );
  const label = `${day(week.start)} to ${day(week.end)}`;
  const isLatest = week.start >= thisWeek.start;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Weekly recap"
        actions={
          <div className="flex items-center gap-1">
            <IconButton icon="arrow-left-01" label="Previous week" onPress={() => setWeek(shiftWeek(week, -1))} />
            <span className="type-body-strong min-w-36 text-center text-ink">{label}</span>
            <IconButton icon="arrow-right-01" label="Next week" isDisabled={isLatest} onPress={() => setWeek(shiftWeek(week, 1))} />
          </div>
        }
      />
      {recap.inProgress && <p className="type-caption text-muted">This week is still going. These figures are so far.</p>}

      {!recap.hasData ? (
        <EmptyState icon="calendar-03" title="Nothing recorded this week" description="No spending or income was recorded for these days. Try another week." />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <section className={CARD}>
              <h2 className="type-label text-muted">Spent</h2>
              <p className="type-figure-lg mt-1 text-ink"><Amount value={recap.spent} currency={currency} /></p>
              <p className="type-caption mt-1 text-muted">
                {recap.spentChange === undefined ? 'Nothing spent the week before to compare with.' : <>{pct(recap.spentChange)} on the week before (<Amount value={recap.prevSpent} currency={currency} className="type-caption" />).</>}
              </p>
            </section>
            <section className={CARD}>
              <h2 className="type-label text-muted">Earned</h2>
              <p className="type-figure-lg mt-1 text-ink"><Amount value={recap.earned} currency={currency} /></p>
              <p className="type-caption mt-1 text-muted">The week before: <Amount value={recap.prevEarned} currency={currency} className="type-caption" />.</p>
            </section>
            <section className={CARD}>
              <h2 className="type-label text-muted">Kept</h2>
              <p className="type-figure-lg mt-1 text-ink"><Amount value={recap.saved} currency={currency} tone="flow" /></p>
              <p className="type-caption mt-1 text-muted">{recap.transactionCount} {recap.transactionCount === 1 ? 'transaction' : 'transactions'}.</p>
            </section>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <section className={CARD} aria-label="Where it went">
              <h2 className="type-card-title mb-3 text-ink">Where it went</h2>
              {recap.topCategories.length > 0 ? <Shares rows={recap.topCategories} currency={currency} /> : <p className="type-body text-muted">No spending.</p>}
            </section>
            <section className={CARD} aria-label="Top merchants">
              <h2 className="type-card-title mb-3 text-ink">Top merchants</h2>
              {recap.topMerchants.length > 0 ? <Shares rows={recap.topMerchants} currency={currency} /> : <p className="type-body text-muted">No spending.</p>}
              {recap.biggest && <p className="type-caption mt-4 text-muted">Biggest purchase: {recap.biggest.label}, <Amount value={recap.biggest.amount} currency={currency} className="type-caption" /> on {day(recap.biggest.date)}.</p>}
            </section>
          </div>
        </>
      )}

      {recap.budgets.length > 0 && (
        <section className={CARD} aria-label="Budgets">
          <h2 className="type-card-title mb-1 text-ink">Budgets running high</h2>
          <p className="type-caption mb-3 text-muted">This month so far, as of the end of the week.</p>
          <ul className="space-y-3">
            {recap.budgets.map(line => (
              <li key={line.budget.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="type-body text-ink">{line.name}</span>
                  <span className="type-caption text-muted">{Math.round(line.pct)}% of <Amount value={line.limit} currency={currency} className="type-caption" /></span>
                </div>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-inset" aria-hidden><span className={`block h-full rounded-full ${line.pct > 100 ? 'bg-money-out' : 'bg-amber'}`} style={{ width: `${Math.min(100, line.pct)}%` }} /></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recap.upcomingWindow && (
        <section className={CARD} aria-label="Coming up">
          <h2 className="type-card-title mb-1 text-ink">Coming up</h2>
          <p className="type-caption mb-3 text-muted">{day(recap.upcomingWindow.start)} to {day(recap.upcomingWindow.end)}</p>
          {recap.upcoming.length === 0 ? <p className="type-body text-muted">No bills are due.</p> : (
            <>
              <ul className="divide-y divide-line">
                {recap.upcoming.map((bill, i) => (
                  <li key={`${bill.name}-${bill.date}-${i}`} className="flex items-baseline justify-between gap-3 py-2">
                    <span className="type-body truncate text-ink">{bill.name} <span className="type-caption text-muted">{weekday(bill.date)}</span></span>
                    <Amount value={bill.amount} currency={currency} className="type-body shrink-0" />
                  </li>
                ))}
              </ul>
              <p className="type-caption mt-2 text-muted">In total <Amount value={recap.upcomingTotal} currency={currency} className="type-caption" />.</p>
            </>
          )}
        </section>
      )}
    </div>
  );
};

export default WeeklyRecap;
