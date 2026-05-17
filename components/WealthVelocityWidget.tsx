
import React, { useMemo } from 'react';
import { Transaction, Account } from '../types';
import { convertToEur, formatCurrency, parseLocalDate } from '../utils';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Line, ComposedChart, CartesianGrid } from 'recharts';

interface WealthVelocityWidgetProps {
  transactions: Transaction[];
  accounts: Account[];
}

const WealthVelocityWidget: React.FC<WealthVelocityWidgetProps> = ({ transactions, accounts }) => {
  const chartData = useMemo(() => {
    const months = 6;
    const today = new Date();
    const data = [];
    
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthKey = d.toLocaleString('default', { month: 'short' });
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

      const monthlyDelta = transactions
        .filter(t => !t.transferId && parseLocalDate(t.date) >= start && parseLocalDate(t.date) <= end)
        .reduce((sum, t) => sum + convertToEur(t.amount, t.currency), 0);

      data.push({ month: monthKey, delta: monthlyDelta });
    }

    // Calculate 3-month moving average for the line
    return data.map((item, idx, arr) => {
      const startIdx = Math.max(0, idx - 2);
      const window = arr.slice(startIdx, idx + 1);
      const avg = window.reduce((sum, i) => sum + i.delta, 0) / window.length;
      return { ...item, avg };
    });
  }, [transactions]);

  const currentDelta = chartData[chartData.length - 1]?.delta || 0;
  const isAccelerating = currentDelta > (chartData[chartData.length - 1]?.avg || 0);

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex justify-between items-center px-1">
        <div>
          <p className="text-[10px] font-semibold tracking-wider text-light-text-secondary/60 dark:text-dark-text-secondary/80">Growth momentum</p>
          <div className="flex items-center gap-2">
            <h3 className={`text-2xl font-semibold ${currentDelta >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {currentDelta >= 0 ? '+' : ''}{formatCurrency(currentDelta, 'EUR')}
            </h3>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isAccelerating ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-gray-500/10 text-gray-500 dark:text-gray-400'}`}>
              {isAccelerating ? 'Accelerating' : 'Stabilizing'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-grow">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ left: -30, right: 0, top: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.05} />
            <XAxis dataKey="month" axisLine={false} tickLine={false} fontSize={10} tick={{ fill: 'currentColor', opacity: 0.5 }} />
            <YAxis axisLine={false} tickLine={false} hide />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'var(--light-card)', 
                backdropFilter: 'blur(15px) saturate(180%) brightness(105%)', 
                WebkitBackdropFilter: 'blur(15px) saturate(180%) brightness(105%)',
                border: 'none', 
                borderRadius: '24px', 
                boxShadow: 'inset 2px 2px 1px rgba(255, 255, 255, 0.05), inset -2px -2px 2px rgba(0, 0, 0, 0.05), 0 8px 32px rgba(0, 0, 0, 0.1)' 
              }}
              formatter={(value: number) => [formatCurrency(value, 'EUR'), 'Net Change']}
            />
            {/* Using 'natural' type for extreme curves */}
            <Area type="natural" dataKey="delta" fill="#6366F1" stroke="none" fillOpacity={0.1} />
            <Line type="natural" dataKey="avg" stroke="#94A3B8" strokeWidth={2} dot={false} strokeDasharray="5 5" name="Moving Average" />
            <Line type="natural" dataKey="delta" stroke="#6366F1" strokeWidth={3} dot={{ r: 4, fill: '#6366F1', strokeWidth: 0 }} activeDot={{ r: 6 }} name="Actual Delta" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      <p className="text-[10px] italic text-light-text-secondary/60 dark:text-dark-text-secondary/80 text-center font-medium">
        Dashed line represents your 3-month trailing growth average.
      </p>
    </div>
  );
};

export default WealthVelocityWidget;
