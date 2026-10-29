import React, { useMemo, useState } from 'react';
import { formatShortDate } from '../../../../utils/dateFormat';
import { cn } from '../../../../lib/utils';
import type { Account, ScheduledPayment } from '../../../../types';
import type { AccountDetailData } from '../../../../hooks/useAccountDetailData';
import { simulateExtraLoanPayment } from '../../../../utils/accountDetailModel';
import { computeLoanBalanceBreakdown, toLocalISOString } from '../../../../utils';
import { NvIcon } from '../../NvIcon';
import { PaymentPlan } from './PaymentPlan';
import { toast } from '../../toast';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Money,
  MoreButton,
  ProgressBar,
} from '../../ui';

/*
 * Archetype 4: Amortized Debt & Lending View (`Loan`, `Lending`).
 * Includes:
 * - Principal Payoff Progress & Linked Asset LTV/Equity card
 * - Interactive Early-Payoff & Extra Principal Simulator (`simulateExtraLoanPayment`)
 * - Full Amortization Schedule with inline Extra Principal Overrides (`BUG-08` & `BUG-09` fixed)
 */

export const LoanArchetype: React.FC<{
  data: AccountDetailData;
  onNavigateToAccount?: (account: Account) => void;
  /** Overview tab: progress and simulator. Payment plan tab: the schedule. */
  section?: 'overview' | 'plan';
}> = ({ data, onNavigateToAccount, section = 'overview' }) => {
  const {
    account,
    loanMetrics,
    accountTransactions,
    loanPaymentOverrides,
    recordAccountTransaction,
  } = data;

  const [extraMonthlyStr, setExtraMonthlyStr] = useState('150');
  const [lumpSumStr, setLumpSumStr] = useState('0');

  const interestSplit = useMemo(
    () => (account ? computeLoanBalanceBreakdown(account, accountTransactions, loanPaymentOverrides) : null),
    [account, accountTransactions, loanPaymentOverrides]
  );

  const simulation = useMemo(() => {
    if (!account) return null;
    return simulateExtraLoanPayment(
      account,
      accountTransactions,
      loanPaymentOverrides,
      Math.max(0, parseFloat(extraMonthlyStr) || 0),
      Math.max(0, parseFloat(lumpSumStr) || 0)
    );
  }, [account, accountTransactions, loanPaymentOverrides, extraMonthlyStr, lumpSumStr]);

  if (!account || !loanMetrics) return null;

  const isLending = account.type === 'Lending';
  const schedule = loanMetrics.schedule;

  return (
    <div className="space-y-5">
      {/* Top Row: Payoff Progress + Early-Payoff Simulator */}
      {section === 'overview' && (
      <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
        {/* Left 6 Cols: Principal & Interest Breakdown + Linked Asset */}
        <Card className="flex flex-col h-full space-y-4 lg:col-span-6">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-nv-ink">
                {isLending ? 'Repayment progress' : 'Principal payoff & equity'}
              </h2>
              <p className="text-xs text-nv-muted">
                {loanMetrics.payoffDate
                  ? `Paid off ${formatShortDate(toLocalISOString(loanMetrics.payoffDate))}`
                  : 'Amortization breakdown'}
              </p>
            </div>
            <Badge tone="violet">{loanMetrics.progressPercent}% repaid</Badge>
          </div>

          <ProgressBar
            value={loanMetrics.progressPercent}
            tone="violet"
            label="Principal repayment progress"
          />

          <div className="grid grid-cols-2 gap-3 rounded-nv-sub bg-nv-surface p-4 text-xs">
            <div>
              <p className="text-nv-muted">Original principal</p>
              <div className="mt-0.5">
                <Money amount={loanMetrics.totalPrincipal} currency={account.currency} />
              </div>
            </div>
            <div>
              <p className="text-nv-muted">Total principal paid</p>
              <div className="mt-0.5">
                <Money
                  amount={loanMetrics.totalPaidPrincipal}
                  currency={account.currency}
                  tone="income"
                />
              </div>
            </div>
            <div>
              <p className="text-nv-muted">Total interest paid</p>
              <div className="mt-0.5">
                <Money amount={loanMetrics.totalPaidInterest} currency={account.currency} />
              </div>
            </div>
            <div>
              <p className="text-nv-muted">Interest still to pay</p>
              <div className="mt-0.5">
                {/* Q2: the balance is principal + interest built up so far; the rest is shown here, not in it. */}
                <Money amount={interestSplit?.futureInterest ?? loanMetrics.outstandingInterest} currency={account.currency} />
              </div>
              {interestSplit && interestSplit.accruedInterest > 0 && (
                <p className="mt-0.5 text-nv-muted">
                  + <Money amount={interestSplit.accruedInterest} currency={account.currency} /> owed now
                </p>
              )}
            </div>
          </div>

          {loanMetrics.linkedAsset && (
            <button
              type="button"
              onClick={() =>
                loanMetrics.linkedAsset && onNavigateToAccount?.(loanMetrics.linkedAsset)
              }
              className="flex w-full items-center justify-between rounded-nv-sub bg-nv-surface p-4 text-left transition-colors hover:bg-nv-inset"
            >
              <div className="flex items-center gap-3">
                <NvIcon
                  name={loanMetrics.linkedAsset.type === 'Property' ? 'home' : 'pin'}
                  size={20}
                  className="text-nv-violet-text"
                />
                <div>
                  <p className="text-xs text-nv-muted">
                    Secured on {loanMetrics.linkedAsset.type} · LTV {loanMetrics.ltv}%
                  </p>
                  <p className="text-sm font-semibold text-nv-ink">
                    {loanMetrics.linkedAsset.name}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-nv-muted">Market equity</p>
                <Money amount={loanMetrics.marketEquity} currency={account.currency} />
              </div>
            </button>
          )}
        </Card>

        {/* Right 6 Cols: Early-Payoff & Extra Principal Simulator */}
        <Card className="flex flex-col h-full space-y-4 lg:col-span-6">
          <div>
            <h2 className="text-lg font-semibold text-nv-ink">
              Early-payoff & interest saver simulator
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-nv-muted">
                Extra Monthly Principal ({account.currency})
              </label>
              <input
                type="number"
                step="50"
                value={extraMonthlyStr}
                onChange={(e) => setExtraMonthlyStr(e.target.value)}
                className="h-10 w-full rounded-nv-control border border-nv-line bg-nv-surface px-3 text-sm text-nv-ink outline-none focus:border-nv-violet"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-nv-muted">
                One-Time Lump Sum ({account.currency})
              </label>
              <input
                type="number"
                step="500"
                value={lumpSumStr}
                onChange={(e) => setLumpSumStr(e.target.value)}
                className="h-10 w-full rounded-nv-control border border-nv-line bg-nv-surface px-3 text-sm text-nv-ink outline-none focus:border-nv-violet"
              />
            </div>
          </div>

          {simulation && (
            <div className="space-y-3 rounded-nv-sub bg-nv-surface p-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-nv-control bg-nv-inset p-3">
                  <p className="text-xs text-nv-muted">Time saved</p>
                  <p className="nv-tabular mt-1 text-lg font-semibold text-nv-violet-text">
                    {simulation.monthsSaved} mo
                  </p>
                </div>
                <div className="rounded-nv-control bg-nv-inset p-3">
                  <p className="text-xs text-nv-muted">Interest saved</p>
                  <div className="mt-1">
                    <Money
                      amount={simulation.interestSaved}
                      currency={account.currency}
                      tone="income"
                    />
                  </div>
                </div>
                <div className="rounded-nv-control bg-nv-inset p-3">
                  <p className="text-xs text-nv-muted">New payoff</p>
                  <p className="nv-tabular mt-1 text-sm font-semibold text-nv-ink">
                    {simulation.newPayoffDate || '—'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-nv-muted">
                <span>
                  Baseline Interest:{' '}
                  <Money
                    amount={simulation.baselineTotalInterest}
                    currency={account.currency}
                  />
                </span>
                <span>
                  Accelerated Interest:{' '}
                  <Money
                    amount={simulation.acceleratedTotalInterest}
                    currency={account.currency}
                  />
                </span>
              </div>
            </div>
          )}
        </Card>
      </div>
      )}

      {/* Payment plan tab */}
      {section === 'plan' && <PaymentPlan data={data} />}
    </div>
  );
};
