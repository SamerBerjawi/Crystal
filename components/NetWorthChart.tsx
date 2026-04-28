
import React, { useMemo } from 'react';
import { AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Label, Legend, Dot } from 'recharts';
import { formatCurrency, parseLocalDate } from '../utils';
import { FinancialGoal } from '../types';
import { motion } from 'motion/react';

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
  const chartData = useMemo(() => data.map(point => ({
    ...point,
    actual: point.value,
  })), [data]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const CustomTooltip = ({ active, payload, label }: any) => {
      if (active && payload && payload.length) {
        const historyPayload = payload.find((p: any) => p.dataKey === 'actual');
        const forecastPayload = payload.find((p: any) => p.dataKey === 'forecast');

        return (
          <div className="bg-white/90 dark:bg-dark-card/90 backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-black/5 dark:border-white/10 min-w-[180px] animate-in fade-in zoom-in duration-200">
            <div className="mb-3 pb-2 border-b border-black/5 dark:border-white/5">
                <p className="font-bold text-light-text dark:text-dark-text text-xs uppercase tracking-wider">
                    {parseLocalDate(label).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
            </div>
            
            <div className="space-y-3">
                {historyPayload && (
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest mb-1">Actual Net Worth</span>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                            <span className="text-lg font-black text-light-text dark:text-dark-text font-mono tracking-tighter">
                                {formatCurrency(historyPayload.value, 'EUR')}
                            </span>
                        </div>
                    </div>
                )}
                
                {forecastPayload && (
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest mb-1">Forecasted</span>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-primary-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                            <span className="text-lg font-black text-primary-500 font-mono tracking-tighter">
                                {formatCurrency(forecastPayload.value, 'EUR')}
                            </span>
                        </div>
                    </div>
                )}
            </div>
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
    
    if (rangeInDays <= 365) {
      // For ranges up to a year, show Month only, but ensure we don't repeat if ticks are too close
      return date.toLocaleDateString('en-US', { month: 'short' });
    }
    
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };
  
  const gradientId = `colorNetWorth-${lineColor.replace('#', '')}`;
  const forecastGradientId = `colorForecast-${lineColor.replace('#', '')}`;

  return (
    <div className="flex-grow relative" style={{ width: '100%', height: '300px' }}>
      <ResponsiveContainer minWidth={0} minHeight={0} debounce={50}>
        <AreaChart
          data={chartData}
          margin={{ top: 20, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id={forecastGradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={lineColor} stopOpacity={0.2}/>
              <stop offset="95%" stopColor={lineColor} stopOpacity={0}/>
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.05} vertical={false} />
          <XAxis 
            dataKey="name" 
            stroke="currentColor" 
            opacity={0.4} 
            fontSize={11} 
            tickFormatter={tickFormatter} 
            minTickGap={60} 
            interval="preserveStartEnd"
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
          <Legend 
            verticalAlign="top" 
            align="right"
            height={36} 
            iconType="circle" 
            wrapperStyle={{ 
                fontSize: '10px', 
                fontWeight: '800', 
                textTransform: 'uppercase', 
                letterSpacing: '0.05em',
                paddingBottom: '20px'
            }} 
          />
          
          {/* Today Line */}
          <ReferenceLine 
            x={todayStr} 
            stroke="#6366F1" 
            strokeWidth={2} 
            strokeDasharray="3 3"
            label={{ 
                value: 'TODAY', 
                position: 'insideTopLeft', 
                fill: '#6366F1', 
                fontSize: 10, 
                fontWeight: 900,
                letterSpacing: '0.1em'
            }} 
          />

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
              <Area 
                type="monotone" 
                dataKey="forecast" 
                name="Forecast" 
                stroke={lineColor} 
                fill={`url(#${forecastGradientId})`}
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
            filter="url(#glow)"
            activeDot={{ r: 6, fill: 'white', stroke: '#10B981', strokeWidth: 3 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default NetWorthChart;
