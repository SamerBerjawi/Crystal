import React from 'react';
import { cn } from '../../../../lib/utils';
import type { Account } from '../../../../types';
import type { AccountDetailData } from '../../../../hooks/useAccountDetailData';
import { NvIcon } from '../../NvIcon';
import { Badge, Card, EmptyState, Money } from '../../ui';

/*
 * Archetype 1: Operating & Cash Account View (`Checking`, `Other Assets (Cash)`, `Other Assets`, `Other Liabilities`).
 * Displays:
 * - 6-Month Inflow vs Outflow Bar Chart
 * - Top 90-Day Spending Categories Breakdown
 * - 14-Day Scheduled Obligations & Safe-to-Spend Buffer
 * - Physical Cash Burn & Runway (when `account.otherSubType === 'Cash'`)
 */

export const OperatingAccountArchetype: React.FC<{
  data: AccountDetailData;
  onNavigateToAccount?: (account: Account) => void;
}> = ({ data, onNavigateToAccount }) => {
  const { account, operatingMetrics, cashMetrics } = data;
  if (!account || !operatingMetrics) return null;

  const isPhysicalCash =
    account.type === 'Other Assets' && account.otherSubType === 'Cash';

  const maxMonthlyVal = Math.max(
    1,
    ...operatingMetrics.inflowOutflow6m.map((m) => Math.max(m.income, m.expense))
  );

  return (
    <div className="space-y-5">
      {/* Physical Cash Burn & Runway Banner (Cash Sub-type) */}
      {isPhysicalCash && cashMetrics && (
        <Card className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="rounded-nv-sub bg-nv-surface p-4">
            <p className="text-xs text-nv-muted">30-Day Cash Outflow</p>
            <div className="mt-1">
              <Money
                amount={cashMetrics.rolling30dOutflow}
                currency={account.currency}
                size="lg"
              />
            </div>
          </div>
          <div className="rounded-nv-sub bg-nv-surface p-4">
            <p className="text-xs text-nv-muted">Avg Daily Cash Burn</p>
            <div className="mt-1">
              <Money
                amount={cashMetrics.avgDailySpend}
                currency={account.currency}
                size="lg"
              />
            </div>
          </div>
          <div className="rounded-nv-sub bg-nv-surface p-4">
            <p className="text-xs text-nv-muted">Estimated Cash Runway</p>
            <p className="nv-tabular mt-1 text-xl font-semibold text-nv-ink">
              {cashMetrics.runwayDays !== null ? `${cashMetrics.runwayDays} days` : 'Unlimited'}
            </p>
          </div>
          <div className="rounded-nv-sub bg-nv-surface p-4">
            <p className="text-xs text-nv-muted">Reserve Status</p>
            <p className="mt-1 text-sm font-semibold text-nv-violet-text">
              {cashMetrics.burnRateMessage}
            </p>
          </div>
        </Card>
      )}

      {/* Main 2-Column Operating Analytics Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left 7 Cols: 6-Month Inflow vs Outflow Bar Chart */}
        <Card className="space-y-4 lg:col-span-7">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-nv-ink">
                6-Month Inflow vs. Outflow
              </h2>
              <p className="text-xs text-nv-muted">
                Monthly cashflow velocity in {account.currency}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-nv-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-nv-green" />
                Inflow
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-nv-orange" />
                Outflow
              </span>
            </div>
          </div>

          <div className="grid grid-cols-6 gap-3 rounded-nv-sub bg-nv-surface p-4">
            {operatingMetrics.inflowOutflow6m.map((m) => {
              const incPct = Math.round((m.income / maxMonthlyVal) * 100);
              const expPct = Math.round((m.expense / maxMonthlyVal) * 100);
              return (
                <div key={m.name} className="flex flex-col items-center">
                  <div className="flex h-36 w-full items-end justify-center gap-1.5 rounded-xl bg-nv-inset/60 p-2">
                    <div
                      title={`Inflow: ${m.income}`}
                      style={{ height: `${Math.max(4, incPct)}%` }}
                      className="w-3 rounded-t-full bg-nv-green transition-all"
                    />
                    <div
                      title={`Outflow: ${m.expense}`}
                      style={{ height: `${Math.max(4, expPct)}%` }}
                      className="w-3 rounded-t-full bg-nv-orange transition-all"
                    />
                  </div>
                  <span className="mt-2 text-xs font-medium text-nv-ink">{m.name}</span>
                  <span
                    className={cn(
                      'nv-tabular text-[11px]',
                      m.net >= 0 ? 'text-nv-green-text' : 'text-nv-muted'
                    )}
                  >
                    <Money amount={m.net} currency={account.currency} signed compact />
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Right 5 Cols: Top 90-Day Spending Categories */}
        <Card className="space-y-4 lg:col-span-5">
          <div>
            <h2 className="text-lg font-semibold text-nv-ink">Top Outflow Categories (90d)</h2>
            <p className="text-xs text-nv-muted">
              Non-transfer spending distribution over the past 90 days
            </p>
          </div>

          {operatingMetrics.topCategories90d.length === 0 ? (
            <EmptyState
              icon="budget"
              title="No categorized outflows"
              body="Expenses over the last 90 days will appear here by category."
            />
          ) : (
            <div className="space-y-2.5 rounded-nv-sub bg-nv-surface p-4">
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
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Upcoming 14-Day Scheduled Outflows */}
          <Card className="space-y-3">
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
              <p className="rounded-nv-sub bg-nv-surface p-4 text-xs text-nv-muted">
                No scheduled outflows due in the next 14 days.
              </p>
            ) : (
              <div className="divide-y divide-nv-line rounded-nv-sub bg-nv-surface px-4">
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
          <Card className="space-y-3">
            <div>
              <h3 className="text-base font-semibold text-nv-ink">
                Connected Settlement Cards & Goals
              </h3>
              <p className="text-xs text-nv-muted">
                Credit cards and savings goals funded by {account.name}
              </p>
            </div>

            <div className="space-y-2">
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
                  <p className="rounded-nv-sub bg-nv-surface p-4 text-xs text-nv-muted">
                    No credit cards or savings goals are linked to this account yet.
                  </p>
                )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
