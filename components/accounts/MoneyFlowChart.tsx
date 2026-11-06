import React, { useEffect, useMemo, useState } from 'react';
import { curveNatural } from 'd3-shape';
import type { Category, Currency } from '../../types';
import { formatCurrency } from '../../utils';
import { FLOW_UNITS, type FlowPeriod, type FlowUnit } from '../../utils/activityModel';
import { parseDay } from '../../utils/accountPagesModel';
import { ChartTooltip, ComposedChart, Grid, Line, SeriesBar, useChartHoverSelector, XAxis } from '../../src/components/bklit';
import { EntityGlyph } from '../EntityIcon';
import { Amount } from '../ui/Money';
import SegmentedControl from '../ui/SegmentedControl';
import { EmptyState } from '../ui/States';

export interface CategoryStyle { color?: string; icon?: string }

/** Colour and icon for a category name, from the category tree. Sub-categories borrow their parent's. */
export const categoryStyles = (categories: Category[]): ((name: string) => CategoryStyle) => {
  const details = new Map<string, CategoryStyle>();
  const walk = (nodes: Category[], icon?: string, color?: string) => nodes.forEach(node => {
    details.set(node.name, { icon: node.icon || icon, color: node.color || color });
    walk(node.subCategories ?? [], node.icon || icon, node.color || color);
  });
  walk(categories);
  return name => details.get(name) ?? {};
};

interface MoneyFlowChartProps {
  periods: FlowPeriod[];
  currency: Currency;
  /** Words for this account: a card is "Spent" and "Paid", a loan "Paid" and "Added". */
  labels?: { in: string; out: string; balance: string };
  /** Weeks, months or quarters. Leave out for a chart whose periods are fixed. */
  units?: { active: FlowUnit; onChange: (unit: FlowUnit) => void };
  hint?: string;
  categoryStyle?: (name: string) => CategoryStyle;
  /** Show "where it went" and the top source for the picked period. */
  showDetail?: boolean;
  onCategory?: (name: string) => void;
  height?: number;
}

const DEFAULT_LABELS = { in: 'Money in', out: 'Money out', balance: 'Balance' };

/** Tells the card which period the pointer is over, so the panel beside the chart follows it. */
const ActivePeriod: React.FC<{ onActive: (index: number) => void }> = ({ onActive }) => {
  const index = useChartHoverSelector(state => state.tooltipData?.index ?? null);
  useEffect(() => { if (index !== null) onActive(index); }, [index, onActive]);
  return null;
};
(ActivePeriod as unknown as { __isPostOverlay: boolean }).__isPostOverlay = true;

/**
 * Money in and out, period by period, on the Bklit composed chart: a bar for what came in and one for what went out, a
 * line for the balance, and a panel beside it for the period under the pointer: where its money went and who paid in.
 */
