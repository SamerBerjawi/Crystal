import React, { useMemo, useState } from 'react';
import {
  CandlestickChart,
  Candlestick,
  Grid,
  ChartTooltip,
  XAxis,
  OHLCDataPoint,
} from '../src/components/charts';
import { formatCurrency } from '../utils';
import { PriceHistoryEntry, InvestmentTransaction, Currency } from '../types';
import Icon from './ui/Icon';

export type TimeframeOption = '1M' | '3M' | '6M' | '1Y' | 'ALL';
export type GranularityOption = 'raw' | 'weekly';

export interface InvestmentCandlestickChartProps {
  title?: string;
  subtitle?: string;
  currentValue: number;
  costBasis?: number;
  priceHistory?: PriceHistoryEntry[];
  transactions?: InvestmentTransaction[];
  currency?: Currency;
  height?: number;
  className?: string;
  compact?: boolean;
  isNegativeTrend?: boolean;
  initialGranularity?: GranularityOption;
}

interface CustomTooltipProps {
  point?: Record<string, unknown>;
  index?: number;
  currency?: Currency;
  granularity?: GranularityOption;
}

const OHLCTooltipContent: React.FC<CustomTooltipProps> = ({ point, currency = 'EUR', granularity = 'raw' }) => {
  if (!point) return null;

  const date = point.date instanceof Date ? point.date : new Date(String(point.date));
  const open = Number(point.open || 0);
  const high = Number(point.high || 0);
  const low = Number(point.low || 0);
  const close = Number(point.close || 0);

  const diff = close - open;
  const percentChange = open !== 0 ? (diff / open) * 100 : 0;
  const isPositive = diff >= 0;

  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-black/10 dark:border-white/10 text-xs space-y-2.5 min-w-[220px] select-none">
      <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-2">
        <span className="font-semibold text-gray-500 dark:text-gray-400 text-xs tracking-wider uppercase">
          {formattedDate} {granularity === 'weekly' ? '(Week End)' : '(Logged Entry)'}
        </span>
        <span
          className={`px-2.5 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider ${
            isPositive
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
          }`}
        >
          {isPositive ? '+' : ''}
          {percentChange.toFixed(2)}%
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-xs">
        <div className="flex justify-between items-center">
          <span className="text-gray-400 font-sans text-xs font-medium">Open</span>
          <span className="font-bold text-light-text dark:text-dark-text">{formatCurrency(open, currency)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-400 font-sans text-xs font-medium">High</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(high, currency)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-400 font-sans text-xs font-medium">Low</span>
          <span className="font-bold text-rose-600 dark:text-rose-400">{formatCurrency(low, currency)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-400 font-sans text-xs font-medium">Close</span>
          <span className="font-black text-primary-500">{formatCurrency(close, currency)}</span>
        </div>
      </div>

      <div className="pt-1.5 border-t border-black/5 dark:border-white/5 flex justify-between items-center font-mono text-xs">
        <span className="text-gray-400 font-sans">{granularity === 'weekly' ? 'Weekly Return' : 'Log Return'}</span>
        <span className={`font-bold ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
          {isPositive ? '+' : ''}{formatCurrency(diff, currency)}
        </span>
      </div>
    </div>
  );
};

export const InvestmentCandlestickChart: React.FC<InvestmentCandlestickChartProps> = ({
  title = 'Candlestick OHLC Performance',
  subtitle = 'Open, High, Low, and Close trends for portfolio assets',
  currentValue,
  costBasis,
  priceHistory = [],
  transactions = [],
  currency = 'EUR',
  height = 320,
  className = '',
  compact = false,
  isNegativeTrend,
  initialGranularity = 'raw',
}) => {
  const [timeframe, setTimeframe] = useState<TimeframeOption>('3M');
  const [granularity, setGranularity] = useState<GranularityOption>(initialGranularity);

  const ohlcData = useMemo<OHLCDataPoint[]>(() => {
    // Sort historical price entries chronologically
    const sortedHistory = [...priceHistory].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    let daysOffset = 90;
    if (timeframe === '1M') daysOffset = 30;
    else if (timeframe === '3M') daysOffset = 90;
    else if (timeframe === '6M') daysOffset = 180;
    else if (timeframe === '1Y') daysOffset = 365;
    else if (timeframe === 'ALL') {
      if (sortedHistory.length > 0) {
        const earliestDate = new Date(sortedHistory[0].date);
        const diffDays = Math.ceil((new Date().getTime() - earliestDate.getTime()) / (1000 * 3600 * 24));
        daysOffset = Math.max(30, diffDays);
      } else if (transactions.length > 0) {
        const sortedTxs = [...transactions].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        const earliestDate = new Date(sortedTxs[0].date);
        const diffDays = Math.ceil((new Date().getTime() - earliestDate.getTime()) / (1000 * 3600 * 24));
        daysOffset = Math.max(30, diffDays);
      } else {
        daysOffset = 365;
      }
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - daysOffset);

    // If completely empty history, do not fabricate synthetic upward curves
    if (sortedHistory.length === 0) {
      return [];
    }

    // Filter history entries strictly within the selected window
    const historyInRange = sortedHistory.filter((h) => {
      const d = new Date(h.date);
      return d > startDate && d <= endDate;
    });

    const lastHistoryPrice = sortedHistory[sortedHistory.length - 1].price;
    const endValue = currentValue > 0 ? currentValue : lastHistoryPrice;

    // Find the opening valuation prior to or right at the start of this timeframe window
    const pastEntries = sortedHistory.filter((h) => new Date(h.date) <= startDate);
    let initialOpeningValuation: number;
    if (pastEntries.length > 0) {
      initialOpeningValuation = pastEntries[pastEntries.length - 1].price;
    } else if (historyInRange.length > 0) {
      initialOpeningValuation = historyInRange[0].price;
    } else {
      initialOpeningValuation = endValue;
    }

    const startValue = initialOpeningValuation;
    const result: OHLCDataPoint[] = [];

    // If no price fluctuations recorded in this specific timeframe, display clean baseline at endValue
    if (historyInRange.length === 0) {
      const flatValue = Number(endValue.toFixed(2));
      if (granularity === 'raw') {
        result.push({
          date: endDate,
          open: flatValue,
          high: flatValue,
          low: flatValue,
          close: flatValue,
        });
        return result;
      }

      const candleCount = Math.max(2, Math.min(52, Math.ceil(daysOffset / 7)));
      const stepMs = (endDate.getTime() - startDate.getTime()) / candleCount;
      for (let i = 0; i < candleCount; i++) {
        result.push({
          date: new Date(startDate.getTime() + stepMs * (i + 1)),
          open: flatValue,
          high: flatValue,
          low: flatValue,
          close: flatValue,
        });
      }
      return result;
    }

    // BRANCH A: RAW LOGS MODE (1:1 mapping of recorded valuation changes)
    if (granularity === 'raw') {
      let previousClose = startValue;

      for (let i = 0; i < historyInRange.length; i++) {
        const entry = historyInRange[i];
        const entryDate = new Date(entry.date);

        const open = previousClose;
        const close = entry.price;

        const high = Math.max(open, close);
        const low = Math.min(open, close);

        previousClose = close;

        result.push({
          date: entryDate,
          open: Number(open.toFixed(2)),
          high: Number(high.toFixed(2)),
          low: Number(low.toFixed(2)),
          close: Number(close.toFixed(2)),
        });
      }

      // If latest market close differs from last logged entry and last entry is older than 12h, add close candle
      const lastEntry = historyInRange[historyInRange.length - 1];
      const timeDiff = endDate.getTime() - new Date(lastEntry.date).getTime();
      if (timeDiff > 43200000 && endValue > 0 && Math.abs(lastEntry.price - endValue) > 0.01) {
        const open = previousClose;
        const close = endValue;
        result.push({
          date: endDate,
          open: Number(open.toFixed(2)),
          high: Number(Math.max(open, close).toFixed(2)),
          low: Number(Math.min(open, close).toFixed(2)),
          close: Number(close.toFixed(2)),
        });
      }

      return result;
    }

    // BRANCH B: WEEKLY GROUPED MODE
    const candleCount = Math.max(2, Math.min(52, Math.ceil(daysOffset / 7)));
    const stepMs = (endDate.getTime() - startDate.getTime()) / candleCount;
    let previousClose = startValue;

    for (let i = 0; i < candleCount; i++) {
      const slotStart = new Date(startDate.getTime() + stepMs * i);
      const slotEnd = new Date(startDate.getTime() + stepMs * (i + 1));

      const matchingEntries = sortedHistory.filter((h) => {
        const d = new Date(h.date);
        return d >= slotStart && d <= slotEnd;
      });

      let open: number;
      let close: number;
      let high: number;
      let low: number;

      if (matchingEntries.length > 0) {
        open = previousClose;
        close = (i === candleCount - 1 && endValue > 0)
          ? endValue
          : matchingEntries[matchingEntries.length - 1].price;
        const pricesInSlot = [...matchingEntries.map((e) => e.price), open, close];
        high = Math.max(...pricesInSlot);
        low = Math.min(...pricesInSlot);
      } else {
        open = previousClose;
        close = (i === candleCount - 1 && endValue > 0) ? endValue : previousClose;
        high = Math.max(open, close);
        low = Math.min(open, close);
      }

      open = Math.max(0.01, Number(open.toFixed(2)));
      close = Math.max(0.01, Number(close.toFixed(2)));
      high = Math.max(open, close, Number(high.toFixed(2)));
      low = Math.max(0.01, Math.min(open, close, Number(low.toFixed(2))));

      previousClose = close;

      result.push({
        date: slotEnd,
        open,
        high,
        low,
        close,
      });
    }

    return result;
  }, [timeframe, granularity, currentValue, priceHistory, transactions]);

  const stats = useMemo(() => {
    if (ohlcData.length === 0) {
      return {
        startDate: new Date(),
        open: currentValue || 0,
        high: currentValue || 0,
        low: currentValue || 0,
        close: currentValue || 0,
        change: 0,
        changePercent: 0,
      };
    }

    const first = ohlcData[0];
    const last = ohlcData[ohlcData.length - 1];
    const highest = Math.max(...ohlcData.map((d) => d.high));
    const lowest = Math.min(...ohlcData.map((d) => d.low));

    const diff = last.close - first.open;
    const changePercent = first.open !== 0 ? (diff / first.open) * 100 : 0;

    return {
      startDate: first.date,
      open: first.open,
      high: highest,
      low: lowest,
      close: last.close,
      change: diff,
      changePercent,
    };
  }, [ohlcData, currentValue]);

  const startDateFormatted = useMemo(() => {
    return stats.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: timeframe === 'ALL' || timeframe === '1Y' ? '2-digit' : undefined });
  }, [stats.startDate, timeframe]);

  return (
    <div
      className={`glass-section rounded-2xl p-4 sm:p-5 border border-slate-200/60 dark:border-white/5 shadow-card relative overflow-hidden flex flex-col justify-between ${className}`}
    >
      {/* Top Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary-500/10 flex items-center justify-center shrink-0">
            <Icon name="candlestick_chart" className="text-primary-500 text-sm" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-light-text dark:text-dark-text tracking-tight flex items-center gap-2">
              <span>{title}</span>
            </h3>
            {subtitle && (
              <p className="text-2xs text-light-text-secondary dark:text-dark-text-secondary opacity-70 truncate max-w-md">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* View Mode & Timeframe Selector */}
        <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
          {/* Granularity / Grouping Selector */}
          <div className="flex items-center bg-gray-100 dark:bg-white/5 p-0.5 rounded-lg border border-black/5 dark:border-white/5 text-2xs">
            <button
              type="button"
              onClick={() => setGranularity('raw')}
              className={`px-2 py-0.5 rounded-md font-semibold tracking-wider uppercase transition-all cursor-pointer ${
                granularity === 'raw'
                  ? 'bg-white dark:bg-dark-card text-primary-600 dark:text-primary-400 shadow-xs'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              Raw Logs
            </button>
            <button
              type="button"
              onClick={() => setGranularity('weekly')}
              className={`px-2 py-0.5 rounded-md font-semibold tracking-wider uppercase transition-all cursor-pointer ${
                granularity === 'weekly'
                  ? 'bg-white dark:bg-dark-card text-primary-600 dark:text-primary-400 shadow-xs'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              Weekly
            </button>
          </div>

          {/* Timeframe Selector (1M, 3M, 6M, 1Y, ALL) */}
          <div className="flex items-center bg-gray-100 dark:bg-white/5 p-0.5 rounded-lg border border-black/5 dark:border-white/5 text-2xs">
            {(['1M', '3M', '6M', '1Y', 'ALL'] as TimeframeOption[]).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={`px-1.5 py-0.5 rounded-md font-semibold tracking-wider uppercase transition-all cursor-pointer ${
                  timeframe === tf
                    ? 'bg-white dark:bg-dark-card text-primary-600 dark:text-primary-400 shadow-xs'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {tf === 'ALL' ? 'All Time' : tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary OHLC Metric Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-1.5 bg-gray-50/80 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 rounded-xl mb-2 text-xs">
        <div className="flex flex-col px-2">
          <span className="text-2xs font-semibold tracking-wider text-gray-400 uppercase">Period Start</span>
          <span className="text-xs font-bold font-mono text-light-text dark:text-dark-text mt-0.5">
            {startDateFormatted}
          </span>
        </div>
        <div className="flex flex-col px-2">
          <span className="text-2xs font-semibold tracking-wider text-gray-400 uppercase">Open</span>
          <span className="text-xs font-bold font-mono text-light-text dark:text-dark-text privacy-blur mt-0.5">
            {formatCurrency(stats.open, currency)}
          </span>
        </div>
        <div className="flex flex-col px-2">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-2xs font-semibold tracking-wider text-emerald-600 dark:text-emerald-400 uppercase">High</span>
          </div>
          <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400 privacy-blur mt-0.5">
            {formatCurrency(stats.high, currency)}
          </span>
        </div>
        <div className="flex flex-col px-2">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span className="text-2xs font-semibold tracking-wider text-rose-600 dark:text-rose-400 uppercase">Low</span>
          </div>
          <span className="text-xs font-bold font-mono text-rose-600 dark:text-rose-400 privacy-blur mt-0.5">
            {formatCurrency(stats.low, currency)}
          </span>
        </div>
        <div className="col-span-2 sm:col-span-1 flex flex-col px-2 justify-center">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-semibold tracking-wider text-primary-500 uppercase">Return</span>
            <span
              className={`text-2xs font-bold font-mono px-1.5 py-0.5 rounded-md ${
                stats.change >= 0
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
              }`}
            >
              {stats.change >= 0 ? '+' : ''}
              {stats.changePercent.toFixed(1)}%
            </span>
          </div>
          <span className="text-xs font-black font-mono text-primary-500 privacy-blur mt-0.5">
            {formatCurrency(stats.close, currency)}
          </span>
        </div>
      </div>

      {/* Main Candlestick Chart Area */}
      <div className="w-full relative h-[180px] min-h-[175px] max-h-[180px]">
        {ohlcData.length > 0 ? (
          <CandlestickChart
            key={`${timeframe}-${granularity}`}
            revealSignature={`${timeframe}-${granularity}`}
            data={ohlcData}
            margin={{ top: 12, right: 16, bottom: 28, left: 16 }}
            style={{ height: 180, minHeight: 175 }}
            candleGap={0.25}
          >
            <Grid horizontal stroke="rgba(128,128,128,0.12)" />
            <Candlestick
              positiveFill="#10b981"
              negativeFill="#ef4444"
              fadedOpacity={0.25}
            />
            <ChartTooltip
              showCrosshair={true}
              showDots={false}
              indicatorColor={(pt) =>
                Number(pt.close) >= Number(pt.open) ? '#10b981' : '#ef4444'
              }
              content={({ point, index }) => (
                <OHLCTooltipContent point={point} index={index} currency={currency} granularity={granularity} />
              )}
            />
            <XAxis />
          </CandlestickChart>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-200/80 dark:border-white/10 rounded-xl bg-slate-500/[0.02]">
            <div className="w-8 h-8 rounded-lg bg-primary-500/10 flex items-center justify-center text-primary-500 mb-1.5">
              <Icon name="candlestick_chart" className="text-base" />
            </div>
            <p className="text-xs font-semibold text-light-text dark:text-dark-text">No Historical Checkpoints</p>
            <p className="text-2xs text-light-text-secondary dark:text-dark-text-secondary max-w-sm mt-0.5">
              Candlesticks require historical valuation logs or symbol price checkpoints. Add transactions or log price updates to view OHLC trends.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvestmentCandlestickChart;
