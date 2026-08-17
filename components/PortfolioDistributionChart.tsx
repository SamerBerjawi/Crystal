import React, { useMemo } from 'react';
import { PieChart, PieSlice, PieCenter, type PieData } from '../src/components/charts';
import { formatCurrency } from '../utils';

interface ChartDataItem {
  name: string;
  value: number;
  color: string;
  [key: string]: any;
}

interface PortfolioDistributionChartProps {
  data: ChartDataItem[];
  totalValue: number;
}

const PortfolioDistributionChart: React.FC<PortfolioDistributionChartProps> = ({ data, totalValue }) => {
  const pieData = useMemo<PieData[]>(() => {
    return data.map((item) => ({
      label: item.name,
      value: item.value,
      color: item.color,
    }));
  }, [data]);

  return (
    <div className="h-full w-full flex flex-col md:flex-row items-center justify-between gap-4 py-2" style={{ minHeight: 270 }}>
      <div className="flex-1 w-full relative flex items-center justify-center min-h-[220px]">
        <PieChart
          data={pieData}
          innerRadius={65}
          cornerRadius={6}
          padAngle={pieData.length > 1 ? 0.04 : 0}
          className="w-full h-full max-h-[240px]"
        >
          {pieData.map((_, index) => (
            <PieSlice key={index} index={index} showGlow />
          ))}
          <PieCenter defaultLabel="Total Value">
            {({ value, label, isHovered }) => (
              <div className="flex flex-col items-center justify-center text-center">
                <span className="text-light-text-secondary dark:text-gray-400 text-xs font-semibold uppercase tracking-wider leading-none mb-1">
                  {label}
                </span>
                <span className="text-xl font-black text-light-text dark:text-white tracking-tight">
                  {formatCurrency(isHovered ? value : totalValue, 'EUR')}
                </span>
              </div>
            )}
          </PieCenter>
        </PieChart>
      </div>

      {pieData.length > 1 && (
        <div className="flex flex-wrap md:flex-col gap-2 max-h-[220px] overflow-y-auto pr-2">
          {pieData.map((item) => {
            const pct = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
            return (
              <div key={item.label} className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="font-bold text-light-text dark:text-white truncate max-w-[110px]">{item.label}</span>
                <span className="text-xs font-mono text-light-text-secondary dark:text-gray-400">({pct.toFixed(1)}%)</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PortfolioDistributionChart;
