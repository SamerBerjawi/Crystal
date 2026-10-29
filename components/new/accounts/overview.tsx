import React, { useMemo } from 'react';
import { cn } from '../../../lib/utils';
import type { Currency } from '../../../types';
import {
  type AccountAttentionItem,
  type AccountsAllocationItem,
  type AccountsHeroModel,
  type AccountsKpiSparkPoint,
  type AccountsPageSegment,
} from '../../../utils/accountsModel';
import { parseLocalDate, safeRound } from '../../../utils';
import {
  Area,
  AreaChart,
  AreaSparkline,
  ChartTooltip,
  Grid,
  XAxis,
  useSparklineHover,
  curveMonotoneX,
} from '../../bklit/charts';
import { NvIcon, type NvIconName } from '../NvIcon';
import { useMediaQuery } from '../Drawer';
import { TwoToneTitle } from '../tile';
import { Badge, Card, Money } from '../ui';

/*
 * Hero for `/accounts-new`: `AccountsHeroCard`, the split balance-sheet card with the interactive 90-day net worth
 * chart, the assets / liabilities / liquid cash strip, the 5-bucket allocation and the ranked attention items.
 */

const BUCKET_SEGMENT_MAP: Record<AccountsAllocationItem['id'], AccountsPageSegment> = {
  cash: 'cash_cards',
  savings_pension: 'savings_yield',
  property_assets: 'property_vehicles',
  credit_cards: 'cash_cards',
  loans_debt: 'loans_debt',
};

const BUCKET_DOT_CLASSES: Record<AccountsAllocationItem['id'], string> = {
  cash: 'bg-nv-violet',
  savings_pension: 'bg-nv-green',
  property_assets: 'bg-nv-sky',
  credit_cards: 'bg-nv-orange',
  loans_debt: 'bg-nv-red',
};

const BUCKET_ICONS: Record<AccountsAllocationItem['id'], NvIconName> = {
  cash: 'bank',
  savings_pension: 'piggy',
  property_assets: 'home',
  credit_cards: 'card',
  loans_debt: 'invoice',
};

const BUCKET_ICON_CLASSES: Record<AccountsAllocationItem['id'], string> = {
  cash: 'text-nv-violet-text',
  savings_pension: 'text-nv-green-text',
  property_assets: 'text-nv-sky-text',
  credit_cards: 'text-nv-orange-text',
  loans_debt: 'text-nv-red-text',
};

const BUCKET_ICON_BG_CLASSES: Record<AccountsAllocationItem['id'], string> = {
  cash: 'bg-nv-violet-soft',
  savings_pension: 'bg-nv-green-soft',
  property_assets: 'bg-nv-sky-soft',
  credit_cards: 'bg-nv-orange-soft',
  loans_debt: 'bg-nv-red-soft',
};

/* ── Interactive 90d Net Worth Area Spark-Chart ─────────────────────────── */

const NetWorth90dChart: React.FC<{
  series: { date: string | Date; value: number }[];
  currency: Currency;
}> = ({ series, currency }) => {
  // The axis labels need about 24px under the plot; a phone also gets a taller chart so the line has room.
  const compact = !useMediaQuery('(min-width: 640px)');
  const chartData = useMemo(
    () =>
      series.map((pt) => ({
        date: pt.date instanceof Date ? pt.date : parseLocalDate(pt.date),
        netWorth: pt.value,
      })),
    [series]
  );

  if (chartData.length < 2) {
    return (
      <div className="flex h-44 items-center justify-center rounded-nv-tile bg-nv-inset text-xs text-nv-muted">
        Add accounts to see 90-day net worth trajectory
      </div>
    );
  }

  const latestPoint = chartData[chartData.length - 1];

  return (
    <div className="flex flex-col justify-between rounded-nv-tile bg-nv-inset px-4 pb-2 pt-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-nv-muted">
          90-day net worth trajectory
        </span>
        {latestPoint && (
          <Money amount={latestPoint.netWorth} currency={currency} size="md" />
        )}
      </div>

      <div className="w-full select-none">
        <AreaChart
          margin={{ top: 8, right: 8, bottom: 24, left: 8 }}
          data={chartData}
          aspectRatio={compact ? '2 / 1' : '2.8 / 1'}
          currency={currency}
        >
          <Grid horizontal />
          <Area
            dataKey="netWorth"
            curve={curveMonotoneX}
            fill="var(--chart-line-primary)"
            stroke="var(--chart-line-primary)"
            fillOpacity={0.2}
            strokeWidth={3}
          />
          <XAxis />
          <ChartTooltip currency={currency} />
        </AreaChart>
      </div>
    </div>
  );
};

/* ── Change Delta Indicator ─────────────────────────────────────────────── */

const Delta: React.FC<{ pct: number | null; good: 'up' | 'down' }> = ({ pct, good }) => {
  if (pct === null) return null;
  const up = pct >= 0;
  const fine = pct === 0 || (up ? good === 'up' : good === 'down');
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium',
        fine ? 'text-nv-green-text' : 'text-nv-red-text'
      )}
    >
      <NvIcon name="arrowUpRight" size={13} className={up ? '' : 'rotate-90'} />
      {up ? '+' : ''}
      {pct}%
    </span>
  );
};

