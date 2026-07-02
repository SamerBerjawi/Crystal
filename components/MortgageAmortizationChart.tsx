
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ScheduledPayment, Currency } from '../types';
import { formatCurrency, parseLocalDate } from '../utils';
import Card from './Card';

interface MortgageAmortizationChartProps {
  schedule: ScheduledPayment[];
  currency: Currency;
  accountType?: string;
}

const MortgageAmortizationChart: React.FC<MortgageAmortizationChartProps> = ({ schedule, currency, accountType = 'Loan' }) => {
  const isLending = accountType === 'Lending';
  const principalName = isLending ? "Principal Received" : "Principal Paid";
  const interestName = isLending ? "Interest Earned" : "Interest Paid";

  // aggregate data by year to make the chart readable if the loan is long
  const yearlyData = React.useMemo(() => {
    const grouped: Record<string, { year: string; principal: number; interest: number; balance: number }> = {};
    
    schedule.forEach(payment => {
        const date = parseLocalDate(payment.date);
        const year = date.getFullYear().toString();
        
        if (!grouped[year]) {
            grouped[year] = { year, principal: 0, interest: 0, balance: payment.outstandingBalance };
        }
        grouped[year].principal += payment.principal;
        grouped[year].interest += payment.interest;
        // Update balance to the latest in that year
        grouped[year].balance = payment.outstandingBalance;
    });

    return Object.values(grouped);
  }, [schedule]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-neutral-900 p-5 rounded-[20px] shadow-2xl border border-neutral-200 dark:border-neutral-800/80 backdrop-blur-xl">
          <p className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 mb-4 tracking-[0.2em] uppercase">{label}</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-6">
                <span className="text-[10px] font-bold tracking-widest text-neutral-600 dark:text-neutral-300 uppercase">Principal</span>
                <span className="text-sm font-black text-blue-500 tabular-nums">{formatCurrency(payload[0].value, currency)}</span>
            </div>
            <div className="flex items-center justify-between gap-6">
                <span className="text-[10px] font-bold tracking-widest text-neutral-600 dark:text-neutral-300 uppercase">Interest</span>
                <span className="text-sm font-black text-rose-500 tabular-nums">{formatCurrency(payload[1].value, currency)}</span>
            </div>
            <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800/80 flex items-center justify-between gap-6">
                <span className="text-[10px] font-bold tracking-widest text-neutral-500 dark:text-neutral-400 uppercase">Balance</span>
                <span className="text-sm font-black text-neutral-850 dark:text-neutral-100 tabular-nums">{formatCurrency(payload[0].payload.balance, currency)}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-grow" style={{ width: '100%', minHeight: '200px' }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <BarChart
            data={yearlyData}
            margin={{
              top: 20,
              right: 10,
              left: 10,
              bottom: 0,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} vertical={false} />
            <XAxis 
                dataKey="year" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 12 }} 
                minTickGap={30}
            />
            <YAxis 
                hide 
            />
            <Tooltip content={<CustomTooltip />} cursor={{fill: 'transparent'}} />
            <Legend wrapperStyle={{ paddingTop: '10px' }} />
            <Bar dataKey="principal" name={principalName} stackId="a" fill="#3B82F6" radius={[0, 0, 4, 4]} />
            <Bar dataKey="interest" name={interestName} stackId="a" fill="#EF4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default MortgageAmortizationChart;
