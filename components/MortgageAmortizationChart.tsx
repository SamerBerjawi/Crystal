import React from 'react';
import { ScheduledPayment, Currency } from '../types';
import { formatCurrency, parseLocalDate } from '../utils';
import { BarChart, Bar, Grid, BarXAxis, BarYAxis, ChartTooltip } from '@/src/components/charts';

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

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-grow" style={{ width: '100%', minHeight: '200px' }}>
        <BarChart
          data={yearlyData}
          xDataKey="year"
          stacked
          aspectRatio="auto"
          margin={{ top: 20, right: 15, left: 15, bottom: 25 }}
          className="w-full h-full"
        >
          <Grid horizontal vertical={false} strokeOpacity={0.1} />
          <Bar dataKey="principal" stroke="#3B82F6" fill="#3B82F6" lineCap="round" />
          <Bar dataKey="interest" stroke="#EF4444" fill="#EF4444" lineCap="round" />
          <BarXAxis />
          <BarYAxis />
          <ChartTooltip
            valueFormatter={(val: number) => formatCurrency(val, currency)}
          />
        </BarChart>
      </div>
    </div>
  );
};

export default MortgageAmortizationChart;
