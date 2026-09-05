import React from 'react';
import Icon from './ui/Icon';

interface MetricCardProps {
  title: string;
  value: number | string | undefined;
  unit?: string;
  accentColor?: string;
  icon?: React.ReactNode;
  statusLabel?: string;
  statusVariant?: 'optimal' | 'elevated' | 'low' | 'normal';
  changePercent?: number;
  min?: number | string;
  max?: number | string;
  sparklinePoints?: string; // e.g. "2,18 15,12 30,16 45,6 60,10 68,4"
  footerNote?: string;
  className?: string;
  onClick?: () => void;
}

const STATUS_BADGE_CLASSES: Record<'optimal' | 'elevated' | 'low' | 'normal', string> = {
  optimal: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
  elevated: 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30',
  low: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30',
  normal: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border-cyan-500/30',
};

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  accentColor = '#fa9a1d',
  icon,
  statusLabel,
  statusVariant = 'optimal',
  changePercent,
  min,
  max,
  sparklinePoints,
  footerNote,
  className = '',
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 select-none flex flex-col justify-between shadow-[4px_6px_12px_rgba(0,0,0,0.06)] dark:shadow-[4px_6px_12px_rgba(0,0,0,0.25)] bg-white/80 hover:bg-white/95 dark:bg-white/[0.04] dark:hover:bg-white/[0.07] border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      <div>
        {/* ROW 1: Icon on Left, Status Badge on Right (never overlap) */}
        <div className="flex items-center justify-between gap-2">
          <div
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0 border"
            style={{
              backgroundColor: `${accentColor}18`,
              borderColor: `${accentColor}35`,
              color: accentColor,
            }}
          >
            {icon || <Icon name="Activity" className="text-base" />}
          </div>

          {statusLabel && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${STATUS_BADGE_CLASSES[statusVariant]}`}
            >
              {statusLabel}
            </span>
          )}
        </div>

        {/* ROW 2: Metric Title (Full width, no badge crowding) */}
        <div className="mt-2.5 min-w-0">
          <h3 className="text-xs font-bold truncate text-slate-700 dark:text-slate-200">
            {title}
          </h3>
        </div>

        {/* ROW 3: Big Metric Value, Unit & Change Delta Indicator */}
        <div className="flex items-baseline justify-between gap-1.5 mt-1">
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-2xl sm:text-3xl font-black tracking-tight font-mono truncate">
              {value !== undefined ? value : '--'}
            </span>
            {unit && (
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 shrink-0">
                {unit}
              </span>
            )}
          </div>

          {changePercent !== undefined && changePercent !== 0 && (
            <div
              className={`flex items-center gap-0.5 text-[11px] font-bold shrink-0 ${
                changePercent >= 0 ? 'text-emerald-500' : 'text-rose-500'
              }`}
            >
              <Icon
                name={changePercent >= 0 ? 'trending_up' : 'trending_down'}
                className="text-xs"
              />
              <span>{Math.abs(changePercent)}%</span>
            </div>
          )}
        </div>
      </div>

      {/* ROW 4: Subtle Footer Divider, Min/Max Bounds & Mini Sparkline */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-2 overflow-hidden">
        <div className="min-w-0 flex-1 text-[10px] font-medium text-slate-400 dark:text-slate-500 truncate">
          {min !== undefined && max !== undefined ? (
            <span>
              Min:{' '}
              <strong className="font-semibold text-slate-700 dark:text-slate-300">
                {min}
              </strong>{' '}
              · Max:{' '}
              <strong className="font-semibold text-slate-700 dark:text-slate-300">
                {max}
              </strong>
            </span>
          ) : footerNote ? (
            <span>{footerNote}</span>
          ) : (
            <span>Telemetry live</span>
          )}
        </div>

        {sparklinePoints && (
          <div className="shrink-0 w-14 h-5 overflow-hidden">
            <svg viewBox="0 0 70 24" className="w-full h-full block">
              <polyline
                fill="none"
                stroke={accentColor}
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                points={sparklinePoints}
              />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
};

export default MetricCard;
