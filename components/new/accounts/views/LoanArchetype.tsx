import React, { useMemo, useState } from 'react';
import { formatShortDate } from '../../../../utils/dateFormat';
import { cn } from '../../../../lib/utils';
import type { Account, ScheduledPayment } from '../../../../types';
import type { AccountDetailData } from '../../../../hooks/useAccountDetailData';
import { simulateExtraLoanPayment } from '../../../../utils/accountDetailModel';
import { toLocalISOString } from '../../../../utils';
import { NvIcon } from '../../NvIcon';
import { FilterChip } from '../../tile';
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

type ScheduleFilter = 'all' | 'upcoming' | 'paid' | 'overdue';

export const LoanArchetype: React.FC<{
  data: AccountDetailData;
  onNavigateToAccount?: (account: Account) => void;
}> = ({ data, onNavigateToAccount }) => {
  const {
    account,
    loanMetrics,
    accountTransactions,
    loanPaymentOverrides,
    saveLoanInstallmentOverride,
    recordAccountTransaction,
  } = data;

  const [extraMonthlyStr, setExtraMonthlyStr] = useState('150');
  const [lumpSumStr, setLumpSumStr] = useState('0');
  const [schedFilter, setSchedFilter] = useState<ScheduleFilter>('all');
  const [expanded, setExpanded] = useState(false);
  const [editingPmtNum, setEditingPmtNum] = useState<number | null>(null);
  const [extraOverrideInput, setExtraOverrideInput] = useState('');

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

  const filteredSchedule = schedule.filter((p) => {
    if (schedFilter === 'upcoming') return p.status === 'Upcoming';
    if (schedFilter === 'paid') return p.status === 'Paid';
    if (schedFilter === 'overdue') return p.status === 'Overdue';
    return true;
  });

  const visibleSchedule = expanded ? filteredSchedule : filteredSchedule.slice(0, 12);

  const handleSaveExtraOverride = (paymentNumber: number) => {
    const num = Math.max(0, parseFloat(extraOverrideInput) || 0);
    const res = saveLoanInstallmentOverride(
      paymentNumber,
      num > 0 ? { extraPrincipal: num } : null
    );
    if (res?.undo) {
      toast.undo(
        num > 0
          ? `Set +${num} extra principal on installment #${paymentNumber}`
          : `Cleared extra principal on installment #${paymentNumber}`,
        res.undo
      );
    }
    setEditingPmtNum(null);
  };

  const handleRecordInstallment = (pmt: ScheduledPayment) => {
    const res = recordAccountTransaction({
      date: pmt.date <= toLocalISOString(new Date()) ? pmt.date : toLocalISOString(new Date()),
      description: `${account.name} — Installment #${pmt.paymentNumber}`,
      merchant: account.financialInstitution || account.name,
      amount: pmt.totalPayment,
      category: 'Loan & Debt Payment',
      type: isLending ? 'expense' : 'income',
      principalAmount: pmt.principal,
      interestAmount: pmt.interest,
    });
    if (res?.undo) {
      toast.undo(`Recorded installment #${pmt.paymentNumber}`, res.undo);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Row: Payoff Progress + Early-Payoff Simulator */}
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
              <p className="text-nv-muted">Remaining scheduled interest</p>
              <div className="mt-0.5">
                <Money
                  amount={loanMetrics.outstandingInterest}
                  currency={account.currency}
                />
              </div>
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

      {/* Amortization Schedule Ledger */}
      {schedule.length > 0 && (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-nv-ink">
                Amortization Schedule ({filteredSchedule.length} installments)
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <FilterChip
                label="All"
                active={schedFilter === 'all'}
                onClick={() => setSchedFilter('all')}
              />
              <FilterChip
                label="Upcoming"
                active={schedFilter === 'upcoming'}
                onClick={() => setSchedFilter('upcoming')}
              />
              <FilterChip
                label="Paid"
                active={schedFilter === 'paid'}
                onClick={() => setSchedFilter('paid')}
              />
              {schedule.some((p) => p.status === 'Overdue') && (
                <FilterChip
                  label="Overdue"
                  icon="alert"
                  active={schedFilter === 'overdue'}
                  onClick={() => setSchedFilter('overdue')}
                />
              )}
            </div>
          </div>

          {visibleSchedule.length === 0 ? (
            <EmptyState
              icon="calendar"
              title="No installments in this filter"
              body="Switch filters to inspect the full amortization table."
            />
          ) : (
            <div className="space-y-1.5">
              {visibleSchedule.map((pmt) => {
                const isEditingExtra = editingPmtNum === pmt.paymentNumber;
                return (
                  <div
                    key={pmt.paymentNumber}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-nv-sub bg-nv-surface px-4 py-3 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="nv-tabular flex h-8 w-8 items-center justify-center rounded-full bg-nv-inset text-xs font-semibold text-nv-ink">
                        #{pmt.paymentNumber}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="nv-tabular font-semibold text-nv-ink">
                            {formatShortDate(pmt.date)}
                          </span>
                          <Badge
                            tone={
                              pmt.status === 'Paid'
                                ? 'green'
                                : pmt.status === 'Overdue'
                                  ? 'red'
                                  : 'neutral'
                            }
                          >
                            {pmt.status}
                          </Badge>
                          {(pmt.extraPrincipal || 0) > 0 && (
                            <Badge tone="violet">
                              +<Money amount={pmt.extraPrincipal!} currency={account.currency} /> extra
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-nv-muted">
                          Principal:{' '}
                          <Money amount={pmt.principal} currency={account.currency} /> · Interest:{' '}
                          <Money amount={pmt.interest} currency={account.currency} /> · Total:{' '}
                          <Money amount={pmt.totalPayment} currency={account.currency} />
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isEditingExtra ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            value={extraOverrideInput}
                            onChange={(e) => setExtraOverrideInput(e.target.value)}
                            placeholder="Extra principal"
                            className="h-9 w-28 rounded-nv-control border border-nv-line bg-nv-inset px-2.5 text-xs text-nv-ink outline-none focus:border-nv-violet"
                          />
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleSaveExtraOverride(pmt.paymentNumber)}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingPmtNum(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <>
                          {pmt.status !== 'Paid' && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPmtNum(pmt.paymentNumber);
                                  setExtraOverrideInput(String(pmt.extraPrincipal || ''));
                                }}
                                className="rounded-full bg-nv-inset px-3 py-1 text-xs font-medium text-nv-ink hover:bg-nv-line"
                              >
                                + Extra Principal
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRecordInstallment(pmt)}
                                className="rounded-full bg-nv-violet-soft px-3 py-1 text-xs font-medium text-nv-violet-text hover:opacity-90"
                              >
                                Mark paid
                              </button>
                            </>
                          )}
                          <div className="min-w-20 text-right">
                            <Money amount={pmt.totalPayment} currency={account.currency} />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {filteredSchedule.length > 12 && (
            <div className="flex justify-center pt-1">
              <MoreButton
                expanded={expanded}
                total={filteredSchedule.length}
                onToggle={() => setExpanded((v) => !v)}
              />
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
