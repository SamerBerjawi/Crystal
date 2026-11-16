import React from 'react';
import { LineSparkline } from '../../src/components/charts/sparkline';
import {
  Cell,
  Column,
  Row as AriaRow,
  Table,
  TableBody,
  TableHeader,
  type Selection,
  type SortDescriptor,
} from 'react-aria-components';
import Icon from './Icon';
import { Button } from './Actions';
import { StatGauge } from './StatGauge';
import { Checkbox } from './Fields';
import { useIsMobile } from '../../hooks/useIsMobile';
import { cn } from '../../lib/utils';

const BADGE_TONES = {
  neutral: 'bg-inset',
  positive: 'bg-money-in-soft',
  attention: 'bg-amber-soft',
  negative: 'bg-money-out-soft',
  blue: 'bg-blue-soft',
  tomato: 'bg-tomato-soft',
  rose: 'bg-rose-soft',
  teal: 'bg-teal-soft',
} as const;

const BADGE_DOTS: Record<keyof typeof BADGE_TONES, string> = {
  neutral: 'bg-muted',
  positive: 'bg-money-in',
  attention: 'bg-amber',
  negative: 'bg-money-out',
  blue: 'bg-blue',
  tomato: 'bg-tomato',
  rose: 'bg-rose',
  teal: 'bg-teal',
};

