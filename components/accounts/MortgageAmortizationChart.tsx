import React, { useEffect, useMemo, useState } from 'react';
import type { Account, ScheduledPayment } from '../../types';
import { parseLocalDate, safeRound } from '../../utils';
import { computeAmortizationTrajectory } from '../../utils/accountPagesModel';
import type { ChartMarker } from '../../src/components/charts';
import Icon from '../ui/Icon';
import { Badge } from '../ui/Display';
import { Slider } from '../ui/Fields';
import { Amount } from '../ui/Money';
import SegmentedControl from '../ui/SegmentedControl';
import { Bars, Figures, TimeSeries } from './charts';

interface MortgageAmortizationChartProps {
  account: Account;
  schedule: ScheduledPayment[];
  principal: number;
  rate: number;
  monthlyPayment: number;
  extra?: number;
  lump?: number;
  assetValue?: number;
}

const shortMonthYear = (iso: string) =>
  parseLocalDate(iso).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

/**
 * Interactive mortgage/loan amortization chart showing remaining balance vs. cumulative
 * principal and interest over time, annual stacked breakdowns, a per-payment principal/interest
 * split inspector, and automated repayment milestones.
 */
const MortgageAmortizationChart: React.FC<MortgageAmortizationChartProps> = ({
  account,
  schedule,
  principal,
  rate,
  monthlyPayment,
  extra = 0,
  lump = 0,
  assetValue,
}) => {
  const [view, setView] = useState<'trajectory' | 'yearly' | 'split'>('trajectory');

  const trajectory = useMemo(
    () =>
      computeAmortizationTrajectory({
        schedule,
        principal,
        rate,
        monthlyPayment,
        loanStartDate: account.loanStartDate,
        extraMonthly: extra,
        lumpSum: lump,
        assetValue,
      }),
    [schedule, principal, rate, monthlyPayment, account.loanStartDate, extra, lump, assetValue],
  );

  const nextIdx = Math.max(0, schedule.findIndex(p => p.status !== 'Paid'));
  const defaultPaymentNumber = schedule[nextIdx]?.paymentNumber ?? schedule[0]?.paymentNumber ?? 1;
  const [selectedPaymentNum, setSelectedPaymentNum] = useState<number>(defaultPaymentNumber);

  useEffect(() => {
    if (!schedule.some(p => p.paymentNumber === selectedPaymentNum)) {
      setSelectedPaymentNum(defaultPaymentNumber);
    }
  }, [defaultPaymentNumber, schedule, selectedPaymentNum]);

  const activeInstallment = useMemo(
    () => schedule.find(p => p.paymentNumber === selectedPaymentNum) ?? schedule[0] ?? null,
    [schedule, selectedPaymentNum],
  );

  const markers = useMemo<ChartMarker[]>(() => {
    const out: ChartMarker[] = [{ date: new Date(), title: 'Today', color: 'var(--muted)' }];
    trajectory.milestones
      .filter(m => m.id !== 'payoff')
      .forEach(m => {
        out.push({
          date: parseLocalDate(m.date),
          title: m.label,
          description: `${shortMonthYear(m.date)} · ${m.detail}`,
          color: m.reached ? 'var(--money-in)' : 'var(--primary)',
        });
      });
    return out;
  }, [trajectory.milestones]);

  if (schedule.length === 0) return null;

  const hasOverpayment = extra > 0 || lump > 0;
  const maxPaymentNum = schedule[schedule.length - 1]?.paymentNumber ?? schedule.length;
  const minPaymentNum = schedule[0]?.paymentNumber ?? 1;
  const principalPct = activeInstallment && activeInstallment.totalPayment > 0
    ? Math.min(100, Math.max(0, safeRound((activeInstallment.principal / activeInstallment.totalPayment) * 100, 1)))
    : 100;
  const interestPct = safeRound(Math.max(0, 100 - principalPct), 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          items={[
            { id: 'trajectory', label: 'Balance & P&I' },
            { id: 'yearly', label: 'By year' },
            { id: 'split', label: 'Payment split' },
          ]}
          activeId={view}
          onChange={id => setView(id as 'trajectory' | 'yearly' | 'split')}
        />
        <span className="type-caption text-muted">
          Total scheduled interest: <strong className="text-ink"><Amount value={trajectory.totalInterest} currency={account.currency} /></strong>
        </span>
      </div>

      {view === 'trajectory' && (
        <TimeSeries
          data={trajectory.points}
          series={[
            { key: 'balance', label: 'Remaining balance', color: 'var(--chart-1)', dashFromIndex: trajectory.todayIndex },
            { key: 'cumulativePrincipal', label: 'Cumulative principal', color: 'var(--money-in)' },
            { key: 'cumulativeInterest', label: 'Cumulative interest', color: 'var(--chart-4)' },
            ...(hasOverpayment
              ? [{ key: 'fasterBalance', label: 'With overpayment', color: 'var(--teal)' }]
              : []),
          ]}
          currency={account.currency}
          markers={markers}
          height="h-[240px] md:h-[300px]"
        />
      )}

      {view === 'yearly' && (
        <Bars
          data={trajectory.years}
          xKey="year"
          stacked
          bars={[
            { key: 'principal', label: 'Principal', color: 'var(--chart-1)' },
            { key: 'interest', label: 'Interest', color: 'var(--chart-4)' },
          ]}
          currency={account.currency}
          height="h-[240px] md:h-[300px]"
        />
      )}

      {view === 'split' && activeInstallment && (
        <div className="space-y-4 rounded-[var(--radius-lg)] border border-line bg-inset p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="type-body-strong text-ink">
                Installment #{activeInstallment.paymentNumber} · {shortMonthYear(activeInstallment.date)}
              </p>
              <p className="type-caption text-muted">
                {principalPct.toFixed(0)}% toward principal · {interestPct.toFixed(0)}% interest
              </p>
            </div>
            <Badge tone={activeInstallment.status === 'Paid' ? 'positive' : activeInstallment.status === 'Overdue' ? 'negative' : 'neutral'}>
              {activeInstallment.status}
            </Badge>
          </div>

          <div
            role="img"
            aria-label={`Payment breakdown: ${principalPct}% principal and ${interestPct}% interest`}
            className="flex h-4 w-full overflow-hidden rounded-full bg-solid"
          >
            <div
              className="h-full transition-[width] duration-300"
              style={{ width: `${principalPct}%`, backgroundColor: 'var(--chart-1)' }}
            />
            <div
              className="h-full transition-[width] duration-300"
              style={{ width: `${interestPct}%`, backgroundColor: 'var(--chart-4)' }}
            />
          </div>

          <Figures
            items={[
              {
                label: 'Principal',
                value: <Amount value={activeInstallment.principal} currency={account.currency} />,
                note: `${principalPct.toFixed(1)}% of payment`,
              },
              {
                label: 'Interest',
                value: <Amount value={activeInstallment.interest} currency={account.currency} />,
                note: `${interestPct.toFixed(1)}% of payment`,
              },
              {
                label: 'Remaining balance',
                value: <Amount value={activeInstallment.outstandingBalance} currency={account.currency} />,
                note: <>Payment <Amount value={activeInstallment.totalPayment} currency={account.currency} /></>,
              },
            ]}
          />

          {maxPaymentNum > minPaymentNum && (
            <Slider
              label="Scrub installment"
              value={activeInstallment.paymentNumber}
              minValue={minPaymentNum}
              maxValue={maxPaymentNum}
              step={1}
              onChange={val => setSelectedPaymentNum(Array.isArray(val) ? val[0] : val)}
            />
          )}
        </div>
      )}

      {trajectory.milestones.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-1.5 type-label text-muted">
            <Icon name="flag" size={14} />
            <span>Repayment milestones</span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {trajectory.milestones.map(milestone => (
              <button
                key={milestone.id}
                type="button"
                onClick={() => {
                  setSelectedPaymentNum(milestone.paymentNumber);
                  setView('split');
                }}
                className="flex cursor-pointer flex-col justify-between gap-1.5 rounded-[var(--radius-lg)] border border-line bg-inset p-3 text-left transition-colors hover:border-line-strong"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="type-caption font-semibold text-ink">{milestone.label}</span>
                  <Badge tone={milestone.reached ? 'positive' : 'neutral'}>
                    {milestone.reached ? 'Reached' : shortMonthYear(milestone.date)}
                  </Badge>
                </div>
                <p className="type-caption text-muted">{milestone.detail}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MortgageAmortizationChart;
