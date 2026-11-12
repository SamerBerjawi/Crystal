import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Currency, HoldingSummary } from '../../types';
import { formatHoldingType } from '../../utils/investments';
import type { Diversification } from '../../utils/portfolioInsights';
import { AreaSparkline, LineSparkline, Ring, RingChart } from '../../src/components/charts';
import { BrandMark } from '../ServiceCard';
import { ShareBar } from '../accounts/charts';
import { IconButton } from '../ui/Actions';
import { Badge } from '../ui/Display';
import { Amount } from '../ui/Money';
import SegmentedControl from '../ui/SegmentedControl';
import { StatGauge } from '../ui/StatGauge';
import { cn } from '../../lib/utils';

export const signedPct = (value: number, digits = 1) => `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(digits)}%`;
const gainTone = (value: number | null) => (value === null ? 'neutral' : value >= 0 ? 'positive' : 'negative');
const kindOf = (holding: HoldingSummary) => (holding.type === 'Warrant' ? 'Warrant' : formatHoldingType(holding.subType));

export interface PositionCardData {
  holding: HoldingSummary;
  /** Recent prices, oldest first. */
  trend: number[];
  returnPct: number | null;
  /** Change over the trend window, in percent. */
  trendPct: number | null;
  weight: number;
}

/** The largest positions as cards in a strip you can scroll sideways, each with its recent price. */
export const PositionStrip: React.FC<{ items: PositionCardData[]; currency: Currency; onOpen: (symbol: string) => void }> = ({ items, currency, onOpen }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll, items]);

  const scrollBy = (offset: number) => {
    scrollRef.current?.scrollBy({ left: offset, behavior: 'smooth' });
  };

  return (
    <div className="relative group/strip">
      {canScrollLeft && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 z-10 hidden md:block -ml-3">
          <IconButton
            icon="chevron_left"
            label="Scroll left"
            className="rounded-full shadow-md bg-surface/90 backdrop-blur-sm border border-line text-ink hover:bg-surface"
            onPress={() => scrollBy(-248)}
          />
        </div>
      )}
      <div
        ref={scrollRef}
        className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:thin] no-scrollbar md:[scrollbar-width:auto]"
      >
        {items.map(({ holding, trend, returnPct, trendPct, weight }) => {
          const up = trendPct === null ? (returnPct ?? 0) >= 0 : trendPct >= 0;
          return (
            <button
              key={holding.symbol}
              type="button"
              onClick={() => onOpen(holding.symbol)}
              className="surface-card group flex w-[232px] shrink-0 snap-start cursor-pointer flex-col gap-3 rounded-[var(--radius-xl)] p-4 text-left transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-focus motion-reduce:transition-none"
            >
              <span className="flex items-center gap-3">
                <BrandMark name={holding.name || holding.symbol} />
                <span className="min-w-0 flex-1">
                  <span className="type-body-strong block truncate text-ink">{holding.symbol}</span>
                  <span className="type-caption block truncate text-muted">{holding.name || kindOf(holding)}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="type-figure-row block text-ink"><Amount value={holding.currentPrice} currency={holding.currency ?? currency} /></span>
                  <span className="type-caption block text-muted">per unit</span>
                </span>
              </span>
              <span className="block h-10">
                {trend.length > 1
                  ? <AreaSparkline data={trend.map((value, index) => ({ index, value }))} dataKey="value" height={40} curve="natural" color={up ? 'var(--money-in)' : 'var(--money-out)'} interactive={false} />
                  : <span className="type-caption flex h-full items-center text-muted">No recent prices</span>}
              </span>
              <span className="flex items-end justify-between gap-2">
                <span className="min-w-0">
                  <span className="type-figure-row block truncate text-ink"><Amount value={holding.currentValue} currency={currency} /></span>
                  <span className="type-caption block text-muted">{weight.toFixed(1)}% of portfolio</span>
                </span>
                <Badge tone={gainTone(returnPct)}>{returnPct === null ? 'No price' : signedPct(returnPct)}</Badge>
              </span>
            </button>
          );
        })}
      </div>
      {canScrollRight && (
        <div className="absolute right-0 top-1/2 -translate-y-1/2 z-10 hidden md:block -mr-3">
          <IconButton
            icon="chevron_right"
            label="Scroll right"
            className="rounded-full shadow-md bg-surface/90 backdrop-blur-sm border border-line text-ink hover:bg-surface"
            onPress={() => scrollBy(248)}
          />
        </div>
      )}
    </div>
  );
};

export interface MoverRow { holding: HoldingSummary; gain: number; pct: number; trend: number[] }

