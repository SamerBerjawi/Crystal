import React from 'react';
import type { Currency } from '../types';
import { PieChart as BklitPieChart, PieCenter, PieSlice } from '../src/components/charts';
import { formatCurrency } from '../utils';
import Icon from './ui/Icon';
import { Amount } from './ui/Money';

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

const GroupList: React.FC<{ title: string; groups: Record<string, Group>; total: number; empty: string; currency: Currency; toDisplay: (eur: number) => number }> = ({ title, groups, total, empty, currency, toDisplay }) => (
  <div className="min-w-0">
    <h3 className="type-label mb-3 flex justify-between text-muted">
      <span>{title}</span>
      <Amount value={toDisplay(total)} currency={currency} className="text-ink" />
    </h3>
    {total === 0 && <p className="type-body text-muted">{empty}</p>}
    <ul className="space-y-3">
      {Object.entries(groups).filter(([, group]) => group.value !== 0).map(([name, group]) => (
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
  </div>
);

/** The Analysis tab's allocation card, as a widget: donut, then assets and debts by group. */
const AssetAllocationWidget: React.FC<AssetAllocationWidgetProps> = ({ allocation, assetGroups, liabilityGroups, totalAssets, totalDebt, currency, toDisplay }) => (
  <div className="grid gap-6 lg:grid-cols-[280px_1fr_1fr]">
    <div className="h-64">
      <BklitPieChart
        data={allocation.map(item => ({ label: item.name, value: item.value, color: item.color }))}
        innerRadius={70}
        cornerRadius={6}
        padAngle={allocation.length > 1 ? 0.04 : 0}
        className="h-64 w-full"
      >
        {allocation.map((_, index) => <PieSlice key={index} index={index} />)}
        <PieCenter defaultLabel="Net worth">
          {({ value, label, isHovered }) => (
            <div className="flex flex-col items-center text-center">
              <span className="type-caption text-muted">{label}</span>
              <span className="type-figure-row privacy-blur text-ink">{formatCurrency(toDisplay(isHovered ? value : totalAssets - Math.abs(totalDebt)), currency)}</span>
            </div>
          )}
        </PieCenter>
      </BklitPieChart>
    </div>
    <GroupList title="Assets" groups={assetGroups} total={totalAssets} empty="No assets yet." currency={currency} toDisplay={toDisplay} />
    <GroupList title="Debts" groups={liabilityGroups} total={Math.abs(totalDebt)} empty="No debts recorded." currency={currency} toDisplay={toDisplay} />
  </div>
);

export default AssetAllocationWidget;
