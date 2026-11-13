import React, { useMemo, useState } from 'react';
import { calculateAccountTotals, getDateRange, getMainCurrency } from '../utils';
import type { Duration } from '../types';
import { bridgeBars, bridgeHeadline, buildNetWorthBridge, type BridgeStep } from '../utils/netWorthBridge';
import { useAccountSelector, useTransactionSelector } from '../contexts/DomainProviders';
import { useScheduleContext } from '../contexts/FinancialDataContext';
import { Amount } from './ui/Money';

/** What moved your net worth over the dashboard's period: where it started, what came in and went out, where it ended. */
const NetWorthBridgeWidget: React.FC<{ duration: Duration; accountIds: string[] }> = ({ duration, accountIds }) => {
  const accounts = useAccountSelector(a => a);
  const transactions = useTransactionSelector(t => t);
  const { loanPaymentOverrides } = useScheduleContext();
  const currency = getMainCurrency();
  const today = useMemo(() => new Date(), []);
  const [open, setOpen] = useState<string | null>(null);

  const scoped = useMemo(() => {
    const chosen = new Set(accountIds);
    return accounts.filter(a => chosen.has(a.id) && (a.includeInAnalytics ?? true));
  }, [accounts, accountIds]);
  const range = useMemo(() => getDateRange(duration, transactions), [duration, transactions]);
  const scopedTransactions = useMemo(() => {
    const ids = new Set(scoped.map(a => a.id));
    return transactions.filter(tx => !tx.isSplitParent && !tx.isCombinedParent && ids.has(tx.accountId));
  }, [transactions, scoped]);
  const netWorth = useMemo(() => calculateAccountTotals(scoped, scopedTransactions, loanPaymentOverrides).netWorth, [scoped, scopedTransactions, loanPaymentOverrides]);
  const names = useMemo(() => new Map(accounts.map(a => [a.id, a.name])), [accounts]);

  const bridge = useMemo(() => buildNetWorthBridge({
    transactions: scopedTransactions, selectedAccountIds: scoped.map(a => a.id), netWorth, start: range.start, end: range.end, today, accountNames: names,
  }), [scopedTransactions, scoped, netWorth, range, today, names]);
  const { bars, min, max, truncated } = useMemo(() => bridgeBars(bridge), [bridge]);
  const headline = bridgeHeadline(bridge);
  const span = max - min || 1;
  const pos = (v: number) => ((v - min) / span) * 100;

  const rows: { key: string; label: string; from: number; to: number; step?: BridgeStep; total?: boolean }[] = [
    { key: 'start', label: 'Start', from: min, to: bridge.startValue, total: true },
    ...bars.map(b => ({ key: b.step.kind, label: b.step.label, from: b.from, to: b.to, step: b.step })),
    { key: 'end', label: 'End', from: min, to: bridge.endValue, total: true },
  ];

  return (
    <div className="h-full overflow-y-auto">
      {!bridge.hasActivity ? (
        <p className="type-body text-muted">Nothing happened in this period. Pick a longer one to see what moved your net worth.</p>
      ) : (
        <>
          <p className="type-body mt-2 text-ink">
            Net worth went {headline.direction === 'flat' ? 'nowhere' : headline.direction}
            {headline.direction !== 'flat' && <> by <Amount value={Math.abs(bridge.change)} currency={currency} className="type-body-strong" />
              {bridge.changePct !== undefined && <> ({Math.round(Math.abs(bridge.changePct) * 1000) / 10}%)</>}</>}
            {headline.driver && <>, mostly from {headline.driver.label.toLowerCase()}</>}.
          </p>
          <p className="type-caption mt-0.5 text-muted">{bridge.start} to {bridge.end}</p>
          <ul className="mt-4 space-y-1">
            {rows.map(row => {
              const lo = Math.min(row.from, row.to);
              const hi = Math.max(row.from, row.to);
              const tone = row.total ? 'bg-primary' : row.to >= row.from ? 'bg-money-in' : 'bg-money-out';
              const value = row.total ? row.to : (row.step?.amount ?? 0);
              const expandable = !!row.step && row.step.details.length > 0;
              return (
                <li key={row.key}>
                  <button
                    type="button"
                    disabled={!expandable}
                    aria-expanded={expandable ? open === row.key : undefined}
                    onClick={() => setOpen(open === row.key ? null : row.key)}
                    className="grid w-full grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-3 rounded-[var(--radius-md)] px-2 py-2 text-left enabled:cursor-pointer enabled:hover:bg-inset focus-visible:outline-2 focus-visible:outline-[var(--focus)] md:grid-cols-[14rem_minmax(0,1fr)_8rem]"
                  >
                    <span className="type-body truncate text-ink">{row.label}{row.step ? <span className="type-caption ml-1.5 text-muted">{row.step.count}</span> : null}</span>
                    <span className="relative block h-5 rounded bg-inset" aria-hidden>
                      <span className={`absolute top-0 h-full rounded ${tone}`} style={{ left: `${pos(lo)}%`, width: `${Math.max(pos(hi) - pos(lo), 0.8)}%` }} />
                    </span>
                    <Amount value={value} currency={currency} tone={row.total ? 'plain' : 'flow'} className="type-body-strong text-right text-ink" />
                  </button>
                  {open === row.key && row.step && (
                    <ul className="mb-2 ml-4 space-y-1 border-l border-line pl-4">
                      {row.step.details.map(d => (
                        <li key={d.label} className="flex items-center justify-between gap-3 py-0.5">
                          <span className="type-caption truncate text-muted">{d.label}</span>
                          <Amount value={d.amount} currency={currency} tone="flow" className="type-caption text-ink" />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="type-caption mt-3 text-muted">
            {truncated && <>The bars start at <Amount value={min} currency={currency} className="type-caption" />, not at zero, so the changes stay readable. </>}
            Follows the period and accounts chosen above. Uses today's exchange rates. Market gains are the ones you recorded as market adjustments.
          </p>
        </>
      )}
    </div>
  );
};

export default NetWorthBridgeWidget;
