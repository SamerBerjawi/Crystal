import React, { useMemo, useState } from 'react';
import { calculateAccountTotals, getDateRange, getMainCurrency } from '../utils';
import type { Duration } from '../types';
import { bridgeBars, bridgeHeadline, buildNetWorthBridge, type BridgeKind, type BridgeStep } from '../utils/netWorthBridge';
import { useAccountSelector, useTransactionSelector } from '../contexts/DomainProviders';
import { useCategoryContext, useScheduleContext } from '../contexts/FinancialDataContext';
import { getCategoryDetails } from '../utils/categories';
import { formatShortDate } from '../utils/dateFormat';
import { AccountLogo } from './AccountCard';
import { EntityGlyph } from './EntityIcon';
import { Badge } from './ui/Display';
import Icon from './ui/Icon';
import { Amount } from './ui/Money';
import { cn } from '../lib/utils';

const STEP_ICON: Record<BridgeKind, string> = {
  income: 'arrow-down-02',
  spending: 'arrow-up-02',
  market: 'chart-increase',
  corrections: 'sliders-horizontal',
  transfers: 'arrow-data-transfer-horizontal',
};

interface NetWorthBridgeWidgetProps {
  duration: Duration;
  accountIds: string[];
  customRange?: { start: Date; end: Date };
}

