import React, { useState } from 'react';
import { Account, InvestmentTransaction, Warrant, HoldingsOverview, Currency } from '../types';
import { formatCurrency } from '../utils';
import Icon from './ui/Icon';
import SwipeableRow from './SwipeableRow';
import PullToRefresh from './PullToRefresh';
import FloatingActionButton from './FloatingActionButton';

interface MobileInvestmentsViewProps {
  accounts: Account[];
  investmentTransactions: InvestmentTransaction[];
  holdingsOverview?: HoldingsOverview;
  onOpenHoldingDetail: (symbol: string) => void;
  onAddTransaction: () => void;
  onViewAccount?: (accountId: string) => void;
  preferredCurrency?: string;
  conversionRates?: any;
  onRefreshData?: () => Promise<void>;
}

type InvestmentSegment = 'all' | 'Warrant' | 'Standard';

export const MobileInvestmentsView: React.FC<MobileInvestmentsViewProps> = ({
  accounts,
  investmentTransactions,
  holdingsOverview,
  onOpenHoldingDetail,
  onAddTransaction,
  onViewAccount,
  preferredCurrency = 'EUR',
  conversionRates,
  onRefreshData,
}) => {
  const [activeSegment, setActiveSegment] = useState<InvestmentSegment>('all');
  const [viewTab, setViewTab] = useState<'holdings' | 'accounts'>('holdings');

  const curr = preferredCurrency as Currency;

  const handleRefresh = async () => {
    if (onRefreshData) {
      await onRefreshData();
    } else {
      await new Promise((res) => setTimeout(res, 800));
    }
  };

  const totalPortfolioValue = holdingsOverview?.totalValue || 0;
  const totalCostBasis = holdingsOverview?.totalCostBasis || 0;
  const totalUnrealizedGain = totalPortfolioValue - totalCostBasis;
  const totalGainPercent = totalCostBasis > 0 ? (totalUnrealizedGain / totalCostBasis) * 100 : 0;

  const holdings = holdingsOverview?.holdings || [];

  const filteredHoldings = holdings.filter((h) => {
    if (activeSegment === 'all') return true;
    return h.type === activeSegment;
  });

  const investmentAccounts = accounts.filter((a) => a.type === 'Investment');

  const segments: { id: InvestmentSegment; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'Standard', label: 'Standard' },
    { id: 'Warrant', label: 'Warrants' },
  ];

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="space-y-5 pb-24 animate-fade-in md:hidden relative">
        {/* Header */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-70">
              Wealth & Portfolio
            </p>
            <h1 className="text-2xl font-extrabold text-light-text dark:text-white tracking-tight">
              Investments
            </h1>
          </div>

          <button
            onClick={onAddTransaction}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-2xl bg-teal-500 hover:bg-teal-600 text-white shadow-lg shadow-teal-500/25 flex items-center justify-center active:scale-95 touch-feedback transition-all"
            aria-label="Add Investment"
          >
            <Icon name="add" className="text-2xl" />
          </button>
        </div>

        {/* Hero Portfolio Card */}
        <div className="relative overflow-hidden rounded-[2.2rem] bg-gradient-to-br from-teal-950 via-slate-900 to-emerald-950 p-6 text-white shadow-xl border border-teal-500/20">
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 space-y-3">
            <div className="flex items-center justify-between text-xs text-teal-200/70 font-bold uppercase tracking-wider">
              <span>Investment Portfolio</span>
              <span>{preferredCurrency}</span>
            </div>

            <div>
              <h2 className="text-3xl font-black tracking-tight text-white privacy-blur">
                {formatCurrency(totalPortfolioValue, curr)}
              </h2>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <div>
                <span className="text-[10px] font-semibold text-white/60 uppercase block">Total Gain/Loss</span>
                <span
                  className={`text-xs font-black privacy-blur ${
                    totalUnrealizedGain >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {totalUnrealizedGain >= 0 ? '+' : ''}
                  {formatCurrency(totalUnrealizedGain, curr)} ({totalGainPercent.toFixed(2)}%)
                </span>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-semibold text-white/60 uppercase block">Holdings Count</span>
                <span className="text-xs font-black text-white">{holdings.length} Positions</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Switcher: Holdings vs Accounts */}
        <div className="flex items-center p-1 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5">
          <button
            onClick={() => setViewTab('holdings')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all min-h-[38px] touch-feedback ${
              viewTab === 'holdings'
                ? 'bg-white dark:bg-dark-card text-teal-600 dark:text-teal-400 shadow-sm'
                : 'text-light-text-secondary dark:text-dark-text-secondary opacity-60'
            }`}
          >
            Holdings ({holdings.length})
          </button>
          <button
            onClick={() => setViewTab('accounts')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all min-h-[38px] touch-feedback ${
              viewTab === 'accounts'
                ? 'bg-white dark:bg-dark-card text-teal-600 dark:text-teal-400 shadow-sm'
                : 'text-light-text-secondary dark:text-dark-text-secondary opacity-60'
            }`}
          >
            Accounts ({investmentAccounts.length})
          </button>
        </div>

        {viewTab === 'holdings' && (
          <>
            {/* Segment Filter Strip */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-touch py-0.5">
              {segments.map((seg) => {
                const isActive = activeSegment === seg.id;
                return (
                  <button
                    key={seg.id}
                    onClick={() => setActiveSegment(seg.id)}
                    className={`touch-feedback px-3.5 py-1.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap min-h-[36px] border ${
                      isActive
                        ? 'bg-teal-500 text-white border-teal-500 shadow-sm'
                        : 'bg-white/80 dark:bg-dark-card/80 border-black/5 dark:border-white/10 text-light-text-secondary dark:text-dark-text-secondary'
                    }`}
                  >
                    {seg.label}
                  </button>
                );
              })}
            </div>

            {/* Holdings Stack */}
            <div className="space-y-2.5">
              {filteredHoldings.map((h) => {
                const valueEur = h.currentValue || 0;
                const gainEur = h.currentValue - h.totalCost;
                const gainPct = h.totalCost > 0 ? (gainEur / h.totalCost) * 100 : 0;

                return (
                  <SwipeableRow
                    key={h.symbol}
                    rightActions={[
                      {
                        icon: 'analytics',
                        bgClass: 'bg-teal-500',
                        label: 'Detail',
                        onAction: () => onOpenHoldingDetail(h.symbol),
                      },
                    ]}
                  >
                    <div
                      onClick={() => onOpenHoldingDetail(h.symbol)}
                      className="bg-white/90 dark:bg-dark-card/90 backdrop-blur-md rounded-2xl p-4 border border-black/5 dark:border-white/10 shadow-sm flex items-center justify-between gap-3 min-h-[64px] touch-feedback cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-11 h-11 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 font-black text-xs flex items-center justify-center shrink-0 border border-teal-500/20">
                          {h.symbol.slice(0, 4)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-light-text dark:text-white truncate">
                            {h.name || h.symbol}
                          </p>
                          <p className="text-[10px] font-semibold text-light-text-secondary dark:text-dark-text-secondary opacity-70 truncate mt-0.5">
                            {h.quantity} shares • {h.subType || h.type}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-xs font-extrabold text-light-text dark:text-white privacy-blur">
                          {formatCurrency(valueEur, curr)}
                        </p>
                        <p
                          className={`text-[10px] font-extrabold privacy-blur mt-0.5 ${
                            gainEur >= 0 ? 'text-emerald-500' : 'text-rose-500'
                          }`}
                        >
                          {gainEur >= 0 ? '+' : ''}
                          {gainPct.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </SwipeableRow>
                );
              })}

              {filteredHoldings.length === 0 && (
                <div className="text-center py-12 bg-white/60 dark:bg-dark-card/60 rounded-3xl border border-black/5 dark:border-white/5 p-6">
                  <Icon name="candlestick_chart" className="text-4xl text-gray-400 mb-2" />
                  <p className="text-sm font-bold text-light-text dark:text-white">No holdings found</p>
                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                    Tap the button below to add your first investment position.
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {viewTab === 'accounts' && (
          <div className="space-y-2.5">
            {investmentAccounts.map((acc) => (
              <div
                key={acc.id}
                onClick={() => onViewAccount && onViewAccount(acc.id)}
                className="bg-white/90 dark:bg-dark-card/90 backdrop-blur-md rounded-2xl p-4 border border-black/5 dark:border-white/10 shadow-sm flex items-center justify-between gap-3 min-h-[64px] touch-feedback cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-11 h-11 rounded-2xl bg-teal-500/10 text-teal-500 flex items-center justify-center shrink-0 border border-teal-500/20">
                    <Icon name="show_chart" className="text-xl" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-light-text dark:text-white truncate">
                      {acc.name}
                    </p>
                    <p className="text-[10px] font-semibold text-light-text-secondary dark:text-dark-text-secondary opacity-70 truncate mt-0.5">
                      {acc.type} {acc.subType ? `• ${acc.subType}` : ''}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-xs font-extrabold text-light-text dark:text-white privacy-blur">
                    {formatCurrency(acc.balance, (acc.currency || curr) as Currency)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <FloatingActionButton onClick={onAddTransaction} label="Add Investment" />
      </div>
    </PullToRefresh>
  );
};
