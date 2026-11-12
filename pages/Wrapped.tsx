import React, { useContext, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { formatCurrency, getMainCurrency } from '../utils';
import { buildWrapped, wrappedDate, wrappedYears, type Wrapped as WrappedData } from '../utils/wrappedModel';
import { useAccountSelector, useTransactionSelector } from '../contexts/DomainProviders';
import { useCategoryContext } from '../contexts/FinancialDataContext';
import PageHeader from '../components/PageHeader';
import { Button } from '../components/ui/Actions';
import Icon from '../components/ui/Icon';
import { Amount, PrivacyContext } from '../components/ui/Money';
import { Select } from '../components/ui/Pickers';
import { EmptyState } from '../components/ui/States';
import { EntityGlyph, MerchantLogo } from '../components/EntityIcon';
import { WrappedStoryModal, getFinancialArchetype } from '../components/WrappedStoryModal';
import { fireConfetti } from '../components/ui/Confetti';
import type { Category } from '../types';

const CARD = 'surface-card min-w-0 rounded-[var(--radius-xl)] p-5 border border-line transition-all duration-200 hover:border-line-strong';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthName = (month: number) => new Date(2000, month, 1).toLocaleDateString(undefined, { month: 'long' });
const percent = (value: number) => `${Math.round(value * 100)}%`;

const Tile: React.FC<{ icon: string; label: string; children: React.ReactNode; note?: React.ReactNode; className?: string }> = ({ icon, label, children, note, className }) => (
  <section className={`${CARD} ${className ?? ''}`}>
    <div className="mb-2 flex items-center gap-2 text-muted"><Icon name={icon} size={18} /><h2 className="type-label">{label}</h2></div>
    <div className="type-figure-lg text-ink">{children}</div>
    {note && <p className="type-caption mt-1.5 text-muted">{note}</p>}
  </section>
);

const MerchantRankList: React.FC<{ rows: WrappedData['topMerchants'] }> = ({ rows }) => {
  const currency = getMainCurrency();
  const max = rows[0]?.total || 1;
  return (
    <ol className="space-y-3.5">
      {rows.map((row, index) => {
        const rankColor = index === 0 ? 'bg-amber-500/20 text-amber-500' : index === 1 ? 'bg-slate-400/20 text-slate-400' : index === 2 ? 'bg-amber-700/20 text-amber-700' : 'bg-inset text-muted';
        return (
          <li key={row.label} className="group">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${rankColor}`}>
                  {index + 1}
                </span>
                <MerchantLogo merchant={row.label} size={22} className="rounded" />
                <span className="type-body-strong truncate text-ink group-hover:text-primary transition-colors">{row.label}</span>
              </div>
              <Amount value={row.total} currency={currency} className="type-body shrink-0 font-medium text-ink" />
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-inset">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${(row.total / max) * 100}%` }}
              />
            </div>
            <p className="type-caption mt-1 text-muted">{row.count} {row.count === 1 ? 'payment' : 'payments'}</p>
          </li>
        );
      })}
    </ol>
  );
};

