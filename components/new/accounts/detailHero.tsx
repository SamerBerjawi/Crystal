import React, { useMemo, useState } from 'react';
import { cn } from '../../../lib/utils';
import type { AccountDetailData } from '../../../hooks/useAccountDetailData';
import { normalizeCurrency, parseLocalDate } from '../../../utils';
import {
  Area,
  AreaChart,
  Background,
  ChartTooltip,
  Grid,
  TrendLine,
  XAxis,
  curveNatural,
} from '../../bklit/charts';
import { NvIcon } from '../NvIcon';
import { Badge, Button, Card, Money, SegmentedTabs } from '../ui';
import { safeImageSrcAttr } from '../../../utils/safeImageUrl';
import { AccountCard, accountHasCard, accountPicture } from './AccountCard';
import { AccountLogo, LicensePlateNew } from './parts';

/*
 * AccountDetailHero: Unified Split Hero Card (`Card top={...}`) for `/accounts-new/:id`.
 * Combines account identity, live vs settled balance, interactive Historical + Forecast trajectory chart,
 * and 4 archetype-specific KPI tiles.
 */

type ChartMode = 'history' | 'forecast';
type ForecastHorizon = '30' | '90' | '180' | '365';

export const AccountDetailHero: React.FC<{
  data: AccountDetailData;
  onBack: () => void;
  onEdit: () => void;
  onAdjustBalance: () => void;
  onRecordTx: () => void;
  onOpenValuation?: () => void;
  onOpenBankSync?: () => void;
  onOpenCloseAsset?: () => void;
}> = ({
  data,
  onBack,
  onEdit,
  onAdjustBalance,
  onRecordTx,
  onOpenValuation,
  onOpenBankSync,
  onOpenCloseAsset,
}) => {
  const { account, archetype, displayBalance, sparkline90d, forecastSeries } = data;
  const [chartMode, setChartMode] = useState<ChartMode>('history');
  const [failedPicture, setFailedPicture] = useState<string | null>(null);

  const chartData = useMemo(() => {
    if (chartMode === 'forecast') {
      return forecastSeries.points.map((pt) => ({
        date: parseLocalDate(pt.date),
        balance: pt.value,
      }));
    }
    return sparkline90d.sparklineData.map((pt) => ({
      date: pt.date instanceof Date ? pt.date : parseLocalDate(String(pt.date)),
      balance: pt.value,
    }));
  }, [chartMode, forecastSeries.points, sparkline90d.sparklineData]);

  if (!account) return null;

  const isClosed = account.status === 'closed';
  const typeLabel = account.subType || account.otherSubType || account.type;
  const isPhysicalAsset = account.type === 'Property' || account.type === 'Vehicle';
  const isLeasedVehicle = account.type === 'Vehicle' && account.ownership === 'Leased';
  const latestPoint = chartData[chartData.length - 1];
  // A picture (car, house) beats the card; a bank account or card shows its card.
  const pictureSrc = (() => {
    const url = accountPicture(account);
    return url && url !== failedPicture ? safeImageSrcAttr(url) : null;
  })();
  const showCard = !pictureSrc && accountHasCard(account);
  const hasMedia = Boolean(pictureSrc) || showCard;
  const strokeColor =
    chartMode === 'forecast' ? 'var(--nv-sky-text)' : 'var(--chart-line-primary)';

  return (
    <Card
      top={
        <div className="space-y-6">
          {/* Top Breadcrumb & Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-nv-inset px-4 text-sm font-medium text-nv-ink transition-colors hover:bg-nv-line"
            >
              <NvIcon name="arrowLeft" size={16} />
              <span>All accounts</span>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              {data.enableBankingLink && onOpenBankSync && (
                <Button variant="secondary" size="sm" icon="refresh" onClick={onOpenBankSync}>
                  Bank sync
                </Button>
              )}
              {isPhysicalAsset && !isLeasedVehicle && onOpenValuation && (
                <Button variant="secondary" size="sm" icon="investments" onClick={onOpenValuation}>
                  Appraise value
                </Button>
              )}
              <Button variant="secondary" size="sm" icon="refresh" onClick={onAdjustBalance}>
                Reconcile
              </Button>
              <Button variant="secondary" size="sm" icon="edit" onClick={onEdit}>
                Edit
              </Button>
              <Button variant="primary" size="sm" icon="add" onClick={onRecordTx}>
                Record activity
              </Button>
            </div>
          </div>

          {/* Main Identity & Interactive Trajectory Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
            {/* Left: title, then the card or picture with the balance beside it */}
            <div className={cn('min-w-0 space-y-5', hasMedia ? 'lg:col-span-7' : 'lg:col-span-6')}>
              <div className="flex items-start gap-4">
                {!hasMedia && <AccountLogo account={account} size={52} />}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <h1 className="min-w-0 truncate text-2xl font-semibold text-nv-ink">{account.name}</h1>
                    {account.isPrimary && <Badge tone="violet">Primary</Badge>}
                    {isClosed && (
                      <Badge tone="neutral" icon="archive">
                        Archived
                      </Badge>
                    )}
                    {data.enableBankingLink && (
                      <Badge tone="sky" icon="refresh">
                        Connected
                      </Badge>
                    )}
                    {account.licensePlate && (
                      <LicensePlateNew plate={account.licensePlate} countryCode={account.registrationCountryCode} />
                    )}
                  </div>
                  <p className="mt-1 text-sm text-nv-muted">
                    {[
                      account.financialInstitution,
                      typeLabel,
                      account.accountNumber || (account.last4 ? `•••• ${account.last4}` : undefined),
                      account.address,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              </div>

              <div className={cn(hasMedia && 'flex flex-wrap items-stretch gap-x-8 gap-y-5')}>
                {pictureSrc && (
                  <img
                    src={pictureSrc}
                    alt={account.name}
                    onError={() => setFailedPicture(accountPicture(account))}
                    className="aspect-[1.586] w-full max-w-[300px] shrink-0 rounded-[22px] object-cover"
                  />
                )}
                {showCard && <AccountCard account={account} className="w-full max-w-[300px] shrink-0" />}

                {/* Label and figure sit on the card's bottom edge */}
                <div className={cn('min-w-[220px] flex-1', hasMedia && 'flex flex-col justify-end gap-1 self-stretch')}>
                  <p className="text-xs font-medium text-nv-muted">
                    {isLeasedVehicle
                      ? 'Monthly lease payment'
                      : isPhysicalAsset
                        ? 'Current market value'
                        : 'Current balance'}
                  </p>
                  <div>
                    <Money
                      amount={isLeasedVehicle ? account.leasePaymentAmount || 0 : displayBalance}
                      currency={account.currency}
                      size="hero"
                    />
                    {normalizeCurrency(account.currency) !== normalizeCurrency(data.displayCurrency) && !isLeasedVehicle && (
                      <p className="mt-1 text-sm text-nv-muted">
                        ≈ <Money amount={data.convertToDisplay(displayBalance)} currency={data.displayCurrency} />
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right 6 Cols: Historical vs Forecast Trajectory Chart */}
            <div className={cn('rounded-nv-tile bg-nv-inset p-4', hasMedia ? 'lg:col-span-5' : 'lg:col-span-6')}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <SegmentedTabs<ChartMode>
                    label="Trajectory mode"
                    size="sm"
                    value={chartMode}
                    onChange={setChartMode}
                    items={[
                      { id: 'history', label: '90d history' },
                      { id: 'forecast', label: 'Forecast' },
                    ]}
                  />
                  {chartMode === 'forecast' && (
                    <SegmentedTabs<ForecastHorizon>
                      label="Forecast horizon"
                      size="sm"
                      value={String(data.forecastDays) as ForecastHorizon}
                      onChange={(v) =>
                        data.setForecastDays(Number(v) as 30 | 90 | 180 | 365)
                      }
                      items={[
                        { id: '30', label: '30D' },
                        { id: '90', label: '90D' },
                        { id: '180', label: '6M' },
                        { id: '365', label: '1Y' },
                      ]}
                    />
                  )}
                </div>

                {latestPoint && (
                  <div className="text-right">
                    <Money amount={latestPoint.balance} currency={account.currency} />
                  </div>
                )}
              </div>

              {chartData.length > 1 ? (
                <div className="w-full select-none">
                  <AreaChart
                    margin={{ top: 8, right: 8, bottom: 40, left: 8 }}
                    data={chartData}
                    aspectRatio="2.8 / 1"
                    currency={account.currency}
                  >
                    <Background pattern="dots" opacity={0.85} />
                    <Grid horizontal />
                    <TrendLine
                      dataKey="balance"
                      strokeStyle="gradient"
                      gradientStart="var(--chart-3)"
                      gradientEnd="var(--chart-1)"
                      strokeWidth={2}
                      strokeOpacity={0.5}
                      fadeEdges
                    />
                    <Area
                      dataKey="balance"
                      curve={curveNatural}
                      fill={strokeColor}
                      stroke={strokeColor}
                      fillOpacity={0.2}
                      strokeWidth={3}
                    />
                    <XAxis />
                    <ChartTooltip currency={account.currency} />
                  </AreaChart>
                </div>
              ) : (
                <div className="flex h-36 items-center justify-center text-xs text-nv-muted">
                  Insufficient history points for chart
                </div>
              )}
            </div>
          </div>
        </div>
      }
    >
      {/* Bottom Grey Tile Band: 4 Contextual KPI Cells */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {archetype === 'operating' && data.operatingMetrics && (
          <>
            <div className="rounded-nv-sub bg-nv-surface p-4">
              <p className="text-xs text-nv-muted">Safe to spend (after 14d bills)</p>
              <div className="mt-1">
                <Money
                  amount={data.operatingMetrics.safeToSpend}
                  currency={account.currency}
                  size="lg"
                />
              </div>
            </div>
            <div className="rounded-nv-sub bg-nv-surface p-4">
              <p className="text-xs text-nv-muted">14-day scheduled outflows</p>
              <div className="mt-1">
                <Money
                  amount={data.operatingMetrics.upcomingOutflows14d}
                  currency={account.currency}
                  size="lg"
                />
              </div>
            </div>
            <div className="rounded-nv-sub bg-nv-surface p-4">
              <p className="text-xs text-nv-muted">30-day lowest projected</p>
              <div className="mt-1">
                <Money
                  amount={data.operatingMetrics.lowestBalanceForecast}
                  currency={account.currency}
                  size="lg"
                />
              </div>
            </div>
            <div className="rounded-nv-sub bg-nv-surface p-4">
              <p className="text-xs text-nv-muted">3-month avg monthly spend</p>
              <div className="mt-1">
                <Money
                  amount={data.operatingMetrics.avgMonthlySpend}
                  currency={account.currency}
                  size="lg"
                />
              </div>
            </div>
          </>
        )}

        {archetype === 'yield_pot' && data.savingsMetrics && (
          <>
            <div className="rounded-nv-sub bg-nv-surface p-4">
              <p className="text-xs text-nv-muted">Annual yield rate (APY)</p>
              <p className="nv-tabular mt-1 text-xl font-semibold text-nv-green-text">
                {data.savingsMetrics.apy.toFixed(2)}%
              </p>
            </div>
            <div className="rounded-nv-sub bg-nv-surface p-4">
              <p className="text-xs text-nv-muted">YTD interest earned / accrued</p>
              <div className="mt-1">
                <Money
                  amount={data.savingsMetrics.totalInterestYTD}
                  currency={account.currency}
                  size="lg"
                  tone="income"
                />
              </div>
            </div>
            <div className="rounded-nv-sub bg-nv-surface p-4">
              <p className="text-xs text-nv-muted">Projected monthly interest</p>
              <div className="mt-1">
                <Money
                  amount={data.savingsMetrics.projectedMonthlyInterest}
                  currency={account.currency}
                  size="lg"
                />
              </div>
            </div>
            <div className="rounded-nv-sub bg-nv-surface p-4">
              <p className="text-xs text-nv-muted">Projected annual interest</p>
              <div className="mt-1">
                <Money
                  amount={data.savingsMetrics.projectedAnnualInterest}
                  currency={account.currency}
                  size="lg"
                />
              </div>
            </div>
          </>
        )}

        {archetype === 'yield_pot' && data.pensionMetrics && (
          <>
            <div className="rounded-nv-sub bg-nv-surface p-4">
              <p className="text-xs text-nv-muted">Total contributions</p>
              <div className="mt-1">
                <Money
                  amount={data.pensionMetrics.totalInvested}
                  currency={account.currency}
                  size="lg"
                />
              </div>
            </div>
            <div className="rounded-nv-sub bg-nv-surface p-4">
              <p className="text-xs text-nv-muted">Total investment gain</p>
              <div className="mt-1">
                <Money
                  amount={data.pensionMetrics.totalReturn}
                  currency={account.currency}
                  size="lg"
                  signed
                  tone={data.pensionMetrics.totalReturn >= 0 ? 'income' : 'ink'}
                />
              </div>
            </div>
            <div className="rounded-nv-sub bg-nv-surface p-4">
              <p className="text-xs text-nv-muted">Money-weighted return</p>
              {data.pensionMetrics.annualizedReturnPct !== null ? (
                <p className="nv-tabular mt-1 text-xl font-semibold text-nv-green-text">
                  {data.pensionMetrics.annualizedReturnPct >= 0 ? '+' : ''}
                  {data.pensionMetrics.annualizedReturnPct.toFixed(2)}% a year
                </p>
              ) : (
                <p className="nv-tabular mt-1 text-xl font-semibold text-nv-muted">—</p>
              )}
            </div>
            <div className="rounded-nv-sub bg-nv-surface p-4">
              <p className="text-xs text-nv-muted">
                {data.pensionMetrics.retirementYear
                  ? `Projected at retirement (${data.pensionMetrics.retirementYear})`
                  : 'Projected at retirement'}
              </p>
              {data.pensionMetrics.projectedValueAtRetirement !== null ? (
                <div className="mt-1">
                  <Money
                    amount={data.pensionMetrics.projectedValueAtRetirement}
                    currency={account.currency}
                    size="lg"
                  />
                </div>
              ) : (
                <button type="button" onClick={onEdit} className="mt-1 min-h-11 text-left text-sm font-medium text-nv-ink underline-offset-2 hover:underline">
                  {data.pensionMetrics.missingForProjection.retirementYear && data.pensionMetrics.missingForProjection.expectedReturn
                    ? 'Set retirement year and return'
                    : data.pensionMetrics.missingForProjection.retirementYear
                      ? 'Set a retirement year'
                      : 'Set an expected return'}
                </button>
              )}
            </div>
          </>
        )}

        {archetype === 'yield_pot' && data.spareChangeMetrics && (
          <>
            <div className="rounded-nv-sub bg-nv-surface p-4">
              <p className="text-xs text-nv-muted">Round-up total saved</p>
              <div className="mt-1">
                <Money
                  amount={data.spareChangeMetrics.totalSaved}
                  currency={account.currency}
                  size="lg"
                  tone="income"
                />
              </div>
            </div>
            <div className="rounded-nv-sub bg-nv-surface p-4">
              <p className="text-xs text-nv-muted">Captured round-ups</p>
              <p className="nv-tabular mt-1 text-xl font-semibold text-nv-ink">
                {data.spareChangeMetrics.totalRoundUps}
              </p>
            </div>
            <div className="rounded-nv-sub bg-nv-surface p-4">
              <p className="text-xs text-nv-muted">Average round-up</p>
              <div className="mt-1">
                <Money
                  amount={data.spareChangeMetrics.avgRoundUp}
                  currency={account.currency}
                  size="lg"
                />
              </div>
            </div>
            <div className="rounded-nv-sub bg-nv-surface p-4">
              <p className="text-xs text-nv-muted">Saved this month</p>
              <div className="mt-1">
                <Money
                  amount={data.spareChangeMetrics.thisMonthSaved}
                  currency={account.currency}
                  size="lg"
                />
              </div>
            </div>
          </>
        )}

        {archetype === 'credit_card' && data.creditCardMetrics && (
          <>
            <div className="rounded-nv-sub bg-nv-surface p-4">
              <p className="text-xs text-nv-muted">Available credit</p>
              <div className="mt-1">
                <Money
                  amount={data.creditCardMetrics.availableCredit}
                  currency={account.currency}
                  size="lg"
                />
              </div>
            </div>
            <div className="rounded-nv-sub bg-nv-surface p-4">
              <p className="text-xs text-nv-muted">Credit limit</p>
              <div className="mt-1">
                <Money
                  amount={data.creditCardMetrics.creditLimit}
                  currency={account.currency}
                  size="lg"
                />
              </div>
            </div>
            <div className="rounded-nv-sub bg-nv-surface p-4">
              <p className="text-xs text-nv-muted">Credit utilization</p>
              <p
                className={cn(
                  'nv-tabular mt-1 text-xl font-semibold',
                  data.creditCardMetrics.utilization >= 80
                    ? 'text-nv-red-text'
                    : data.creditCardMetrics.utilization >= 30
                      ? 'text-nv-orange-text'
                      : 'text-nv-green-text'
                )}
              >
                {data.creditCardMetrics.utilization.toFixed(1)}%
              </p>
            </div>
            <div className="rounded-nv-sub bg-nv-surface p-4">
              <p className="text-xs text-nv-muted">Current cycle spend</p>
              <div className="mt-1">
                <Money
                  amount={data.creditCardMetrics.totalSpent}
                  currency={account.currency}
                  size="lg"
                />
              </div>
            </div>
          </>
        )}

        {archetype === 'loan' && data.loanMetrics && (
          <>
            <div className="rounded-nv-sub bg-nv-surface p-4">
              <p className="text-xs text-nv-muted">Remaining principal</p>
              <div className="mt-1">
                <Money
                  amount={data.loanMetrics.outstandingPrincipal}
                  currency={account.currency}
                  size="lg"
                />
              </div>
            </div>
            <div className="rounded-nv-sub bg-nv-surface p-4">
              <p className="text-xs text-nv-muted">Principal repaid</p>
              <div className="mt-1 flex items-baseline gap-2">
                <Money
                  amount={data.loanMetrics.totalPaidPrincipal}
                  currency={account.currency}
                  size="lg"
                />
                <span className="nv-tabular text-xs font-medium text-nv-violet-text">
                  ({data.loanMetrics.progressPercent}%)
                </span>
              </div>
            </div>
            <div className="rounded-nv-sub bg-nv-surface p-4">
              <p className="text-xs text-nv-muted">Interest rate (APR)</p>
              <p className="nv-tabular mt-1 text-xl font-semibold text-nv-ink">
                {(account.interestRate || 0).toFixed(2)}%
              </p>
            </div>
            <div className="rounded-nv-sub bg-nv-surface p-4">
              <p className="text-xs text-nv-muted">Next scheduled installment</p>
              <div className="mt-1">
                {data.loanMetrics.nextScheduledPayment ? (
                  <Money
                    amount={data.loanMetrics.nextScheduledPayment.totalPayment}
                    currency={account.currency}
                    size="lg"
                  />
                ) : (
                  <span className="text-lg font-semibold text-nv-green-text">Paid in full</span>
                )}
              </div>
            </div>
          </>
        )}

        {archetype === 'physical_asset' && data.propertyMetrics && (
          <>
            <div className="rounded-nv-sub bg-nv-surface p-4">
              <p className="text-xs text-nv-muted">Net property equity</p>
              <div className="mt-1">
                <Money
                  amount={data.propertyMetrics.netEquity}
                  currency={account.currency}
                  size="lg"
                />
              </div>
            </div>
            <div className="rounded-nv-sub bg-nv-surface p-4">
              <p className="text-xs text-nv-muted">Appreciation vs purchase</p>
              <div className="mt-1 flex items-baseline gap-1.5">
                <Money
                  amount={data.propertyMetrics.appreciation}
                  currency={account.currency}
                  size="lg"
                  signed
                  tone={data.propertyMetrics.appreciation >= 0 ? 'income' : 'ink'}
                />
                <span className="nv-tabular text-xs text-nv-muted">
                  ({data.propertyMetrics.appreciationPercent.toFixed(1)}%)
                </span>
              </div>
            </div>
            <div className="rounded-nv-sub bg-nv-surface p-4">
              <p className="text-xs text-nv-muted">Linked mortgage debt</p>
              <div className="mt-1">
                <Money
                  amount={data.propertyMetrics.loanBalance}
                  currency={account.currency}
                  size="lg"
                />
              </div>
            </div>
            <div className="rounded-nv-sub bg-nv-surface p-4">
              <p className="text-xs text-nv-muted">Loan-to-value (LTV)</p>
              <p className="nv-tabular mt-1 text-xl font-semibold text-nv-ink">
                {data.propertyMetrics.ltv.toFixed(1)}%
              </p>
            </div>
          </>
        )}

        {archetype === 'physical_asset' && data.vehicleMetrics && (
          <>
            <div className="rounded-nv-sub bg-nv-surface p-4">
              <p className="text-xs text-nv-muted">
                {isLeasedVehicle ? 'Remaining Lease Allowance' : 'Net Vehicle Equity'}
              </p>
              <div className="mt-1">
                {isLeasedVehicle && data.vehicleMetrics.leaseStats ? (
                  <span className="nv-tabular text-xl font-semibold text-nv-ink">
                    {Math.round(data.vehicleMetrics.leaseStats.remainingMileage).toLocaleString()} km
                  </span>
                ) : (
                  <Money
                    amount={data.vehicleMetrics.ownedStats?.netEquity ?? account.balance}
                    currency={account.currency}
                    size="lg"
                  />
                )}
              </div>
            </div>
            <div className="rounded-nv-sub bg-nv-surface p-4">
              <p className="text-xs text-nv-muted">Latest odometer</p>
              <p className="nv-tabular mt-1 text-xl font-semibold text-nv-ink">
                {data.vehicleMetrics.currentMileage.toLocaleString()} km
              </p>
            </div>
            <div className="rounded-nv-sub bg-nv-surface p-4">
              <p className="text-xs text-nv-muted">Total operating cost (TCO)</p>
              <div className="mt-1">
                <Money
                  amount={data.vehicleTco?.totalCostOfOwnership ?? 0}
                  currency={account.currency}
                  size="lg"
                />
              </div>
            </div>
            <div className="rounded-nv-sub bg-nv-surface p-4">
              <p className="text-xs text-nv-muted">All-in cost per km</p>
              <div className="mt-1">
                {data.vehicleTco?.costPerKm !== null && data.vehicleTco?.costPerKm !== undefined ? (
                  <Money amount={data.vehicleTco.costPerKm} currency={account.currency} size="lg" />
                ) : (
                  <span className="text-sm text-nv-muted">Log 2+ odometer entries</span>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Optional Asset Closure Banner */}
      {isPhysicalAsset && onOpenCloseAsset && !isClosed && (
        <div className="mt-3 flex items-center justify-end">
          <button
            type="button"
            onClick={onOpenCloseAsset}
            className="inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-nv-muted hover:text-nv-ink"
          >
            <NvIcon name="archive" size={14} />
            <span>Sell, return, or retire this {account.type.toLowerCase()}…</span>
          </button>
        </div>
      )}
    </Card>
  );
};
