import React, { useMemo } from 'react';
import { Transaction } from '../types';
import { convertToEur, formatCurrency } from '../utils';
import Icon from './ui/Icon';
import { BarChart, Bar, Grid, BarXAxis, BarYAxis, ChartTooltip } from '@/src/components/charts';

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
      <div className="flex-grow min-h-[220px]">
        <BarChart
          data={data.sorted}
          xDataKey="name"
          orientation="horizontal"
          aspectRatio="auto"
          margin={{ top: 10, right: 30, left: 90, bottom: 10 }}
          className="w-full h-full"
        >
          <Grid vertical horizontal={false} strokeOpacity={0.05} />
          <Bar
            dataKey="value"
            fill={(_, index) => (index < 3 ? '#fa9a1d' : '#94A3B8')}
            lineCap="round"
          />
          <BarYAxis />
          <ChartTooltip
            valueFormatter={(val: number) => formatCurrency(val, 'EUR')}
          />
        </BarChart>
      </div>

      <div className="bg-primary-500/5 dark:bg-primary-400/5 p-3 rounded-xl border border-primary-500/10 dark:border-primary-400/10">
        <div className="flex items-center gap-2 mb-1">
          <Icon name="info" className="text-primary-500 text-sm" />
          <span className="text-xs font-semibold uppercase tracking-wider text-primary-700 dark:text-primary-300">Pareto insight</span>
        </div>
        <p className="text-xs text-primary-900 dark:text-primary-100 leading-relaxed">
          Your top 3 merchants account for <span className="font-semibold">{topThreePercent.toFixed(0)}%</span> of your discretionary outflows. Cutting costs here will have the highest impact.
        </p>
      </div>
    </div>
  );
};

export default MerchantParetoWidget;
