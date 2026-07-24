import React from 'react';
import { motion } from 'motion/react';
import { Currency } from '../types';
import { formatCurrency } from '../utils';

export interface BudgetProgressBarProps {
  spent: number;
  budgeted: number;
  currency?: Currency;
  categoryName?: string;
  categoryColor?: string;
  warningThreshold?: number; // e.g. 80 for 80%
  criticalThreshold?: number; // e.g. 100 for 100%
  variant?: 'default' | 'compact' | 'detailed' | 'minimal';
  showLabels?: boolean;
  showValues?: boolean;
  showPercentage?: boolean;
  showThresholdTicks?: boolean;
  className?: string;
  onEdit?: () => void;
}

export const BudgetProgressBar: React.FC<BudgetProgressBarProps> = ({
  spent,
  budgeted,
  currency = 'EUR',
  categoryName,
  categoryColor,
  warningThreshold = 80,
  criticalThreshold = 100,
  variant = 'default',
  showLabels = true,
  showValues = true,
  showPercentage = true,
  showThresholdTicks = true,
  className = '',
  onEdit,
}) => {
  const hasBudget = budgeted > 0;
  const percentage = hasBudget ? (spent / budgeted) * 100 : 0;
  const remaining = hasBudget ? budgeted - spent : 0;
  const isOverBudget = percentage >= criticalThreshold;
  const isNearingLimit = percentage >= warningThreshold && percentage < criticalThreshold;

  // Status Styling
  let barGradient = 'from-primary-500 to-indigo-600';
  let barGlow = 'shadow-[0_0_12px_rgba(99,102,241,0.4)]';
  let textColor = 'text-primary-600 dark:text-primary-400';
  let badgeBg = 'bg-primary-500/10 text-primary-600 dark:text-primary-400 border-primary-500/20';
  let statusText = 'On Track';
  let statusIcon = 'check_circle';

  if (isOverBudget) {
    barGradient = 'from-rose-500 via-red-500 to-rose-600';
    barGlow = 'shadow-[0_0_16px_rgba(244,63,94,0.6)]';
    textColor = 'text-rose-600 dark:text-rose-400';
    badgeBg = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 animate-pulse';
    statusText = `Over Limit by ${formatCurrency(Math.abs(remaining), currency)}`;
    statusIcon = 'warning';
  } else if (isNearingLimit) {
    barGradient = 'from-amber-400 via-amber-500 to-orange-500';
    barGlow = 'shadow-[0_0_14px_rgba(245,158,11,0.5)]';
    textColor = 'text-amber-600 dark:text-amber-400';
    badgeBg = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
    statusText = `Nearing Limit (${percentage.toFixed(0)}%)`;
    statusIcon = 'error';
  }

  // Variant: Minimal (just the track + fill bar)
  if (variant === 'minimal') {
    return (
      <div className={`w-full ${className}`}>
        <div className="relative w-full bg-black/5 dark:bg-white/10 rounded-full h-2 overflow-hidden border border-black/5 dark:border-white/5">
          <motion.div
            className={`h-full rounded-full bg-gradient-to-r ${barGradient} ${barGlow}`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(percentage, 100)}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </div>
    );
  }

  // Variant: Compact (For list rows or widgets)
  if (variant === 'compact') {
    return (
      <div className={`space-y-1.5 w-full ${className}`}>
        {(showLabels || showPercentage) && (
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              {categoryName && (
                <span className="font-bold tracking-tight text-light-text dark:text-dark-text truncate">
                  {categoryName}
                </span>
              )}
              {isNearingLimit && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Nearing Limit
                </span>
              )}
              {isOverBudget && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  Over Limit
                </span>
              )}
            </div>
            {showPercentage && (
              <span className={`font-black tracking-tight ${textColor}`}>
                {percentage.toFixed(0)}%
              </span>
            )}
          </div>
        )}

        <div className="relative w-full bg-black/5 dark:bg-white/10 rounded-full h-2 overflow-hidden border border-black/5 dark:border-white/5">
          <motion.div
            className={`h-full rounded-full bg-gradient-to-r ${barGradient} ${barGlow}`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(percentage, 100)}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>

        {showValues && (
          <div className="flex justify-between text-[11px] font-medium text-light-text-secondary dark:text-dark-text-secondary">
            <span>{formatCurrency(spent, currency)} spent</span>
            <span className={remaining < 0 ? 'text-rose-500 font-bold' : ''}>
              {formatCurrency(budgeted, currency)} cap
            </span>
          </div>
        )}
      </div>
    );
  }

  // Variant: Detailed / Default (For Budget cards and primary budget view)
  return (
    <div className={`space-y-3.5 w-full ${className}`}>
      {/* Top Header Row */}
      {(showLabels || showValues) && (
        <div className="flex justify-between items-end gap-2">
          <div className="space-y-1">
            {categoryName && (
              <h4 className="font-bold text-sm tracking-tight text-light-text dark:text-dark-text leading-none flex items-center gap-2">
                {categoryName}
              </h4>
            )}
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeBg}`}>
                <span className="material-symbols-outlined text-[13px] leading-none">{statusIcon}</span>
                {statusText}
              </span>
            </div>
          </div>

          <div className="text-right space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-50 block leading-none">
              {remaining >= 0 ? 'Remaining' : 'Exceeded By'}
            </span>
            <span className={`text-base font-black tracking-tight privacy-blur leading-none ${remaining >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {formatCurrency(Math.abs(remaining), currency)}
            </span>
          </div>
        </div>
      )}

      {/* Visual Progress Track */}
      <div className="relative w-full">
        <div className="relative w-full bg-black/5 dark:bg-white/10 rounded-full h-3 overflow-hidden border border-black/5 dark:border-white/5 p-[1px]">
          <motion.div
            className={`h-full rounded-full bg-gradient-to-r ${barGradient} ${barGlow}`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(percentage, 100)}%` }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          />
        </div>

        {/* Threshold Markers (80% warning and 100% limit ticks) */}
        {showThresholdTicks && (
          <div className="absolute top-0 left-0 right-0 h-3 pointer-events-none">
            {/* 80% Tick */}
            <div
              className="absolute top-0 bottom-0 w-[2px] bg-amber-500/60 z-10"
              style={{ left: `${warningThreshold}%` }}
              title={`Warning Threshold (${warningThreshold}%)`}
            />
            {/* 100% Tick */}
            <div
              className="absolute top-0 bottom-0 w-[2px] bg-rose-500/80 z-10"
              style={{ left: `${Math.min(criticalThreshold, 100)}%` }}
              title={`Monthly Limit (${criticalThreshold}%)`}
            />
          </div>
        )}
      </div>

      {/* Bottom Metrics Row */}
      <div className="flex justify-between items-center text-[10px] font-bold tracking-wide text-light-text-secondary dark:text-dark-text-secondary">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
          <span className="opacity-60">Utilized:</span>
          <span className={`font-black ${textColor}`}>{percentage.toFixed(0)}%</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
            <span className="opacity-60">Spent: </span>
            <span className="font-black text-light-text dark:text-dark-text privacy-blur">
              {formatCurrency(spent, currency)}
            </span>
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
            <span className="opacity-60">Limit: </span>
            <span className="font-black text-primary-500 privacy-blur">
              {formatCurrency(budgeted, currency)}
            </span>
          </div>
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-light-text dark:text-dark-text"
              title="Edit Budget"
            >
              <span className="material-symbols-outlined text-sm leading-none">edit</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BudgetProgressBar;
