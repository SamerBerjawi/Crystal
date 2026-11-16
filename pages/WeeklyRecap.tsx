import React, { useMemo, useState } from 'react';
import PageHeader, { type PageStat } from '../components/PageHeader';
import { EntityGlyph, MerchantLogo } from '../components/EntityIcon';
import { Button, IconButton } from '../components/ui/Actions';
import { Badge } from '../components/ui/Display';
import Icon from '../components/ui/Icon';
import { Amount } from '../components/ui/Money';
import { SidePanel } from '../components/ui/Overlays';
import { EmptyState } from '../components/ui/States';
import { useAccountSelector, useTransactionSelector } from '../contexts/DomainProviders';
import { useBudgetsContext, useCategoryContext, useScheduleContext } from '../contexts/FinancialDataContext';
import { Bar, BarChart, BarXAxis, ChartTooltip, Grid, TrendLine, YAxis } from '../src/components/charts';
import { convertToMain, formatCurrency, getMainCurrency } from '../utils';
import { parentCategoryName } from '../utils/budgetModel';
import { getCategoryDetails } from '../utils/categories';
import { buildRecap, shiftWeek, weekOf, type RecapShare } from '../utils/weeklyRecap';
import { cn } from '../lib/utils';

const CARD = 'surface-card min-w-0 rounded-[var(--radius-xl)] p-5 border border-line';
const day = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const shortWeekday = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
const weekday = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const pct = (v: number) => `${v < 0 ? '−' : '+'}${Math.abs(v * 100).toFixed(0)}%`;

type DrillFilter =
  | { kind: 'day'; date: string; title: string }
  | { kind: 'category'; name: string; title: string }
  | { kind: 'merchant'; name: string; title: string };