/* ── Interactive bklit AreaSparkline KPI Card ───────────────────────────── */

interface AccountsSparkKpiCardProps {
  label: string;
  icon: NvIconName;
  iconColor: string;
  chartColor: string;
  data: AccountsKpiSparkPoint[];
  total: number;
  subtitle: React.ReactNode;
  good: 'up' | 'down';
  currency: Currency;
  active?: boolean;
  onClick?: () => void;
}

const AccountsSparkKpiCard: React.FC<AccountsSparkKpiCardProps> = ({
  label,
  icon,
  iconColor,
  chartColor,
  data,
  total,
  subtitle,
  good,
  currency,
  active,
  onClick,
}) => {
  const hover = useSparklineHover<AccountsKpiSparkPoint>();
  const cardData = useMemo(() => {
    if (!data || data.length === 0) {
      return Array.from({ length: 30 }, (_, i) => ({
        day: `Day ${i + 1}`,
        date: '',
        value: total,
      }));
    }
    return data.slice(-30);
  }, [data, total]);

  const shown = hover.datum ?? cardData.at(-1);
  const displayValue = shown?.value ?? total;
  const isHovered = hover.datum !== null;

  // 30d percentage change delta
  const startVal = cardData[0]?.value ?? total;
  const deltaPct =
    Math.abs(startVal) > 0.01
      ? safeRound(((total - startVal) / Math.abs(startVal)) * 100, 1)
      : null;

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'group flex flex-col justify-between rounded-nv-tile bg-nv-inset p-3.5 text-left transition-all',
        onClick && 'cursor-pointer hover:bg-nv-inset/80',
        active && 'ring-1.5 ring-nv-ink'
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-1.5">
          <span className="flex items-center gap-1.5 truncate text-xs font-medium text-nv-muted">
            <NvIcon name={icon} size={14} className={iconColor} />
            <span className="truncate">{label}</span>
          </span>
          {isHovered ? (
            <span className="truncate text-xs font-medium text-nv-muted">
              {shown?.day}
            </span>
          ) : (
            <Delta pct={deltaPct} good={good} />
          )}
        </div>

        <div className="mt-1 truncate">
          <Money
            amount={displayValue}
            currency={currency}
            size="lg"
            className="font-semibold text-nv-ink"
          />
        </div>
      </div>

      <div className="mt-2.5 h-10 w-full overflow-hidden select-none">
        {cardData.length > 1 ? (
          <AreaSparkline
            data={cardData}
            dataKey="value"
            color={chartColor}
            height={40}
            curve="monotone"
            fill="gradient"
            fillOpacity={0.32}
            strokeWidth={2}
            {...hover.sparklineProps}
          />
        ) : (
          <div className="h-full w-full rounded bg-nv-surface/40" />
        )}
      </div>

      <p className="mt-2 truncate text-xs text-nv-muted">
        {subtitle}
      </p>
    </div>
  );
};

/* ── 1. AccountsHeroCard ────────────────────────────────────────────────── */

