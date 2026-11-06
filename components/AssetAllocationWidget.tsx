import React from 'react';
import type { Currency } from '../types';
import { PieChart as BklitPieChart, PieCenter, PieSlice } from '../src/components/charts';
import { formatCurrency } from '../utils';
import Icon from './ui/Icon';
import { Amount } from './ui/Money';
import { fitRows, useWidgetBox } from './ui/WidgetGrid';

interface Group {
  value: number;
  color: string;
  icon: string;
}

interface AssetAllocationWidgetProps {
  allocation: { name: string; value: number; color: string }[];
  assetGroups: Record<string, Group>;
  liabilityGroups: Record<string, Group>;
  totalAssets: number;
  totalDebt: number;
  currency: Currency;
  toDisplay: (eur: number) => number;
}

const GroupList: React.FC<{ title: string; groups: Record<string, Group>; total: number; empty: string; currency: Currency; toDisplay: (eur: number) => number; limit?: number }> = ({ title, groups, total, empty, currency, toDisplay, limit = Infinity }) => {
  const entries = Object.entries(groups).filter(([, group]) => group.value !== 0);
  return (
  <div className="min-w-0">
    <h3 className="type-label mb-3 flex justify-between text-muted">
      <span>{title}</span>
      <Amount value={toDisplay(total)} currency={currency} className="text-ink" />
    </h3>
    {total === 0 && <p className="type-body text-muted">{empty}</p>}
    <ul className="space-y-3">
      {entries.slice(0, limit).map(([name, group]) => (
        <li key={name}>
          <div className="type-body mb-1 flex items-center justify-between gap-3 text-ink">
            <span className="flex min-w-0 items-center gap-2">
              <Icon name={group.icon} size={16} className="shrink-0 text-muted" />
              <span className="truncate">{name}</span>
            </span>
            <span className="type-figure-row shrink-0">
              <Amount value={toDisplay(group.value)} currency={currency} />
              <span className="type-caption ml-2 text-muted">{((group.value / total) * 100).toFixed(1)}%</span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-inset">
            <div className="h-full rounded-full" style={{ width: `${(group.value / total) * 100}%`, backgroundColor: group.color }} />
          </div>
        </li>
      ))}
    </ul>
    {entries.length > limit && <p className="type-caption mt-2 text-muted">+{entries.length - limit} more</p>}
  </div>
  );
};

/** The Analysis tab's allocation card, as a widget: donut, then assets and debts by group. */
const AssetAllocationWidget: React.FC<AssetAllocationWidgetProps> = ({ allocation, assetGroups, liabilityGroups, totalAssets, totalDebt, currency, toDisplay }) => {
  const box = useWidgetBox();
  // The donut is a square sized to the room: as tall as the widget when it sits beside the lists, as wide as it when above them.
  const wide = box.width === 0 || box.width >= 760;
  const showDonut = box.height === 0 || box.height >= 260;
  const stacked = box.width > 0 && box.width < 520;
  const donutSize = box.width === 0 || box.height === 0
    ? 280
    : wide
      ? Math.max(160, Math.min(box.height - 8, Math.round(box.width * 0.36)))
      : Math.max(140, Math.min(box.width - 8, Math.round(box.height * 0.45)));
  // Each group is a 50px row under a 40px heading.
  const limit = box.height === 0 ? Infinity : Math.max(2, fitRows(box, stacked ? 44 : 50, 6, 56) - (stacked ? 2 : 0));
  const donut = (
    <div className="flex items-center justify-center" style={wide ? { width: donutSize } : undefined}>
      <BklitPieChart
        data={allocation.map(item => ({ label: item.name, value: item.value, color: item.color }))}
        size={donutSize}
        innerRadius={Math.round(donutSize * 0.3)}
        cornerRadius={6}
        padAngle={allocation.length > 1 ? 0.04 : 0}
      >
        {allocation.map((_, index) => <PieSlice key={index} index={index} />)}
        <PieCenter defaultLabel="Net worth">
          {({ value, label, isHovered }) => (
            <div className="flex flex-col items-center text-center">
              <span className="type-caption text-muted">{label}</span>
              <p className="type-figure-row text-ink"><Amount value={toDisplay(isHovered ? value : totalAssets - Math.abs(totalDebt))} currency={currency} /></p>
            </div>
          )}
        </PieCenter>
      </BklitPieChart>
    </div>
  );
  return (
    <div className="grid h-full content-start gap-6" style={{ gridTemplateColumns: showDonut && wide ? `${donutSize}px 1fr 1fr` : stacked ? '1fr' : '1fr 1fr' }}>
      {showDonut && (wide ? donut : <div className={stacked ? '' : 'col-span-2'}>{donut}</div>)}
      <GroupList title="Assets" groups={assetGroups} total={totalAssets} empty="No assets yet." currency={currency} toDisplay={toDisplay} limit={limit} />
      <GroupList title="Debts" groups={liabilityGroups} total={Math.abs(totalDebt)} empty="No debts recorded." currency={currency} toDisplay={toDisplay} limit={limit} />
    </div>
  );
};

export default AssetAllocationWidget;
