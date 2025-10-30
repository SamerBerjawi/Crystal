import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Label, ReferenceDot } from 'recharts';
import { formatCurrency } from '../utils';
import { FinancialGoal } from '../types';

interface ChartData {
  date: string;
  value: number;
}

interface ForecastChartProps {
  data: ChartData[];
  oneTimeGoals: FinancialGoal[];
  lowestPoint: {
      value: number;
      date: string;
  };
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const formattedDate = new Date(label).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      return (
        <div className="bg-light-card dark:bg-dark-card p-3 rounded-lg shadow-lg border border-black/5 dark:border-white/5">
          <p className="label font-bold text-light-text dark:text-dark-text mb-2">{formattedDate}</p>
          <p style={{ color: payload[0].color }}>
            <span className="font-semibold text-sm">Balance: </span>
            <span className="text-sm">{formatCurrency(payload[0].value, 'EUR')}</span>
          </p>
        </div>
      );
    }
    return null;
};

const ForecastChart: React.FC<ForecastChartProps> = ({ data, oneTimeGoals, lowestPoint }) => {
  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-full text-light-text-secondary dark:text-dark-text-secondary">Select accounts and a period to generate a forecast.</div>;
  }
  
  return (
    <div style={{ width: '100%', height: '400px' }}>
      <ResponsiveContainer>
        <AreaChart
          data={data}
          margin={{ top: 5, right: 20, left: 20, bottom: 20 }}
        >
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366F1" stopOpacity={0.7}/><stop offset="95%" stopColor="#6366F1" stopOpacity={0}/></linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
          <XAxis 
            dataKey="date" 
            stroke="currentColor" 
            opacity={0.6} 
            fontSize={12} 
            tickFormatter={(dateStr) => new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            minTickGap={60}
          />
          <YAxis 
            stroke="currentColor" 
            opacity={0.6} 
            fontSize={12} 
            tickFormatter={(value) => formatCurrency(value as number, 'EUR').replace(/\.00$/, '').replace('€', '€ ')}
            domain={['dataMin', 'dataMax']}
            width={90}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="currentColor" strokeDasharray="4 4" opacity={0.5} />
          {oneTimeGoals.map(goal => (
              <ReferenceLine key={goal.id} x={goal.date} stroke="#FBBF24" strokeDasharray="3 3">
                  <Label value={goal.name} position="insideTopRight" fill="#FBBF24" fontSize={12} angle={-90} dx={10} dy={10} />
              </ReferenceLine>
          ))}
          {data.length > 0 && lowestPoint && (
              <ReferenceDot
                  x={lowestPoint.date}
                  y={lowestPoint.value}
                  r={8}
                  fill="#F97316"
                  stroke="white"
                  strokeWidth={2}
                  isFront={true}
              >
                  <Label value="Lowest Point" position="top" offset={15} fill="#F97316" fontSize={12} fontWeight="bold" />
              </ReferenceDot>
          )}
          <Area type="monotone" dataKey="value" name="Projected Balance" stroke="#6366F1" fill="url(#colorValue)" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ForecastChart;