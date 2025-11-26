import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '../utils';

interface DonutChartProps {
  assets: number;
  debt: number;
}

const COLORS = ['#22C55E', '#EF4444']; // Green for Assets, Red for Debt

const AssetDebtDonutChart: React.FC<DonutChartProps> = ({ assets, debt }) => {

  const data = [
    { name: 'Assets', value: assets > 0 ? assets : 0 },
    { name: 'Debt', value: Math.abs(debt) > 0 ? Math.abs(debt) : 0 },
  ].filter(d => d.value > 0); // Filter out zero-value segments
  
  const netWorth = assets - debt;

  return (
    <div className="h-full flex flex-col">
        <div>
            <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0"></div>
                    <div className="text-sm">
                        <p className="text-light-text-secondary dark:text-dark-text-secondary">Assets</p>
                        <p className="font-semibold">{formatCurrency(assets, 'EUR')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                     <div className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0"></div>
                     <div className="text-sm">
                        <p className="text-light-text-secondary dark:text-dark-text-secondary">Liabilities</p>
                        <p className="font-semibold">{formatCurrency(Math.abs(debt), 'EUR')}</p>
                    </div>
                </div>
            </div>
        </div>
      <div className="flex-grow relative -mt-4" style={{ width: '100%', minHeight: '180px' }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="70%"
              outerRadius="90%"
              fill="#8884d8"
              animationDuration={800}
              paddingAngle={data.length > 1 ? 5 : 0}
              dataKey="value"
              startAngle={90}
              endAngle={-270}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-light-text-secondary dark:text-dark-text-secondary text-sm">Net Worth</span>
            <span className="text-2xl lg:text-3xl font-bold text-light-text dark:text-dark-text text-center">{formatCurrency(netWorth, 'EUR')}</span>
        </div>
      </div>
    </div>
  );
};

export default AssetDebtDonutChart;