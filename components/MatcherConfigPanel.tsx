import React from 'react';
import { MatcherConfig, DEFAULT_MATCHER_CONFIG } from '../hooks/useMatcherConfig';
import { BTN_SECONDARY_STYLE } from '../constants';

interface MatcherConfigPanelProps {
  config: MatcherConfig;
  onChange: (updates: Partial<MatcherConfig>) => void;
  onReset: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const MatcherConfigPanel: React.FC<MatcherConfigPanelProps> = ({
  config,
  onChange,
  onReset,
  isOpen = true,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-white/90 dark:bg-dark-card/90 backdrop-blur-md border border-emerald-500/20 shadow-xl space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400">tune</span>
          <div>
            <h4 className="font-bold text-sm text-light-text dark:text-dark-text">Transaction Matching Thresholds</h4>
            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
              Configure strictness rules for detecting synced bank matches & recurring items.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onReset}
            className={`${BTN_SECONDARY_STYLE} !py-1 !px-2.5 !text-[11px]`}
            title="Reset to default matching rules"
          >
            Reset Defaults
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-light-text-secondary hover:text-light-text dark:hover:text-dark-text p-1 rounded-lg"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Slider 1: Amount Variance % */}
        <div className="space-y-2 bg-light-bg dark:bg-dark-bg p-3.5 rounded-xl border border-black/5 dark:border-white/5">
          <div className="flex justify-between items-center text-xs font-bold">
            <span className="text-light-text dark:text-dark-text">Amount Variance Tolerance</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-black px-2 py-0.5 rounded-md bg-emerald-500/10">
              ±{config.amountVariancePercent}%
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="25"
            step="1"
            value={config.amountVariancePercent}
            onChange={e => onChange({ amountVariancePercent: Number(e.target.value) })}
            className="w-full accent-emerald-600 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-light-text-secondary dark:text-dark-text-secondary">
            <span>±1% (Strict)</span>
            <span>±25% (Relaxed)</span>
          </div>
        </div>

        {/* Slider 2: Date Flexibility (Days) */}
        <div className="space-y-2 bg-light-bg dark:bg-dark-bg p-3.5 rounded-xl border border-black/5 dark:border-white/5">
          <div className="flex justify-between items-center text-xs font-bold">
            <span className="text-light-text dark:text-dark-text">Date Flexibility</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-black px-2 py-0.5 rounded-md bg-emerald-500/10">
              ±{config.dateVarianceDays} Days
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="7"
            step="1"
            value={config.dateVarianceDays}
            onChange={e => onChange({ dateVarianceDays: Number(e.target.value) })}
            className="w-full accent-emerald-600 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-light-text-secondary dark:text-dark-text-secondary">
            <span>±1 Day</span>
            <span>±7 Days</span>
          </div>
        </div>

        {/* Slider 3: Lookback Window (Days) */}
        <div className="space-y-2 bg-light-bg dark:bg-dark-bg p-3.5 rounded-xl border border-black/5 dark:border-white/5">
          <div className="flex justify-between items-center text-xs font-bold">
            <span className="text-light-text dark:text-dark-text">Transaction Lookback</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-black px-2 py-0.5 rounded-md bg-emerald-500/10">
              Last {config.lookbackDays} Days
            </span>
          </div>
          <input
            type="range"
            min="3"
            max="30"
            step="1"
            value={config.lookbackDays}
            onChange={e => onChange({ lookbackDays: Number(e.target.value) })}
            className="w-full accent-emerald-600 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-light-text-secondary dark:text-dark-text-secondary">
            <span>3 Days</span>
            <span>30 Days</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MatcherConfigPanel;