/** Best and worst returns, switchable, each with its recent price line. */
export const Movers: React.FC<{ rows: MoverRow[]; currency: Currency; onOpen: (symbol: string) => void }> = ({ rows, currency, onOpen }) => {
  const [side, setSide] = useState<'up' | 'down'>('up');
  const gainers = rows.filter(row => row.gain >= 0).sort((a, b) => b.pct - a.pct).slice(0, 5);
  const losers = rows.filter(row => row.gain < 0).sort((a, b) => a.pct - b.pct).slice(0, 5);
  const list = side === 'up' ? gainers : losers;
  const widest = Math.max(1, ...list.map(row => Math.abs(row.pct)));
  return (
    <div className="flex h-full flex-col gap-3">
      <SegmentedControl items={[{ id: 'up', label: `Gainers ${gainers.length}` }, { id: 'down', label: `Losers ${losers.length}` }]} activeId={side} onChange={id => setSide(id as 'up' | 'down')} />
      {list.length === 0 ? (
        <p className="type-body py-6 text-center text-muted">{side === 'up' ? 'Nothing is up on its cost yet.' : 'Nothing is below its cost. Nice.'}</p>
      ) : (
        <ul className="divide-y divide-line">
          {list.map(row => (
            <li key={row.holding.symbol}>
              <button type="button" onClick={() => onOpen(row.holding.symbol)} className="flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] py-1.5 text-left hover:bg-inset">
                <span className="min-w-0 flex-1">
                  <span className="type-body-strong block truncate text-ink">{row.holding.name || row.holding.symbol}</span>
                  <span className="type-caption block truncate text-muted"><Amount value={row.holding.currentPrice} currency={row.holding.currency ?? currency} /> per unit</span>
                  <span className="mt-1 block"><ShareBar value={(Math.abs(row.pct) / widest) * 100} label={`${row.holding.symbol} return`} tone={row.gain >= 0 ? 'ok' : 'bad'} /></span>
                </span>
                <span className="w-16 shrink-0">
                  {row.trend.length > 1 && <LineSparkline data={row.trend.map((value, index) => ({ index, value }))} dataKey="value" height={28} curve="natural" color={row.trend[row.trend.length - 1] >= row.trend[0] ? 'var(--money-in)' : 'var(--money-out)'} interactive={false} />}
                </span>
                <span className="w-24 shrink-0 text-right">
                  <span className={cn('type-figure-row block', row.gain >= 0 ? 'text-money-in' : 'text-money-out')}>{signedPct(row.pct)}</span>
                  <span className="type-caption block text-muted"><Amount value={row.gain} currency={currency} tone="flow" /></span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/** How spread out the money is: a gauge of effective positions, with the largest shares beside it. */
export const DiversificationCard: React.FC<{ figures: Diversification; biggest?: { label: string; share: number } }> = ({ figures, biggest }) => {
  const tone = figures.verdict === 'Concentrated' ? 'loss' : figures.verdict === 'Focused' ? 'amber' : 'pine';
  return (
    <div className="flex items-center gap-5 max-sm:flex-col max-sm:items-start">
      <StatGauge fill={figures.score} tone={tone} size={132} label="Diversification" display={<span className="type-figure-lg text-ink">{figures.effective.toFixed(1)}</span>} caption={figures.verdict} />
      <dl className="grid min-w-0 max-w-lg flex-1 grid-cols-2 gap-x-4 gap-y-3">
        <div><dt className="type-label text-muted">Positions</dt><dd className="type-figure-row text-ink">{figures.count}</dd></div>
        <div><dt className="type-label text-muted">Worth as equal</dt><dd className="type-figure-row text-ink">{figures.effective.toFixed(1)}</dd></div>
        <div><dt className="type-label text-muted">Largest</dt><dd className="type-figure-row text-ink">{figures.topShare.toFixed(1)}%</dd></div>
        <div><dt className="type-label text-muted">Top three</dt><dd className="type-figure-row text-ink">{figures.top3Share.toFixed(1)}%</dd></div>
        {biggest && <p className="type-caption col-span-2 text-muted">{biggest.label} is your biggest position at {biggest.share.toFixed(1)}%. {figures.topShare > 25 ? 'Over a quarter in one place adds risk.' : 'No single position dominates.'}</p>}
      </dl>
    </div>
  );
};

/** Winning against losing sales as a ring, with the rate (or the hovered count) in the middle. */
export const WinRate: React.FC<{ wins: number; losses: number }> = ({ wins, losses }) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = wins + losses;
  const rate = total > 0 ? Math.round((wins / total) * 100) : 0;
  const data = [
    { label: 'Winning', value: wins, maxValue: Math.max(1, total), color: 'var(--money-in)' },
    { label: 'Losing', value: losses, maxValue: Math.max(1, total), color: 'var(--money-out)' },
  ];
  const active = hovered === null ? null : data[hovered];
  return (
    <div className="flex items-center gap-5">
      <div role="img" aria-label={`Win rate ${rate}%: ${wins} winning and ${losses} losing sales`} className="relative shrink-0">
        <RingChart data={data} size={132} strokeWidth={12} ringGap={5} baseInnerRadius={36} hoveredIndex={hovered} onHoverChange={setHovered}>
          {data.map((_, index) => <Ring key={index} index={index} />)}
        </RingChart>
        <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="type-figure-row text-ink">{active ? active.value : `${rate}%`}</span>
          <span className="type-caption text-muted">{active ? active.label : 'Win rate'}</span>
        </span>
      </div>
      <ul className="space-y-2">
        {data.map((item, index) => (
          <li key={item.label} className="type-body flex items-center gap-2 text-ink" onMouseEnter={() => setHovered(index)} onMouseLeave={() => setHovered(null)}>
            <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            {item.value} {item.label.toLowerCase()} {item.value === 1 ? 'sale' : 'sales'}
          </li>
        ))}
      </ul>
    </div>
  );
};
