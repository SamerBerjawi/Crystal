
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { formatCurrency } from '../utils';

// FIX: Add an index signature to the ChartDataItem interface to make it compatible with the 'data' prop of recharts components, which expects a generic object.
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
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-light-card dark:bg-dark-card p-3 rounded-lg shadow-lg border border-black/5 dark:border-white/5">
          <p className="font-semibold">{`${payload[0].name}`}</p>
          <p style={{ color: payload[0].payload.fill }}>{`Value: ${formatCurrency(payload[0].value, 'EUR')}`}</p>
          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{`(${(payload[0].percent * 100).toFixed(1)}%)`}</p>
        </div>
      );
    }
    return null;
  };

  // The legend is only needed for more than one data point.
  // This also determines if we need to shift the chart to make space.
  const showLegend = data && data.length > 1;
  const chartCx = showLegend ? '35%' : '50%';
  const textLeft = showLegend ? '35%' : '50%';

  return (
    <div className="h-full w-full relative" style={{ minHeight: 270 }}>
        <ResponsiveContainer minWidth={0} minHeight={0} debounce={50}>
            <PieChart>
                <Pie
                    data={data}
                    cx={chartCx}
                    cy="50%"
                    innerRadius="60%"
                    outerRadius="80%"
                    fill="#8884d8"
                    animationDuration={800}
                    paddingAngle={5}
                    dataKey="value"
                    startAngle={90}
                    endAngle={-270}
                >
                    {data.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} stroke={entry.color} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                {showLegend && <Legend iconType="circle" iconSize={8} layout="vertical" verticalAlign="middle" align="right" />}
            </PieChart>
        </ResponsiveContainer>
        <div 
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center pointer-events-none"
            style={{ left: textLeft }}
        >
            <span className="text-light-text-secondary dark:text-dark-text-secondary text-sm">Total Value</span>
            <span className="text-2xl font-bold text-light-text dark:text-dark-text">{formatCurrency(totalValue, 'EUR')}</span>
        </div>
    </div>
  );
};

export default PortfolioDistributionChart;
