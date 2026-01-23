
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Label } from 'recharts';
import { formatCurrency, parseLocalDate } from '../utils';
import { FinancialGoal } from '../types';

interface ChartData {
  name: string;
  value?: number;
  forecast?: number;
  benchmark?: number;
}

interface NetWorthChartProps {
  data: ChartData[];
  lineColor?: string;
  showForecast?: boolean;
  showGoals?: boolean;
  goals?: FinancialGoal[];
}

const yAxisTickFormatter = (value: number) => {
    if (Math.abs(value) >= 1000000) return `€${(value / 1000000).toFixed(1)}M`;
    if (Math.abs(value) >= 1000) return `€${(value / 1000).toFixed(0)}K`;
    return `€${value}`;
};

const NetWorthChart: React.FC<NetWorthChartProps> = ({ 
    data, 
    lineColor = '#6366F1',
    showForecast = true,
    showGoals = true,
    goals = []
}) => {

  const CustomTooltip = ({ active, payload, label }: any) => {
      if (active && payload && payload.length) {
        // payload can contain 'value', 'forecast', and 'benchmark'
        const historyPayload = payload.find((p: any) => p.dataKey === 'value');
        const forecastPayload = payload.find((p: any) => p.dataKey === 'forecast');
        const benchmarkPayload = payload.find((p: any) => p.dataKey === 'benchmark');

        return (
          <div className="bg-white dark:bg-dark-card p-3 rounded-xl shadow-lg border border-black/5 dark:border-white/10 text-sm">
            <p className="label font-semibold text-light-text-secondary dark:text-dark-text-secondary text-xs mb-2 pb-1 border-b border-black/5 dark:border-white/5">
                {parseLocalDate(label).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            {historyPayload && (
                <div className="flex justify-between gap-4 mb-1">
                    <span className="text-light-text dark:text-dark-text">Actual:</span>
                    <span className="font-bold text-light-text dark:text-dark-text font-mono">
                        {formatCurrency(historyPayload.value, 'EUR')}
                    </span>
                </div>
            )}
            {forecastPayload && (
                <div className="flex justify-between gap-4 mb-1">
                    <span className="text-light-text-secondary dark:text-dark-text-secondary">Projected:</span>
                    <span className="font-bold text-primary-500 font-mono">
                        {formatCurrency(forecastPayload.value, 'EUR')}
                    </span>
                </div>
            )}
            {benchmarkPayload && (
                <div className="flex justify-between gap-4 pt-1 border-t border-black/5 dark:border-white/5">
                    <span className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Baseline:</span>
                    <span className="font-bold text-gray-500 dark:text-gray-400 font-mono">
                        {formatCurrency(benchmarkPayload.value, 'EUR')}
                    </span>
                </div>
            )}
          </div>
        );
      }
      return null;
  };

  const tickFormatter = (dateStr: string) => {
    const date = parseLocalDate(dateStr);

    if (data.length <= 1) return '';

    const startDate = parseLocalDate(data[0].name);
    const endDate = parseLocalDate(data[data.length - 1].name);
    const rangeInDays = (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24);

    if (rangeInDays <= 31) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    
    if (startDate.getFullYear() === endDate.getFullYear()) {
      return date.toLocaleDateString('en-US', { month: 'short' });
    }
    
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };
  
  const gradientId = `colorNetWorth-${lineColor.replace('#', '')}`;
  const forecastGradientId = `colorNetWorthForecast-${lineColor.replace('#', '')}`;

  return (
    <div className="flex-grow" style={{ width: '100%', height: '270px' }}>
      <ResponsiveContainer minWidth={0} minHeight={0} debounce={50}>
        <AreaChart
          data={data}
          margin={{ top: 10, right: 0, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={lineColor} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={lineColor} stopOpacity={0}/>
            </linearGradient>
            <linearGradient id={forecastGradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={lineColor} stopOpacity={0.1}/>
              <stop offset="95%" stopColor={lineColor} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.05} vertical={false} />
          <XAxis 
            dataKey="name" 
            stroke="currentColor" 
            opacity={0.4} 
            fontSize={11} 
            tickFormatter={tickFormatter} 
            minTickGap={40} 
            axisLine={false} 
            tickLine={false} 
            dy={10}
          />
          <YAxis 
            stroke="currentColor" 
            opacity={0.4} 
            fontSize={11} 
            tickFormatter={yAxisTickFormatter} 
            axisLine={false} 
            tickLine={false} 
          />
          <Tooltip 
            cursor={{ stroke: lineColor, strokeWidth: 1, strokeDasharray: '4 4', opacity: 0.5 }}
            content={<CustomTooltip />} 
           />
          
          {/* Goal Markers */}
          {showGoals && goals.map((goal, index) => {
              if (!goal.date) return null;
              // Check if date is within chart range
              if(data.length === 0) return null;
              const start = data[0].name;
              const end = data[data.length - 1].name;
              if (goal.date < start || goal.date > end) return null;

              return (
                <ReferenceLine 
                    key={goal.id} 
                    x={goal.date} 
                    stroke="#F59E0B" 
                    strokeDasharray="3 3"
                    strokeOpacity={0.6}
                >
                    <Label 
                        value={goal.name} 
                        position="insideTop" 
                        fill="#F59E0B" 
                        fontSize={10} 
                        fontWeight={700}
                        angle={-90}
                        dy={20}
                        dx={-5}
                    />
                </ReferenceLine>
              );
          })}

          {/* Benchmark Line (Baseline) */}
          <Area 
            type="monotone" 
            dataKey="benchmark" 
            name="Baseline" 
            stroke="#9CA3AF" 
            strokeDasharray="3 3"
            strokeWidth={2}
            fill="none"
            activeDot={{ r: 4, fill: '#9CA3AF', strokeWidth: 0 }}
          />

          {/* Forecast Area */}
          {showForecast && (
              <Area 
                type="monotone" 
                dataKey="forecast" 
                name="Forecast" 
                stroke={lineColor} 
                strokeDasharray="5 5"
                fill={`url(#${forecastGradientId})`} 
                strokeWidth={2}
                strokeOpacity={0.6}
                activeDot={{ r: 4, fill: 'white', stroke: lineColor, strokeWidth: 2 }}
              />
          )}

          {/* Actual History Area */}
          <Area 
            type="monotone" 
            dataKey="value" 
            name="Net Worth" 
            stroke={lineColor} 
            fill={`url(#${gradientId})`} 
            strokeWidth={3}
            activeDot={{ r: 6, fill: 'white', stroke: lineColor, strokeWidth: 3 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default NetWorthChart;
