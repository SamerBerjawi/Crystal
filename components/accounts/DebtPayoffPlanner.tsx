import React, { useContext, useEffect, useMemo, useState } from 'react';
import { curveNatural } from '@visx/curve';
import type { Account, DebtPlanSettings, Transaction } from '../../types';
import { comparePlans, type PlanResult, type Strategy } from '../../utils/debtPlan';
import { debtsFromAccounts, type PlanDebt } from '../../utils/debtPlanInputs';
import { currencySign, formatCurrency, getMainCurrency } from '../../utils';
import { useScheduleContext } from '../../contexts/FinancialDataContext';
import { usePreferencesContext } from '../../contexts/DomainProviders';
import { ChartTooltip, Grid, Line, LineChart, XAxis, YAxis } from '../../src/components/charts';
import { useChartStable, useYScale } from '../../src/components/charts/chart-context';
import { SpotlightIndicator } from '../../src/components/charts/spotlight-indicator';
import { HorizonArea, clip, labelWidth } from '../ForecastHorizonChart';
import { AccountLogo } from '../AccountCard';
import { Button } from '../ui/Actions';
import { Badge } from '../ui/Display';
import { AmountInput, Slider, Switch, TextInput } from '../ui/Fields';
import Icon from '../ui/Icon';
import { Amount, PrivacyContext } from '../ui/Money';
import SegmentedControl from '../ui/SegmentedControl';
import { Banner, EmptyState } from '../ui/States';
import { cn } from '../../lib/utils';

const CARD = 'surface-card min-w-0 rounded-[var(--radius-xl)] p-5 border border-line';
const COLORS: Record<Strategy, string> = { minimums: 'var(--muted)', snowball: 'var(--amber)', avalanche: 'var(--primary)' };
const NAMES: Record<Strategy, string> = { minimums: 'Minimums only', snowball: 'Snowball', avalanche: 'Avalanche' };
const HOW: Record<Strategy, string> = {
  minimums: 'Each debt gets its own payment and nothing more.',
  snowball: 'Extra and freed minimums go to the smallest balance first. Quick wins.',
  avalanche: 'Extra and freed minimums go to the highest rate first. Least interest.',
};
const PRESET_EXTRAS = [50, 100, 250, 500];

