import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { Transaction, Duration } from '../types';
import { formatCurrency, getDateRange, convertToEur } from '../utils';
import Card from './Card';

interface CashFlowChartProps {
  transactions: Transaction[];
  duration: Duration;
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // The label is a date string 'YYYY-MM-DD'. To avoid timezone issues, parse it as UTC.
      const dateParts = label.split('-').map(Number);
      const date = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]));
      const formattedDate = date.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
      
      const income = payload.find((p: any) => p.dataKey === 'income')?.value || 0;
      const expenses = payload.find((p: any) => p.dataKey === 'expenses')?.value || 0;

      return (
        <div className="bg-light-card dark:bg-dark-card p-3 rounded-lg shadow-lg border border-black/5 dark:border-white/5">
          <p className="font-semibold mb-2">{formattedDate}</p>
          {income > 0 && <p className="text-green-500">Income: {formatCurrency(income, 'EUR')}</p>}
          {expenses > 0 && <p className="text-red-500">Expenses: {formatCurrency(expenses, 'EUR')}</p>}
        </div>
      );
    }
    return null;
};

const CashFlowChart: React.FC<CashFlowChartProps> = ({ transactions, duration }) => {
  const chartData = useMemo(() => {
    const { start, end } = getDateRange(duration, transactions);
    const dataMap: { [key: string]: { date: string; income: number; expenses: number } } = {};

    let currentDate = new Date(start);
    while (currentDate <= end) {
      const dateKey = currentDate.toISOString().split('T')[0];
      dataMap[dateKey] = { date: dateKey, income: 0, expenses: 0 };
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    transactions.forEach(tx => {
      // Parse the transaction date string as UTC to avoid timezone shifts
      const dateParts = tx.date.split('-').map(Number);
      const txDate = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]));

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
  
  const tickFormatter = (dateStr: string) => {
    const dateParts = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]));
    return date.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
  };
  
  const yAxisTickFormatter = (value: number) => {
      if (Math.abs(value) >= 1000) return `€${(value / 1000).toFixed(0)}k`;
      return `€${value}`;
  }

  return (
    <Card className="h-full flex flex-col">
      <h3 className="text-xl font-semibold mb-4 text-light-text dark:text-dark-text">Cash Flow</h3>
      <div className="flex-grow" style={{ width: '100%', minHeight: 300 }}>
        <ResponsiveContainer>
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} vertical={false} />
            <XAxis 
                dataKey="date" 
                tickFormatter={tickFormatter} 
                fontSize={12} 
                stroke="currentColor" 
                opacity={0.6}
                minTickGap={20}
            />
            <YAxis 
                tickFormatter={yAxisTickFormatter}
                fontSize={12} 
                width={80} 
                stroke="currentColor" 
                opacity={0.6}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(128, 128, 128, 0.1)' }} />
            <Legend wrapperStyle={{ fontSize: '14px' }} />
            <ReferenceLine y={0} stroke="currentColor" opacity={0.3} />
            <Bar dataKey="income" fill="#22C55E" name="Income" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" fill="#EF4444" name="Expenses" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

export default CashFlowChart;