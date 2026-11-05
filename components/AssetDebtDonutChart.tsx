import React, { useMemo } from 'react';
import { PieChart, PieSlice, PieCenter, type PieData } from '../src/components/charts';
import { getMainCurrency } from '../utils';
import { Amount } from './ui/Money';

interface DonutChartProps {
  assets: number;
  debt: number;
}

/** Assets against debts, with net worth in the middle. Green and red mean money in and money out everywhere else, so they keep that meaning here. */
const AssetDebtDonutChart: React.FC<DonutChartProps> = ({ assets, debt }) => {
  const currency = getMainCurrency();
  const pieData = useMemo<PieData[]>(() => [
    ...(assets > 0 ? [{ label: 'Assets', value: assets, color: 'var(--money-in)' }] : []),
    ...(Math.abs(debt) > 0 ? [{ label: 'Debts', value: Math.abs(debt), color: 'var(--money-out)' }] : []),
  ], [assets, debt]);

  const legend = [
    { label: 'Assets', value: assets, color: 'var(--money-in)' },
    { label: 'Debts', value: Math.abs(debt), color: 'var(--money-out)' },
  ];

  return (
    <div className="flex h-full flex-col">
      <dl className="grid grid-cols-2 gap-4">
        {legend.map(item => (
          <div key={item.label}>
            <dt className="type-label flex items-center gap-2 text-muted">
              <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
              {item.label}
            </dt>
            <dd className="type-figure-row mt-0.5 text-ink"><Amount value={item.value} currency={currency} /></dd>
          </div>
        ))}
      </dl>
      <div className="relative mt-2 flex min-h-[200px] w-full flex-grow items-center justify-center">
        {pieData.length === 0 ? (
          <p className="type-body text-muted">Nothing to show yet.</p>
        ) : (
          <PieChart data={pieData} innerRadius={70} cornerRadius={6} padAngle={pieData.length > 1 ? 0.05 : 0} className="mx-auto aspect-square h-full max-h-[220px] w-auto">
            {pieData.map((_, index) => <PieSlice key={index} index={index} />)}
            <PieCenter defaultLabel="Net worth">
              {({ value, label, isHovered }) => (
                <div className="flex flex-col items-center justify-center text-center">
                  <span className="type-label text-muted">{label}</span>
                  <span className="type-figure-row text-ink"><Amount value={isHovered ? value : assets - debt} currency={currency} /></span>
                </div>
              )}
            </PieCenter>
          </PieChart>
        )}
      </div>
    </div>
  );
};

export default AssetDebtDonutChart;
