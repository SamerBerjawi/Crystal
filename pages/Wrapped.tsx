import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { formatCurrency, getMainCurrency } from '../utils';
import { buildWrapped, wrappedDate, wrappedYears, type Wrapped as WrappedData } from '../utils/wrappedModel';
import { useAccountSelector, useTransactionSelector } from '../contexts/DomainProviders';
import PageHeader from '../components/PageHeader';
import { Button } from '../components/ui/Actions';
import Icon from '../components/ui/Icon';
import { Amount } from '../components/ui/Money';
import { Select } from '../components/ui/Pickers';
import { EmptyState } from '../components/ui/States';

const CARD = 'surface-card min-w-0 rounded-[var(--radius-xl)] p-5';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthName = (month: number) => new Date(2000, month, 1).toLocaleDateString(undefined, { month: 'long' });
const percent = (value: number) => `${Math.round(value * 100)}%`;

const Tile: React.FC<{ icon: string; label: string; children: React.ReactNode; note?: React.ReactNode; className?: string }> = ({ icon, label, children, note, className }) => (
  <section className={`${CARD} ${className ?? ''}`}>
    <div className="mb-2 flex items-center gap-2 text-muted"><Icon name={icon} size={18} /><h2 className="type-label">{label}</h2></div>
    <div className="type-figure-lg text-ink">{children}</div>
    {note && <p className="type-caption mt-1 text-muted">{note}</p>}
  </section>
);

const RankList: React.FC<{ rows: WrappedData['topMerchants'] }> = ({ rows }) => {
  const currency = getMainCurrency();
  const max = rows[0]?.total || 1;
  return (
    <ol className="space-y-3">
      {rows.map((row, index) => (
        <li key={row.label}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="type-body-strong min-w-0 truncate text-ink">{index + 1}. {row.label}</span>
            <Amount value={row.total} currency={currency} className="type-body shrink-0 text-ink" />
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-inset"><div className="h-full rounded-full bg-primary" style={{ width: `${(row.total / max) * 100}%` }} /></div>
          <p className="type-caption mt-0.5 text-muted">{row.count} {row.count === 1 ? 'payment' : 'payments'}</p>
        </li>
      ))}
    </ol>
  );
};

/** Income, spending and what was kept, month by month. The bar is spending as a share of the biggest month. */
const MonthBars: React.FC<{ months: WrappedData['months'] }> = ({ months }) => {
  const max = Math.max(...months.map(m => Math.max(m.income, m.expense)), 1);
  return (
    <div className="grid grid-cols-12 items-end gap-1.5" role="img" aria-label="Income and spending for each month">
      {months.map(m => (
        <div key={m.month} className="flex flex-col items-center gap-1">
          <div className="flex h-28 w-full items-end gap-0.5">
            <div className="w-1/2 rounded-t bg-money-in" style={{ height: `${(m.income / max) * 100}%` }} title={`${monthName(m.month)} income`} />
            <div className="w-1/2 rounded-t bg-chart-2" style={{ height: `${(m.expense / max) * 100}%` }} title={`${monthName(m.month)} spending`} />
          </div>
          <span className="type-caption text-muted">{MONTHS[m.month].slice(0, 1)}</span>
        </div>
      ))}
    </div>
  );
};

const summaryText = (w: WrappedData) => {
  const money = (value: number) => formatCurrency(value, getMainCurrency());
  const lines = [`My ${w.year} in money`, `Income ${money(w.income)}, spending ${money(w.expense)}, kept ${money(w.saved)}${w.savingsRate !== undefined ? ` (${percent(w.savingsRate)})` : ''}.`];
  if (w.topMerchants[0]) lines.push(`Most spent at ${w.topMerchants[0].label}.`);
  if (w.longestNoSpendStreak.days > 1) lines.push(`Longest no-spend streak: ${w.longestNoSpendStreak.days} days.`);
  if (w.kilometres) lines.push(`Drove ${w.kilometres.toLocaleString()} km.`);
  return lines.join('\n');
};

