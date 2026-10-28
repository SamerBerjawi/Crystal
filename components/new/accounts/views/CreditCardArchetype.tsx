import React from 'react';
import { cn } from '../../../../lib/utils';
import type { Account } from '../../../../types';
import type { AccountDetailData } from '../../../../hooks/useAccountDetailData';
import { toLocalISOString } from '../../../../utils';
import { CardFlip } from '../../../kokonutui/card-flip';
import { AccountLogo } from '../../EntityIcon';
import { NvIcon } from '../../NvIcon';
import { Badge, Button, Card, Money, ProgressBar } from '../../ui';

/*
 * Archetype 3: Revolving Credit Card Account View (`Credit Card`).
 * Displays interactive 2-sided CardFlip, credit utilization health bar, statement cycle window,
 * settlement account link, 1-click Statement Payment trigger, and 6-month cycle spend chart.
 */

export const CreditCardArchetype: React.FC<{
  data: AccountDetailData;
  onPayStatement: () => void;
  onNavigateToAccount?: (account: Account) => void;
}> = ({ data, onPayStatement, onNavigateToAccount }) => {
  const { account, creditCardMetrics, accounts } = data;
  if (!account || !creditCardMetrics) return null;

  const settlementAcc = account.settlementAccountId
    ? accounts.find((a) => a.id === account.settlementAccountId)
    : undefined;

  const maxSpend = Math.max(
    1,
    ...creditCardMetrics.spendingHistory.map((m) => m.value)
  );

  const utilTone =
    creditCardMetrics.utilization >= 80
      ? 'red'
      : creditCardMetrics.utilization >= 30
        ? 'orange'
        : 'green';

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      {/* Left 6 Cols: Interactive Credit Card + Utilization & Statement Cycle */}
      <Card className="space-y-5 lg:col-span-6">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-nv-ink">
              Card & Statement Cycle
            </h2>
            <p className="text-xs text-nv-muted">
              Active cycle: {toLocalISOString(creditCardMetrics.activeWindowStart)} →{' '}
              {toLocalISOString(creditCardMetrics.activeWindowEnd)}
            </p>
          </div>
          <Button variant="cta" size="sm" icon="card" onClick={onPayStatement}>
            Pay Statement
          </Button>
        </div>

        <CardFlip
          heightClassName="h-52"
          flipLabel="Flip credit card for statement & limit details"
          front={
            <div className="flex h-full w-full flex-col justify-between rounded-nv-card bg-nv-ink p-5 text-nv-on-ink">
              <div className="flex items-start justify-between pr-10">
                <div className="flex items-center gap-3">
                  <AccountLogo account={account} size={38} />
                  <div>
                    <p className="text-sm font-semibold">{account.name}</p>
                    <p className="text-xs opacity-70">
                      {account.financialInstitution || 'Credit Card'}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs opacity-70">
                  {creditCardMetrics.creditSurplus > 0
                    ? 'Positive Credit Surplus'
                    : 'Current Balance Owed'}
                </p>
                <div className="mt-0.5">
                  <Money
                    amount={
                      creditCardMetrics.creditSurplus > 0
                        ? creditCardMetrics.creditSurplus
                        : creditCardMetrics.balanceOwed
                    }
                    currency={account.currency}
                    size="xl"
                    tone="inherit"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="nv-tabular tracking-widest opacity-80">
                  {account.last4 ? `•••• •••• •••• ${account.last4}` : '•••• ••••'}
                </span>
                <span className="font-semibold uppercase opacity-80">
                  {account.cardNetwork || 'CARD'}
                </span>
              </div>
            </div>
          }
          back={
            <div className="flex h-full w-full flex-col justify-between rounded-nv-card border border-nv-line bg-nv-surface p-5 text-nv-ink">
              <div className="pr-10">
                <p className="text-sm font-semibold">{account.name}</p>
                <p className="text-xs text-nv-muted">Statement & Limit Specifications</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-nv-control bg-nv-inset p-2.5">
                  <p className="text-[10px] text-nv-muted">Statement Day</p>
                  <p className="nv-tabular font-semibold">
                    Day {account.statementStartDate || 1} of month
                  </p>
                </div>
                <div className="rounded-nv-control bg-nv-inset p-2.5">
                  <p className="text-[10px] text-nv-muted">Payment Due Day</p>
                  <p className="nv-tabular font-semibold">
                    Day {account.paymentDate || 15} of month
                  </p>
                </div>
                <div className="rounded-nv-control bg-nv-inset p-2.5">
                  <p className="text-[10px] text-nv-muted">APR Interest Rate</p>
                  <p className="nv-tabular font-semibold">
                    {account.interestRate !== undefined ? `${account.interestRate}%` : '0%'}
                  </p>
                </div>
                <div className="rounded-nv-control bg-nv-inset p-2.5">
                  <p className="text-[10px] text-nv-muted">Available Credit</p>
                  <Money
                    amount={creditCardMetrics.availableCredit}
                    currency={account.currency}
                  />
                </div>
              </div>
            </div>
          }
        />

        {/* Utilization Bar */}
        <div className="space-y-2 rounded-nv-sub bg-nv-surface p-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-nv-ink">Credit Limit Utilization</span>
            <Badge tone={utilTone}>
              {creditCardMetrics.utilization < 30
                ? 'Optimal (<30%)'
                : creditCardMetrics.utilization < 80
                  ? 'Elevated (30–80%)'
                  : 'High (>80%)'}
            </Badge>
          </div>
          <ProgressBar
            value={creditCardMetrics.utilization}
            tone={utilTone}
            label="Credit utilization"
          />
          <div className="flex items-center justify-between pt-1 text-xs text-nv-muted">
            <span>
              Cycle Spend:{' '}
              <Money amount={creditCardMetrics.totalSpent} currency={account.currency} />
            </span>
            <span>
              Cycle Payments:{' '}
              <Money
                amount={creditCardMetrics.totalPayments}
                currency={account.currency}
                tone="income"
              />
            </span>
          </div>
        </div>

        {settlementAcc && (
          <button
            type="button"
            onClick={() => onNavigateToAccount?.(settlementAcc)}
            className="flex w-full items-center justify-between rounded-nv-sub bg-nv-surface p-4 text-left transition-colors hover:bg-nv-inset"
          >
            <div className="flex items-center gap-3">
              <NvIcon name="bank" size={18} className="text-nv-violet-text" />
              <div>
                <p className="text-xs text-nv-muted">Linked Settlement Account</p>
                <p className="text-sm font-semibold text-nv-ink">{settlementAcc.name}</p>
              </div>
            </div>
            <Money amount={settlementAcc.balance} currency={settlementAcc.currency} />
          </button>
        )}
      </Card>

      {/* Right 6 Cols: 6-Month Statement Spend Bar Chart */}
      <Card className="space-y-4 lg:col-span-6">
        <div>
          <h2 className="text-lg font-semibold text-nv-ink">
            6-Month Statement Spend History
          </h2>
          <p className="text-xs text-nv-muted">
            Net card purchases per calendar month (net of refunds)
          </p>
        </div>

        <div className="grid grid-cols-6 gap-3 rounded-nv-sub bg-nv-surface p-5">
          {creditCardMetrics.spendingHistory.map((m) => {
            const pct = Math.round((m.value / maxSpend) * 100);
            return (
              <div key={m.name} className="flex flex-col items-center">
                <div className="flex h-44 w-full items-end justify-center rounded-xl bg-nv-inset/60 p-2">
                  <div
                    style={{ height: `${Math.max(5, pct)}%` }}
                    className="w-5 rounded-t-full bg-nv-orange transition-all"
                  />
                </div>
                <span className="mt-2 text-xs font-medium text-nv-ink">{m.name}</span>
                <span className="nv-tabular text-[11px] text-nv-muted">
                  <Money amount={m.value} currency={account.currency} compact />
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};
