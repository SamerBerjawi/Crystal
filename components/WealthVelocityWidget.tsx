
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
      const monthKey = d.toLocaleString('default', { month: 'short' }).toUpperCase();
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

      const monthlyDelta = transactions
        .filter(t => !t.transferId && parseLocalDate(t.date) >= start && parseLocalDate(t.date) <= end)
        .reduce((sum, t) => sum + convertToEur(t.amount, t.currency), 0);

      data.push({ month: monthKey, delta: monthlyDelta });
    }

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
    <div className="flex flex-col h-full space-y-6 !bg-transparent !p-0">
      <div className="flex justify-between items-end px-1">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary opacity-40 mb-1">Growth Momentum Index</p>
          <div className="flex items-center gap-3">
            <h3 className={`text-2xl font-black tracking-tighter font-mono ${currentDelta >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {currentDelta >= 0 ? '+' : ''}{formatCurrency(currentDelta, 'EUR')}
            </h3>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[8px] font-black uppercase tracking-widest ${
                isAccelerating 
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-lg shadow-emerald-500/5' 
                : 'bg-black/5 dark:bg-white/5 text-light-text-secondary border-black/5'
            }`}>
              {isAccelerating && <div className="w-1 h-1 rounded-full bg-emerald-500 animate-ping"></div>}
              {isAccelerating ? 'Accelerating' : 'Stabilizing'}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-grow min-h-[140px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ left: -30, right: 0, top: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="4 4" vertical={false} strokeOpacity={0.03} />
            <XAxis 
                dataKey="month" 
                axisLine={false} 
                tickLine={false} 
                fontSize={9} 
                tick={{ fill: 'currentColor', opacity: 0.3 }} 
                className="font-black uppercase tracking-[0.2em]"
            />
            <YAxis axisLine={false} tickLine={false} hide />
            <Tooltip 
              contentStyle={{ 
                borderRadius: '2rem', 
                border: 'none', 
                backgroundColor: 'rgba(255,255,255,0.9)', 
                backdropFilter: 'blur(16px)',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)' 
              }}
              labelStyle={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '8px', opacity: 0.4 }}
              itemStyle={{ fontSize: '14px', fontWeight: '900', fontFamily: 'monospace' }}
              formatter={(value: number) => [formatCurrency(value, 'EUR'), 'Net Change']}
            />
            <Area type="monotone" dataKey="delta" fill="#6366F1" stroke="none" fillOpacity={0.05} />
            <Line 
                type="monotone" 
                dataKey="avg" 
                stroke="currentColor" 
                strokeOpacity={0.1}
                strokeWidth={1} 
                dot={false} 
                strokeDasharray="4 4" 
                name="3M Average" 
            />
            <Line 
                type="monotone" 
                dataKey="delta" 
                stroke="#6366F1" 
                strokeWidth={3} 
                dot={{ r: 4, fill: '#6366F1', strokeWidth: 0 }} 
                activeDot={{ r: 6 }} 
                name="Actual Delta" 
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      <div className="flex items-center justify-center gap-2 px-4 py-2 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5">
        <span className="material-symbols-outlined text-[10px] opacity-20">insights</span>
        <p className="text-[8px] font-black uppercase tracking-[0.3em] text-light-text-secondary opacity-30 text-center leading-none">
            Node velocity reflects 3-month trailing growth trajectory
        </p>
      </div>
    </div>
  );
};

export default WealthVelocityWidget;
