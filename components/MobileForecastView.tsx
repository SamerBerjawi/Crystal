import React from 'react';
import { ForecastDuration, Currency } from '../types';
import { formatCurrency } from '../utils';
import Icon from './ui/Icon';
import PullToRefresh from './PullToRefresh';

interface MobileForecastViewProps {
  forecastDuration: ForecastDuration;
  setForecastDuration: (dur: ForecastDuration) => void;
  projectedNetWorth: number;
  lowestBalance: number;
  lowestBalanceDate: string;
  runwayMonths: number;
  preferredCurrency?: string;
  children?: React.ReactNode;
  onRefreshData?: () => Promise<void>;
}

export const MobileForecastView: React.FC<MobileForecastViewProps> = ({
  forecastDuration,
  setForecastDuration,
  projectedNetWorth,
  lowestBalance,
  lowestBalanceDate,
  runwayMonths,
  preferredCurrency = 'EUR',
  children,
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

  const horizons: { id: ForecastDuration; label: string }[] = [
    { id: '3M', label: '3M' },
    { id: '6M', label: '6M' },
    { id: 'EOY', label: 'EOY' },
    { id: '1Y', label: '1Y' },
  ];

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="space-y-5 pb-24 animate-fade-in md:hidden relative">
        {/* Header */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-70">
              Future Cash Flow
            </p>
            <h1 className="text-2xl font-extrabold text-light-text dark:text-white tracking-tight">
              Forecasting
            </h1>
          </div>

          <span className="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 text-xs font-bold px-3 py-1 rounded-full">
            AI Engine
          </span>
        </div>

        {/* Horizon Duration Selector Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-touch py-0.5">
          {horizons.map((h) => {
            const isActive = forecastDuration === h.id;
            return (
              <button
                key={h.id}
                onClick={() => setForecastDuration(h.id)}
                className={`touch-feedback flex-1 px-3.5 py-1.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap min-h-[36px] border ${
                  isActive
                    ? 'bg-cyan-500 text-white border-cyan-500 shadow-sm'
                    : 'bg-white/80 dark:bg-dark-card/80 border-black/5 dark:border-white/10 text-light-text-secondary dark:text-dark-text-secondary'
                }`}
              >
                {h.label}
              </button>
            );
          })}
        </div>

        {/* Hero Projection Card */}
        <div className="relative overflow-hidden rounded-[2.2rem] bg-gradient-to-br from-cyan-950 via-slate-900 to-indigo-950 p-6 text-white shadow-xl border border-cyan-500/20">
          <div className="relative z-10 space-y-3">
            <div className="flex items-center justify-between text-xs text-cyan-200/70 font-bold uppercase tracking-wider">
              <span>Projected Net Worth ({forecastDuration})</span>
              <span>{preferredCurrency}</span>
            </div>

            <div>
              <h2 className="text-3xl font-black tracking-tight text-white privacy-blur">
                {formatCurrency(projectedNetWorth, curr)}
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
              <div className="bg-white/10 p-2.5 rounded-xl border border-white/10">
                <span className="text-[9px] font-bold text-cyan-200/80 uppercase block">Lowest Liquidity</span>
                <span className="text-xs font-black text-white privacy-blur">
                  {formatCurrency(lowestBalance, curr)}
                </span>
                {lowestBalanceDate && (
                  <span className="text-[9px] text-white/60 block mt-0.5">{lowestBalanceDate}</span>
                )}
              </div>

              <div className="bg-white/10 p-2.5 rounded-xl border border-white/10">
                <span className="text-[9px] font-bold text-cyan-200/80 uppercase block">Financial Runway</span>
                <span className="text-xs font-black text-emerald-400">
                  {runwayMonths > 36 ? '36+ Months' : `${runwayMonths.toFixed(1)} Months`}
                </span>
                <span className="text-[9px] text-white/60 block mt-0.5">Based on burn rate</span>
              </div>
            </div>
          </div>
        </div>

        {/* Children components (charts, goal cards, etc.) */}
        <div className="space-y-4">
          {children}
        </div>
      </div>
    </PullToRefresh>
  );
};
