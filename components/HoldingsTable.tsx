import { getMainCurrency } from '../utils';
import React, { useMemo, useState } from 'react';
import type { SortDescriptor } from 'react-aria-components';
import type { HoldingSummary } from '../types';
import { cn } from '../lib/utils';
import { formatHoldingType } from '../utils/investments';
import { LineSparkline } from '../src/components/charts';
import { ShareBar } from './accounts/charts';
import { IconButton } from './ui/Actions';
import { DataTable, type TableColumn } from './ui/Display';
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
  /** What the weights are a share of. */
  total: number;
  onOpen: (holding: HoldingSummary) => void;
  empty?: React.ReactNode;
}

type TableRow = HoldingRow & { id: string; gain: number | null; pct: number | null; weight: number };

const gainOf = (holding: HoldingSummary) => (holding.priceUnavailable ? null : holding.currentValue - holding.totalCost);

const GainCell: React.FC<{ row: TableRow }> = ({ row }) => {
  if (row.pct === null || row.gain === null) return <span className="type-caption text-muted">{row.holding.priceUnavailable ? 'No price' : '—'}</span>;
  return (
    <span className="inline-flex flex-col items-end">
      <span className={cn('type-figure-row', row.pct >= 0 ? 'text-money-in' : 'text-money-out')}>{row.pct >= 0 ? '+' : '−'}{Math.abs(row.pct).toFixed(1)}%</span>
      <span className="type-caption text-muted"><Amount value={row.gain} currency={getMainCurrency()} tone="flow" /></span>
    </span>
  );
};

const Identity: React.FC<{ holding: HoldingSummary }> = ({ holding }) => (
  <span className="flex min-w-0 items-center gap-3">
    <BrandMark name={holding.name || holding.symbol} />
    <span className="min-w-0">
      <span className="type-body-strong block truncate text-ink">{holding.name || holding.symbol}</span>
      <span className="type-caption block truncate text-muted">{holding.symbol} · {holding.type === 'Warrant' ? 'Warrant' : formatHoldingType(holding.subType)}</span>
    </span>
  </span>
);

const Trend: React.FC<{ trend: { value: number }[] }> = ({ trend }) => (
  trend.length > 1
    ? <span className="block w-24"><LineSparkline data={trend.map((point, index) => ({ index, value: point.value }))} dataKey="value" height={28} curve="natural" color={trend[trend.length - 1].value >= trend[0].value ? 'var(--money-in)' : 'var(--money-out)'} /></span>
    : <span className="type-caption text-muted">—</span>
);

const SORTERS: Record<string, (row: TableRow) => number | string> = {
  holding: row => (row.holding.name || row.holding.symbol).toLowerCase(),
  weight: row => row.weight,
  value: row => row.holding.currentValue,
  gain: row => row.pct ?? -Infinity,
  price: row => row.holding.currentPrice,
};

/** Every holding with its weight, recent price and return. Columns sort; phones keep name, value and return (`INV-16`). */
const HoldingsTable: React.FC<HoldingsTableProps> = ({ rows, total, onOpen, empty }) => {
  const [sort, setSort] = useState<SortDescriptor>({ column: 'value', direction: 'descending' });

  const tableRows = useMemo<TableRow[]>(() => {
    const prepared = rows.map(row => {
      const gain = gainOf(row.holding);
      return { ...row, id: row.holding.symbol, gain, pct: gain === null || row.holding.totalCost <= 0 ? null : (gain / row.holding.totalCost) * 100, weight: total > 0 ? (row.holding.currentValue / total) * 100 : 0 };
    });
    const key = SORTERS[String(sort.column)] ?? SORTERS.value;
    const direction = sort.direction === 'ascending' ? 1 : -1;
    return prepared.sort((a, b) => {
      const left = key(a);
      const right = key(b);
      return (left < right ? -1 : left > right ? 1 : 0) * direction;
    });
  }, [rows, total, sort]);

  const menuFor = (row: TableRow) => <Menu title={row.holding.symbol} trigger={<IconButton icon="more-horizontal" label={`Actions for ${row.holding.symbol}`} tooltipPlacement="left" />} items={row.menu} />;

  const columns: TableColumn<TableRow>[] = [
    { id: 'holding', label: 'Holding', isSortable: true, isKey: true, render: row => <Identity holding={row.holding} /> },
    {
      id: 'weight', label: 'Weight', isSortable: true, width: 140, render: row => (
        <span className="flex items-center gap-2">
          <span className="w-16"><ShareBar value={row.weight} label={`${row.holding.symbol} weight`} /></span>
          <span className="type-caption tabular-nums text-muted">{row.weight.toFixed(1)}%</span>
        </span>
      ),
    },
    {
      id: 'price', label: 'Price', align: 'right', isSortable: true, render: row => (
        <span className="inline-flex flex-col items-end">
          <Amount value={row.holding.currentPrice} currency={row.holding.currency ?? 'EUR'} />
          <span className="type-caption text-muted">
            {row.holding.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })} units
            {row.holding.priceUnavailable && <span className="text-attention-text"> · last trade</span>}
          </span>
        </span>
      ),
    },
    { id: 'trend', label: '30 days', render: row => <Trend trend={row.trend} /> },
    {
      id: 'value', label: 'Value', align: 'right', isSortable: true, isKey: true, render: row => (
        <span className="inline-flex flex-col items-end">
          <Amount value={row.holding.currentValue} currency={getMainCurrency()} />
          <span className="type-caption text-muted">cost <Amount value={row.holding.totalCost} currency={getMainCurrency()} /></span>
        </span>
      ),
    },
    { id: 'gain', label: 'Return', align: 'right', isSortable: true, isKey: true, render: row => <GainCell row={row} /> },
    { id: 'actions', label: 'Actions', align: 'right', isKey: true, width: 56, render: row => menuFor(row) },
  ];

  return (
    <DataTable
      label="Holdings"
      columns={columns}
      rows={tableRows}
      sort={sort}
      onSortChange={setSort}
      onRowOpen={row => onOpen(row.holding)}
      empty={empty}
      className="bg-transparent"
      renderPhoneRow={row => (
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onOpen(row.holding)} className="flex min-h-14 min-w-0 flex-1 cursor-pointer items-center justify-between gap-3 py-1.5 text-left">
            <Identity holding={row.holding} />
            <span className="shrink-0 text-right">
              <span className="type-figure-row block text-ink"><Amount value={row.holding.currentValue} currency={getMainCurrency()} /></span>
              <GainCell row={row} />
            </span>
          </button>
          {menuFor(row)}
        </div>
      )}
    />
  );
};

export default HoldingsTable;
