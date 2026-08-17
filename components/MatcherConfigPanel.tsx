import React from 'react';
import { MatcherConfig, DEFAULT_MATCHER_CONFIG } from '../hooks/useMatcherConfig';
import { BTN_SECONDARY_STYLE } from '../constants';
import Icon from './ui/Icon';

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
          <Icon name="tune" className="text-emerald-600 dark:text-emerald-400" />
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
            className={`${BTN_SECONDARY_STYLE} !py-1 !px-2.5 !text-xs`}
            title="Reset to default matching rules"
          >
            Reset Defaults
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-light-text-secondary hover:text-light-text dark:hover:text-dark-text p-1 rounded-lg"
            >
              <Icon name="close" className="text-lg" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <div className="flex justify-between text-xs text-light-text-secondary dark:text-dark-text-secondary">
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
          <div className="flex justify-between text-xs text-light-text-secondary dark:text-dark-text-secondary">
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
          <div className="flex justify-between text-xs text-light-text-secondary dark:text-dark-text-secondary">
            <span>3 Days</span>
            <span>30 Days</span>
          </div>
        </div>

        {/* Slider 4: Minimum Confidence Score */}
        <div className="space-y-2 bg-light-bg dark:bg-dark-bg p-3.5 rounded-xl border border-black/5 dark:border-white/5">
          <div className="flex justify-between items-center text-xs font-bold">
            <span className="text-light-text dark:text-dark-text">Min Confidence Score</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-black px-2 py-0.5 rounded-md bg-emerald-500/10">
              ≥{config.minMatchScore}%
            </span>
          </div>
          <input
            type="range"
            min="30"
            max="90"
            step="5"
            value={config.minMatchScore}
            onChange={e => onChange({ minMatchScore: Number(e.target.value) })}
            className="w-full accent-emerald-600 cursor-pointer"
          />
          <div className="flex justify-between text-xs text-light-text-secondary dark:text-dark-text-secondary">
            <span>30% (Show More)</span>
            <span>90% (Very Strict)</span>
          </div>
        </div>
      </div>

      {/* Toggle: Require Name Match */}
      <div className="flex items-center justify-between bg-light-bg dark:bg-dark-bg p-3.5 rounded-xl border border-black/5 dark:border-white/5">
        <div className="space-y-0.5">
          <p className="text-xs font-bold text-light-text dark:text-dark-text">Require Name Similarity</p>
          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary max-w-xs">
            When enabled, bill/recurring matches with low name similarity are suppressed even if amount and date match well.
          </p>
        </div>
        <button
          onClick={() => onChange({ requireNameMatch: !config.requireNameMatch })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ml-4 ${
            config.requireNameMatch ? 'bg-emerald-600' : 'bg-black/20 dark:bg-white/20'
          }`}
          aria-label="Toggle require name match"
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
              config.requireNameMatch ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>
  );
};

export default MatcherConfigPanel;
