
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
      // Filter for discretionary expenses (ignore transfers and likely fixed costs like Rent/Mortgage)
      if (tx.type === 'expense' && !tx.transferId && tx.merchant) {
        const amount = Math.abs(convertToEur(tx.amount, tx.currency));
        const merchant = tx.merchant.trim();
        merchantTotals.set(merchant, (merchantTotals.get(merchant) || 0) + amount);
        totalDiscretionary += amount;
      }
    });

    const sorted = Array.from(merchantTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8) // Top 8
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
      <div className="h-full flex items-center justify-center text-light-text-secondary opacity-60 italic text-sm">
        Not enough merchant data found.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex-grow">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.sorted} layout="vertical" margin={{ left: -10, right: 40 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} strokeOpacity={0.05} />
            <XAxis type="number" hide />
            <YAxis 
              dataKey="name" 
              type="category" 
              axisLine={false} 
              tickLine={false} 
              fontSize={11} 
              width={100}
              tick={{ fill: 'currentColor', opacity: 0.7 }}
            />
            <Tooltip 
              cursor={{ fill: 'rgba(0,0,0,0.02)' }}
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
              formatter={(value: number) => [formatCurrency(value, 'EUR'), 'Total Spent']}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={12}>
              {data.sorted.map((entry, index) => (
                <Cell key={index} fill={index < 3 ? '#fa9a1d' : '#94A3B8'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      <div className="bg-primary-50 dark:bg-primary-900/10 p-3 rounded-xl border border-primary-100 dark:border-primary-800/30">
        <div className="flex items-center gap-2 mb-1">
          <span className="material-symbols-outlined text-primary-500 text-sm">info</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary-700 dark:text-primary-300">Pareto Insight</span>
        </div>
        <p className="text-xs text-primary-900 dark:text-primary-100 leading-relaxed">
          Your top 3 merchants account for <span className="font-bold">{topThreePercent.toFixed(0)}%</span> of your discretionary outflows. Cutting costs here will have the highest impact.
        </p>
      </div>
    </div>
  );
};

export default MerchantParetoWidget;