const CategoryRankList: React.FC<{
  rows: WrappedData['topCategories'];
  categoryMap: Map<string, { icon?: string; color?: string }>;
}> = ({ rows, categoryMap }) => {
  const currency = getMainCurrency();
  const max = rows[0]?.total || 1;
  return (
    <ol className="space-y-3.5">
      {rows.map((row, index) => {
        const catInfo = categoryMap.get(row.label);
        const rankColor = index === 0 ? 'bg-amber-500/20 text-amber-500' : index === 1 ? 'bg-slate-400/20 text-slate-400' : index === 2 ? 'bg-amber-700/20 text-amber-700' : 'bg-inset text-muted';
        return (
          <li key={row.label} className="group">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${rankColor}`}>
                  {index + 1}
                </span>
                <EntityGlyph icon={catInfo?.icon} label={row.label} color={catInfo?.color} size={18} />
                <span className="type-body-strong truncate text-ink group-hover:text-primary transition-colors">{row.label}</span>
              </div>
              <Amount value={row.total} currency={currency} className="type-body shrink-0 font-medium text-ink" />
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-inset">
              <div
                className="h-full rounded-full bg-chart-2 transition-[width] duration-500"
                style={{ width: `${(row.total / max) * 100}%` }}
              />
            </div>
            <p className="type-caption mt-1 text-muted">{row.count} {row.count === 1 ? 'transaction' : 'transactions'}</p>
          </li>
        );
      })}
    </ol>
  );
};

/** Income, spending and what was kept, month by month with interactive hover insights. */
const MonthBars: React.FC<{ months: WrappedData['months'] }> = ({ months }) => {
  const [hoveredMonth, setHoveredMonth] = useState<WrappedData['months'][number] | null>(null);
  const currency = getMainCurrency();
  const max = Math.max(...months.map(m => Math.max(m.income, m.expense)), 1);

  return (
    <div className="space-y-3">
      {hoveredMonth && (
        <div className="flex items-center justify-between rounded-lg bg-inset/60 px-3 py-1.5 text-xs">
          <span className="font-semibold text-ink">{monthName(hoveredMonth.month)}</span>
          <div className="flex items-center gap-3">
            <span className="text-money-in">Income: <Amount value={hoveredMonth.income} currency={currency} /></span>
            <span className="text-chart-2">Spent: <Amount value={hoveredMonth.expense} currency={currency} /></span>
            <span className="font-medium text-ink">Net: <Amount value={hoveredMonth.saved} currency={currency} /></span>
          </div>
        </div>
      )}
      <div className="grid grid-cols-12 items-end gap-1.5 sm:gap-2.5" role="img" aria-label="Income and spending for each month">
        {months.map(m => (
          <div
            key={m.month}
            className="flex flex-col items-center gap-1 cursor-pointer transition-transform hover:scale-105"
            onMouseEnter={() => setHoveredMonth(m)}
            onMouseLeave={() => setHoveredMonth(null)}
          >
            <div className="flex h-28 w-full items-end gap-0.5 sm:gap-1">
              <div
                className="w-1/2 rounded-t bg-money-in transition-[height] duration-500"
                style={{ height: `${(m.income / max) * 100}%` }}
                title={`${monthName(m.month)} income`}
              />
              <div
                className="w-1/2 rounded-t bg-chart-2 transition-[height] duration-500"
                style={{ height: `${(m.expense / max) * 100}%` }}
                title={`${monthName(m.month)} spending`}
              />
            </div>
            <span className="type-caption text-muted">{MONTHS[m.month].slice(0, 1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const summaryText = (w: WrappedData, isPrivate = false) => {
  const money = (value: number) => isPrivate ? '•••' : formatCurrency(value, getMainCurrency());
  const lines = [
    `✨ My ${w.year} in Money ✨`,
    `Income ${money(w.income)}, spending ${money(w.expense)}, kept ${money(w.saved)}${w.savingsRate !== undefined ? ` (${percent(w.savingsRate)})` : ''}.`,
  ];
  if (w.topMerchants[0]) lines.push(`Most spent at ${w.topMerchants[0].label}.`);
  if (w.longestNoSpendStreak.days > 1) lines.push(`Longest no-spend streak: ${w.longestNoSpendStreak.days} days.`);
  if (w.kilometres) lines.push(`Drove ${w.kilometres.toLocaleString()} km.`);
  return lines.join('\n');
};

/** A year in review, built only from what is already in the ledger. Nothing leaves the browser. */
const Wrapped: React.FC = () => {
  const transactions = useTransactionSelector(tx => tx);
  const accounts = useAccountSelector(acc => acc);
  const { expenseCategories, incomeCategories } = useCategoryContext();
  const currency = getMainCurrency();
  const isPrivate = useContext(PrivacyContext);

  const [isStoryOpen, setStoryOpen] = useState(false);

  const allCategories = useMemo(
    () => [...(expenseCategories || []), ...(incomeCategories || [])],
    [expenseCategories, incomeCategories]
  );

  const categoryMap = useMemo(() => {
    const map = new Map<string, { icon?: string; color?: string }>();
    const register = (cat: Category) => {
      map.set(cat.name, { icon: cat.icon, color: cat.color });
      cat.subCategories?.forEach(sub => {
        map.set(sub.name, { icon: sub.icon || cat.icon, color: sub.color || cat.color });
      });
    };
    allCategories.forEach(register);
    return map;
  }, [allCategories]);

  const inAnalytics = useMemo(() => {
    const ids = new Set(accounts.filter(acc => acc.includeInAnalytics ?? true).map(acc => acc.id));
    return ids.size === 0 ? transactions : transactions.filter(tx => ids.has(tx.accountId));
  }, [transactions, accounts]);
  const years = useMemo(() => wrappedYears(inAnalytics), [inAnalytics]);
  const [picked, setPicked] = useState<number | null>(null);
  const year = picked ?? years[0] ?? new Date().getFullYear();

  const mileage = useMemo(() => accounts.flatMap(acc => acc.mileageLogs ?? []), [accounts]);
  const wrapped = useMemo(() => buildWrapped(year, inAnalytics, accounts, mileage), [year, inAnalytics, accounts, mileage]);
  const archetype = useMemo(() => getFinancialArchetype(wrapped), [wrapped]);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(summaryText(wrapped, isPrivate));
      toast.success('Summary copied to clipboard!');
      fireConfetti({ particleCount: 50, spread: 50 });
    } catch {
      toast.error('Could not copy the summary');
    }
  };

  const openStory = () => {
    setStoryOpen(true);
  };

  const picker = years.length > 1 ? (
    <Select label="Year" variant="chip" value={String(year)} onChange={id => setPicked(Number(id))} options={years.map(y => ({ id: String(y), label: String(y) }))} />
  ) : null;

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Annual Wrapped"
        actions={
          <div className="flex items-center gap-2">
            {picker}
            {wrapped.hasData && (
              <>
                <Button icon="play" variant="primary" onPress={openStory}>
                  Play Story
                </Button>
                <Button icon="copy-01" variant="ghost" onPress={share}>
                  Copy summary
                </Button>
              </>
            )}
          </div>
        }
      />

      {!wrapped.hasData ? (
        <EmptyState icon="calendar-03" title={`Nothing recorded for ${year}`} description="Once this year has income or spending in it, your review shows up here." />
      ) : (
        <>
          {/* Hero Story Banner Card */}
          <section className="relative overflow-hidden rounded-[var(--radius-2xl)] border border-primary/20 bg-gradient-to-br from-primary-soft via-surface-card to-surface-card p-6 md:p-8 shadow-sm">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 size-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="max-w-xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  <Icon name="sparkles" size={14} />
                  <span>Your {year} Recap is Ready</span>
                </div>
                <h2 className="type-figure-hero mt-3 text-ink">
                  {wrapped.saved >= 0 ? 'You kept ' : 'You spent '}
                  <Amount value={Math.abs(wrapped.saved)} currency={currency} countUp />
                  {wrapped.saved >= 0 ? '' : ' more than you earned'}
                </h2>
                <p className="type-body mt-2 text-muted">
                  {wrapped.savingsRate !== undefined && wrapped.saved >= 0 ? `That is ${percent(wrapped.savingsRate)} of your income, across ` : 'Across '}
                  {wrapped.transactionCount.toLocaleString()} transactions in {year}.
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs font-medium text-ink">
                  <span className="flex size-6 items-center justify-center rounded-full bg-inset text-base">
                    {archetype.badge}
                  </span>
                  <span>Archetype: <strong>{archetype.title}</strong></span>
                  <span className="text-muted">• {archetype.tagline}</span>
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
                <button
                  type="button"
                  onClick={openStory}
                  className="group relative flex items-center gap-3 overflow-hidden rounded-2xl bg-primary px-6 py-3.5 text-white font-semibold shadow-lg shadow-primary/25 transition-all duration-200 hover:scale-105 hover:shadow-primary/40 active:scale-95"
                >
                  <span className="flex size-8 items-center justify-center rounded-full bg-white/20 text-white transition-transform group-hover:scale-110">
                    <Icon name="play" size={16} />
                  </span>
                  <span>Play {year} Story</span>
                </button>
                <span className="text-xs text-muted">Interactive story mode with music & flair</span>
              </div>
            </div>
          </section>

          {/* Archetype Spotlight Card */}
          <section className="relative overflow-hidden rounded-[var(--radius-xl)] border border-line bg-inset/40 p-5 backdrop-blur-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-line bg-surface-card text-3xl shadow-sm">
                {archetype.badge}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="type-caption font-semibold uppercase tracking-wider text-primary">Your Money Personality</span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{archetype.tagline}</span>
                </div>
                <h3 className="type-body-strong text-ink text-base mt-0.5">{archetype.title}</h3>
                <p className="type-caption mt-1 text-muted leading-relaxed">{archetype.description}</p>
              </div>
            </div>
          </section>

          {/* Core Metrics Grid */}
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

          {/* Rank Lists (Merchants & Categories) */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <section className={CARD}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="type-card-title text-ink">Top merchants</h2>
                <span className="type-caption text-muted">Where it went</span>
              </div>
              <MerchantRankList rows={wrapped.topMerchants} />
            </section>
            <section className={CARD}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="type-card-title text-ink">Top categories</h2>
                <span className="type-caption text-muted">By total spend</span>
              </div>
              <CategoryRankList rows={wrapped.topCategories} categoryMap={categoryMap} />
            </section>
          </div>

          {/* Month by month */}
          <section className={CARD}>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="type-card-title text-ink">Month by month</h2>
              <span className="type-caption flex items-center gap-3 text-muted">
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-money-in" aria-hidden="true" />Income</span>
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-chart-2" aria-hidden="true" />Spending</span>
              </span>
            </div>
            <MonthBars months={wrapped.months} />
          </section>

          {/* Story Presentation Modal */}
          <WrappedStoryModal
            isOpen={isStoryOpen}
            onClose={() => setStoryOpen(false)}
            wrapped={wrapped}
            categoryMap={categoryMap}
            isPrivate={isPrivate}
          />
        </>
      )}
    </div>
  );
};

export default Wrapped;
