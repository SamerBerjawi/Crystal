import React, { useMemo, useState } from 'react';
import {
  CandlestickChart,
  Candlestick,
  Grid,
  ChartTooltip,
  XAxis,
  OHLCDataPoint,
} from '../src/components/charts';
import { formatCurrency, getMainCurrency } from '../utils';
import { dayOf } from '../utils/portfolioHistory';
import { PriceHistoryEntry, InvestmentTransaction, Currency } from '../types';
import SegmentedControl from './ui/SegmentedControl';

export type TimeframeOption = '1M' | '3M' | '6M' | '1Y' | 'ALL';
export type GranularityOption = 'raw' | 'weekly';

const GROUPINGS = [{ id: 'raw', label: 'Each log' }, { id: 'weekly', label: 'Weekly' }];
const TIMEFRAMES = [{ id: '1M', label: '1M' }, { id: '3M', label: '3M' }, { id: '6M', label: '6M' }, { id: '1Y', label: '1Y' }, { id: 'ALL', label: 'All' }];

export interface InvestmentCandlestickChartProps {
  currentValue: number;
  costBasis?: number;
  priceHistory?: PriceHistoryEntry[];
  transactions?: InvestmentTransaction[];
  currency?: Currency;
  className?: string;
  initialGranularity?: GranularityOption;
}

interface CustomTooltipProps {
  point?: Record<string, unknown>;
  index?: number;
  currency?: Currency;
  granularity?: GranularityOption;
}