/** A year in review, built only from what is already in the ledger. Nothing leaves the browser. */
const Wrapped: React.FC = () => {
  const transactions = useTransactionSelector(tx => tx);
  const accounts = useAccountSelector(acc => acc);
  const currency = getMainCurrency();

  const inAnalytics = useMemo(() => {
    const ids = new Set(accounts.filter(acc => acc.includeInAnalytics ?? true).map(acc => acc.id));
    return ids.size === 0 ? transactions : transactions.filter(tx => ids.has(tx.accountId));
  }, [transactions, accounts]);
  const years = useMemo(() => wrappedYears(inAnalytics), [inAnalytics]);
  const [picked, setPicked] = useState<number | null>(null);
  const year = picked ?? years[0] ?? new Date().getFullYear();

  const mileage = useMemo(() => accounts.flatMap(acc => acc.mileageLogs ?? []), [accounts]);
  const wrapped = useMemo(() => buildWrapped(year, inAnalytics, accounts, mileage), [year, inAnalytics, accounts, mileage]);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(summaryText(wrapped));
      toast.success('Summary copied');
    } catch {
      toast.error('Could not copy the summary');
    }
  };

  const picker = years.length > 1 ? (
    <Select label="Year" variant="chip" value={String(year)} onChange={id => setPicked(Number(id))} options={years.map(y => ({ id: String(y), label: String(y) }))} />
  ) : null;

  return (
    <div className="space-y-5">
      <PageHeader title="Annual Wrapped" actions={<div className="flex items-center gap-2">{picker}{wrapped.hasData && <Button icon="copy-01" variant="ghost" onPress={share}>Copy summary</Button>}</div>} />

      {!wrapped.hasData ? (
        <EmptyState icon="calendar-03" title={`Nothing recorded for ${year}`} description="Once this year has income or spending in it, your review shows up here." />
      ) : (
        <>
          <section className="surface-card rounded-[var(--radius-2xl)] bg-primary-soft p-6 md:p-8">
            <p className="type-label text-muted">Your {year}</p>
            <p className="type-figure-hero mt-2 text-ink">
              {wrapped.saved >= 0 ? 'You kept ' : 'You spent '}
              <Amount value={Math.abs(wrapped.saved)} currency={currency} countUp />
              {wrapped.saved >= 0 ? '' : ' more than you earned'}
            </p>
            <p className="type-body mt-2 text-muted">
              {wrapped.savingsRate !== undefined && wrapped.saved >= 0 ? `That is ${percent(wrapped.savingsRate)} of your income, across ` : 'Across '}
              {wrapped.transactionCount.toLocaleString()} transactions.
            </p>
          </section>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 min-[1100px]:grid-cols-3">
            <Tile icon="wallet-02" label="Income"><Amount value={wrapped.income} currency={currency} /></Tile>
            <Tile icon="credit-card" label="Spending"><Amount value={wrapped.expense} currency={currency} /></Tile>
            {wrapped.netWorth && (
              <Tile icon="chart-increase" label="Net worth" note={<>From <Amount value={wrapped.netWorth.start} currency={currency} /> to <Amount value={wrapped.netWorth.end} currency={currency} /></>}>
                <Amount value={wrapped.netWorth.change} currency={currency} tone="loss" />
                {wrapped.netWorth.changePct !== undefined && <span className="type-body ml-2 text-muted">{wrapped.netWorth.change >= 0 ? '+' : ''}{percent(wrapped.netWorth.changePct)}</span>}
              </Tile>
            )}
            {wrapped.bestMonth && (
              <Tile icon="award-01" label="Best month" note={<>You kept <Amount value={wrapped.bestMonth.saved} currency={currency} /></>}>{monthName(wrapped.bestMonth.month)}</Tile>
            )}
            {wrapped.worstMonth && wrapped.worstMonth.month !== wrapped.bestMonth?.month && (
              <Tile icon="alert-circle" label="Toughest month" note={wrapped.worstMonth.saved >= 0 ? <>You still kept <Amount value={wrapped.worstMonth.saved} currency={currency} /></> : <>You spent <Amount value={Math.abs(wrapped.worstMonth.saved)} currency={currency} /> more than you earned</>}>{monthName(wrapped.worstMonth.month)}</Tile>
            )}
            {wrapped.biggestPurchase && (
              <Tile icon="receipt" label="Biggest purchase" note={`${wrapped.biggestPurchase.label}, ${wrappedDate(wrapped.biggestPurchase.date)}`}><Amount value={wrapped.biggestPurchase.amount} currency={currency} /></Tile>
            )}
            {wrapped.busiestDay && (
              <Tile icon="calendar-03" label="Busiest spending day" note={<>{wrapped.busiestDay.count} {wrapped.busiestDay.count === 1 ? 'payment' : 'payments'}, <Amount value={wrapped.busiestDay.total} currency={currency} /></>}>{wrappedDate(wrapped.busiestDay.date)}</Tile>
            )}
            {wrapped.longestNoSpendStreak.days > 1 && wrapped.longestNoSpendStreak.start && wrapped.longestNoSpendStreak.end && (
              <Tile icon="target-01" label="Longest no-spend streak" note={`${wrappedDate(wrapped.longestNoSpendStreak.start)} to ${wrappedDate(wrapped.longestNoSpendStreak.end)}. ${wrapped.noSpendDays} no-spend days in all.`}>{wrapped.longestNoSpendStreak.days} days</Tile>
            )}
            {wrapped.kilometres !== undefined && (
              <Tile icon="car-01" label="On the road" note="From your mileage logs">{wrapped.kilometres.toLocaleString()} km</Tile>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <section className={CARD}><h2 className="type-card-title mb-3 text-ink">Where it went</h2><RankList rows={wrapped.topMerchants} /></section>
            <section className={CARD}><h2 className="type-card-title mb-3 text-ink">Top categories</h2><RankList rows={wrapped.topCategories} /></section>
          </div>

          <section className={CARD}>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="type-card-title text-ink">Month by month</h2>
              <span className="type-caption flex items-center gap-3 text-muted">
                <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-money-in" aria-hidden="true" />Income</span>
                <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-chart-2" aria-hidden="true" />Spending</span>
              </span>
            </div>
            <MonthBars months={wrapped.months} />
          </section>
        </>
      )}
    </div>
  );
};

export default Wrapped;