export const AccountsHeroCard: React.FC<{
  hero: AccountsHeroModel;
  displayCurrency: Currency;
  activeSegment?: AccountsPageSegment;
  onSelectSegment?: (segment: AccountsPageSegment) => void;
  onSelectAttentionAccount?: (accountId: string) => void;
}> = ({
  hero,
  displayCurrency,
  activeSegment,
  onSelectSegment,
  onSelectAttentionAccount,
}) => {
  const isPositive90d = hero.netWorth90dDelta >= 0;

  return (
    <Card
      top={
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-center">
          {/* Left 7 Cols: Net Worth Headline + Assets/Liabilities/Runway Triplet */}
          <div className="space-y-5 lg:col-span-7">
            <div>
              <TwoToneTitle as="h2" first="Balance sheet" second="net worth" className="text-base" />
              <div className="mt-2">
                <Money amount={hero.netWorth} currency={displayCurrency} size="hero" />
              </div>
              {/* A3: one change line (the badge and the "90d change" said the same thing; Solvency % is gone). */}
              <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-nv-muted">
                <NvIcon
                  name={isPositive90d ? 'investments' : 'warning'}
                  size={15}
                  className={isPositive90d ? 'text-nv-green-text' : 'text-nv-orange-text'}
                />
                <Money amount={hero.netWorth90dDelta} currency={displayCurrency} signed tone={isPositive90d ? 'income' : 'ink'} />
                <span>
                  ({isPositive90d ? '+' : ''}
                  {hero.netWorth90dPct}%) in 90 days
                </span>
              </p>
            </div>

            {/* 3-Column Balance Sheet Summary Strip: bklit AreaSparkline KPI Cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <AccountsSparkKpiCard
                label="Total assets"
                icon="wallet"
                iconColor="text-nv-green-text"
                chartColor="var(--nv-green)"
                data={hero.assetsTrend}
                total={hero.totalAssets}
                subtitle="Gross positive holdings"
                good="up"
                currency={displayCurrency}
              />

              <AccountsSparkKpiCard
                label="Total liabilities"
                icon="invoice"
                iconColor="text-nv-orange-text"
                chartColor="var(--nv-orange)"
                data={hero.liabilitiesTrend}
                total={hero.totalLiabilities}
                subtitle="Cards, loans & mortgages"
                good="down"
                currency={displayCurrency}
              />

              <AccountsSparkKpiCard
                label="Liquid cash"
                icon="bank"
                iconColor="text-nv-grad-from"
                chartColor="var(--nv-grad-from)"
                data={hero.liquidCashTrend}
                total={hero.liquidCash}
                subtitle={
                  hero.liquidRunwayMonths !== null
                    ? `${hero.liquidRunwayMonths} mo expense runway`
                    : (
                      <span>
                        30d net flow:{' '}
                        <Money
                          amount={hero.netFlow30d}
                          currency={displayCurrency}
                          signed
                          compact
                        />
                      </span>
                    )
                }
                good="up"
                currency={displayCurrency}
              />
            </div>
          </div>

          {/* Right 5 Cols: Interactive 90d Net Worth Trajectory Chart */}
          <div className="lg:col-span-5">
            <NetWorth90dChart series={hero.trend90d} currency={displayCurrency} />
          </div>
        </div>
      }
    >
      {/* Bottom Grey Tile Band: 5-Bucket Allocation Breakdown + Needs Attention Strip */}
      <div className="space-y-4">
        {/* A2: assets and liabilities each as their own bar (each adds up to 100 %); a bucket opens its tab. */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {(['asset', 'liability'] as const).map((kind) => {
            const items = hero.allocationItems.filter((item) => item.kind === kind);
            return (
              <div key={kind}>
                <p className="mb-2 text-xs font-medium text-nv-ink">{kind === 'asset' ? 'Assets' : 'Liabilities'}</p>
                {/* The bar is a picture of the shares; the buttons below filter (one target per bucket, 44px+). */}
                <div aria-hidden className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-nv-inset p-0.5">
                  {items
                    .filter((item) => item.pct > 0)
                    .map((item) => (
                      <span
                        key={item.id}
                        title={`${item.label}: ${item.pct}%`}
                        style={{ width: `${item.pct}%` }}
                        className={cn('h-full min-w-1 first:rounded-l-full last:rounded-r-full', BUCKET_DOT_CLASSES[item.id])}
                      />
                    ))}
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {items.map((item) => {
                    const targetSegment = BUCKET_SEGMENT_MAP[item.id];
                    const isActive = activeSegment === targetSegment;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelectSegment?.(targetSegment)}
                        aria-pressed={isActive}
                        className={cn(
                          'flex min-h-11 flex-col rounded-nv-control p-2.5 text-left transition-colors',
                          isActive ? 'bg-nv-surface ring-1.5 ring-nv-ink' : 'bg-nv-surface/70 hover:bg-nv-surface'
                        )}
                      >
                        <span className="flex items-center justify-between gap-1.5">
                          <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-nv-ink">
                            <span
                              className={cn(
                                'flex h-5 w-5 shrink-0 items-center justify-center rounded-md',
                                BUCKET_ICON_BG_CLASSES[item.id],
                                BUCKET_ICON_CLASSES[item.id]
                              )}
                            >
                              <NvIcon name={BUCKET_ICONS[item.id]} size={12} />
                            </span>
                            <span className="truncate">{item.label}</span>
                          </span>
                          <span className="nv-tabular text-xs text-nv-muted">{item.pct}%</span>
                        </span>
                        <span className="mt-1 flex items-baseline justify-between gap-1">
                          <Money amount={item.value} currency={displayCurrency} compact />
                          <span className="text-xs text-nv-muted">
                            {item.count} {item.count === 1 ? 'account' : 'accounts'}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Ranked Attention Items Strip */}
        {hero.attentionItems.length > 0 && (
          <div className="border-t border-nv-line pt-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-nv-ink">
              <NvIcon name="warning" size={15} className="text-nv-orange-text" />
              <span>Needs attention ({hero.attentionItems.length})</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {hero.attentionItems.map((alert: AccountAttentionItem) => (
                <button
                  key={alert.id}
                  type="button"
                  onClick={() => onSelectAttentionAccount?.(alert.accountId)}
                  className="inline-flex min-h-11 items-center gap-2.5 rounded-full border border-nv-line bg-nv-surface px-3.5 py-1.5 text-left text-xs text-nv-ink transition-colors hover:bg-nv-inset"
                >
                  <NvIcon
                    className={
                      alert.severity === 'danger'
                        ? 'text-nv-red-text'
                        : alert.severity === 'warn'
                          ? 'text-nv-orange-text'
                          : 'text-nv-muted'
                    }
                    name={
                      alert.severity === 'danger'
                        ? 'alert'
                        : alert.severity === 'warn'
                          ? 'warning'
                          : 'sparkles'
                    }
                    size={14}
                  />
                  <span className="font-semibold">{alert.accountName}:</span>
                  <span>{alert.title}</span>
                  <span className="nv-tabular rounded-full bg-nv-inset px-2 py-0.5 text-[11px] font-medium text-nv-ink">
                    {alert.metricLabel}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