/** One Monday-to-Sunday week: what came in and went out, daily rhythm, where it went, and what is coming. */
const WeeklyRecap: React.FC = () => {
  const transactions = useTransactionSelector(tx => tx);
  const accounts = useAccountSelector(acc => acc);
  const { expenseCategories, incomeCategories } = useCategoryContext();
  const { budgets } = useBudgetsContext();
  const { recurringTransactions, recurringTransactionOverrides, billsAndPayments } = useScheduleContext();
  const currency = getMainCurrency();
  const today = useMemo(() => new Date(), []);
  const thisWeek = useMemo(() => weekOf(today), [today]);
  const lastFullWeek = useMemo(() => shiftWeek(thisWeek, -1), [thisWeek]);

  // A link can open any week with ?week=YYYY-MM-DD; otherwise the last full week.
  const [week, setWeekState] = useState(() => {
    const asked = new URLSearchParams(window.location.search).get('week');
    return /^\d{4}-\d{2}-\d{2}$/.test(asked ?? '') ? weekOf(new Date(`${asked}T00:00:00`)) : shiftWeek(weekOf(new Date()), -1);
  });
  const [drill, setDrill] = useState<DrillFilter | null>(null);

  const setWeek = (next: typeof week) => {
    setWeekState(next);
    setDrill(null);
    try { window.history.replaceState(null, '', `${window.location.pathname}?week=${next.start}`); } catch { /* the address is a convenience */ }
  };

  const allCategories = useMemo(
    () => [...(expenseCategories || []), ...(incomeCategories || [])],
    [expenseCategories, incomeCategories],
  );
  const accountNames = useMemo(() => new Map(accounts.map(a => [a.id, a.name])), [accounts]);

  const recap = useMemo(
    () =>
      buildRecap({
        transactions,
        accounts,
        categories: expenseCategories || [],
        budgets,
        recurring: recurringTransactions,
        overrides: recurringTransactionOverrides,
        bills: billsAndPayments,
        convert: (amount, from) => convertToMain(amount, from),
        week,
        today,
      }),
    [transactions, accounts, expenseCategories, budgets, recurringTransactions, recurringTransactionOverrides, billsAndPayments, week, today],
  );

  const label = `${day(week.start)} to ${day(week.end)}`;
  const isLatest = week.start >= thisWeek.start;
  const maxDaySpend = Math.max(...recap.days.map(d => d.spent), 1);

  const stats: PageStat[] = [
    {
      label: 'Spent',
      icon: 'credit-card',
      value: recap.spent,
      format: 'money',
      currency,
      ...(recap.spentChange !== undefined
        ? { badge: pct(recap.spentChange), badgeTone: recap.spentChange > 0 ? 'tomato' as const : 'pine' as const }
        : {}),
    },
    { label: 'Earned', icon: 'wallet-02', value: recap.earned, format: 'money', currency, iconTone: 'positive' },
    { label: 'Kept', icon: 'piggy-bank', value: recap.saved, format: 'money', currency, iconTone: recap.saved >= 0 ? 'teal' : 'negative' },
  ];

  const drillTransactions = useMemo(() => {
    if (!drill) return [];
    if (drill.kind === 'day') return recap.transactions.filter(tx => tx.date.slice(0, 10) === drill.date);
    if (drill.kind === 'category') {
      return recap.transactions.filter(tx => {
        if (tx.type !== 'expense') return false;
        const parent = parentCategoryName(tx.category, expenseCategories || []) ?? (tx.category || 'Uncategorized');
        return parent === drill.name;
      });
    }
    return recap.transactions.filter(
      tx => tx.type === 'expense' && (tx.merchant?.trim() || tx.description || 'Unknown merchant') === drill.name,
    );
  }, [drill, recap.transactions, expenseCategories]);

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Weekly recap"
        subtitle={recap.inProgress ? `${label} · In progress (figures so far)` : `${label} · ${recap.transactionCount} ${recap.transactionCount === 1 ? 'transaction' : 'transactions'}`}
        stats={recap.hasData ? stats : undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {week.start !== lastFullWeek.start && (
              <Button variant="ghost" size="sm" onPress={() => setWeek(lastFullWeek)}>
                Last full week
              </Button>
            )}
            {week.start !== thisWeek.start && (
              <Button variant="secondary" size="sm" onPress={() => setWeek(thisWeek)}>
                This week
              </Button>
            )}
            <div className="flex items-center gap-1 rounded-full border border-line bg-surface px-1 py-0.5">
              <IconButton icon="arrow-left-01" label="Previous week" onPress={() => setWeek(shiftWeek(week, -1))} />
              <span className="type-body-strong min-w-32 px-1 text-center text-ink">{label}</span>
              <IconButton icon="arrow-right-01" label="Next week" isDisabled={isLatest} onPress={() => setWeek(shiftWeek(week, 1))} />
            </div>
          </div>
        }
      />

      {!recap.hasData ? (
        <EmptyState icon="calendar-03" title="Nothing recorded this week" description="No spending or income was recorded for these days. Try another week." />
      ) : (
        <>
          {/* Daily Rhythm Strip (Mon - Sun) */}
          <section className={CARD} aria-label="Daily spending rhythm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="type-card-title text-ink">Daily rhythm</h2>
                <p className="type-caption text-muted">Click any day to inspect its transactions.</p>
              </div>
              <div className="flex items-center gap-2">
                {recap.noSpendDays > 0 && (
                  <Badge tone="positive">
                    {recap.noSpendDays} no-spend {recap.noSpendDays === 1 ? 'day' : 'days'}
                  </Badge>
                )}
                {recap.spentChange !== undefined && (
                  <Badge tone={recap.spentChange > 0 ? 'attention' : 'positive'}>
                    {pct(recap.spentChange)} vs. week before (<Amount value={recap.prevSpent} currency={currency} className="type-caption" />)
                  </Badge>
                )}
              </div>
            </div>

            <div className="mb-4 h-52">
              <BarChart
                data={recap.days.map(d => ({ day: shortWeekday(d.date), Spent: d.spent }))}
                xDataKey="day"
                aspectRatio="auto"
                margin={{ top: 8, right: 8, bottom: 40, left: 56 }}
              >
                <Grid horizontal />
                <Bar dataKey="Spent" lineCap="round" />
                <YAxis yAxisId="left" />
                <TrendLine dataKey="Spent" stroke="var(--chart-1)" />
                <BarXAxis />
                <ChartTooltip valueFormatter={(value: number) => formatCurrency(value, currency)} />
              </BarChart>
            </div>

            <div className="grid grid-cols-7 gap-2 sm:gap-3">
              {recap.days.map(d => {
                const isPeak = d.spent > 0 && d.spent === maxDaySpend;
                return (
                  <button
                    key={d.date}
                    type="button"
                    disabled={d.count === 0}
                    onClick={() => setDrill({ kind: 'day', date: d.date, title: weekday(d.date) })}
                    className={cn(
                      'group flex flex-col items-center rounded-[var(--radius-lg)] border border-line/60 bg-inset/30 p-2.5 text-center transition-colors',
                      d.count > 0 && 'cursor-pointer hover:border-primary hover:bg-inset',
                      isPeak && 'border-amber/60 bg-amber-soft/20',
                    )}
                  >
                    <span className="type-caption font-semibold text-ink">{shortWeekday(d.date)}</span>
                    <span className="type-caption text-[11px] text-muted">{d.date.slice(8, 10)}</span>
                    <span className="type-caption mt-1.5 truncate font-semibold text-ink">
                      {d.spent > 0 ? <Amount value={d.spent} currency={currency} className="type-caption" /> : '—'}
                    </span>
                    <span className="type-caption text-[11px] text-muted">
                      {d.count > 0 ? `${d.count} tx` : 'Calm'}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Categories & Top Merchants */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <section className={CARD} aria-label="Where it went">
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h2 className="type-card-title text-ink">Where it went</h2>
                <span className="type-caption text-muted">Click a category to inspect</span>
              </div>
              {recap.topCategories.length > 0 ? (
                <SharesList
                  rows={recap.topCategories}
                  currency={currency}
                  kind="category"
                  resolveCategory={name => getCategoryDetails(name, allCategories)}
                  onSelect={row => setDrill({ kind: 'category', name: row.label, title: row.label })}
                />
              ) : (
                <p className="type-body text-muted">No spending this week.</p>
              )}
            </section>

            <section className={CARD} aria-label="Top merchants">
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h2 className="type-card-title text-ink">Top merchants</h2>
                <span className="type-caption text-muted">By total spent</span>
              </div>
              {recap.topMerchants.length > 0 ? (
                <SharesList
                  rows={recap.topMerchants}
                  currency={currency}
                  kind="merchant"
                  onSelect={row => setDrill({ kind: 'merchant', name: row.label, title: row.label })}
                />
              ) : (
                <p className="type-body text-muted">No spending this week.</p>
              )}
              {recap.biggest && (
                <div className="mt-4 flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-line bg-inset/40 px-3 py-2">
                  <span className="type-caption text-muted">
                    Biggest purchase: <span className="font-semibold text-ink">{recap.biggest.label}</span> on {day(recap.biggest.date)}
                  </span>
                  <Amount value={recap.biggest.amount} currency={currency} className="type-caption shrink-0 font-bold text-ink" />
                </div>
              )}
            </section>
          </div>
        </>
      )}

      {/* Budgets & Coming up */}
      {(recap.budgets.length > 0 || recap.upcomingWindow) && (
        <div className={cn('grid grid-cols-1 gap-4', recap.budgets.length > 0 && recap.upcomingWindow && 'md:grid-cols-2')}>
          {recap.budgets.length > 0 && (
            <section className={CARD} aria-label="Budgets">
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <div>
                  <h2 className="type-card-title text-ink">Budgets running high</h2>
                  <p className="type-caption text-muted">Month to date as of the end of the week.</p>
                </div>
                <Badge tone="attention">{recap.budgets.length} watching</Badge>
              </div>
              <ul className="space-y-3">
                {recap.budgets.map(line => {
                  const cat = getCategoryDetails(line.name, allCategories);
                  return (
                    <li key={line.budget.id}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2">
                          <EntityGlyph icon={cat?.icon} label={line.name} color={cat?.color} size={16} />
                          <span className="type-body truncate text-ink">{line.name}</span>
                        </span>
                        <span className="type-caption shrink-0 text-muted">
                          <span className={cn('font-semibold', line.pct > 100 ? 'text-money-out' : 'text-ink')}>{Math.round(line.pct)}%</span> of{' '}
                          <Amount value={line.limit} currency={currency} className="type-caption" />
                        </span>
                      </div>
                      <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-inset" aria-hidden>
                        <span
                          className={cn('block h-full rounded-full transition-all', line.pct > 100 ? 'bg-money-out' : 'bg-amber')}
                          style={{ width: `${Math.min(100, line.pct)}%` }}
                        />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {recap.upcomingWindow && (
            <section className={CARD} aria-label="Coming up">
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <div>
                  <h2 className="type-card-title text-ink">Coming up</h2>
                  <p className="type-caption text-muted">{day(recap.upcomingWindow.start)} to {day(recap.upcomingWindow.end)}</p>
                </div>
                {recap.upcoming.length > 0 && (
                  <Amount value={recap.upcomingTotal} currency={currency} className="type-body-strong text-ink" />
                )}
              </div>
              {recap.upcoming.length === 0 ? (
                <p className="type-body text-muted">No unpaid bills or scheduled charges are due.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {recap.upcoming.map((bill, i) => (
                    <li key={`${bill.name}-${bill.date}-${i}`} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <MerchantLogo merchant={bill.name} size={24} />
                        <div className="min-w-0">
                          <span className="type-body block truncate text-ink">{bill.name}</span>
                          <span className="type-caption text-muted">{weekday(bill.date)}</span>
                        </div>
                      </div>
                      <Amount value={bill.amount} currency={currency} className="type-body shrink-0 font-semibold text-ink" />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      )}

      {/* Drill-down SidePanel */}
      <SidePanel
        isOpen={!!drill}
        onClose={() => setDrill(null)}
        title={drill?.title ?? 'Transactions'}
        description={`${drillTransactions.length} ${drillTransactions.length === 1 ? 'transaction' : 'transactions'} in ${label}`}
      >
        {drillTransactions.length === 0 ? (
          <p className="type-body text-muted">No matching transactions.</p>
        ) : (
          <ul className="divide-y divide-line">
            {drillTransactions.map(tx => {
              const cat = getCategoryDetails(tx.category, allCategories);
              const signed = tx.type === 'expense' ? -Math.abs(convertToMain(tx.amount, tx.currency)) : Math.abs(convertToMain(tx.amount, tx.currency));
              return (
                <li key={tx.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <MerchantLogo merchant={tx.merchant || tx.description} size={30} />
                    <div className="min-w-0">
                      <p className="type-body-strong truncate text-ink">{tx.merchant || tx.description}</p>
                      <p className="type-caption flex items-center gap-1.5 text-muted">
                        <EntityGlyph icon={cat?.icon} label={tx.category} color={cat?.color} size={13} />
                        <span className="truncate">{tx.category} · {day(tx.date)} · {accountNames.get(tx.accountId) ?? 'Account'}</span>
                      </p>
                    </div>
                  </div>
                  <Amount value={signed} currency={currency} tone="flow" className="type-figure-row shrink-0" />
                </li>
              );
            })}
          </ul>
        )}
      </SidePanel>
    </div>
  );
};

const SharesList: React.FC<{
  rows: RecapShare[];
  currency: string;
  kind: 'category' | 'merchant';
  resolveCategory?: (name: string) => { icon?: string; color?: string } | undefined;
  onSelect: (row: RecapShare) => void;
}> = ({ rows, currency, kind, resolveCategory, onSelect }) => (
  <ul className="space-y-2">
    {rows.map(row => {
      const cat = kind === 'category' ? resolveCategory?.(row.label) : undefined;
      return (
        <li key={row.label}>
          <button
            type="button"
            onClick={() => onSelect(row)}
            className="w-full cursor-pointer rounded-[var(--radius-md)] px-2 py-1.5 text-left transition-colors hover:bg-inset/70"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                {kind === 'category' ? (
                  <EntityGlyph icon={cat?.icon} label={row.label} color={cat?.color} size={16} />
                ) : (
                  <MerchantLogo merchant={row.label} size={20} />
                )}
                <span className="type-body truncate font-medium text-ink">{row.label}</span>
                <span className="type-caption text-muted">({row.count})</span>
              </span>
              <span className="type-body shrink-0 text-ink">
                <Amount value={row.total} currency={currency} className="type-body font-semibold" />{' '}
                <span className="type-caption text-muted">{Math.round(row.share * 100)}%</span>
              </span>
            </div>
            <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-inset" aria-hidden>
              <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(3, row.share * 100)}%` }} />
            </span>
          </button>
        </li>
      );
    })}
  </ul>
);

export default WeeklyRecap;
