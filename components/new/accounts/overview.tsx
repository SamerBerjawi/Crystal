import React, { useMemo } from 'react';
import { cn } from '../../../lib/utils';
import type { Account, Currency } from '../../../types';
import {
  isMealVoucherAccount,
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
  Background,
  ChartTooltip,
  Grid,
  TrendLine,
  XAxis,
  curveNatural,
  useSparklineHover,
} from '../../bklit/charts';
import { CardFlip } from '../../kokonutui/card-flip';
import { MomentumRail } from '../../kokonutui/momentum-rail';
import { AccountLogo } from '../EntityIcon';
import { NvIcon, type NvIconName } from '../NvIcon';
import { TwoToneTitle } from '../tile';
import { toast } from '../toast';
import { Badge, Button, Card, Money } from '../ui';

/*
 * Hero & Card Wallet Rail for `/accounts-new`:
 * - `AccountsHeroCard`: Split balance-sheet cockpit card (`Card top={...}`) with interactive 90-day Net Worth
 *   scrubbing chart, Assets vs Liabilities solvency bar, 30d liquid runway, 5-bucket allocation breakdown,
 *   and ranked Needs Attention alerts.
 * - `CardWalletRail`: Horizontal `MomentumRail` of interactive 2-sided `CardFlip` cards for Checking, Savings,
 *   and Credit Card accounts.
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
    <div className="flex flex-col justify-between rounded-nv-tile bg-nv-inset p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-nv-muted">
          90-Day Net Worth Trajectory
        </span>
        {latestPoint && (
          <Money amount={latestPoint.netWorth} currency={currency} size="md" />
        )}
      </div>

      <div className="w-full select-none">
        <AreaChart
          margin={{ top: 8, right: 8, bottom: 40, left: 8 }}
          data={chartData}
          aspectRatio="2.8 / 1"
          currency={currency}
        >
          <Background pattern="dots" opacity={0.85} />
          <Grid horizontal />
          <TrendLine
            dataKey="netWorth"
            strokeStyle="gradient"
            gradientStart="var(--chart-3)"
            gradientEnd="var(--chart-1)"
            strokeWidth={2}
            strokeOpacity={0.5}
            fadeEdges
          />
          <Area
            dataKey="netWorth"
            curve={curveNatural}
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
        active && 'ring-1.5 ring-nv-violet'
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
              <div className="flex flex-wrap items-center gap-2.5">
                <TwoToneTitle
                  as="h2"
                  first="Balance Sheet"
                  second="Net Worth"
                  className="text-base"
                />
                <Badge
                  tone={isPositive90d ? 'green' : 'orange'}
                  icon={isPositive90d ? 'investments' : 'warning'}
                >
                  {isPositive90d ? '+' : ''}
                  {hero.netWorth90dPct}% (90d)
                </Badge>
                <Badge tone="violet" icon="checkCircle">
                  {hero.solvencyRatioPct}% Solvency
                </Badge>
              </div>

              <div className="mt-2 flex flex-wrap items-baseline gap-3">
                <Money amount={hero.netWorth} currency={displayCurrency} size="hero" />
                <span className="text-xs text-nv-muted">
                  90d change:{' '}
                  <Money
                    amount={hero.netWorth90dDelta}
                    currency={displayCurrency}
                    signed
                    tone={isPositive90d ? 'income' : 'ink'}
                  />
                </span>
              </div>
            </div>

            {/* 3-Column Balance Sheet Summary Strip: bklit AreaSparkline KPI Cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <AccountsSparkKpiCard
                label="Total Assets"
                icon="wallet"
                iconColor="text-nv-green-text"
                chartColor="var(--nv-green)"
                data={hero.assetsTrend}
                total={hero.totalAssets}
                subtitle="Gross positive holdings"
                good="up"
                currency={displayCurrency}
                active={activeSegment === 'all'}
                onClick={() => onSelectSegment?.('all')}
              />

              <AccountsSparkKpiCard
                label="Total Liabilities"
                icon="invoice"
                iconColor="text-nv-orange-text"
                chartColor="var(--nv-orange)"
                data={hero.liabilitiesTrend}
                total={hero.totalLiabilities}
                subtitle="Cards, loans & mortgages"
                good="down"
                currency={displayCurrency}
                active={activeSegment === 'loans_debt'}
                onClick={() => onSelectSegment?.('loans_debt')}
              />

              <AccountsSparkKpiCard
                label="Liquid Cash"
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
                active={activeSegment === 'cash_cards'}
                onClick={() => onSelectSegment?.('cash_cards')}
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
        {/* Stacked Allocation Bar */}
        <div>
          <div className="mb-2 flex items-center justify-between text-xs text-nv-muted">
            <span className="font-medium text-nv-ink">Capital & Debt Allocation</span>
            <span>Click a bucket to filter segment</span>
          </div>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-nv-inset p-0.5 gap-0.5">
            {hero.allocationItems
              .filter((item) => item.pct > 0)
              .map((item) => (
                <button
                  key={item.id}
                  type="button"
                  title={`${item.label}: ${item.pct}%`}
                  onClick={() => onSelectSegment?.(BUCKET_SEGMENT_MAP[item.id])}
                  style={{ width: `${Math.max(3, item.pct)}%` }}
                  className={cn(
                    'h-full first:rounded-l-full last:rounded-r-full transition-opacity hover:opacity-80',
                    BUCKET_DOT_CLASSES[item.id]
                  )}
                />
              ))}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {hero.allocationItems.map((item) => {
              const targetSegment = BUCKET_SEGMENT_MAP[item.id];
              const isActive = activeSegment === targetSegment;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectSegment?.(targetSegment)}
                  className={cn(
                    'group flex flex-col rounded-nv-control p-2.5 text-left transition-all',
                    isActive
                      ? 'bg-nv-surface ring-1.5 ring-nv-violet shadow-xs'
                      : 'bg-nv-surface/70 hover:bg-nv-surface hover:shadow-2xs'
                  )}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="flex items-center gap-1.5 truncate text-xs font-medium text-nv-ink">
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
                  </div>
                  <div className="mt-1 flex items-baseline justify-between gap-1">
                    <Money amount={item.value} currency={displayCurrency} compact />
                    <span className="text-xs text-nv-muted">{item.count} {item.count === 1 ? 'account' : 'accounts'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Ranked Attention Items Strip */}
        {hero.attentionItems.length > 0 && (
          <div className="border-t border-nv-line pt-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-nv-ink">
              <NvIcon name="warning" size={15} className="text-nv-orange-text" />
              <span>Needs Attention ({hero.attentionItems.length})</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {hero.attentionItems.map((alert: AccountAttentionItem) => (
                <button
                  key={alert.id}
                  type="button"
                  onClick={() => onSelectAttentionAccount?.(alert.accountId)}
                  className={cn(
                    'inline-flex items-center gap-2.5 rounded-full border px-3.5 py-1.5 text-left text-xs transition-colors',
                    alert.severity === 'danger'
                      ? 'border-nv-red/40 bg-nv-red-soft text-nv-red-text'
                      : alert.severity === 'warn'
                        ? 'border-nv-orange/50 bg-nv-orange-soft text-nv-orange-text'
                        : 'border-nv-line bg-nv-surface text-nv-ink hover:bg-nv-inset'
                  )}
                >
                  <NvIcon
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
                  <span className="nv-tabular rounded-full bg-nv-surface/80 px-2 py-0.5 text-[11px] font-medium text-nv-ink">
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

/* ── 2. CardWalletRail (Interactive Flip Cards for Bank & Credit Cards) ── */

export const CardWalletRail: React.FC<{
  accounts: Account[];
  displayBalancesById: Record<string, number>;
  realTodayBalancesById: Record<string, number>;
  linkedEnableBankingIds: Set<string>;
  onOpenAccount: (account: Account) => void;
}> = ({
  accounts,
  displayBalancesById,
  realTodayBalancesById,
  linkedEnableBankingIds,
  onOpenAccount,
}) => {
  if (accounts.length === 0) return null;

  const copyIdentifier = (e: React.MouseEvent, text: string, label: string) => {
    e.stopPropagation();
    if (navigator?.clipboard) {
      void navigator.clipboard.writeText(text);
      toast.success(`Copied ${label} to clipboard`);
    }
  };

  return (
    <MomentumRail
      icon="card"
      title="Card & account wallet"
    >
      {accounts.map((acc) => {
        const balance = displayBalancesById[acc.id] ?? acc.balance;
        const realBal = realTodayBalancesById[acc.id] ?? balance;
        const isCredit = acc.type === 'Credit Card';
        const isSavings = acc.type === 'Savings';
        const isMealVoucher = isMealVoucherAccount(acc);
        const isSynced = linkedEnableBankingIds.has(acc.id);
        const owed = isCredit ? Math.max(0, -realBal) : 0;
        const limit = acc.creditLimit || 0;
        const utilPct = isCredit && limit > 0 ? Math.min(100, Math.round((owed / limit) * 100)) : 0;
        const availableCredit = isCredit && limit > 0 ? Math.max(0, limit - owed) : 0;

        const maskedTail = acc.last4
          ? `•••• ${acc.last4}`
          : acc.accountNumber
            ? `•••• ${acc.accountNumber.slice(-4)}`
            : isMealVoucher
              ? 'Voucher Card'
              : acc.type;

        return (
          <CardFlip
            key={acc.id}
            heightClassName="h-52"
            onSelect={() => onOpenAccount(acc)}
            flipLabel={`Flip ${acc.name} card`}
            front={
              <div
                className={cn(
                  'flex h-full w-full flex-col justify-between rounded-nv-card p-5',
                  isCredit
                    ? 'bg-nv-ink text-nv-on-ink'
                    : 'border border-nv-line bg-nv-surface text-nv-ink'
                )}
              >
                {/* Top Row: Institution Logo + Name + Type */}
                <div className="flex items-start justify-between gap-2 pr-10">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <AccountLogo account={acc} size={36} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{acc.name}</p>
                      <p
                        className={cn(
                          'truncate text-xs',
                          isCredit ? 'opacity-70' : 'text-nv-muted'
                        )}
                      >
                        {acc.financialInstitution ? `${acc.financialInstitution} · ${isMealVoucher ? 'Meal Voucher' : acc.type}` : isMealVoucher ? 'Meal Voucher' : acc.type}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Middle Row: Balance */}
                <Money
                  amount={balance}
                  currency={acc.currency}
                  size="xl"
                  tone={isCredit ? 'inherit' : 'ink'}
                />

                {/* Bottom Row: Masked Number + Network / APY / Utilization */}
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span
                    className={cn(
                      'nv-tabular font-medium tracking-wider',
                      isCredit ? 'opacity-80' : 'text-nv-muted'
                    )}
                  >
                    {maskedTail}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {acc.isPrimary && (
                      <span className="rounded-full bg-nv-violet-soft px-2 py-0.5 text-[11px] font-semibold text-nv-violet-text">
                        Primary
                      </span>
                    )}
                    {isMealVoucher && !acc.isPrimary && (
                      <span className="rounded-full bg-nv-teal-soft px-2 py-0.5 text-[11px] font-semibold text-nv-teal-text">
                        Voucher
                      </span>
                    )}
                    {isSynced && (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                          isCredit
                            ? 'bg-nv-surface/15 text-nv-on-ink'
                            : 'bg-nv-sky-soft text-nv-sky-text'
                        )}
                      >
                        <NvIcon name="refresh" size={11} />
                        Synced
                      </span>
                    )}
                    {isSavings && acc.apy !== undefined && acc.apy > 0 && (
                      <span className="rounded-full bg-nv-green-soft px-2.5 py-0.5 text-[11px] font-semibold text-nv-green-text">
                        {acc.apy}% APY
                      </span>
                    )}
                    {isCredit && limit > 0 && (
                      <span
                        className={cn(
                          'nv-tabular rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                          utilPct >= 80
                            ? 'bg-nv-red text-nv-on-violet'
                            : utilPct >= 30
                              ? 'bg-nv-orange text-nv-on-orange'
                              : 'bg-nv-surface/20 text-nv-on-ink'
                        )}
                      >
                        {utilPct}% used
                      </span>
                    )}
                    {acc.cardNetwork && (
                      <span
                        className={cn(
                          'text-xs font-semibold uppercase',
                          isCredit ? 'opacity-80' : 'text-nv-muted'
                        )}
                      >
                        {acc.cardNetwork}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            }
            back={
              <div className="flex h-full w-full flex-col justify-between rounded-nv-card border border-nv-line bg-nv-surface p-5 text-nv-ink">
                <div className="pr-10">
                  <p className="truncate text-sm font-semibold text-nv-ink">{acc.name}</p>
                  <p className="text-xs text-nv-muted">Account Specifications</p>
                </div>

                <div className="space-y-2 text-xs">
                  {acc.accountNumber ? (
                    <div className="flex items-center justify-between gap-2 rounded-nv-control bg-nv-inset px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-xs text-nv-muted">IBAN / Account Number</p>
                        <p className="nv-tabular truncate font-medium text-nv-ink">
                          {acc.accountNumber}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => copyIdentifier(e, acc.accountNumber!, 'IBAN')}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-nv-surface text-nv-ink hover:bg-nv-line"
                        title="Copy IBAN"
                      >
                        <NvIcon name="copy" size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-nv-control bg-nv-inset px-3 py-2 text-nv-muted">
                      No IBAN stored · {acc.currency} account
                    </div>
                  )}

                  {isCredit && limit > 0 ? (
                    <div className="flex items-center justify-between px-1">
                      <span className="text-nv-muted">Available Credit</span>
                      <Money amount={availableCredit} currency={acc.currency} />
                    </div>
                  ) : (
                    <div className="flex items-center justify-between px-1">
                      <span className="text-nv-muted">Settled Today</span>
                      <Money amount={realBal} currency={acc.currency} />
                    </div>
                  )}

                  {isCredit && (
                    <div className="flex items-center justify-between px-1 text-xs text-nv-muted">
                      <span>Statement Day: {acc.statementStartDate || 1}</span>
                      <span>Due Day: {acc.paymentDate || 15}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon="arrowUpRight"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenAccount(acc);
                    }}
                  >
                    Open Cockpit
                  </Button>
                </div>
              </div>
            }
          />
        );
      })}
    </MomentumRail>
  );
};