const MoneyFlowChart: React.FC<MoneyFlowChartProps> = ({ periods, currency, labels = DEFAULT_LABELS, units, hint = 'Hover a bar to see where it went', categoryStyle, showDetail = true, onCategory, height = 230 }) => {
  const [picked, setPicked] = useState<number | null>(null);

  const hasBalance = periods.length > 0 && periods.every(period => period.balance !== undefined);
  const index = picked !== null && picked < periods.length ? picked : periods.length - 1;
  const current = periods[index];

  const data = useMemo(() => periods.map(period => ({
    date: parseDay(period.id.length === 7 ? `${period.id}-01` : period.id),
    in: period.inValue,
    out: period.outValue,
    ...(hasBalance ? { balance: period.balance } : {}),
  })), [periods, hasBalance]);

  if (!current || periods.every(period => period.inValue === 0 && period.outValue === 0)) {
    return (
      <div className="space-y-3">
        {units && <div className="flex justify-end"><SegmentedControl items={FLOW_UNITS} activeId={units.active} onChange={id => { setPicked(null); units.onChange(id as FlowUnit); }} /></div>}
        <EmptyState icon="chart-column" title="No money moved" description="Nothing came in or went out in this stretch." className="py-6" />
      </div>
    );
  }

  const net = current.inValue - current.outValue;
  const showDetails = showDetail && (current.categories.length > 0 || !!current.topSource);
  const xLabels = periods.map(period => period.short);
  const longLabels = periods.map(period => period.long);

  return (
    <div className="@container space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="type-caption text-muted">{hint}</p>
        {units && <SegmentedControl items={FLOW_UNITS} activeId={units.active} onChange={id => { setPicked(null); units.onChange(id as FlowUnit); }} />}
      </div>

      <div className="flex flex-col gap-5 @[680px]:flex-row">
        <div className="min-w-0 flex-1">
          <div style={{ height }}>
            <ComposedChart data={data} aspectRatio="auto" className="h-full" margin={{ top: 8, right: 8, bottom: 40, left: 8 }} barGap={0} maxBarSize={26}>
              <Grid horizontal />
              <SeriesBar dataKey="in" fill="var(--money-in)" radius={4} />
              <SeriesBar dataKey="out" fill="var(--money-out)" radius={4} />
              {hasBalance && <Line dataKey="balance" yAxisId="balance" stroke="var(--chart-1)" strokeWidth={2} curve={curveNatural} />}
              <ChartTooltip
                showCrosshair={false}
                dateLabels={longLabels}
                rows={point => {
                  const row = point as { in?: number; out?: number; balance?: number };
                  return [
                    { color: 'var(--money-in)', label: labels.in, value: formatCurrency(row.in ?? 0, currency) },
                    { color: 'var(--money-out)', label: labels.out, value: formatCurrency(row.out ?? 0, currency) },
                    ...(hasBalance ? [{ color: 'var(--chart-1)', label: labels.balance, value: formatCurrency(row.balance ?? 0, currency) }] : []),
                  ];
                }}
              />
              <XAxis numTicks={Math.min(periods.length, 8)} labels={xLabels} />
              <ActivePeriod onActive={setPicked} />
            </ComposedChart>
          </div>
          <ul className="type-caption mt-2 flex flex-wrap gap-x-4 gap-y-1 text-muted">
            <li className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: 'var(--money-in)' }} />{labels.in}</li>
            <li className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: 'var(--money-out)' }} />{labels.out}</li>
            {hasBalance && <li className="flex items-center gap-1.5"><span className="h-0.5 w-3.5 rounded-full" style={{ background: 'var(--chart-1)' }} />{labels.balance}</li>}
          </ul>
        </div>

        <aside className="w-full shrink-0 rounded-[var(--radius-lg)] bg-inset p-4 @[680px]:w-[260px]" aria-label={current.long}>
          <p className="flex items-center justify-between gap-2 text-ink">
            <span className="type-body-strong">{current.long}</span>
            {current.isOpen && <span className="type-caption rounded-full bg-[var(--money-in-soft)] px-2 py-0.5 text-[var(--money-in)]">So far</span>}
          </p>
          <dl className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between"><dt className="type-caption flex items-center gap-1.5 text-muted"><span className="size-2 rounded-full" style={{ background: 'var(--money-in)' }} />{labels.in}</dt><dd className="type-figure-row text-ink"><Amount value={current.inValue} currency={currency} /></dd></div>
            <div className="flex items-center justify-between"><dt className="type-caption flex items-center gap-1.5 text-muted"><span className="size-2 rounded-full" style={{ background: 'var(--money-out)' }} />{labels.out}</dt><dd className="type-figure-row text-ink"><Amount value={current.outValue} currency={currency} /></dd></div>
            <div className="flex items-center justify-between border-t border-line pt-1.5"><dt className="type-caption text-muted">Net</dt><dd className="type-figure-row"><Amount value={net} currency={currency} tone="flow" className={net >= 0 ? 'text-[var(--money-in)]' : undefined} /></dd></div>
          </dl>

          {showDetails && current.categories.length > 0 && (
            <>
              <p className="type-label mt-4 text-muted">Where it went</p>
              <ul className="mt-1.5 space-y-2">
                {current.categories.map(category => {
                  const style = categoryStyle?.(category.name) ?? {};
                  const color = style.color || 'var(--muted)';
                  const body = (
                    <>
                      <span className="flex items-center justify-between gap-2">
                        <span className="type-body flex min-w-0 items-center gap-2 text-ink"><EntityGlyph icon={style.icon} label={category.name} color={style.color} size={14} /><span className="truncate">{category.name}</span></span>
                        <span className="type-figure-row shrink-0 text-ink"><Amount value={category.value} currency={currency} /></span>
                      </span>
                      <span className="mt-1 block h-1 rounded-full bg-line"><span className="block h-full rounded-full" style={{ width: `${Math.max(4, category.share * 100)}%`, background: color }} /></span>
                    </>
                  );
                  return (
                    <li key={category.name}>
                      {onCategory
                        ? <button type="button" onClick={() => onCategory(category.name)} className="w-full cursor-pointer text-left">{body}</button>
                        : <div className="w-full text-left">{body}</div>}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {showDetail && current.topSource && (
            <p className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
              <span className="min-w-0"><span className="type-caption block text-muted">Top source</span><span className="type-body-strong block truncate text-ink">{current.topSource.name}</span></span>
              <span className="type-figure-row shrink-0 text-ink"><Amount value={current.topSource.value} currency={currency} /></span>
            </p>
          )}
        </aside>
      </div>
    </div>
  );
};

export default MoneyFlowChart;
