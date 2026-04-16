
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
        <div className="bg-white dark:bg-dark-card p-3 rounded-xl shadow-xl border border-black/5 dark:border-white/10 backdrop-blur-md text-sm">
          <p className="font-black text-light-text dark:text-dark-text mb-2 uppercase tracking-widest text-[10px] opacity-60">{label}</p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-4">
                <span className="text-[10px] font-black uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">Principal</span>
                <span className="font-mono font-black text-primary-500">{formatCurrency(payload[0].value, currency)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
                <span className="text-[10px] font-black uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">Interest</span>
                <span className="font-mono font-black text-rose-500">{formatCurrency(payload[1].value, currency)}</span>
            </div>
            <div className="border-t border-black/5 dark:border-white/5 pt-1.5 mt-1.5 flex items-center justify-between gap-4">
                <span className="text-[10px] font-black uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-60">Balance</span>
                <span className="font-mono font-black text-light-text dark:text-dark-text opacity-80">{formatCurrency(payload[0].payload.balance, currency)}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="h-full flex flex-col">
      <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-4">Amortization Schedule (Yearly)</h3>
      <div className="flex-grow" style={{ width: '100%', minHeight: '200px' }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <BarChart
            data={yearlyData}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 5,
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
    </Card>
  );
};

export default MortgageAmortizationChart;