/** What moved your net worth over the period: where it started, what came in and went out, where it ended. */
const NetWorthBridgeWidget: React.FC<NetWorthBridgeWidgetProps> = ({ duration, accountIds, customRange }) => {
  const accounts = useAccountSelector(a => a);
  const transactions = useTransactionSelector(t => t);
  const { loanPaymentOverrides } = useScheduleContext();
  const { incomeCategories, expenseCategories } = useCategoryContext();
  const currency = getMainCurrency();
  const today = useMemo(() => new Date(), []);
  const [open, setOpen] = useState<string | null>(null);

  const allCategories = useMemo(
    () => [...(expenseCategories || []), ...(incomeCategories || [])],
    [expenseCategories, incomeCategories],
  );

  const scoped = useMemo(() => {
    const chosen = new Set(accountIds);
    return accounts.filter(a => (chosen.size === 0 || chosen.has(a.id)) && (a.includeInAnalytics ?? true));
  }, [accounts, accountIds]);

  const range = useMemo(
    () => customRange ?? getDateRange(duration, transactions),
    [customRange, duration, transactions],
  );

  const scopedTransactions = useMemo(() => {
    const ids = new Set(scoped.map(a => a.id));
    return transactions.filter(tx => !tx.isSplitParent && !tx.isCombinedParent && ids.has(tx.accountId));
  }, [transactions, scoped]);

  const netWorth = useMemo(
    () => calculateAccountTotals(scoped, scopedTransactions, loanPaymentOverrides).netWorth,
    [scoped, scopedTransactions, loanPaymentOverrides],
  );
  const names = useMemo(() => new Map(accounts.map(a => [a.id, a.name])), [accounts]);
  const accountByName = useMemo(() => new Map(accounts.map(a => [a.name, a])), [accounts]);

  const bridge = useMemo(() => buildNetWorthBridge({
    transactions: scopedTransactions,
    selectedAccountIds: scoped.map(a => a.id),
    netWorth,
    start: range.start,
    end: range.end,
    today,
    accountNames: names,
  }), [scopedTransactions, scoped, netWorth, range, today, names]);

  const { bars, min, max, truncated } = useMemo(() => bridgeBars(bridge), [bridge]);
  const headline = bridgeHeadline(bridge);
  const span = max - min || 1;
  const pos = (v: number) => Math.max(0, Math.min(100, ((v - min) / span) * 100));

  const rows: { key: string; label: string; icon: string; from: number; to: number; step?: BridgeStep; total?: boolean }[] = [
    { key: 'start', label: 'Start', icon: 'flag-01', from: min, to: bridge.startValue, total: true },
    ...bars.map(b => ({ key: b.step.kind, label: b.step.label, icon: STEP_ICON[b.step.kind], from: b.from, to: b.to, step: b.step })),
    { key: 'end', label: 'End', icon: 'checkmark-circle-02', from: min, to: bridge.endValue, total: true },
  ];

  const changePct = bridge.changePct !== undefined ? Math.round(Math.abs(bridge.changePct) * 1000) / 10 : null;
  const savingsPct = bridge.savingsRate !== undefined ? Math.round(bridge.savingsRate * 100) : null;

  return (
    <div className="h-full space-y-4 overflow-y-auto">
      {!bridge.hasActivity ? (
        <p className="type-body py-4 text-muted">Nothing happened in this period. Pick a longer one to see what moved your net worth.</p>
      ) : (
        <>
          {/* Headline & Date Span */}
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="type-body text-ink">
                Net worth went {headline.direction === 'flat' ? 'nowhere' : headline.direction}
                {headline.direction !== 'flat' && (
                  <>
                    {' '}by <Amount value={Math.abs(bridge.change)} currency={currency} className="type-body-strong" />
                    {changePct !== null && <> ({changePct}%)</>}
                  </>
                )}
                {headline.driver && <>, mostly from {headline.driver.label.toLowerCase()}</>}.
              </p>
              <p className="type-caption mt-0.5 text-muted">
                {formatShortDate(bridge.start)} to {formatShortDate(bridge.end)}
              </p>
            </div>
            {bridge.changePct !== undefined && (
              <Badge tone={bridge.change >= 0 ? 'positive' : 'negative'}>
                {bridge.change >= 0 ? '+' : '−'}{changePct}%
              </Badge>
            )}
          </div>

          {/* 4-Card KPI Strip */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="rounded-[var(--radius-lg)] border border-line bg-inset/40 p-3">
              <span className="type-label block text-muted">Started</span>
              <span className="type-figure-row mt-0.5 block text-ink">
                <Amount value={bridge.startValue} currency={currency} />
              </span>
            </div>
            <div className="rounded-[var(--radius-lg)] border border-line bg-inset/40 p-3">
              <span className="type-label block text-muted">Kept from income</span>
              <span className="type-figure-row mt-0.5 block">
                <Amount value={bridge.operatingSaved} currency={currency} tone="flow" />
              </span>
              {savingsPct !== null && (
                <span className="type-caption text-muted">{savingsPct}% savings rate</span>
              )}
            </div>
            <div className="rounded-[var(--radius-lg)] border border-line bg-inset/40 p-3">
              <span className="type-label block text-muted">Net change</span>
              <span className="type-figure-row mt-0.5 block">
                <Amount value={bridge.change} currency={currency} tone="flow" />
              </span>
            </div>
            <div className="rounded-[var(--radius-lg)] border border-line bg-inset/40 p-3">
              <span className="type-label block text-muted">Ended</span>
              <span className="type-figure-row mt-0.5 block text-ink">
                <Amount value={bridge.endValue} currency={currency} />
              </span>
            </div>
          </div>

          {/* Waterfall Chart Rows */}
          <ul className="space-y-1">
            {rows.map((row, index) => {
              const lo = Math.min(row.from, row.to);
              const hi = Math.max(row.from, row.to);
              const isGain = row.to >= row.from;
              const tone = row.total
                ? (row.to >= 0 ? 'bg-primary' : 'bg-money-out')
                : (isGain ? 'bg-money-in' : 'bg-money-out');
              const value = row.total ? row.to : (row.step?.amount ?? 0);
              const expandable = !!row.step && row.step.details.length > 0;
              const isOpen = open === row.key;
              const stepMax = row.step ? Math.max(...row.step.details.map(d => Math.abs(d.amount)), 1) : 1;
              const connectorLeft = !row.total ? pos(row.from) : null;

              return (
                <li key={row.key} className={cn(index === 0 && 'pb-1', index === rows.length - 1 && 'pt-1 border-t border-line/60')}>
                  <button
                    type="button"
                    disabled={!expandable}
                    aria-expanded={expandable ? isOpen : undefined}
                    onClick={() => setOpen(isOpen ? null : row.key)}
                    className={cn(
                      'grid w-full grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)_auto] items-center gap-3 rounded-[var(--radius-md)] px-2 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus)] md:grid-cols-[15rem_minmax(0,1fr)_8.5rem]',
                      expandable && 'cursor-pointer hover:bg-inset/70',
                      isOpen && 'bg-inset/70',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={cn(
                        'flex size-6 shrink-0 items-center justify-center rounded-md',
                        row.total ? 'bg-primary-soft text-primary' : isGain ? 'bg-money-in-soft text-money-in' : 'bg-money-out-soft text-money-out',
                      )}>
                        <Icon name={row.icon} size={14} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn('type-body block truncate text-ink', row.total && 'font-semibold')}>
                          {row.label}
                        </span>
                        {row.step && (
                          <span className="type-caption text-muted">
                            {row.step.count} {row.step.count === 1 ? 'entry' : 'entries'}
                          </span>
                        )}
                      </span>
                      {expandable && (
                        <Icon
                          name={isOpen ? 'chevron-up' : 'chevron-down'}
                          size={14}
                          className="shrink-0 text-muted"
                        />
                      )}
                    </span>

                    <span className="relative block h-6 rounded-[var(--radius-sm)] bg-inset" aria-hidden>
                      {connectorLeft !== null && (
                        <span
                          className="absolute top-0 bottom-0 w-px border-l border-dashed border-line-strong"
                          style={{ left: `${connectorLeft}%` }}
                        />
                      )}
                      <span
                        className={cn('absolute top-1 bottom-1 rounded-[var(--radius-sm)] transition-all duration-[var(--duration-normal)]', tone)}
                        style={{ left: `${pos(lo)}%`, width: `${Math.max(pos(hi) - pos(lo), 1.2)}%` }}
                      />
                    </span>

                    <span className="text-right">
                      <Amount
                        value={value}
                        currency={currency}
                        tone={row.total ? 'plain' : 'flow'}
                        className="type-body-strong block text-ink"
                      />
                      {!row.total && bridge.startValue > 0 && Math.abs(value) > 0 && (
                        <span className="type-caption text-muted">
                          {value >= 0 ? '+' : '−'}{((Math.abs(value) / bridge.startValue) * 100).toFixed(1)}%
                        </span>
                      )}
                    </span>
                  </button>

                  {isOpen && row.step && (
                    <ul className="mt-1 mb-2 ml-5 space-y-1.5 border-l-2 border-line pl-4 pr-2">
                      {row.step.details.map(d => {
                        const cat = d.kind === 'category' ? getCategoryDetails(d.label, allCategories) : undefined;
                        const acc = d.kind === 'account' ? accountByName.get(d.label) : undefined;
                        const fillPct = Math.max(4, Math.min(100, (Math.abs(d.amount) / stepMax) * 100));
                        return (
                          <li key={d.label} className="flex items-center justify-between gap-3 py-1">
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              {acc ? (
                                <AccountLogo account={acc} size={20} />
                              ) : d.kind === 'category' ? (
                                <EntityGlyph icon={cat?.icon} label={d.label} color={cat?.color} size={16} />
                              ) : (
                                <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-inset text-muted">
                                  <Icon name="more-horizontal" size={12} />
                                </span>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-1.5">
                                  <span className="type-caption truncate font-medium text-ink">{d.label}</span>
                                  {d.count !== undefined && (
                                    <span className="type-caption text-muted">({d.count})</span>
                                  )}
                                </div>
                                <div className="mt-0.5 h-1 w-full max-w-[140px] overflow-hidden rounded-full bg-inset">
                                  <div
                                    className={cn('h-full rounded-full', d.amount >= 0 ? 'bg-money-in' : 'bg-money-out')}
                                    style={{ width: `${fillPct}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                            <Amount value={d.amount} currency={currency} tone="flow" className="type-caption shrink-0 font-semibold text-ink" />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>

          <p className="type-caption text-muted">
            {truncated && <>The bars start at <Amount value={min} currency={currency} className="type-caption" />, not at zero, so the moves stay readable. </>}
            {customRange ? 'Follows the report period and accounts chosen above.' : 'Follows the period and accounts chosen above.'} Uses today&apos;s exchange rates. Market gains are the ones you recorded as market adjustments.
          </p>
        </>
      )}
    </div>
  );
};

export default NetWorthBridgeWidget;