/** Calendar day -> local midnight (new Date('YYYY-MM-DD') would be UTC midnight and shift the day). */
const parseDay = (value: string): Date => {
  const [y, m, d] = dayOf(value).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const OHLCTooltipContent: React.FC<CustomTooltipProps> = ({ point, currency = getMainCurrency(), granularity = 'raw' }) => {
  if (!point) return null;

  const date = point.date instanceof Date ? point.date : new Date(String(point.date));
  const open = Number(point.open || 0);
  const high = Number(point.high || 0);
  const low = Number(point.low || 0);
  const close = Number(point.close || 0);

  // Money paid in or taken out during the period is not performance.
  const flow = Number(point.flow || 0);
  const diff = close - open - flow;
  const percentChange = open + Math.max(0, flow) !== 0 ? (diff / (open + Math.max(0, flow))) * 100 : 0;
  const isPositive = diff >= 0;

  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="bg-solid p-3 rounded-[var(--radius-lg)] shadow-lg border border-line type-caption space-y-2 min-w-[200px] select-none">
      <div className="flex items-center justify-between border-b border-line pb-2">
        <span className="type-label text-ink">
          {granularity === 'weekly' ? `Week to ${formattedDate}` : formattedDate}
        </span>
        <span className={`font-bold ${isPositive ? 'text-money-in' : 'text-money-out'}`}>{isPositive ? '+' : '−'}{Math.abs(percentChange).toFixed(2)}%</span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <div className="flex justify-between items-center">
          <span className="text-muted">Open</span>
          <span className="font-bold text-ink">{formatCurrency(open, currency)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted">High</span>
          <span className="font-bold text-ink">{formatCurrency(high, currency)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted">Low</span>
          <span className="font-bold text-ink">{formatCurrency(low, currency)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted">Close</span>
          <span className="font-bold text-ink">{formatCurrency(close, currency)}</span>
        </div>
      </div>

      <div className="pt-1.5 border-t border-line flex justify-between items-center">
        <span className="text-muted">{granularity === 'weekly' ? 'Weekly change' : 'Change'}</span>
        <span className={`font-bold ${isPositive ? 'text-money-in' : 'text-money-out'}`}>
          {isPositive ? '+' : ''}{formatCurrency(diff, currency)}
        </span>
      </div>
    </div>
  );
};

const resolveWindow = (
  timeframe: TimeframeOption,
  sortedHistory: PriceHistoryEntry[],
  transactions: InvestmentTransaction[],
) => {
  let daysOffset = 90;
  if (timeframe === '1M') daysOffset = 30;
  else if (timeframe === '3M') daysOffset = 90;
  else if (timeframe === '6M') daysOffset = 180;
  else if (timeframe === '1Y') daysOffset = 365;
  else if (timeframe === 'ALL') {
    const dates = [
      ...sortedHistory.map((h) => dayOf(h.date)),
      ...(sortedHistory.length === 0 ? transactions.map((t) => dayOf(t.date)) : []),
    ].sort();
    if (dates.length > 0) {
      const diffDays = Math.ceil((Date.now() - parseDay(dates[0]).getTime()) / (1000 * 3600 * 24));
      daysOffset = Math.max(30, diffDays);
    } else {
      daysOffset = 365;
    }
  }
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - daysOffset);
  return { daysOffset, startDate, endDate };
};

/** Net money put into (positive) or taken out of (negative) the holdings in a period: buys minus sells. */
const netFlowBetween = (transactions: InvestmentTransaction[], from: Date, to: Date): number =>
  transactions.reduce((sum, t) => {
    const d = parseDay(t.date);
    if (d <= from || d > to) return sum;
    const value = (Number(t.quantity) || 0) * (Number(t.price) || 0);
    return t.type?.toLowerCase() === 'buy' ? sum + value : sum - value;
  }, 0);

export const InvestmentCandlestickChart: React.FC<InvestmentCandlestickChartProps> = ({
  currentValue,
  costBasis,
  priceHistory = [],
  transactions = [],
  currency = getMainCurrency(),
  className = '',
  initialGranularity = 'raw',
}) => {
  const [timeframe, setTimeframe] = useState<TimeframeOption>('3M');
  const [granularity, setGranularity] = useState<GranularityOption>(initialGranularity);

  const rawOhlc = useMemo<OHLCDataPoint[]>(() => {
    // Sort historical price entries chronologically
    const sortedHistory = [...priceHistory].sort(
      (a, b) => dayOf(a.date).localeCompare(dayOf(b.date))
    );

    const { daysOffset, startDate, endDate } = resolveWindow(timeframe, sortedHistory, transactions);

    // If completely empty history, do not fabricate synthetic upward curves
    if (sortedHistory.length === 0) {
      return [];
    }

    // Filter history entries strictly within the selected window
    const historyInRange = sortedHistory.filter((h) => {
      const d = parseDay(h.date);
      return d > startDate && d <= endDate;
    });

    const lastHistoryPrice = sortedHistory[sortedHistory.length - 1].price;
    const endValue = currentValue > 0 ? currentValue : lastHistoryPrice;

    // Find the opening valuation prior to or right at the start of this timeframe window
    const pastEntries = sortedHistory.filter((h) => parseDay(h.date) <= startDate);
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
        const entryDate = parseDay(entry.date);

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
      const timeDiff = endDate.getTime() - parseDay(lastEntry.date).getTime();
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
        const d = parseDay(h.date);
        // Half-open slots: an entry on a boundary belongs to exactly one candle (the last slot also owns the end).
        return d >= slotStart && (d < slotEnd || (i === candleCount - 1 && d <= slotEnd));
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

  // Attach the net money moved into the holdings during each candle, so returns can exclude deposits and withdrawals.
  const ohlcData = useMemo<(OHLCDataPoint & { flow: number })[]>(() => {
    if (rawOhlc.length === 0) return [];
    const sortedHistory = [...priceHistory].sort((a, b) => dayOf(a.date).localeCompare(dayOf(b.date)));
    const { startDate } = resolveWindow(timeframe, sortedHistory, transactions);
    return rawOhlc.map((point, i) => ({
      ...point,
      flow: netFlowBetween(transactions, i === 0 ? startDate : rawOhlc[i - 1].date, point.date),
    }));
  }, [rawOhlc, timeframe, priceHistory, transactions]);

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

    // Performance excludes money paid in or out during the period (buying shares is not a gain).
    const flow = ohlcData.reduce((sum, d) => sum + d.flow, 0);
    const diff = last.close - first.open - flow;
    const base = first.open + Math.max(0, flow);
    const changePercent = base !== 0 ? (diff / base) * 100 : 0;

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
    <div className={className}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl items={GROUPINGS} activeId={granularity} onChange={id => setGranularity(id as GranularityOption)} />
        <SegmentedControl items={TIMEFRAMES} activeId={timeframe} onChange={id => setTimeframe(id as TimeframeOption)} />
      </div>

      <dl className="mb-2 grid grid-cols-2 gap-x-4 gap-y-2 min-[440px]:grid-cols-4">
        <div><dt className="type-label text-muted">From {startDateFormatted}</dt><dd className="type-figure-row text-ink">{formatCurrency(stats.open, currency)}</dd></div>
        <div><dt className="type-label text-muted">High</dt><dd className="type-figure-row text-ink">{formatCurrency(stats.high, currency)}</dd></div>
        <div><dt className="type-label text-muted">Low</dt><dd className="type-figure-row text-ink">{formatCurrency(stats.low, currency)}</dd></div>
        <div>
          <dt className="type-label text-muted">Change</dt>
          <dd className={`type-figure-row ${stats.change >= 0 ? 'text-money-in' : 'text-money-out'}`}>{stats.change >= 0 ? '+' : '−'}{Math.abs(stats.changePercent).toFixed(1)}%</dd>
        </div>
      </dl>

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
            <Grid horizontal stroke="var(--line)" />
            <Candlestick
              positiveFill="var(--money-in)"
              negativeFill="var(--money-out)"
              fadedOpacity={0.25}
            />
            <ChartTooltip
              showCrosshair={true}
              showDots={false}
              indicatorColor={(pt) =>
                Number(pt.close) >= Number(pt.open) ? 'var(--money-in)' : 'var(--money-out)'
              }
              content={({ point, index }) => (
                <OHLCTooltipContent point={point} index={index} currency={currency} granularity={granularity} />
              )}
            />
            <XAxis />
          </CandlestickChart>
        ) : (
          <p className="type-body py-10 text-center text-muted">No logged prices in this period.</p>
        )}
      </div>
    </div>
  );
};

export default InvestmentCandlestickChart;
