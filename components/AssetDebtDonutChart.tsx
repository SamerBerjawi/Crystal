
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
  ].filter(d => d.value > 0); 
  
  const netWorth = assets - debt;
  const ASSET_COLOR = '#10B981';
  const DEBT_COLOR = '#F43F5E';
  const COLORS = [ASSET_COLOR, DEBT_COLOR];

  return (
    <div className="h-full flex flex-col !bg-transparent !p-0">
        <div>
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="flex flex-col gap-1 group">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40 group-hover:opacity-100 transition-opacity">Asset Cluster</span>
                    </div>
                    <p className="text-sm font-black font-mono tracking-tighter text-emerald-500 privacy-blur">{formatCurrency(assets, 'EUR')}</p>
                </div>
                <div className="flex flex-col gap-1 group">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></div>
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40 group-hover:opacity-100 transition-opacity">Debt Liability</span>
                    </div>
                    <p className="text-sm font-black font-mono tracking-tighter text-rose-500 privacy-blur">{formatCurrency(Math.abs(debt), 'EUR')}</p>
                </div>
            </div>
        </div>
      <div className="flex-grow relative" style={{ width: '100%', minHeight: '220px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="75%"
              outerRadius="95%"
              paddingAngle={data.length > 1 ? 10 : 0}
              dataKey="value"
              startAngle={90}
              endAngle={-270}
              stroke="none"
              animationDuration={1000}
            >
              {data.map((entry, index) => (
                <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[index % COLORS.length]} 
                    className="hover:opacity-80 transition-opacity duration-300 cursor-pointer outline-none"
                    style={{ filter: `drop-shadow(0 0 8px ${COLORS[index % COLORS.length]}44)` }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[8px] font-black uppercase tracking-[0.4em] opacity-30 mb-1">Portfolio Core</span>
            <span className="text-2xl font-black text-light-text dark:text-dark-text text-center tracking-tighter font-mono leading-none privacy-blur">
                {formatCurrency(netWorth, 'EUR')}
            </span>
            <div className={`mt-3 px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest ${netWorth >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                {netWorth >= 0 ? 'Net Surplus' : 'Net Deficit'}
            </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-4 opacity-20 group-hover:opacity-50 transition-opacity">
         <div className="h-[1px] flex-grow bg-gradient-to-r from-transparent via-current to-transparent"></div>
         <span className="text-[7px] font-black tracking-[0.5em] uppercase whitespace-nowrap">Liquidity Status Matrix</span>
         <div className="h-[1px] flex-grow bg-gradient-to-r from-transparent via-current to-transparent"></div>
      </div>
    </div>
  );
};

export default AssetDebtDonutChart;
