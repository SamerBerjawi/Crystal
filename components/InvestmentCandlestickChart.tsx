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
        <span className="font-bold text-gray-500 dark:text-gray-400 text-[10px] tracking-wider uppercase">
          {formattedDate} {granularity === 'weekly' ? '(Week End)' : '(Logged Entry)'}
        </span>
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide ${
            isPositive
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
          }`}
        >
          {isPositive ? '+' : ''}
          {percentChange.toFixed(2)}%
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-[11px]">
        <div className="flex justify-between items-center">
          <span className="text-gray-400 font-sans text-[10px] font-semibold">Open</span>
          <span className="font-bold text-light-text dark:text-dark-text">{formatCurrency(open, currency)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-400 font-sans text-[10px] font-semibold">High</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(high, currency)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-400 font-sans text-[10px] font-semibold">Low</span>
          <span className="font-bold text-rose-600 dark:text-rose-400">{formatCurrency(low, currency)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-400 font-sans text-[10px] font-semibold">Close</span>
          <span className="font-black text-primary-500">{formatCurrency(close, currency)}</span>
        </div>
      </div>

      <div className="pt-1.5 border-t border-black/5 dark:border-white/5 flex justify-between items-center font-mono text-[10px]">
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
        daysOffset = 1095;
      }
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - daysOffset);

    // Filter history entries within the selected timeframe
    const historyInRange = sortedHistory.filter((h) => {
      const d = new Date(h.date);
      return d >= startDate && d <= endDate;
    });

    const lastHistoryPrice = sortedHistory.length > 0 ? sortedHistory[sortedHistory.length - 1].price : 0;
    const endValue = currentValue > 0 ? currentValue : (lastHistoryPrice > 0 ? lastHistoryPrice : 1000);

    const historyAtStart = sortedHistory.find((h) => new Date(h.date) >= startDate);
    const firstHistoryPrice = sortedHistory.length > 0 ? sortedHistory[0].price : undefined;

    let startValue: number;
    if (historyAtStart) {
      startValue = historyAtStart.price;
    } else if (firstHistoryPrice !== undefined && timeframe === 'ALL') {
      startValue = firstHistoryPrice;
    } else if (costBasis && costBasis > 0) {
      startValue = costBasis;
    } else if (isNegativeTrend) {
      startValue = endValue * 1.18;
    } else {
      const isLoss = costBasis ? costBasis > endValue : false;
      if (isLoss) {
        startValue = endValue * 1.15;
      } else {
        const gainRatio = timeframe === '1M' ? 0.03 : timeframe === '3M' ? 0.06 : timeframe === '6M' ? 0.10 : 0.15;
        startValue = endValue / (1 + gainRatio);
      }
    }

    const result: OHLCDataPoint[] = [];

    // BRANCH A: RAW LOGS MODE (NO ZERO DROPS, MAP EACH LOG 1:1 AT TRUE PRICE LEVEL)
    if (granularity === 'raw' && historyInRange.length > 0) {
      let previousClose = historyInRange[0].price;

      for (let i = 0; i < historyInRange.length; i++) {
        const entry = historyInRange[i];
        const entryDate = new Date(entry.date);

        const open = i === 0
          ? (historyAtStart && historyAtStart.date !== entry.date ? historyAtStart.price : entry.price)
          : previousClose;
        const close = entry.price;

        const bodyMax = Math.max(open, close);
        const bodyMin = Math.min(open, close);
        const spread = Math.abs(close - open);

        const wickVolatility = Math.max(spread * 0.4, Math.abs(open) * 0.005);
        const high = Number((bodyMax + wickVolatility * (0.3 + Math.abs(Math.sin(i * 1.5)) * 0.7)).toFixed(2));
        const low = Number((bodyMin - wickVolatility * (0.3 + Math.abs(Math.cos(i * 1.5)) * 0.7)).toFixed(2));

        previousClose = close;

        result.push({
          date: entryDate,
          open: Number(open.toFixed(2)),
          high: Math.max(high, open, close),
          low: Math.min(low, open, close),
          close: Number(close.toFixed(2)),
        });
      }

      // Append latest market close candle ONLY if endValue differs significantly and log is older than 24h
      const lastEntry = historyInRange[historyInRange.length - 1];
      const timeDiff = endDate.getTime() - new Date(lastEntry.date).getTime();
      if (timeDiff > 86400000 && endValue > 0 && Math.abs(lastEntry.price - endValue) > 0.01) {
        const open = previousClose;
        const close = endValue;
        const bodyMax = Math.max(open, close);
        const bodyMin = Math.min(open, close);
        result.push({
          date: endDate,
          open: Number(open.toFixed(2)),
          high: Math.max(bodyMax, open, close),
          low: Math.min(bodyMin, open, close),
          close: Number(close.toFixed(2)),
        });
      }

      return result;
    }

    // BRANCH B: WEEKLY GROUPED MODE OR FALLBACK FOR UNLOGGED DAYS
    const candleCount = granularity === 'weekly'
      ? Math.max(4, Math.ceil(daysOffset / 7))
      : Math.min(90, daysOffset);

    // Baseline price sequence for smooth interpolation
    const prices: number[] = [startValue];
    for (let i = 1; i <= candleCount; i++) {
      if (i === candleCount) {
        prices.push(endValue);
      } else {
        const progress = i / candleCount;
        const linearValue = startValue + (endValue - startValue) * progress;
        const volatility = Math.abs(endValue) * 0.012;
        const wave = Math.sin(i * 0.5) * 0.5 + Math.cos(i * 1.1) * 0.3;
        const damping = Math.sin(progress * Math.PI);
        const nextPrice = linearValue + wave * volatility * damping;
        prices.push(Math.max(0.01, Number(nextPrice.toFixed(2))));
      }
    }

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
        open = i === 0 ? matchingEntries[0].price : previousClose;
        close = matchingEntries[matchingEntries.length - 1].price;
        const pricesInSlot = matchingEntries.map((e) => e.price);
        high = Math.max(...pricesInSlot, open, close);
        low = Math.min(...pricesInSlot, open, close);
      } else {
        const openVal = prices[i];
        const closeVal = prices[i + 1];

        open = i === 0 ? openVal : previousClose;
        close = i === candleCount - 1 ? endValue : closeVal;

        const bodyMax = Math.max(open, close);
        const bodyMin = Math.min(open, close);
        const spread = Math.abs(close - open);

        const wickVolatility = Math.max(spread * 0.6, Math.abs(open) * 0.005);
        const highWick = (Math.abs(Math.sin(i * 1.3)) * 0.8 + 0.2) * wickVolatility;
        const lowWick = (Math.abs(Math.cos(i * 1.7)) * 0.8 + 0.2) * wickVolatility;

        high = Number((bodyMax + highWick).toFixed(2));
        low = Math.max(0.01, Number((bodyMin - lowWick).toFixed(2)));
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
  }, [timeframe, granularity, currentValue, costBasis, priceHistory, transactions, isNegativeTrend]);

  const stats = useMemo(() => {
    if (ohlcData.length === 0)
      return {
        startDate: new Date(),
        open: 0,
        high: 0,
        low: 0,
        close: 0,
        change: 0,
        changePercent: 0,
      };

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
  }, [ohlcData]);

  const startDateFormatted = useMemo(() => {
    return stats.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: timeframe === 'ALL' || timeframe === '1Y' ? '2-digit' : undefined });
  }, [stats.startDate, timeframe]);

  return (
    <div
      className={`bg-white dark:bg-dark-card rounded-3xl p-5 sm:p-6 border border-black/5 dark:border-white/5 shadow-sm relative overflow-hidden flex flex-col ${className}`}
    >
      {/* Top Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-primary-500 text-lg">candlestick_chart</span>
            <h3 className="text-sm sm:text-base font-bold text-light-text dark:text-dark-text tracking-tight">
              {title}
            </h3>
          </div>
          {subtitle && (
            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary opacity-70">
              {subtitle}
            </p>
          )}
        </div>

        {/* View Mode & Timeframe Selector */}
        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          {/* Granularity / Grouping Selector */}
          <div className="flex items-center bg-gray-100 dark:bg-white/5 p-1 rounded-2xl border border-black/5 dark:border-white/5">
            <button
              type="button"
              onClick={() => setGranularity('raw')}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black tracking-wider transition-all cursor-pointer ${
                granularity === 'raw'
                  ? 'bg-white dark:bg-dark-card text-primary-600 dark:text-primary-400 shadow-sm scale-105'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              Raw Logs
            </button>
            <button
              type="button"
              onClick={() => setGranularity('weekly')}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black tracking-wider transition-all cursor-pointer ${
                granularity === 'weekly'
                  ? 'bg-white dark:bg-dark-card text-primary-600 dark:text-primary-400 shadow-sm scale-105'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              Weekly Grouped
            </button>
          </div>

          {/* Timeframe Selector (1M, 3M, 6M, 1Y, ALL) */}
          <div className="flex items-center bg-gray-100 dark:bg-white/5 p-1 rounded-2xl border border-black/5 dark:border-white/5">
            {(['1M', '3M', '6M', '1Y', 'ALL'] as TimeframeOption[]).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black tracking-wider transition-all cursor-pointer ${
                  timeframe === tf
                    ? 'bg-white dark:bg-dark-card text-primary-600 dark:text-primary-400 shadow-sm scale-105'
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
      {!compact && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3.5 bg-gray-50 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 rounded-2xl mb-5">
          <div className="flex flex-col">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black tracking-widest text-gray-400 uppercase">Period Start</span>
              <span className="text-[9px] font-bold text-gray-400">{startDateFormatted}</span>
            </div>
            <span className="text-sm font-bold font-mono text-light-text dark:text-dark-text privacy-blur">
              {formatCurrency(stats.open, currency)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-black tracking-widest text-emerald-500 uppercase">Period High</span>
            <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400 privacy-blur">
              {formatCurrency(stats.high, currency)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-black tracking-widest text-rose-500 uppercase">Period Low</span>
            <span className="text-sm font-bold font-mono text-rose-600 dark:text-rose-400 privacy-blur">
              {formatCurrency(stats.low, currency)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-black tracking-widest text-primary-500 uppercase">Latest Close</span>
            <span className="text-sm font-black font-mono text-primary-600 dark:text-primary-400 privacy-blur">
              {formatCurrency(stats.close, currency)}
            </span>
          </div>
          <div className="col-span-2 sm:col-span-1 flex flex-col justify-center">
            <span className="text-[9px] font-black tracking-widest text-gray-400 uppercase">Total Return</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`text-xs font-black font-mono px-2 py-0.5 rounded-lg ${
                  stats.change >= 0
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                }`}
              >
                {stats.change >= 0 ? '+' : ''}
                {stats.changePercent.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Candlestick Chart Area */}
      <div className="w-full relative flex-1 min-h-[260px]" style={{ height }}>
        <CandlestickChart
          key={`${timeframe}-${granularity}`}
          revealSignature={`${timeframe}-${granularity}`}
          data={ohlcData}
          margin={{ top: 20, right: 20, bottom: 35, left: 20 }}
          style={{ height }}
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
      </div>
    </div>
  );
};

export default InvestmentCandlestickChart;
