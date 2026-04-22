
import React, { useMemo } from 'react';
import { Transaction, Category } from '../types';
import { convertToEur, formatCurrency } from '../utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';

interface MerchantParetoWidgetProps {
  transactions: Transaction[];
}

const MerchantParetoWidget: React.FC<MerchantParetoWidgetProps> = ({ transactions }) => {
  const data = useMemo(() => {
    const merchantTotals = new Map<string, number>();
    let totalDiscretionary = 0;

    transactions.forEach(tx => {
      if (tx.type === 'expense' && !tx.transferId && tx.merchant) {
        const amount = Math.abs(convertToEur(tx.amount, tx.currency));
        const merchant = tx.merchant.trim();
        merchantTotals.set(merchant, (merchantTotals.get(merchant) || 0) + amount);
        totalDiscretionary += amount;
      }
    });

    const sorted = Array.from(merchantTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8) 
      .map(([name, value]) => ({
        name,
        value,
        percent: totalDiscretionary > 0 ? (value / totalDiscretionary) * 100 : 0
      }));

    return { sorted, totalDiscretionary };
  }, [transactions]);

  const topThreePercent = data.sorted.slice(0, 3).reduce((sum, item) => sum + item.percent, 0);

  if (data.sorted.length === 0) {
    return (
      <div className="h-full flex items-center justify-center flex-col gap-4 py-12">
        <div className="w-16 h-16 rounded-[2rem] bg-black/5 dark:bg-white/5 flex items-center justify-center animate-pulse">
            <span className="material-symbols-outlined text-3xl opacity-20">analytics</span>
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">No merchant nodes active</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex-grow">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data.sorted} layout="vertical" margin={{ left: -10, right: 40 }}>
            <CartesianGrid strokeDasharray="4 4" horizontal={false} strokeOpacity={0.03} />
            <XAxis type="number" hide />
            <YAxis 
              dataKey="name" 
              type="category" 
              axisLine={false} 
              tickLine={false} 
              width={100}
              tick={(props) => {
                const { x, y, payload } = props;
                return (
                    <g transform={`translate(${x},${y})`}>
                        <text 
                            x={0} 
                            y={0} 
                            dy={4} 
                            textAnchor="start" 
                            fill="currentColor" 
                            className="text-[9px] font-black uppercase tracking-widest opacity-40"
                        >
                            {payload.value}
                        </text>
                    </g>
                );
              }}
            />
            <Tooltip 
              cursor={{ fill: 'rgba(250, 154, 29, 0.05)', radius: 12 }}
              contentStyle={{ 
                borderRadius: '2rem', 
                border: 'none', 
                backgroundColor: 'rgba(255,255,255,0.9)', 
                backdropFilter: 'blur(16px)',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)' 
              }}
              formatter={(value: number) => [formatCurrency(value, 'EUR'), 'Total Spent']}
            />
            <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={14}>
              {data.sorted.map((entry, index) => (
                <Cell 
                    key={index} 
                    fill={index < 3 ? '#fa9a1d' : 'rgba(148, 163, 184, 0.2)'} 
                    className="transition-opacity duration-300 hover:opacity-80"
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      <div className="bg-amber-500/5 dark:bg-amber-500/10 p-5 rounded-[1.5rem] border border-amber-500/20 shadow-lg shadow-amber-500/5 transition-all duration-500 hover:bg-amber-500/10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">Node Pareto Insight</span>
        </div>
        <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary leading-relaxed font-medium">
          Top 3 merchants account for <span className="font-black text-amber-600 dark:text-amber-400 font-mono text-xs">{topThreePercent.toFixed(0)}%</span> of total discretionary outflows. Mitigation recommended at high-velocity nodes.
        </p>
      </div>
    </div>
  );
};

export default MerchantParetoWidget;