/** Soft tints hold ink text with a coloured icon or dot, never coloured text. */
export const Badge: React.FC<{ tone?: keyof typeof BADGE_TONES; icon?: string; children: React.ReactNode; className?: string }> = ({ tone = 'neutral', icon, children, className }) => (
  <span className={cn('inline-flex h-6 max-w-full items-center gap-1.5 rounded-full px-2.5 type-caption text-ink', BADGE_TONES[tone], className)}>
    {icon ? <Icon name={icon} size={16} /> : <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', BADGE_DOTS[tone])} />}
    <span className="truncate">{children}</span>
  </span>
);

export const CountPill: React.FC<{ count: number; className?: string }> = ({ count, className }) => (
  <span className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-pill px-1.5 type-caption text-on-pill tabular-nums', className)}>
    {count}
  </span>
);

/**
 * A small inline trend, drawn with Bklit's quiet area sparkline. It's decoration beside a figure, so it's hidden from
 * screen readers and does not react to the pointer. Green when it ends higher than it started, red when lower. Without a
 * fixed `width` (or with `preserveAspect={false}`) it fills the width of its parent.
 */
/**
 * A trend with its small wobbles averaged out, so the line reads as a shape rather than noise. The window grows with the
 * number of points, and the first and last points stay where they are so the line still starts and ends true.
 */
const smoothTrend = (data: { value: number }[]): { value: number }[] => {
  const radius = Math.min(6, Math.floor(data.length / 14));
  if (radius < 1) return data;
  return data.map((point, index) => {
    if (index === 0 || index === data.length - 1) return point;
    let total = 0;
    let weight = 0;
    for (let offset = -radius; offset <= radius; offset += 1) {
      const neighbour = data[index + offset];
      if (!neighbour) continue;
      const w = radius + 1 - Math.abs(offset); // a triangle: the nearer, the heavier
      total += neighbour.value * w;
      weight += w;
    }
    return { ...point, value: total / weight };
  });
};

export const Sparkline: React.FC<{ data: { value: number }[]; isPositive: boolean; width?: number; height?: number; className?: string; preserveAspect?: boolean }> = ({ data: raw, isPositive, width = 120, height = 24, className, preserveAspect = true }) => {
  const data = React.useMemo(() => smoothTrend(raw).map((point, i) => ({ day: `Day ${i + 1}`, value: point.value })), [raw]);
  if (data.length < 2) return null;
  if (!preserveAspect) {
    return (
      <span aria-hidden="true" className={cn('block w-full', className)}>
        <LineSparkline
          curve="natural"
          data={data}
          dataKey="value"
          height={48}
          springConfig={{ stiffness: 600, damping: 45 }}
        />
      </span>
    );
  }
  return (
    <span aria-hidden="true" className={cn('inline-block shrink-0', className)} style={{ width, height }}>
      <LineSparkline
        color={isPositive ? 'var(--chart-positive)' : 'var(--chart-negative)'}
        curve="natural"
        data={data}
        dataKey="value"
        height={height}
        strokeWidth={1.5}
        width={width}
      />
    </span>
  );
};

/** Long lists load in batches (D-040). */
export const ShowMore: React.FC<{ remaining: number; onPress: () => void; className?: string }> = ({ remaining, onPress, className }) =>
  remaining > 0 ? (
    <div className={cn('flex justify-center py-4', className)}>
      <Button variant="secondary" onPress={onPress}>Show more ({remaining.toLocaleString()} left)</Button>
    </div>
  ) : null;

/** The phone's list row, 64 px: name and context on the left, amount on the right. */
export const Row: React.FC<{
  title: React.ReactNode;
  context?: React.ReactNode;
  trailing?: React.ReactNode;
  leading?: React.ReactNode;
  onPress?: () => void;
  isSelected?: boolean;
  className?: string;
}> = ({ title, context, trailing, leading, onPress, isSelected, className }) => {
  const body = (
    <>
      {leading && <span className="shrink-0">{leading}</span>}
      <span className="min-w-0 flex-1 text-left">
        <span className="type-body-strong block truncate text-ink">{title}</span>
        {context && <span className="type-caption block truncate text-muted">{context}</span>}
      </span>
      {trailing && <span className="type-figure-row shrink-0 text-ink">{trailing}</span>}
    </>
  );
  const styles = cn('flex min-h-16 w-full items-center gap-3 px-1 py-2', isSelected && 'bg-primary-soft', className);
  return onPress ? <button type="button" onClick={onPress} className={cn(styles, 'cursor-pointer active:bg-inset')}>{body}</button> : <div className={styles}>{body}</div>;
};

/** A progress ring powered by the standardized Bklit Gauge. */
export const ProgressRing: React.FC<{ value: number; size?: number; tone?: 'pine' | 'amber' | 'loss'; strokeColor?: string; label: string; caption?: string }> = ({ value, size = 128, tone = 'pine', strokeColor, label, caption }) => (
  <StatGauge fill={value} size={size} tone={tone} color={strokeColor} label={label} display={label} caption={caption} />
);

/** A clean section day heading in a phone list or table section. */
export const DayGroup: React.FC<{ label: React.ReactNode; total?: React.ReactNode; children: React.ReactNode; className?: string }> = ({ label, total, children, className }) => (
  <section className={className}>
    <div className="type-label flex items-center justify-between py-2 text-muted">
      <span>{label}</span>
      {total && <span className="tabular-nums">{total}</span>}
    </div>
    {children}
  </section>
);

export interface TableColumn<T> {
  id: string;
  label: string;
  /** Numbers are right-aligned. */
  align?: 'left' | 'right';
  isSortable?: boolean;
  /** Tablets show key columns only. The rest appear in the detail panel. */
  isKey?: boolean;
  width?: number | string;
  render: (row: T) => React.ReactNode;
}

export type TableDensity = 'comfortable' | 'compact';

export interface DataTableProps<T extends { id: string }> {
  label: string;
  columns: TableColumn<T>[];
  rows: T[];
  density?: TableDensity;
  variant?: 'card' | 'plain';
  /** The phone list row. Tables become `Row` lists under 768 px. */
  renderPhoneRow: (row: T) => React.ReactNode;
  empty?: React.ReactNode;
  sort?: SortDescriptor;
  onSortChange?: (sort: SortDescriptor) => void;
  selection?: Selection;
  onSelectionChange?: (keys: Selection) => void;
  onRowOpen?: (row: T) => void;
  className?: string;
}

/** Comfortable or Compact, with a sticky header, selection and full keyboard support. */
export function DataTable<T extends { id: string }>({ label, columns, rows, density = 'comfortable', variant = 'card', renderPhoneRow, empty, sort, onSortChange, selection, onSelectionChange, onRowOpen, className }: DataTableProps<T>) {
  const isPhone = useIsMobile();

  if (isPhone) {
    if (!rows.length) return <>{empty}</>;
    return <ul aria-label={label} className={cn('divide-y divide-line', className)}>{rows.map(row => <li key={row.id}>{renderPhoneRow(row)}</li>)}</ul>;
  }

  const cellPad = density === 'comfortable' ? 'px-4' : 'px-3';
  const rowHeight = density === 'comfortable' ? 'h-14' : 'h-10';
  const isSelectable = !!onSelectionChange;
  const secondary = 'max-lg:hidden';

  return (
    <div className={cn('overflow-x-auto', variant === 'card' && 'rounded-[var(--radius-xl)] surface-card', className)}>
      <Table
        aria-label={label}
        sortDescriptor={sort}
        onSortChange={onSortChange}
        selectionMode={isSelectable ? 'multiple' : 'none'}
        selectedKeys={selection}
        onSelectionChange={onSelectionChange}
        onRowAction={onRowOpen ? key => { const row = rows.find(item => item.id === key); if (row) onRowOpen(row); } : undefined}
        className="w-full border-separate border-spacing-0"
      >
        <TableHeader className="border-b border-line">
          {isSelectable && (
            <Column width={44} className={cn('h-10 outline-hidden', cellPad)}>
              <Checkbox slot="selection">{null}</Checkbox>
            </Column>
          )}
          {columns.map((column, index) => (
            <Column
              key={column.id}
              id={column.id}
              isRowHeader={index === 0}
              allowsSorting={column.isSortable}
              style={{ width: column.width }}
              className={cn('type-label h-10 whitespace-nowrap text-muted outline-hidden data-[allows-sorting]:cursor-pointer data-[focus-visible]:outline-2 data-[focus-visible]:-outline-offset-2 data-[focus-visible]:outline-focus', cellPad, column.align === 'right' ? 'text-right' : 'text-left', !column.isKey && index > 0 && secondary)}
            >
              {({ sortDirection }) => (
                <span className={cn('inline-flex items-center gap-1', column.align === 'right' && 'flex-row-reverse')}>
                  {column.label}
                  {sortDirection && <Icon name={sortDirection === 'ascending' ? 'arrow_upward' : 'arrow_downward'} size={16} />}
                </span>
              )}
            </Column>
          ))}
        </TableHeader>
        <TableBody renderEmptyState={() => empty ?? null}>
          {rows.map(row => (
            <AriaRow
              key={row.id}
              id={row.id}
              textValue={row.id}
              className={cn('group outline-hidden data-[hovered]:bg-inset data-[selected]:bg-primary-soft data-[focus-visible]:outline-2 data-[focus-visible]:-outline-offset-2 data-[focus-visible]:outline-focus', onRowOpen && 'cursor-pointer')}
            >
              {isSelectable && (
                <Cell className={cn('border-t border-line outline-hidden', rowHeight, cellPad)}>
                  <Checkbox slot="selection">{null}</Checkbox>
                </Cell>
              )}
              {columns.map((column, index) => (
                <Cell
                  key={column.id}
                  className={cn('border-t border-line text-ink outline-hidden data-[focus-visible]:outline-2 data-[focus-visible]:-outline-offset-2 data-[focus-visible]:outline-focus', rowHeight, cellPad, column.align === 'right' ? 'type-figure-row text-right' : 'type-body', !column.isKey && index > 0 && secondary)}
                >
                  {column.render(row)}
                </Cell>
              ))}
            </AriaRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
