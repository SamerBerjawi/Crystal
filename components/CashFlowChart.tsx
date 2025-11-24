
import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { Transaction, Duration } from '../types';
import { formatCurrency, getDateRange, convertToEur, parseDateAsUTC } from '../utils';
import Card from './Card';

interface CashFlowChartProps {
  transactions: Transaction[];
  duration: Duration;
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const date = new Date(label);
      const formattedDate = date.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
      
      const income = payload.find((p: any) => p.dataKey === 'income')?.value || 0;
      const expenses = payload.find((p: any) => p.dataKey === 'expenses')?.value || 0;

      return (
        <div className="bg-light-card dark:bg-dark-card p-3 rounded-lg shadow-modal border border-light-separator dark:border-dark-separator">
          <p className="font-semibold mb-2">{formattedDate}</p>
          {income > 0 && <p className="text-semantic-green">Income: {formatCurrency(income, 'EUR')}</p>}
          {expenses > 0 && <p className="text-semantic-red">Expenses: {formatCurrency(expenses, 'EUR')}</p>}
        </div>
      );
    }
    return null;
};

const CashFlowChart: React.FC<CashFlowChartProps> = ({ transactions, duration }) => {
  const chartData = useMemo(() => {
    const { start, end } = getDateRange(duration, transactions);
    const dataMap: { [key: string]: { date: string; timestamp: number; income: number; expenses: number } } = {};

    let currentDate = new Date(start);
    while (currentDate <= end) {
      const dateKey = currentDate.toISOString().split('T')[0];
      dataMap[dateKey] = { date: dateKey, timestamp: currentDate.getTime(), income: 0, expenses: 0 };
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
    
    transactions.forEach(tx => {
      const txDate = parseDateAsUTC(tx.date);

      if (txDate >= start && txDate <= end) {
        const dateKey = tx.date;
        if (dataMap[dateKey]) {
          const amount = convertToEur(tx.amount, tx.currency);
          if (tx.type === 'income') {
            dataMap[dateKey].income += amount;
          } else {
            dataMap[dateKey].expenses += Math.abs(amount);
          }
        }
      }
    });

    return Object.values(dataMap);
  }, [transactions, duration]);
  
  const tickFormatter = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
  };
  
  const yAxisTickFormatter = (value: number) => {
      if (Math.abs(value) >= 1000) return `€${(value / 1000).toFixed(0)}k`;
      return `€${value}`;
  }

  return (
    <Card className="h-full flex flex-col">
      <h3 className="text-xl font-semibold mb-4 text-light-text dark:text-dark-text">Cash Flow</h3>
      <div className="flex-grow" style={{ width: '100%', minHeight: 270 }}>
        <ResponsiveContainer minWidth={0} minHeight={0} debounce={50}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--light-separator, #E5E7EB)" opacity={0.5} vertical={false} />
            <XAxis 
                dataKey="timestamp"
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={tickFormatter} 
                fontSize={12} 
                stroke="currentColor" 
                tick={{ fill: 'currentColor', opacity: 0.6 }}
                axisLine={false}
                tickLine={false}
                minTickGap={20}
            />
            <YAxis 
                tickFormatter={yAxisTickFormatter}
                fontSize={12} 
                width={80} 
                stroke="currentColor" 
                tick={{ fill: 'currentColor', opacity: 0.6 }}
                axisLine={false}
                tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(128, 128, 128, 0.1)' }} />
            <Legend wrapperStyle={{ fontSize: '14px' }} />
            <ReferenceLine y={0} stroke="currentColor" opacity={0.3} />
            <Bar dataKey="income" fill="#34C759" name="Income" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" fill="#FF3B30" name="Expenses" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

export default CashFlowChart;
