import React from 'react';
import type { HoldingSummary } from '../types';
import { cn } from '../lib/utils';
import { IconButton } from './ui/Actions';
import { Badge, Sparkline } from './ui/Display';
import { Menu, type MenuAction } from './ui/Menu';
import { Amount } from './ui/Money';
import { BrandMark } from './ServiceCard';

export interface HoldingRow {
  holding: HoldingSummary;
  trend: { value: number }[];
  menu: MenuAction[];
}

interface HoldingsTableProps {
  rows: HoldingRow[];
  isPhone: boolean;
  onOpen: (holding: HoldingSummary) => void;
}

const gainOf = (holding: HoldingSummary) => (holding.priceUnavailable ? null : holding.currentValue - holding.totalCost);
const gainPct = (holding: HoldingSummary) => {
  const gain = gainOf(holding);
  return gain === null || holding.totalCost <= 0 ? null : (gain / holding.totalCost) * 100;
};

const GainCell: React.FC<{ holding: HoldingSummary }> = ({ holding }) => {
  const pct = gainPct(holding);
  if (pct === null) return <span className="type-caption text-muted">{holding.priceUnavailable ? 'No price' : '—'}</span>;
  return <span className={cn('type-figure-row', pct >= 0 ? 'text-money-in' : 'text-money-out')}>{pct >= 0 ? '+' : '−'}{Math.abs(pct).toFixed(1)}%</span>;
};

const Identity: React.FC<{ holding: HoldingSummary }> = ({ holding }) => (
  <span className="flex min-w-0 items-center gap-3">
    <BrandMark name={holding.name || holding.symbol} />
    <span className="min-w-0">
      <span className="type-body-strong block truncate text-ink">{holding.symbol}</span>
      <span className="type-caption block truncate text-muted">{holding.name}</span>
    </span>
  </span>
);

/** Rivet's holdings table (D-025). Phones keep name, value and gain (`INV-16`). */
const HoldingsTable: React.FC<HoldingsTableProps> = ({ rows, isPhone, onOpen }) => {
  if (isPhone) {
    return (
      <ul className="divide-y divide-line">
        {rows.map(({ holding, menu }) => (
          <li key={holding.symbol} className="flex items-center gap-1">
            <button type="button" onClick={() => onOpen(holding)} className="flex min-h-14 min-w-0 flex-1 cursor-pointer items-center justify-between gap-3 py-1.5 text-left">
              <Identity holding={holding} />
              <span className="shrink-0 text-right">
                <span className="type-figure-row block text-ink"><Amount value={holding.currentValue} currency="EUR" /></span>
                <GainCell holding={holding} />
              </span>
            </button>
            <Menu title={holding.symbol} trigger={<IconButton icon="more_horiz" label={`Actions for ${holding.symbol}`} tooltipPlacement="left" />} items={menu} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr className="border-b border-line text-left">
            <th scope="col" className="type-label py-2 pr-3 text-muted">Holding</th>
            <th scope="col" className="type-label px-3 py-2 text-right text-muted">Units</th>
            <th scope="col" className="type-label px-3 py-2 text-right text-muted">Price</th>
            <th scope="col" className="type-label px-3 py-2 text-muted">30 days</th>
            <th scope="col" className="type-label px-3 py-2 text-right text-muted">Value</th>
            <th scope="col" className="type-label px-3 py-2 text-right text-muted">Gain</th>
            <th scope="col"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ holding, trend, menu }) => (
            <tr key={holding.symbol} className="border-b border-line last:border-0">
              <td className="max-w-64 py-2 pr-3">
                <button type="button" onClick={() => onOpen(holding)} className="block w-full min-w-0 cursor-pointer text-left"><Identity holding={holding} /></button>
              </td>
              <td className="type-figure-row px-3 py-2 text-right text-ink">{holding.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
              <td className="type-figure-row px-3 py-2 text-right text-ink">
                <Amount value={holding.currentPrice} currency={holding.currency ?? 'EUR'} />
                {holding.priceUnavailable && <span className="block"><Badge tone="attention">Last trade</Badge></span>}
              </td>
              <td className="px-3 py-2"><Sparkline data={trend} isPositive={trend.length < 2 || trend[trend.length - 1].value >= trend[0].value} /></td>
              <td className="type-figure-row px-3 py-2 text-right text-ink"><Amount value={holding.currentValue} currency="EUR" /></td>
              <td className="px-3 py-2 text-right"><GainCell holding={holding} /></td>
              <td className="py-2 text-right"><Menu title={holding.symbol} trigger={<IconButton icon="more_horiz" label={`Actions for ${holding.symbol}`} tooltipPlacement="left" />} items={menu} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default HoldingsTable;
