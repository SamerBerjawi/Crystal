
import React, { useMemo } from 'react';
import { AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Label, Legend } from 'recharts';
import { formatCurrency, parseLocalDate } from '../utils';
import { FinancialGoal } from '../types';

interface ChartData {
  name: string;
  value?: number;
  actual?: number;
  forecast?: number;
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
  const chartData = data.map(point => ({
    ...point,
    actual: point.value,
  }));

  const latestPerformancePoint = useMemo(() => {
    const comparablePoints = chartData.filter(
      point => typeof point.actual === 'number' && typeof point.forecast === 'number'
    );

    if (comparablePoints.length === 0) return null;

    const latestPoint = comparablePoints[comparablePoints.length - 1];
    const delta = (latestPoint.actual as number) - (latestPoint.forecast as number);
    const deltaPercent = (latestPoint.forecast && latestPoint.forecast !== 0)
      ? (delta / latestPoint.forecast) * 100
      : 0;

    return {
      ...latestPoint,
      delta,
      deltaPercent,
    };
  }, [chartData]);

  const CustomTooltip = ({ active, payload, label }: any) => {
      if (active && payload && payload.length) {
        const historyPayload = payload.find((p: any) => p.dataKey === 'actual');
        const forecastPayload = payload.find((p: any) => p.dataKey === 'forecast');
        const delta = historyPayload && forecastPayload
          ? historyPayload.value - forecastPayload.value
          : null;
        const deltaPercent = delta !== null && forecastPayload?.value
          ? (delta / forecastPayload.value) * 100
          : null;

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
                <div className="flex justify-between gap-4">
                    <span className="text-light-text-secondary dark:text-dark-text-secondary">Forecast:</span>
                    <span className="font-bold text-primary-500 font-mono">
                        {formatCurrency(forecastPayload.value, 'EUR')}
                    </span>
                </div>
            )}
            {delta !== null && deltaPercent !== null && (
                <div className="flex justify-between gap-4 pt-2 mt-2 border-t border-black/5 dark:border-white/5">
                    <span className="text-light-text-secondary dark:text-dark-text-secondary">Performance:</span>
                    <span className={`font-bold font-mono ${delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {delta >= 0 ? '+' : ''}{formatCurrency(delta, 'EUR')} ({deltaPercent >= 0 ? '+' : ''}{deltaPercent.toFixed(1)}%)
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

    if (chartData.length <= 1) return '';

    const startDate = parseLocalDate(chartData[0].name);
    const endDate = parseLocalDate(chartData[chartData.length - 1].name);
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

  return (
    <div className="flex-grow" style={{ width: '100%', height: '270px' }}>
      {latestPerformancePoint && (
        <div className="flex justify-end mb-2 text-xs">
          <div className="px-2 py-1 rounded-md bg-black/5 dark:bg-white/10 font-medium">
            <span className="text-light-text-secondary dark:text-dark-text-secondary mr-1">Vs forecast:</span>
            <span className={latestPerformancePoint.delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
              {latestPerformancePoint.delta >= 0 ? '+' : ''}
              {formatCurrency(latestPerformancePoint.delta, 'EUR')} ({latestPerformancePoint.deltaPercent >= 0 ? '+' : ''}{latestPerformancePoint.deltaPercent.toFixed(1)}%)
            </span>
          </div>
        </div>
      )}
      <ResponsiveContainer minWidth={0} minHeight={0} debounce={50}>
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 0, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
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
          <Legend verticalAlign="top" height={24} iconType="line" wrapperStyle={{ fontSize: '12px' }} />
          
          {/* Goal Markers */}
          {showGoals && goals.map((goal) => {
              if (!goal.date) return null;
              if(chartData.length === 0) return null;
              const start = chartData[0].name;
              const end = chartData[chartData.length - 1].name;
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

          {showForecast && (
              <Line 
                type="monotone" 
                dataKey="forecast" 
                name="Forecast" 
                stroke={lineColor} 
                strokeDasharray="6 5"
                strokeWidth={2}
                strokeOpacity={0.8}
                dot={false}
                connectNulls
                activeDot={{ r: 4, fill: 'white', stroke: lineColor, strokeWidth: 2 }}
              />
          )}

          <Area 
            type="monotone" 
            dataKey="actual" 
            name="Actual Net Worth" 
            stroke="#10B981" 
            fill={`url(#${gradientId})`} 
            strokeWidth={3}
            activeDot={{ r: 6, fill: 'white', stroke: '#10B981', strokeWidth: 3 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default NetWorthChart;
