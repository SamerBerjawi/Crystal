import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Currency } from '../../types';
import { squarify } from '../../utils/portfolioInsights';
import { Amount } from '../ui/Money';
import { cn } from '../../lib/utils';

export interface TreemapHolding {
  id: string;
  label: string;
  sublabel?: string;
  value: number;
  /** Return on cost in percent, or null when there's no price. */
  returnPct: number | null;
}

interface HoldingsTreemapProps {
  items: TreemapHolding[];
  currency: Currency;
  total: number;
  onOpen?: (id: string) => void;
  height?: number;
}

/** ±this return paints a tile at full strength. */
const FULL_AT = 30;
const GAP = 4;

/** A soft tint of gain or loss, never stronger than ink text can sit on. */
const tint = (pct: number | null) => {
  if (pct === null) return 'var(--inset)';
  const strength = Math.round(14 + Math.min(1, Math.abs(pct) / FULL_AT) * 46);
  return `color-mix(in oklab, ${pct >= 0 ? 'var(--money-in)' : 'var(--money-out)'} ${strength}%, var(--solid))`;
};
const signed = (pct: number) => `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(1)}%`;

/** Every holding as a tile: its size is its weight, its colour is its return. The figure is always written on it too. */
const HoldingsTreemap: React.FC<HoldingsTreemapProps> = ({ items, currency, total, onOpen, height = 300 }) => {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);

  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    setWidth(element.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const tiles = useMemo(() => squarify(items.map(item => ({ id: item.id, value: item.value, item })), width + GAP, height + GAP), [items, width, height]);
  const active = hovered ? items.find(item => item.id === hovered) : null;

  return (
    <div>
      <div ref={box} className="relative w-full" style={{ height }} onMouseLeave={() => setHovered(null)}>
        {tiles.map(tile => {
          const { item } = tile;
          const w = Math.max(0, tile.w - GAP);
          const h = Math.max(0, tile.h - GAP);
          const roomy = w > 88 && h > 56;
          const tiny = w < 44 || h < 30;
          const share = total > 0 ? (item.value / total) * 100 : 0;
          return (
            <button
              key={tile.id}
              type="button"
              onClick={() => onOpen?.(item.id)}
              onMouseEnter={() => setHovered(item.id)}
              onFocus={() => setHovered(item.id)}
              onBlur={() => setHovered(null)}
              aria-label={`${item.label}, ${share.toFixed(1)}% of the portfolio, ${item.returnPct === null ? 'no price' : `${signed(item.returnPct)} return`}`}
              className={cn(
                'absolute flex cursor-pointer flex-col justify-between overflow-hidden rounded-[var(--radius-md)] p-2 text-left text-ink outline-none transition-[filter,box-shadow] duration-150',
                'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus',
                hovered && hovered !== item.id && 'opacity-70',
                hovered === item.id && 'shadow-[var(--shadow-md)]',
              )}
              style={{ left: tile.x, top: tile.y, width: w, height: h, background: tint(item.returnPct) }}
            >
              {!tiny && (
                <>
                  <span className="min-w-0">
                    <span className={cn('block truncate', roomy ? 'type-body-strong' : 'type-caption font-bold')}>{item.label}</span>
                    {roomy && item.sublabel && <span className="type-caption block truncate text-muted">{item.sublabel}</span>}
                  </span>
                  <span className={cn('flex items-end justify-between gap-1', !roomy && 'flex-col items-start')}>
                    <span className={cn('tabular-nums', roomy ? 'type-figure-row' : 'type-caption font-bold')}>{item.returnPct === null ? '—' : signed(item.returnPct)}</span>
                    {roomy && <span className="type-caption tabular-nums text-muted">{share.toFixed(1)}%</span>}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="type-caption min-h-5 text-muted" aria-live="polite">
          {active
            ? <><span className="font-bold text-ink">{active.label}</span>: <Amount value={active.value} currency={currency} />, {(total > 0 ? (active.value / total) * 100 : 0).toFixed(1)}% of this view{active.returnPct !== null && <>, {signed(active.returnPct)} return</>}</>
            : 'Size is the share of the portfolio. Colour is the return on cost.'}
        </p>
        <div className="type-caption flex items-center gap-2 text-muted" aria-hidden="true">
          <span>−{FULL_AT}%</span>
          <span className="h-2 w-28 rounded-full" style={{ background: `linear-gradient(90deg, ${tint(-FULL_AT)}, ${tint(0)}, ${tint(FULL_AT)})` }} />
          <span>+{FULL_AT}%</span>
        </div>
      </div>
    </div>
  );
};

export default HoldingsTreemap;