const num = (text: string) => {
  const n = Number(text.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const monthName = (iso: string) => new Date(`${iso}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
const duration = (months: number) => {
  if (months === 0) return 'Today';
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y ? `${y} ${y === 1 ? 'year' : 'years'}` : '', m ? `${m} ${m === 1 ? 'month' : 'months'}` : ''].filter(Boolean).join(' ') || 'Under a month';
};

const LABEL_ROWS = 3;
const ROW_HEIGHT = 24;
const PLOT_HEIGHT = 260;
const CHART_MARGIN = { top: 16, right: 16, bottom: 28, left: 56 };

const compactTick = (value: number, currency: string) => {
  const sign = currencySign(currency);
  return Math.abs(value) >= 1000 ? `${sign}${Math.round(value / 100) / 10}k` : `${sign}${Math.round(value)}`;
};

const shortMonthYear = (date: Date) =>
  date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

interface DebtLayerProps {
  data: Record<string, unknown>[];
  activePlan: PlanResult;
  activeStrategy: Strategy;
  today: Date;
}

/**
 * Post-overlay drawn on top of the debt lines, matching ForecastHorizonChart's HorizonLayer:
 * zero baseline, Today marker + pill, non-overlapping milestone flags, and the Debt-free pill.
 */
const DebtHorizonLayer: React.FC<DebtLayerProps> = ({ data, activePlan, activeStrategy, today }) => {
  const { xScale, innerWidth, innerHeight } = useChartStable();
  const yScale = useYScale();

  const dateForMonth = (monthIndex: number) =>
    (data[Math.min(monthIndex, data.length - 1)]?.date as Date | undefined) ??
    new Date(today.getFullYear(), today.getMonth() + monthIndex, 1);

  const milestones = useMemo(() => {
    const ends: number[] = [];
    return activePlan.order
      .filter(step => step.month >= 0 && step.month < data.length)
      .map(step => {
        const date = dateForMonth(step.month);
        return { step, date, x: xScale(date) };
      })
      .sort((a, b) => a.x - b.x)
      .map(({ step, date, x }) => {
        const shortMonth = date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
        const full = `${clip(step.name, 16)}, ${shortMonth}`;
        const right = innerWidth - x - 6;
        const left = x - 6;
        const flip = labelWidth(full) > right && left > right;
        const text = clip(full, Math.max(6, Math.floor(((flip ? left : right) - 22) / 6.6)));
        const w = labelWidth(text);
        const start = Math.max(0, Math.min(flip ? x - 6 - w : x + 6, innerWidth - w));
        let row = ends.findIndex(end => start >= end + 6);
        if (row === -1) row = ends.length < LABEL_ROWS ? ends.length : -1;
        if (row >= 0) ends[row] = start + w;
        return { step, date, x, text, w, start, row };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlan.order, data, xScale, innerWidth]);

  const todayRow = data[0];
  const todayDate = todayRow?.date as Date | undefined;
  const todayX = todayDate ? xScale(todayDate) : undefined;
  const todayVal = todayRow ? Number(todayRow[activeStrategy]) : undefined;
  const todayFlip = todayX !== undefined && todayX + 6 + 52 > innerWidth;
  const zeroY = yScale(0);

  return (
    <g pointerEvents="none">
      {zeroY >= 0 && zeroY <= innerHeight && (
        <line x1={0} x2={innerWidth} y1={zeroY} y2={zeroY} stroke="var(--ink)" strokeOpacity={0.55} strokeWidth={1.5} />
      )}

      {milestones.map(({ step, date, x, text, w, start, row }) => (
        <g key={`${step.id}-${step.month}`}>
          <title>{`${step.name} cleared, ${shortMonthYear(date)}`}</title>
          <line x1={x} x2={x} y1={0} y2={innerHeight} stroke="var(--chart-4)" strokeWidth={1.5} strokeDasharray="5 4" />
          <path d={`M${x},0 l5,5 l-5,5 l-5,-5 z`} fill="var(--chart-4)" />
          {row >= 0 && (
            <g transform={`translate(${start},${8 + (row + 1) * ROW_HEIGHT})`}>
              <rect width={w} height={20} rx={10} fill="var(--solid)" stroke="var(--chart-4)" strokeWidth={1.5} />
              <path d="M10,5 v10 M10,5 h7 l-2,2.5 l2,2.5 h-7" fill="none" stroke="var(--chart-4)" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
              <text x={22} y={14} fontSize={11} fontWeight={700} fill="var(--ink)">{text}</text>
            </g>
          )}
        </g>
      ))}

      {todayX !== undefined && (
        <g aria-hidden="true">
          <line x1={todayX} x2={todayX} y1={0} y2={innerHeight} stroke="var(--ink)" strokeWidth={1.5} />
          {Number.isFinite(todayVal) && (
            <circle cx={todayX} cy={yScale(todayVal!)} r={5} fill="var(--ink)" stroke="var(--solid)" strokeWidth={2} />
          )}
          <g transform={`translate(${todayFlip ? todayX - 6 - 52 : todayX + 6},8)`}>
            <rect width={52} height={20} rx={10} fill="var(--pill)" />
            <text x={26} y={14} textAnchor="middle" fontSize={11} fontWeight={800} fill="var(--on-pill)">Today</text>
          </g>
        </g>
      )}

      {activePlan.months !== null && (() => {
        const payoffIdx = Math.min(activePlan.months, data.length - 1);
        const payoffRow = data[payoffIdx];
        if (!payoffRow) return null;
        const px = xScale(payoffRow.date as Date);
        const py = yScale(Number(payoffRow[activeStrategy]));
        const text = activePlan.months === 0
          ? 'Cleared today'
          : `Debt-free, ${dateForMonth(payoffIdx).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}`;
        const w = Math.max(88, labelWidth(text) - 6);
        const left = Math.max(0, Math.min(px - w / 2, innerWidth - w));
        const pillY = py < 36 ? py + 12 : py - 32;
        return (
          <g>
            <circle cx={px} cy={py} r={5} fill={COLORS[activeStrategy]} stroke="var(--solid)" strokeWidth={2} />
            <g transform={`translate(${left},${pillY})`}>
              <rect width={w} height={20} rx={10} fill="var(--pill)" />
              <text x={w / 2} y={14} textAnchor="middle" fontSize={11} fontWeight={800} fill="var(--on-pill)">{text}</text>
            </g>
          </g>
        );
      })()}
    </g>
  );
};
(DebtHorizonLayer as unknown as { __isPostOverlay: boolean }).__isPostOverlay = true;

/** Interactive Cash-Horizon-styled chart of remaining debt over time across payoff strategies. */
const BalanceChart: React.FC<{
  plans: PlanResult[];
  activeStrategy: Strategy;
  currency: string;
  today: Date;
  isPrivate: boolean;
  revealKey: string;
}> = ({ plans, activeStrategy, currency, today, isPrivate, revealKey }) => {
  const last = Math.max(1, ...plans.map(p => p.months ?? p.balances.length - 1));
  const activePlan = plans.find(p => p.strategy === activeStrategy) ?? plans[0];

  const data = useMemo(() => {
    const rows: Record<string, unknown>[] = [];
    for (let m = 0; m <= last; m += 1) {
      const row: Record<string, unknown> = {
        date: new Date(today.getFullYear(), today.getMonth() + m, 1),
        monthIndex: m,
      };
      plans.forEach(p => {
        row[p.strategy] = p.balances[Math.min(m, p.balances.length - 1)] ?? 0;
      });
      rows.push(row);
    }
    return rows;
  }, [last, plans, today]);

  const spanYears = last / 12;
  const formatTick = (value: Date | number) => {
    const date = value instanceof Date ? value : new Date(value);
    if (spanYears > 6) return String(date.getFullYear());
    if (spanYears > 1.25) return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
    return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  };

  const height = CHART_MARGIN.top + PLOT_HEIGHT + CHART_MARGIN.bottom;
  const summary = `Total owed over time. ${activePlan.payoff ? `${NAMES[activeStrategy]} clears everything in ${monthName(activePlan.payoff)}.` : ''}`;

  return (
    <div className="relative w-full select-none" style={{ height }} role="img" aria-label={summary}>
      <LineChart
        data={data}
        xDataKey="date"
        margin={CHART_MARGIN}
        animationDuration={1400}
        revealSignature={revealKey}
        style={{ height, width: '100%' }}
      >
        <Grid horizontal numTicksRows={3} />
        <SpotlightIndicator seriesKey={activeStrategy} color={COLORS[activeStrategy]} />
        <HorizonArea seriesKey={activeStrategy} color={COLORS[activeStrategy]} />
        {plans.map(plan => (
          <Line
            key={plan.strategy}
            dataKey={plan.strategy}
            label={NAMES[plan.strategy]}
            stroke={COLORS[plan.strategy]}
            strokeWidth={plan.strategy === activeStrategy ? 2.5 : 2}
            strokeDasharray={plan.strategy === 'minimums' ? '5,4' : undefined}
            curve={curveNatural}
            fadeEdges={false}
          />
        ))}
        <XAxis numTicks={5} tickFormatter={formatTick} />
        <YAxis numTicks={3} tickFormatter={v => (isPrivate ? '' : compactTick(v, currency))} />
        <DebtHorizonLayer
          data={data}
          activePlan={activePlan}
          activeStrategy={activeStrategy}
          today={today}
        />
        <ChartTooltip
          showCrosshair={false}
          rows={point =>
            plans.map(plan => ({
              color: COLORS[plan.strategy],
              label: NAMES[plan.strategy],
              value: isPrivate ? '••••' : formatCurrency(Number(point[plan.strategy]), currency),
            }))
          }
        />
      </LineChart>
    </div>
  );
};

/** Editable row for each debt, supporting rate/payment overrides and inclusion toggle. */
const DebtRow: React.FC<{
  debt: PlanDebt;
  account?: Account;
  currency: string;
  override?: { rate?: number; payment?: number };
  onOverride: (patch: { rate?: number; payment?: number }) => void;
  onResetOverride: () => void;
  onToggleExclude: (excluded: boolean) => void;
}> = ({ debt, account, currency, override, onOverride, onResetOverride, onToggleExclude }) => {
  const [editing, setEditing] = useState(debt.needsDetails);
  const [rateDraft, setRateDraft] = useState(String(override?.rate ?? (debt.rate ? Number(debt.rate.toFixed(2)) : '')));
  const [payDraft, setPayDraft] = useState(String(override?.payment ?? (debt.minimum ? Number(debt.minimum.toFixed(2)) : '')));

  useEffect(() => {
    setRateDraft(String(override?.rate ?? (debt.rate ? Number(debt.rate.toFixed(2)) : '')));
    setPayDraft(String(override?.payment ?? (debt.minimum ? Number(debt.minimum.toFixed(2)) : '')));
    if (debt.needsDetails) setEditing(true);
  }, [override?.rate, override?.payment, debt.rate, debt.minimum, debt.needsDetails]);

  const commit = () => {
    const r = Number(rateDraft.replace(',', '.'));
    const p = Number(payDraft.replace(',', '.'));
    onOverride({
      rate: Number.isFinite(r) && r >= 0 ? r : undefined,
      payment: Number.isFinite(p) && p > 0 ? p : undefined,
    });
  };

  return (
    <li className={cn('py-3.5 transition-opacity', debt.excluded && 'opacity-55')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {account ? (
            <AccountLogo account={account} size={36} />
          ) : (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-inset text-muted">
              <Icon name="credit-card" size={18} />
            </span>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="type-body-strong truncate text-ink">{debt.name}</span>
              <Badge tone="neutral">{debt.type}</Badge>
              {debt.needsDetails && !debt.excluded && <Badge tone="attention">Needs payment</Badge>}
              {debt.hasOverride && <Badge tone="blue">Custom terms</Badge>}
            </div>
            <p className="type-caption mt-0.5 text-muted">
              <Amount value={debt.balance} currency={currency} className="type-caption font-semibold text-ink" /> owed
              {' · '}{debt.rate.toFixed(1)}% APR
              {' · '}{debt.minimum > 0 ? <><Amount value={debt.minimum} currency={currency} className="type-caption" />/mo</> : 'no payment set'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Switch isSelected={!debt.excluded} onChange={included => onToggleExclude(!included)}>
            Include
          </Switch>
          <Button variant="ghost" size="sm" onPress={() => setEditing(v => !v)}>
            {editing ? 'Done' : 'Edit'}
          </Button>
        </div>
      </div>

      {editing && (
        <div className="mt-3 grid grid-cols-1 items-end gap-3 rounded-[var(--radius-lg)] border border-line bg-inset/40 p-3 sm:grid-cols-[10rem_12rem_auto]">
          <TextInput
            label="APR (%)"
            inputMode="decimal"
            value={rateDraft}
            placeholder="0"
            onChange={setRateDraft}
            onBlur={commit}
          />
          <AmountInput
            label="Monthly payment"
            currency={currency}
            value={payDraft}
            onChange={setPayDraft}
            onBlur={commit}
          />
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onPress={() => { commit(); if (!debt.needsDetails) setEditing(false); }}>
              Apply
            </Button>
            {debt.hasOverride && (
              <Button size="sm" variant="ghost" onPress={onResetOverride}>
                Reset
              </Button>
            )}
          </div>
        </div>
      )}
    </li>
  );
};

/** Pay your debts off with one budget: the order, the date, and the interest, for three ways of splitting the money. */
const DebtPayoffPlanner: React.FC<{ accounts: Account[]; transactions: Transaction[] }> = ({ accounts, transactions }) => {
  const isPrivate = useContext(PrivacyContext);
  const { loanPaymentOverrides } = useScheduleContext();
  const { preferences, setPreferences } = usePreferencesContext();
  const settings: DebtPlanSettings = preferences.debtPlan ?? {};
  const currency = getMainCurrency();
  const today = useMemo(() => new Date(), []);

  const [extraText, setExtraText] = useState(settings.extra ? String(settings.extra) : '');
  const [lumpText, setLumpText] = useState(settings.lumpSum ? String(settings.lumpSum) : '');
  const [chartView, setChartView] = useState<'chart' | 'table'>('chart');

  const extra = num(extraText);
  const lumpSum = num(lumpText);

  const save = (next: DebtPlanSettings) => setPreferences(prev => ({ ...prev, debtPlan: next }));

  useEffect(() => {
    if (extra === (settings.extra ?? 0) && lumpSum === (settings.lumpSum ?? 0)) return;
    const timer = setTimeout(
      () => save({ ...settings, extra: extra || undefined, lumpSum: lumpSum || undefined }),
      450,
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extra, lumpSum]);

  const debts = useMemo(
    () => debtsFromAccounts({ accounts, transactions, loanPaymentOverrides, settings, conversionRates: preferences.conversionRates }),
    [accounts, transactions, loanPaymentOverrides, settings, preferences.conversionRates],
  );
  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);
  const planned = debts.filter(d => !d.needsDetails && !d.excluded);
  const comparison = useMemo(() => comparePlans(planned, extra, today, lumpSum), [planned, extra, today, lumpSum]);
  const strategies: Strategy[] = ['minimums', 'snowball', 'avalanche'];

  // Table checkpoints (every 6 months + final month)
  const tableRows = useMemo(() => {
    const maxLen = Math.max(...strategies.map(s => comparison[s].balances.length));
    const indices: number[] = [];
    for (let m = 0; m < maxLen; m += 6) indices.push(m);
    if (maxLen > 1 && indices[indices.length - 1] !== maxLen - 1) indices.push(maxLen - 1);
    return indices.map(m => ({
      month: m,
      label: m === 0 ? 'Today' : new Date(today.getFullYear(), today.getMonth() + m, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
      minimums: comparison.minimums.balances[Math.min(m, comparison.minimums.balances.length - 1)] ?? 0,
      snowball: comparison.snowball.balances[Math.min(m, comparison.snowball.balances.length - 1)] ?? 0,
      avalanche: comparison.avalanche.balances[Math.min(m, comparison.avalanche.balances.length - 1)] ?? 0,
    }));
  }, [comparison, today]);

  if (debts.length === 0) {
    return (
      <EmptyState
        icon="target-02"
        title="No debts to plan"
        description="Add a loan, credit card with a balance, or liability under Accounts, and Crystal will work out the quickest way to clear it."
      />
    );
  }

  const setOverride = (id: string, patch: { rate?: number; payment?: number }) =>
    save({ ...settings, overrides: { ...settings.overrides, [id]: { ...settings.overrides?.[id], ...patch } } });

  const resetOverride = (id: string) => {
    const nextOverrides = { ...(settings.overrides ?? {}) };
    delete nextOverrides[id];
    save({ ...settings, overrides: Object.keys(nextOverrides).length ? nextOverrides : undefined });
  };

  const toggleExclude = (id: string, exclude: boolean) => {
    const set = new Set(settings.excludedIds ?? []);
    if (exclude) set.add(id);
    else set.delete(id);
    const list = [...set];
    save({ ...settings, excludedIds: list.length ? list : undefined });
  };

  const totalOwed = planned.reduce((sum, d) => sum + d.balance, 0);
  const totalPayments = planned.reduce((sum, d) => sum + d.minimum, 0);
  const activeStrategy: Strategy = settings.strategy ?? comparison.cheapest;
  const activePlan = comparison[activeStrategy];
  const sliderMax = Math.max(2000, Math.ceil((totalPayments + 500) / 500) * 500, Math.ceil((extra + 500) / 500) * 500);

  const bestSaved = Math.max(comparison.saved.avalanche, comparison.saved.snowball);
  const bestMonthsSaved =
    comparison.minimums.months !== null && comparison[comparison.cheapest].months !== null
      ? comparison.minimums.months - comparison[comparison.cheapest].months!
      : 0;

  return (
    <div className="space-y-6">
      {comparison.minimums.stuck.length > 0 && (
        <Banner tone="attention">
          {planned.filter(d => comparison.minimums.stuck.includes(d.id)).map(d => d.name).join(', ')}{' '}
          {comparison.minimums.stuck.length === 1 ? 'is' : 'are'} paid less each month than the interest it adds, so on minimums alone{' '}
          {comparison.minimums.stuck.length === 1 ? 'it never clears' : 'they never clear'}.
        </Banner>
      )}

      {/* KPI Strip */}
      {planned.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className={CARD}>
            <span className="type-label text-muted">Total debt in plan</span>
            <p className="type-figure-lg mt-1 text-ink"><Amount value={totalOwed} currency={currency} /></p>
            <p className="type-caption mt-1 text-muted">{planned.length} active {planned.length === 1 ? 'debt' : 'debts'}</p>
          </div>
          <div className={CARD}>
            <span className="type-label text-muted">Monthly budget</span>
            <p className="type-figure-lg mt-1 text-ink"><Amount value={totalPayments + extra} currency={currency} /></p>
            <p className="type-caption mt-1 text-muted">
              <Amount value={totalPayments} currency={currency} className="type-caption" /> min
              {extra > 0 && <> + <Amount value={extra} currency={currency} className="type-caption" /> extra</>}
            </p>
          </div>
          <div className={CARD}>
            <span className="type-label text-muted">Debt-free ({NAMES[activeStrategy]})</span>
            <p className="type-figure-lg mt-1 text-ink">{activePlan.payoff ? monthName(activePlan.payoff) : 'Never'}</p>
            <p className="type-caption mt-1 text-muted">
              {activePlan.months === null ? 'Payments below monthly interest' : duration(activePlan.months)}
            </p>
          </div>
          <div className={CARD}>
            <span className="type-label text-muted">Interest saved vs. minimums</span>
            <p className="type-figure-lg mt-1 text-money-in">
              <Amount value={activeStrategy === 'minimums' ? bestSaved : comparison.saved[activeStrategy]} currency={currency} />
            </p>
            <p className="type-caption mt-1 text-muted">
              {bestMonthsSaved > 0 ? `${bestMonthsSaved} months faster at best` : 'Rollover speeds payoff automatically'}
            </p>
          </div>
        </div>
      )}

      {/* Simulator Controls */}
      <section className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="type-card-title text-ink">Accelerate your payoff</h2>
            <p className="type-caption text-muted">Test how extra monthly payments or a one-time lump sum change your debt-free date.</p>
          </div>
          {(extra > 0 || lumpSum > 0) && (
            <Button variant="ghost" size="sm" onPress={() => { setExtraText(''); setLumpText(''); }}>
              Reset extras
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
              <Slider
                label="Extra each month"
                minValue={0}
                maxValue={sliderMax}
                step={25}
                value={Math.min(sliderMax, extra)}
                onChange={v => setExtraText(v > 0 ? String(v) : '')}
                formatOptions={{ style: 'currency', currency, maximumFractionDigits: 0 }}
              />
              <AmountInput
                label="Exact monthly extra"
                currency={currency}
                value={extraText}
                onChange={setExtraText}
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="type-caption mr-1 text-muted">Quick add:</span>
              {PRESET_EXTRAS.map(amt => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setExtraText(String(extra + amt))}
                  className="cursor-pointer rounded-full border border-line bg-inset px-2.5 py-1 text-xs font-semibold text-ink transition-colors hover:border-primary hover:bg-primary-soft"
                >
                  +{formatCurrency(amt, currency, { compact: true })}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col justify-between gap-3 rounded-[var(--radius-lg)] border border-line bg-inset/40 p-4">
            <AmountInput
              label="One-time lump sum today"
              currency={currency}
              value={lumpText}
              onChange={setLumpText}
              help="Applied immediately to your top-priority debt."
            />
            {planned.length > 0 && (extra > 0 || lumpSum > 0) && bestMonthsSaved > 0 && (
              <p className="type-caption text-ink">
                Clears everything <span className="font-bold text-primary">{bestMonthsSaved} months sooner</span> and saves{' '}
                <Amount value={bestSaved} currency={currency} className="type-caption font-bold text-money-in" /> in interest.
              </p>
            )}
          </div>
        </div>
      </section>

      {planned.length > 0 && (
        <>
          {/* 3 Strategy Cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {strategies.map(strategy => {
              const plan = comparison[strategy];
              const isCheapest = strategy === comparison.cheapest && bestSaved > 0.5;
              const isSelected = activeStrategy === strategy;
              const monthsDiff =
                strategy !== 'minimums' && plan.months !== null && comparison.minimums.months !== null
                  ? comparison.minimums.months - plan.months
                  : 0;
              return (
                <button
                  key={strategy}
                  type="button"
                  onClick={() => save({ ...settings, strategy })}
                  aria-pressed={isSelected}
                  className={cn(
                    CARD,
                    'cursor-pointer text-left transition-all',
                    isSelected ? 'ring-2 ring-primary border-primary' : 'hover:border-line-strong',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="type-label flex items-center gap-2 text-muted">
                      <span className="inline-block h-1.5 w-4 rounded-full" style={{ background: COLORS[strategy] }} />
                      {NAMES[strategy]}
                    </h2>
                    {isCheapest && <Badge tone="positive">Least interest</Badge>}
                  </div>
                  <p className="type-figure-lg mt-2 text-ink">{plan.payoff ? monthName(plan.payoff) : 'Never'}</p>
                  <p className="type-caption text-muted">
                    {plan.months === null ? 'The payments do not keep up with the interest.' : `Debt-free in ${duration(plan.months)}.`}
                  </p>
                  <p className="type-body mt-3 text-ink">
                    Interest <Amount value={plan.interest} currency={currency} className="type-body-strong" />
                  </p>
                  {strategy !== 'minimums' && (
                    <p className="type-caption mt-1 text-muted">
                      {comparison.saved[strategy] > 0.5 || monthsDiff > 0 ? (
                        <>
                          Saves <Amount value={comparison.saved[strategy]} currency={currency} className="type-caption font-semibold text-money-in" />
                          {monthsDiff > 0 ? ` and ${monthsDiff} months` : ''} vs. minimums.
                        </>
                      ) : (
                        'Same as minimums only.'
                      )}
                    </p>
                  )}
                  <p className="type-caption mt-3 text-muted">{HOW[strategy]}</p>
                </button>
              );
            })}
          </div>

          {/* Trajectory Chart & Table */}
          <section className={CARD} aria-label="Total owed over time">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="type-card-title text-ink">What you owe, month by month</h2>
                <p className="type-caption text-muted">Move over the chart to compare remaining balances across strategies.</p>
              </div>
              <SegmentedControl
                items={[{ id: 'chart', label: 'Chart' }, { id: 'table', label: 'Table' }]}
                activeId={chartView}
                onChange={id => setChartView(id as 'chart' | 'table')}
              />
            </div>

            {chartView === 'chart' ? (
              <>
                <BalanceChart
                  plans={strategies.map(s => comparison[s])}
                  activeStrategy={activeStrategy}
                  currency={currency}
                  today={today}
                  isPrivate={isPrivate}
                  revealKey={`${activeStrategy}-${extra}-${lumpSum}-${planned.map(d => d.id).join()}`}
                />
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {strategies.map(s => (
                    <li key={s} className="type-caption flex items-center gap-1.5 text-muted">
                      <span
                        aria-hidden="true"
                        className={cn('h-0.5 w-3 rounded-full', s === 'minimums' && 'h-0 bg-transparent border-t-2 border-dashed')}
                        style={s === 'minimums' ? { borderColor: COLORS[s] } : { backgroundColor: COLORS[s] }}
                      />
                      {NAMES[s]}
                    </li>
                  ))}
                  <li className="type-caption flex items-center gap-1.5 text-muted">
                    <span aria-hidden="true" className="h-3 w-0 border-l-2 border-solid border-ink" />
                    Today
                  </li>
                  {activePlan.order.length > 0 && (
                    <li className="type-caption flex items-center gap-1.5 text-muted">
                      <span aria-hidden="true" className="h-3 w-0 border-l-2 border-dashed border-[var(--chart-4)]" />
                      Debt cleared
                    </li>
                  )}
                </ul>
              </>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-line type-label text-muted">
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 px-3 text-right">Minimums</th>
                      <th className="py-2 px-3 text-right">Snowball</th>
                      <th className="py-2 pl-3 text-right">Avalanche</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {tableRows.map(row => (
                      <tr key={row.month} className="type-body">
                        <td className="py-2 pr-3 text-ink">{row.label}</td>
                        <td className="py-2 px-3 text-right text-muted"><Amount value={row.minimums} currency={currency} /></td>
                        <td className="py-2 px-3 text-right text-ink"><Amount value={row.snowball} currency={currency} /></td>
                        <td className="py-2 pl-3 text-right font-semibold text-ink"><Amount value={row.avalanche} currency={currency} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Payoff Order Roadmap (Always visible when planned.length > 0) */}
          {activePlan.order.length > 0 && (
            <section className={CARD} aria-label="Payoff roadmap">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 className="type-card-title text-ink">The order to clear them ({NAMES[activeStrategy]})</h2>
                  <p className="type-caption text-muted">
                    {activeStrategy === comparison.cheapest && Math.abs(comparison.avalanche.interest - comparison.snowball.interest) > 0.5
                      ? 'The plan with the least total interest.'
                      : activeStrategy === 'minimums'
                        ? 'Order each debt clears when paying minimums separately.'
                        : HOW[activeStrategy]}
                  </p>
                </div>
                <Badge tone="neutral">{activePlan.order.length} cleared</Badge>
              </div>

              <ol className="divide-y divide-line">
                {activePlan.order.map((step, index) => {
                  const debt = planned.find(d => d.id === step.id);
                  const acc = accountMap.get(step.id);
                  return (
                    <li key={step.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                          {index + 1}
                        </span>
                        {acc && <AccountLogo account={acc} size={28} />}
                        <div className="min-w-0">
                          <p className="type-body-strong truncate text-ink">{step.name}</p>
                          {debt && (
                            <p className="type-caption text-muted">
                              <Amount value={debt.balance} currency={currency} className="type-caption" /> at {debt.rate.toFixed(1)}% APR
                              {step.interestPaid !== undefined && <> · <Amount value={step.interestPaid} currency={currency} className="type-caption" /> interest</>}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge tone="positive">
                          {step.month === 0 ? 'Cleared today' : `Cleared ${new Date(today.getFullYear(), today.getMonth() + step.month, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`}
                        </Badge>
                        {step.month > 0 && (
                          <p className="type-caption mt-0.5 text-muted">{duration(step.month)}</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}
        </>
      )}

      {/* Your Debts & Overrides */}
      <section className={CARD} aria-label="Your debts">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="type-card-title text-ink">Your debts</h2>
            <p className="type-caption text-muted">Include or exclude cards and override rates or payments without changing your accounts.</p>
          </div>
          <span className="type-caption text-muted">{planned.length} of {debts.length} active</span>
        </div>
        <ul className="divide-y divide-line">
          {debts.map(d => (
            <DebtRow
              key={d.id}
              debt={d}
              account={accountMap.get(d.id)}
              currency={currency}
              override={settings.overrides?.[d.id]}
              onOverride={patch => setOverride(d.id, patch)}
              onResetOverride={() => resetOverride(d.id)}
              onToggleExclude={ex => toggleExclude(d.id, ex)}
            />
          ))}
        </ul>
        <p className="type-caption mt-4 text-muted">
          Loans use the rate and payment from their schedule unless overridden. Credit cards are included when carrying a balance; toggle off any card you pay in full each month. Amounts are in {currency} at today&apos;s exchange rates.
        </p>
      </section>
    </div>
  );
};

export default DebtPayoffPlanner;
