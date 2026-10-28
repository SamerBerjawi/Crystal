import React, { useMemo, useState } from 'react';
import { cn } from '../../../../lib/utils';
import type { Account, Currency } from '../../../../types';
import type { AccountDetailData } from '../../../../hooks/useAccountDetailData';
import {
  ChartTooltip,
  Grid,
  Scatter,
  ScatterChart,
  TooltipContent,
  XAxis,
  YAxis,
} from '../../../bklit/charts';
import { useMediaQuery } from '../../Drawer';
import { NvIcon } from '../../NvIcon';
import { Badge, Card, EmptyState, Money } from '../../ui';

/*
 * Archetype 1: Operating & Cash Account View (`Checking`, `Other Assets (Cash)`, `Other Assets`, `Other Liabilities`).
 * Displays:
 * - 6-Month Inflow vs Outflow BKlit Scatter Chart with Jitter (each dot represents a transaction amount)
 * - Top 90-Day Spending Categories Breakdown
 * - 14-Day Scheduled Obligations & Safe-to-Spend Buffer
 * - Physical Cash Burn & Runway (when `account.otherSubType === 'Cash'`)
 */

const series = {
  inflow: { label: 'Inflow', color: 'var(--nv-green)' },
  outflow: { label: 'Outflow', color: 'var(--nv-orange)' },
} as const;

const shortMonthFmt = new Intl.DateTimeFormat('en-US', { month: 'short' });
const monthYearFmt = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const formatMonth = (date: Date) => shortMonthFmt.format(date);
const formatAmount = (value: number) => {
  const abs = Math.abs(value);
  const formatted = abs >= 1000 ? `${Math.round(abs / 1000)}k` : String(Math.round(abs));
  return value < 0 ? `-${formatted}` : formatted;
};

function TxScatterTooltip({
  point,
  currency,
}: {
  point: Record<string, unknown>;
  currency: Currency;
}) {
  const rows: Array<{ color: string; label: string; value: React.ReactNode }> = (
    ['inflow', 'outflow'] as const
  ).flatMap((key) => {
    const value = point[key];
    return typeof value === 'number'
      ? [
          {
            color: series[key].color,
            label: (point.description as string) || series[key].label,
            value: (
              <span className="nv-tabular font-medium">
                {key === 'inflow' ? '+' : '-'}
                <Money amount={value} currency={currency} />
              </span>
            ),
          },
        ]
      : [];
  });

  const title = point.txDate
    ? `${point.txDate} · ${point.description || (point.inflow !== undefined ? 'Inflow' : 'Outflow')}`
    : point.date instanceof Date
      ? monthYearFmt.format(point.date)
      : 'Transaction';

  return <TooltipContent rows={rows} title={title} />;
}

