import React, { useMemo, useState } from 'react';
import { cn } from '../../../../lib/utils';
import type { Account } from '../../../../types';
import type { AccountDetailData } from '../../../../hooks/useAccountDetailData';
import { parseLocalDate } from '../../../../utils';
import { computeCompoundingProjection } from '../../../../utils/accountDetailModel';
import {
  Area,
  AreaChart,
  Background,
  ChartTooltip,
  Grid,
  TrendLine,
  XAxis,
  curveNatural,
} from '../../../bklit/charts';
import { NvIcon } from '../../NvIcon';
import { Badge, Button, Card, Money, SegmentedTabs } from '../../ui';

/*
 * Archetype 2: Yield & Accumulation Account View (`Savings`, `Pension Fund`, `Spare Change`).
 * Features the repaired Savings Interest Engine (recorded + daily-balance accrued + projected interest),
 * Pension CAGR & retirement horizon, Spare Change micro-round-up tracker, and an interactive Compounding Estimator.
 */

type HorizonYears = '5' | '10' | '15' | '20' | '30';

export const YieldPotArchetype: React.FC<{
  data: AccountDetailData;
  onLogInterest: () => void;
  onEditAccount: () => void;
  onNavigateToAccount?: (account: Account) => void;
}> = ({ data, onLogInterest, onEditAccount, onNavigateToAccount }) => {
  const { account, savingsMetrics, pensionMetrics, spareChangeMetrics, realTodayBalance } = data;

  const defaultApy =
    account?.apy ??
    (account?.subType === 'Pension Fund' ? 6.0 : 3.0);

  const [monthlyDepositStr, setMonthlyDepositStr] = useState('250');
  const [simApyStr, setSimApyStr] = useState(() => String(defaultApy > 0 ? defaultApy : 3.0));
  const [horizonStr, setHorizonStr] = useState<HorizonYears>('10');

  const compounding = useMemo(
    () =>
      computeCompoundingProjection({
        initialBalance: Math.max(0, realTodayBalance),
        monthlyDeposit: Math.max(0, parseFloat(monthlyDepositStr) || 0),
        apy: Math.max(0, parseFloat(simApyStr) || 0),
        years: parseInt(horizonStr, 10) || 10,
      }),
    [realTodayBalance, monthlyDepositStr, simApyStr, horizonStr]
  );

  if (!account) return null;

  /* ── Case A: Spare Change Round-Up Pot ───────────────────────────────── */
  if (account.type === 'Investment' && account.subType === 'Spare Change' && spareChangeMetrics) {
    const maxMonth = Math.max(1, ...spareChangeMetrics.monthlyData.map((m) => m.value));

    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Card className="space-y-4 lg:col-span-7">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-nv-ink">
                6-Month Round-Up Velocity
              </h2>
              <p className="text-xs text-nv-muted">
                Automatic spare-change captures excluding manual lump-sum deposits
              </p>
            </div>
            <Badge tone="green" icon="sparkles">
              {spareChangeMetrics.totalRoundUps} round-ups
            </Badge>
          </div>

          <div className="grid grid-cols-6 gap-3 rounded-nv-sub bg-nv-surface p-4">
            {spareChangeMetrics.monthlyData.map((m) => {
              const pct = Math.round((m.value / maxMonth) * 100);
              return (
                <div key={m.name} className="flex flex-col items-center">
                  <div className="flex h-36 w-full items-end justify-center rounded-xl bg-nv-inset/60 p-2">
                    <div
                      style={{ height: `${Math.max(5, pct)}%` }}
                      className="w-5 rounded-t-full bg-nv-violet transition-all"
                    />
                  </div>
                  <span className="mt-2 text-xs font-medium text-nv-ink">{m.name}</span>
                  <span className="nv-tabular text-[11px] text-nv-muted">
                    <Money amount={m.value} currency={account.currency} />
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="space-y-4 lg:col-span-5">
          <div>
            <h2 className="text-lg font-semibold text-nv-ink">Round-Up Diagnostics</h2>
            <p className="text-xs text-nv-muted">
              Breakdown of micro-savings vs manual deposits
            </p>
          </div>

          <div className="space-y-2.5 rounded-nv-sub bg-nv-surface p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-nv-muted">Pure Round-Up Captures</span>
              <Money
                amount={spareChangeMetrics.totalRoundUpSaved}
                currency={account.currency}
                tone="income"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-nv-muted">Manual Lump-Sum Deposits</span>
              <Money amount={spareChangeMetrics.manualDeposits} currency={account.currency} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-nv-muted">Biggest Single Round-Up</span>
              <Money amount={spareChangeMetrics.biggestRoundUp} currency={account.currency} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-nv-muted">Coffee Equivalent (~€4.50)</span>
              <span className="nv-tabular font-semibold text-nv-ink">
                {spareChangeMetrics.coffeesSaved} coffees
              </span>
            </div>
          </div>

          {spareChangeMetrics.sourceAccount ? (
            <button
              type="button"
              onClick={() =>
                spareChangeMetrics.sourceAccount &&
                onNavigateToAccount?.(spareChangeMetrics.sourceAccount)
              }
              className="flex w-full items-center justify-between rounded-nv-sub bg-nv-surface p-4 text-left transition-colors hover:bg-nv-inset"
            >
              <div>
                <p className="text-xs text-nv-muted">Linked Round-Up Source Account</p>
                <p className="text-sm font-semibold text-nv-ink">
                  {spareChangeMetrics.sourceAccount.name}
                </p>
              </div>
              <NvIcon name="arrowUpRight" size={18} className="text-nv-violet-text" />
            </button>
          ) : (
            <div className="rounded-nv-sub bg-nv-surface p-4">
              <p className="text-xs text-nv-muted">
                No source checking account linked yet. Link one to automatically round up card purchases.
              </p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-2.5"
                onClick={onEditAccount}
              >
                Link Source Account
              </Button>
            </div>
          )}
        </Card>
      </div>
    );
  }

  /* ── Case B: Savings Account or Pension Fund ─────────────────────────── */
  const maxInterestVal = savingsMetrics
    ? Math.max(0.01, ...savingsMetrics.interestHistory.map((m) => m.value))
    : 1;

  const compoundingChartData = useMemo(() => {
    const startYear = new Date().getFullYear();
    return compounding.yearlySeries.map((yr) => ({
      date: new Date(startYear + yr.year, 0, 1),
      balance: yr.balance,
      principal: yr.principal,
    }));
  }, [compounding.yearlySeries]);

  const pensionChartData = useMemo(() => {
    if (!pensionMetrics) return [];
    return pensionMetrics.chartData.map((pt) => ({
      date: parseLocalDate(`${pt.date}-01`),
      balance: pt.balance,
      contributions: pt.contributions,
    }));
  }, [pensionMetrics]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left 7 Cols: 12-Month Interest Yield Chart (Savings) OR Contribution History (Pension) */}
        {savingsMetrics ? (
          <Card className="space-y-4 lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-nv-ink">
                  12-Month Interest & Yield Ledger
                </h2>
                <p className="text-xs text-nv-muted">
                  Combines recorded interest payouts with daily-balance APY accrual ({savingsMetrics.apy}% APY)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" icon="add" onClick={onLogInterest}>
                  Log Interest Payout
                </Button>
              </div>
            </div>

            {savingsMetrics.apy <= 0 && savingsMetrics.recordedInterestYTD <= 0 ? (
              <div className="flex flex-col items-center justify-center rounded-nv-sub bg-nv-surface p-6 text-center">
                <p className="text-sm font-medium text-nv-ink">
                  No APY rate configured on this savings reserve
                </p>
                <p className="mt-1 max-w-md text-xs text-nv-muted">
                  Set an Annual Percentage Yield (APY) on {account.name} to automatically calculate daily accrued interest, monthly yield, and compounding projections.
                </p>
                <Button
                  size="sm"
                  variant="cta"
                  icon="edit"
                  className="mt-3"
                  onClick={onEditAccount}
                >
                  Set APY Rate
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-12 gap-1.5 rounded-nv-sub bg-nv-surface p-4">
                  {savingsMetrics.interestHistory.map((pt) => {
                    const hPct = Math.round((pt.value / maxInterestVal) * 100);
                    return (
                      <div key={pt.monthKey} className="flex flex-col items-center">
                        <div className="flex h-32 w-full items-end justify-center rounded-lg bg-nv-inset/50 p-1">
                          <div
                            title={`${pt.name}: ${pt.value} (${pt.isProjected ? 'Accrued / Projected' : 'Recorded Payout'})`}
                            style={{ height: `${Math.max(6, hPct)}%` }}
                            className={cn(
                              'w-full rounded-t-md transition-all',
                              pt.isProjected ? 'bg-nv-violet/75' : 'bg-nv-green'
                            )}
                          />
                        </div>
                        <span className="mt-1.5 text-[10px] font-medium text-nv-muted">
                          {pt.name}
                        </span>
                        <span className="nv-tabular text-[10px] text-nv-ink">
                          <Money amount={pt.value} currency={account.currency} compact />
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-nv-muted">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-nv-green" />
                      Recorded Payouts YTD:{' '}
                      <Money
                        amount={savingsMetrics.recordedInterestYTD}
                        currency={account.currency}
                      />
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-nv-violet" />
                      Daily Accrued YTD:{' '}
                      <Money
                        amount={savingsMetrics.accruedInterestYTD}
                        currency={account.currency}
                      />
                    </span>
                  </div>
                  <span>90d Growth Index: {savingsMetrics.growthIndexLabel}</span>
                </div>
              </>
            )}
          </Card>
        ) : pensionMetrics ? (
          <Card className="space-y-4 lg:col-span-7">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-nv-ink">
                  Pension Retirement Trajectory
                </h2>
                <p className="text-xs text-nv-muted">
                  Historical balance and projected compounding toward {pensionMetrics.retirementYear}
                </p>
              </div>
              <Badge tone="violet">Target {pensionMetrics.retirementYear}</Badge>
            </div>

            {pensionChartData.length > 1 && (
              <div className="rounded-nv-sub bg-nv-surface p-4">
                <AreaChart
                  margin={{ top: 8, right: 8, bottom: 40, left: 8 }}
                  data={pensionChartData}
                  aspectRatio="2.6 / 1"
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
                    fill="var(--chart-line-primary)"
                    stroke="var(--chart-line-primary)"
                    fillOpacity={0.2}
                    strokeWidth={3}
                  />
                  <XAxis />
                  <ChartTooltip currency={account.currency} />
                </AreaChart>
              </div>
            )}
          </Card>
        ) : null}

        {/* Right 5 Cols: Interactive Compounding & Wealth Projector */}
        <Card className="space-y-4 lg:col-span-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-nv-ink">
                Interactive Compounding Simulator
              </h2>
              <p className="text-xs text-nv-muted">
                Simulate future value with recurring monthly deposits
              </p>
            </div>
            <SegmentedTabs<HorizonYears>
              label="Compounding horizon"
              size="sm"
              value={horizonStr}
              onChange={setHorizonStr}
              items={[
                { id: '5', label: '5Y' },
                { id: '10', label: '10Y' },
                { id: '20', label: '20Y' },
                { id: '30', label: '30Y' },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-nv-muted">
                Monthly Deposit ({account.currency})
              </label>
              <input
                type="number"
                step="50"
                value={monthlyDepositStr}
                onChange={(e) => setMonthlyDepositStr(e.target.value)}
                className="h-10 w-full rounded-nv-control border border-nv-line bg-nv-surface px-3 text-sm text-nv-ink outline-none focus:border-nv-violet"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-nv-muted">
                Simulated APY (%)
              </label>
              <input
                type="number"
                step="0.25"
                value={simApyStr}
                onChange={(e) => setSimApyStr(e.target.value)}
                className="h-10 w-full rounded-nv-control border border-nv-line bg-nv-surface px-3 text-sm text-nv-ink outline-none focus:border-nv-violet"
              />
            </div>
          </div>

          <div className="rounded-nv-sub bg-nv-surface p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-nv-muted">
                Projected Balance in {horizonStr} Years
              </span>
              <Money
                amount={compounding.finalBalance}
                currency={account.currency}
                size="xl"
              />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-nv-line pt-3 text-xs">
              <div>
                <p className="text-nv-muted">Principal Contributed</p>
                <div className="mt-0.5">
                  <Money
                    amount={compounding.totalPrincipal}
                    currency={account.currency}
                  />
                </div>
              </div>
              <div>
                <p className="text-nv-muted">Compound Interest Earned</p>
                <div className="mt-0.5">
                  <Money
                    amount={compounding.totalInterestEarned}
                    currency={account.currency}
                    tone="income"
                    signed
                  />
                </div>
              </div>
            </div>

            {/* Compounding Trajectory Area Chart */}
            {compoundingChartData.length > 1 && (
              <div className="mt-4">
                <AreaChart
                  margin={{ top: 8, right: 8, bottom: 40, left: 8 }}
                  data={compoundingChartData}
                  aspectRatio="2.4 / 1"
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
                    fill="var(--chart-line-primary)"
                    stroke="var(--chart-line-primary)"
                    fillOpacity={0.2}
                    strokeWidth={3}
                  />
                  <XAxis />
                  <ChartTooltip currency={account.currency} />
                </AreaChart>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
