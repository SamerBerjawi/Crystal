import React from 'react';
import { RecurringTransaction, Currency } from '../types';
import { formatCurrency } from '../utils';
import Icon from './ui/Icon';
import SwipeableRow from './SwipeableRow';
import PullToRefresh from './PullToRefresh';
import FloatingActionButton from './FloatingActionButton';

interface MobileSubscriptionsViewProps {
  subscriptions: RecurringTransaction[];
  totalMonthlyCost: number;
  totalAnnualCost: number;
  onAddSubscription: () => void;
  onEditSubscription: (sub: RecurringTransaction) => void;
  onDeleteSubscription: (id: string) => void;
  preferredCurrency?: string;
  onRefreshData?: () => Promise<void>;
}

export const MobileSubscriptionsView: React.FC<MobileSubscriptionsViewProps> = ({
  subscriptions,
  totalMonthlyCost,
  totalAnnualCost,
  onAddSubscription,
  onEditSubscription,
  onDeleteSubscription,
  preferredCurrency = 'EUR',
  onRefreshData,
}) => {
  const curr = preferredCurrency as Currency;

  const handleRefresh = async () => {
    if (onRefreshData) {
      await onRefreshData();
    } else {
      await new Promise((res) => setTimeout(res, 800));
    }
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="space-y-5 pb-24 animate-fade-in md:hidden relative">
        {/* Header */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-70">
              Recurring Outflows
            </p>
            <h1 className="text-2xl font-extrabold text-light-text dark:text-white tracking-tight">
              Subscriptions
            </h1>
          </div>

          <button
            onClick={onAddSubscription}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-2xl bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/25 flex items-center justify-center active:scale-95 touch-feedback transition-all"
            aria-label="Add Subscription"
          >
            <Icon name="add" className="text-2xl" />
          </button>
        </div>

        {/* Hero Card */}
        <div className="relative overflow-hidden rounded-[2.2rem] bg-gradient-to-br from-rose-950 via-slate-900 to-indigo-950 p-6 text-white shadow-xl border border-rose-500/20">
          <div className="relative z-10 space-y-3">
            <div className="flex items-center justify-between text-xs text-rose-200/70 font-bold uppercase tracking-wider">
              <span>Monthly Subscriptions</span>
              <span>{preferredCurrency}</span>
            </div>

            <div>
              <h2 className="text-3xl font-black tracking-tight text-white privacy-blur">
                {formatCurrency(totalMonthlyCost, curr)} <span className="text-sm font-bold opacity-60">/ mo</span>
              </h2>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <div>
                <span className="text-[10px] font-semibold text-white/60 uppercase block">Annualized Expense</span>
                <span className="text-xs font-black text-rose-300 privacy-blur">
                  {formatCurrency(totalAnnualCost, curr)} / yr
                </span>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-semibold text-white/60 uppercase block">Active Services</span>
                <span className="text-xs font-black text-white">{subscriptions.length} Active</span>
              </div>
            </div>
          </div>
        </div>

        {/* Subscriptions Stack */}
        <div className="space-y-2.5">
          {subscriptions.map((sub) => {
            const subCurrency = (sub.currency || curr) as Currency;

            return (
              <SwipeableRow
                key={sub.id}
                rightActions={[
                  {
                    icon: 'edit',
                    bgClass: 'bg-amber-500',
                    label: 'Edit',
                    onAction: () => onEditSubscription(sub),
                  },
                  {
                    icon: 'delete',
                    bgClass: 'bg-rose-500',
                    label: 'Cancel',
                    onAction: () => onDeleteSubscription(sub.id),
                  },
                ]}
              >
                <div
                  onClick={() => onEditSubscription(sub)}
                  className="bg-white/90 dark:bg-dark-card/90 backdrop-blur-md rounded-2xl p-4 border border-black/5 dark:border-white/10 shadow-sm flex items-center justify-between gap-3 min-h-[64px] touch-feedback cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-11 h-11 rounded-2xl bg-rose-500/10 text-rose-500 font-bold flex items-center justify-center shrink-0 border border-rose-500/20">
                      <Icon name="refresh" className="text-xl" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-light-text dark:text-white truncate">
                        {sub.description}
                      </p>
                      <p className="text-[10px] font-semibold text-light-text-secondary dark:text-dark-text-secondary opacity-70 truncate mt-0.5">
                        {sub.frequency} • Next: {sub.nextDueDate}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-xs font-extrabold text-rose-600 dark:text-rose-400 privacy-blur">
                      {formatCurrency(sub.amount, subCurrency)}
                    </p>
                    <span className="text-[9px] font-bold text-gray-400 block mt-0.5 uppercase">
                      {sub.category || 'Recurring'}
                    </span>
                  </div>
                </div>
              </SwipeableRow>
            );
          })}

          {subscriptions.length === 0 && (
            <div className="text-center py-12 bg-white/60 dark:bg-dark-card/60 rounded-3xl border border-black/5 dark:border-white/5 p-6">
              <Icon name="refresh" className="text-4xl text-gray-400 mb-2" />
              <p className="text-sm font-bold text-light-text dark:text-white">No active subscriptions</p>
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                Track your recurring software, streaming, and membership charges.
              </p>
              <button
                onClick={onAddSubscription}
                className="mt-4 px-4 py-2 rounded-xl bg-rose-500 text-white text-xs font-bold shadow-md touch-feedback"
              >
                Add Subscription
              </button>
            </div>
          )}
        </div>

        <FloatingActionButton onClick={onAddSubscription} label="Add Subscription" />
      </div>
    </PullToRefresh>
  );
};