export const OperatingAccountArchetype: React.FC<{
  data: AccountDetailData;
  onNavigateToAccount?: (account: Account) => void;
}> = ({ data, onNavigateToAccount }) => {
  const { account, operatingMetrics, cashMetrics, normalizedTransactions } = data;
  if (!account || !operatingMetrics) return null;

  const isPhysicalCash =
    account.type === 'Other Assets' && account.otherSubType === 'Cash';
  const isDesktop = useMediaQuery('(min-width: 640px)');

  const monthDates = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const dates: Date[] = [];
    for (let i = 5; i >= 0; i--) {
      dates.push(new Date(currentYear, currentMonth - i, 1));
    }
    return dates;
  }, []);

  const chartData = useMemo(() => {
    const points: Array<{
      date: Date;
      inflow?: number;
      outflow?: number;
      description?: string;
      txDate?: string;
    }> = [];

    // Anchor points so all 6 months exist on the X-axis
    for (const d of monthDates) {
      points.push({ date: d });
    }

    const sixMonthsAgo = monthDates[0];
    const endOfThisMonth = new Date(
      monthDates[5].getFullYear(),
      monthDates[5].getMonth() + 1,
      0,
      23,
      59,
      59
    );

    if (normalizedTransactions && normalizedTransactions.length > 0) {
      for (const item of normalizedTransactions) {
        const pDate = item.parsedDate;
        if (pDate >= sixMonthsAgo && pDate <= endOfThisMonth) {
          const monthBucket = new Date(pDate.getFullYear(), pDate.getMonth(), 1);
          const amount = Math.abs(item.amountInAccountCurrency);
          if (amount > 0) {
            if (item.amountInAccountCurrency >= 0) {
              points.push({
                date: monthBucket,
                inflow: Math.round(amount * 100) / 100,
                description: item.tx.description || item.tx.merchant || 'Inflow',
                txDate: item.dateStr,
              });
            } else {
              points.push({
                date: monthBucket,
                outflow: Math.round(amount * 100) / 100,
                description: item.tx.description || item.tx.merchant || 'Outflow',
                txDate: item.dateStr,
              });
            }
          }
        }
      }
    }

    points.sort((a, b) => a.date.getTime() - b.date.getTime());
    return points;
  }, [monthDates, normalizedTransactions]);

  const hasTxPoints = chartData.some(
    (p) => p.inflow !== undefined || p.outflow !== undefined
  );

  // Automatically determine if transaction variance is high enough to warrant a log scale
  const scaleAnalysis = useMemo(() => {
    const positiveAmounts: number[] = [];
    for (const p of chartData) {
      if (typeof p.inflow === 'number' && p.inflow > 0) positiveAmounts.push(p.inflow);
      if (typeof p.outflow === 'number' && p.outflow > 0) positiveAmounts.push(p.outflow);
    }

    if (positiveAmounts.length < 3) {
      return { isHighVariance: false, ratio: 1, cv: 0, min: 0, max: 0 };
    }

    const min = Math.min(...positiveAmounts);
    const max = Math.max(...positiveAmounts);
    const ratio = min > 0 ? max / min : 1;

    const mean = positiveAmounts.reduce((acc, v) => acc + v, 0) / positiveAmounts.length;
    const variance =
      positiveAmounts.reduce((acc, v) => acc + (v - mean) ** 2, 0) / positiveAmounts.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean > 0 ? stdDev / mean : 0;

    // High variance criteria:
    // 1. Extreme ratio: max is >= 25x the min (e.g. €4 vs €100+) and max >= 100
    // OR
    // 2. High dispersion: CV >= 1.35 and max >= 15x min and max >= 100
    const isHighVariance = (ratio >= 25 || (cv >= 1.35 && ratio >= 15)) && max >= 100;

    return { isHighVariance, ratio, cv, min, max };
  }, [chartData]);

  const [userScaleMode, setUserScaleMode] = useState<'auto' | 'linear' | 'log'>('auto');

  const activeScaleType =
    userScaleMode === 'auto'
      ? scaleAnalysis.isHighVariance
        ? 'symlog'
        : 'linear'
      : userScaleMode === 'log'
        ? 'symlog'
        : 'linear';

  return (
    <div className="space-y-5">
      {/* Physical Cash Burn & Runway Banner (Cash Sub-type) */}
      {isPhysicalCash && cashMetrics && (
        <Card className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="flex flex-col justify-between rounded-nv-sub bg-nv-surface p-4 h-full">
            <p className="text-xs text-nv-muted">30-Day Cash Outflow</p>
            <div className="mt-1">
              <Money
                amount={cashMetrics.rolling30dOutflow}
                currency={account.currency}
                size="lg"
              />
            </div>
          </div>
          <div className="flex flex-col justify-between rounded-nv-sub bg-nv-surface p-4 h-full">
            <p className="text-xs text-nv-muted">Avg Daily Cash Burn</p>
            <div className="mt-1">
              <Money
                amount={cashMetrics.avgDailySpend}
                currency={account.currency}
                size="lg"
              />
            </div>
          </div>
          <div className="flex flex-col justify-between rounded-nv-sub bg-nv-surface p-4 h-full">
            <p className="text-xs text-nv-muted">Estimated Cash Runway</p>
            <p className="nv-tabular mt-1 text-xl font-semibold text-nv-ink">
              {cashMetrics.runwayDays !== null ? `${cashMetrics.runwayDays} days` : 'Unlimited'}
            </p>
          </div>
          <div className="flex flex-col justify-between rounded-nv-sub bg-nv-surface p-4 h-full">
            <p className="text-xs text-nv-muted">Reserve Status</p>
            <p className="mt-1 text-sm font-semibold text-nv-violet-text">
              {cashMetrics.burnRateMessage}
            </p>
          </div>
        </Card>
      )}

      {/* Main 2-Column Operating Analytics Grid */}
      <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
        {/* Left 7 Cols: 6-Month Inflow vs Outflow Scatter Chart */}
        <Card className="flex flex-col h-full space-y-4 lg:col-span-7">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-nv-ink">
                6-Month Inflow vs. Outflow
              </h2>
              <p className="text-xs text-nv-muted">
                Transaction distribution & cashflow velocity in {account.currency}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-nv-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-nv-green" />
                Inflow
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-nv-orange" />
                Outflow
              </span>
              <button
                type="button"
                onClick={() => {
                  setUserScaleMode((curr) => {
                    if (curr === 'auto') return scaleAnalysis.isHighVariance ? 'linear' : 'log';
                    return curr === 'linear' ? 'log' : 'auto';
                  });
                }}
                className="flex items-center gap-1 rounded-full border border-nv-line bg-nv-base px-2 py-0.5 text-[10px] font-medium text-nv-muted transition hover:border-nv-ink/30 hover:text-nv-ink focus:outline-none"
                title={`Y-Axis Scale: ${activeScaleType === 'symlog' ? 'Logarithmic' : 'Linear'} (${userScaleMode === 'auto' ? 'Auto-detected' : 'Manual'}). Click to toggle.`}
              >
                <span>{activeScaleType === 'symlog' ? 'Log' : 'Linear'}</span>
                {userScaleMode === 'auto' && (
                  <span className="text-[9px] text-nv-muted/70">(auto)</span>
                )}
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-between rounded-nv-sub bg-nv-surface p-3 sm:p-4">
            {hasTxPoints ? (
              <ScatterChart
                data={chartData}
                formatXLabel={formatMonth}
                jitter={{ x: 0.6 }}
                scaleType={activeScaleType}
                margin={{
                  top: 8,
                  right: 8,
                  bottom: 12,
                  left: isDesktop ? 48 : 36,
                }}
                aspectRatio={isDesktop ? '2.2 / 1' : '1.55 / 1'}
              >
                <Grid horizontal />
                <Scatter
                  dataKey="inflow"
                  fill={series.inflow.color}
                  radius={isDesktop ? 3.5 : 2.75}
                />
                <Scatter
                  dataKey="outflow"
                  fill={series.outflow.color}
                  radius={isDesktop ? 3.5 : 2.75}
                />
                <YAxis formatValue={formatAmount} />
                <ChartTooltip
                  content={({ point }) => (
                    <TxScatterTooltip point={point} currency={account.currency} />
                  )}
                />
              </ScatterChart>
            ) : (
              <div className="flex h-52 items-center justify-center">
                <EmptyState
                  icon="transactions"
                  title="No transaction activity"
                  body="Recent transactions will appear here as scatter distribution points."
                />
              </div>
            )}

            {/* Unified X-Axis: Month & Net Flow */}
            <div
              className="mt-2 grid grid-cols-6 border-t border-nv-line pt-2.5 text-center"
              style={{
                paddingLeft: isDesktop ? 48 : 36,
                paddingRight: 8,
              }}
            >
              {operatingMetrics.inflowOutflow6m.map((m) => {
                const roundedNet = Math.round(m.net);
                const isNegative = roundedNet < 0;
                return (
                  <div
                    key={m.name}
                    className="flex flex-col items-center justify-center px-0.5 min-w-0"
                  >
                    <span className="text-[10px] sm:text-[11px] font-medium text-nv-muted truncate">
                      {m.name}
                    </span>
                    <span className="truncate">
                      <Money
                        amount={roundedNet}
                        currency={account.currency}
                        signed
                        compact
                        tone={isNegative ? 'expense' : 'income'}
                        className="text-[10px] sm:text-[11px] font-semibold"
                      />
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Right 5 Cols: Top 90-Day Spending Categories */}
        <Card className="flex flex-col h-full space-y-4 lg:col-span-5">
          <div>
            <h2 className="text-lg font-semibold text-nv-ink">Top Outflow Categories (90d)</h2>
            <p className="text-xs text-nv-muted">
              Non-transfer spending distribution over the past 90 days
            </p>
          </div>

          {operatingMetrics.topCategories90d.length === 0 ? (
            <div className="flex-1 flex items-center justify-center rounded-nv-sub bg-nv-surface p-4">
              <EmptyState
                icon="budget"
                title="No categorized outflows"
                body="Expenses over the last 90 days will appear here by category."
              />
            </div>
          ) : (
            <div className="flex-1 space-y-2.5 rounded-nv-sub bg-nv-surface p-4 flex flex-col justify-between">
              {operatingMetrics.topCategories90d.map((item) => (
                <div key={item.category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-nv-ink">{item.category}</span>
                    <div className="flex items-center gap-2">
                      <span className="nv-tabular text-nv-muted">{item.pct}%</span>
                      <Money amount={item.amount} currency={account.currency} />
                    </div>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-nv-inset">
                    <div
                      className="h-full rounded-full bg-nv-violet"
                      style={{ width: `${Math.max(4, item.pct)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Bottom Row: Upcoming 14-Day Scheduled Bills & Linked Cards / Goals */}
      {(operatingMetrics.upcomingPayments.length > 0 ||
        operatingMetrics.linkedCreditCards.length > 0 ||
        operatingMetrics.linkedGoals.length > 0) && (
        <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-2">
          {/* Upcoming 14-Day Scheduled Outflows */}
          <Card className="flex flex-col h-full space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-nv-ink">
                  Upcoming 14-Day Obligations
                </h3>
                <p className="text-xs text-nv-muted">
                  Scheduled bills, loan installments & card settlements reserved in Safe-to-Spend
                </p>
              </div>
              <Badge tone="violet">
                {operatingMetrics.upcomingPayments.length} scheduled
              </Badge>
            </div>

            {operatingMetrics.upcomingPayments.length === 0 ? (
              <div className="flex-1 flex items-center justify-center rounded-nv-sub bg-nv-surface p-4">
                <p className="text-xs text-nv-muted">
                  No scheduled outflows due in the next 14 days.
                </p>
              </div>
            ) : (
              <div className="flex-1 divide-y divide-nv-line rounded-nv-sub bg-nv-surface px-4">
                {operatingMetrics.upcomingPayments.map((pmt, idx) => (
                  <div
                    key={`${pmt.date}-${idx}`}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-nv-ink">{pmt.description}</p>
                      <p className="text-xs text-nv-muted">Due {pmt.date}</p>
                    </div>
                    <Money amount={-pmt.amount} currency={account.currency} />
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Linked Credit Cards & Savings Goals */}
          <Card className="flex flex-col h-full space-y-3">
            <div>
              <h3 className="text-base font-semibold text-nv-ink">
                Connected Settlement Cards & Goals
              </h3>
              <p className="text-xs text-nv-muted">
                Credit cards and savings goals funded by {account.name}
              </p>
            </div>

            <div className="flex-1 space-y-2 flex flex-col justify-start">
              {operatingMetrics.linkedCreditCards.map((cc) => (
                <button
                  key={cc.id}
                  type="button"
                  onClick={() => onNavigateToAccount?.(cc)}
                  className="flex w-full items-center justify-between rounded-nv-sub bg-nv-surface px-4 py-3 text-left transition-colors hover:bg-nv-inset"
                >
                  <div className="flex items-center gap-2.5">
                    <NvIcon name="card" size={18} className="text-nv-violet-text" />
                    <div>
                      <p className="text-sm font-medium text-nv-ink">{cc.name}</p>
                      <p className="text-xs text-nv-muted">Auto-debit settlement card</p>
                    </div>
                  </div>
                  <Money amount={cc.balance} currency={cc.currency} />
                </button>
              ))}

              {operatingMetrics.linkedGoals.map((goal) => (
                <div
                  key={goal.id}
                  className="flex items-center justify-between rounded-nv-sub bg-nv-surface px-4 py-3"
                >
                  <div className="flex items-center gap-2.5">
                    <NvIcon name="piggy" size={18} className="text-nv-green-text" />
                    <div>
                      <p className="text-sm font-medium text-nv-ink">{goal.name}</p>
                      <p className="text-xs text-nv-muted">Funded savings goal</p>
                    </div>
                  </div>
                  <Money amount={goal.currentAmount} currency={account.currency} />
                </div>
              ))}

              {operatingMetrics.linkedCreditCards.length === 0 &&
                operatingMetrics.linkedGoals.length === 0 && (
                  <div className="flex-1 flex items-center justify-center rounded-nv-sub bg-nv-surface p-4">
                    <p className="text-xs text-nv-muted">
                      No credit cards or savings goals are linked to this account yet.
                    </p>
                  </div>
                )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
