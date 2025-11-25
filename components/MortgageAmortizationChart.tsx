
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ScheduledPayment, Currency } from '../types';
import { formatCurrency, parseDateAsUTC } from '../utils';
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
        const date = parseDateAsUTC(payment.date);
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
        <div className="bg-light-card dark:bg-dark-card p-3 rounded-lg shadow-lg border border-black/5 dark:border-white/5 text-sm">
          <p className="font-bold text-light-text dark:text-dark-text mb-2">{label}</p>
          <div className="space-y-1">
            <p className="text-primary-500">{isLending ? 'Principal' : 'Principal'}: {formatCurrency(payload[0].value, currency)}</p>
            <p className="text-red-500">{isLending ? 'Interest' : 'Interest'}: {formatCurrency(payload[1].value, currency)}</p>
            <div className="border-t border-black/10 dark:border-white/10 pt-1 mt-1">
                <p className="text-light-text-secondary dark:text-dark-text-secondary">Balance: {formatCurrency(payload[0].payload.balance, currency)}</p>
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
      <div className="flex-grow" style={{ width: '100%', minHeight: '300px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={yearlyData}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 5,
            }}
            stacked
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
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            <Bar dataKey="principal" name={principalName} stackId="a" fill="#3B82F6" radius={[0, 0, 4, 4]} />
            <Bar dataKey="interest" name={interestName} stackId="a" fill="#EF4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

export default MortgageAmortizationChart;
