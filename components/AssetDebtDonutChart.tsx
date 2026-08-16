import React, { useMemo } from 'react';
import { PieChart, PieSlice, PieCenter, type PieData } from '../src/components/charts';
import { formatCurrency } from '../utils';

interface DonutChartProps {
  assets: number;
  debt: number;
}

const AssetDebtDonutChart: React.FC<DonutChartProps> = ({ assets, debt }) => {
  const pieData = useMemo<PieData[]>(() => {
    const items: PieData[] = [];
    if (assets > 0) {
      items.push({ label: 'Assets', value: assets, color: '#22C55E' });
    }
    if (Math.abs(debt) > 0) {
      items.push({ label: 'Liabilities', value: Math.abs(debt), color: '#EF4444' });
    }
    return items;
  }, [assets, debt]);

  const netWorth = assets - debt;

  return (
    <div className="h-full flex flex-col">
      <div>
        <div className="grid grid-cols-2 gap-4 mt-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0" />
            <div className="text-sm">
              <p className="text-light-text-secondary dark:text-gray-300">Assets</p>
              <p className="font-semibold text-light-text dark:text-white">{formatCurrency(assets, 'EUR')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" />
            <div className="text-sm">
              <p className="text-light-text-secondary dark:text-gray-300">Liabilities</p>
              <p className="font-semibold text-light-text dark:text-white">{formatCurrency(Math.abs(debt), 'EUR')}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-grow relative flex items-center justify-center min-h-[200px] w-full mt-2">
        <PieChart
          data={pieData}
          innerRadius={70}
          cornerRadius={6}
          padAngle={pieData.length > 1 ? 0.05 : 0}
          className="w-full h-full max-h-[220px]"
        >
          {pieData.map((_, index) => (
            <PieSlice key={index} index={index} showGlow />
          ))}
          <PieCenter defaultLabel="Net Worth">
            {({ value, label, isHovered }) => (
              <div className="flex flex-col items-center justify-center text-center">
                <span className="text-light-text-secondary dark:text-gray-300 text-xs tracking-wider font-semibold uppercase">
                  {label}
                </span>
                <span className="text-lg sm:text-xl font-bold text-light-text dark:text-white tracking-tight">
                  {formatCurrency(isHovered ? value : netWorth, 'EUR')}
                </span>
              </div>
            )}
          </PieCenter>
        </PieChart>
      </div>
    </div>
  );
};

export default AssetDebtDonutChart;
