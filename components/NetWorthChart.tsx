
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
          <div className="bg-white/90 dark:bg-dark-card/90 backdrop-blur-xl p-5 rounded-[2rem] shadow-2xl border border-black/5 dark:border-white/10 min-w-[220px] animate-in fade-in zoom-in duration-300">
            <div className="mb-4 pb-3 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
                <p className="font-black text-light-text dark:text-dark-text text-[10px] uppercase tracking-[0.25em] opacity-40">
                    {parseLocalDate(label).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                <div className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-ping"></div>
            </div>
            
            <div className="space-y-4">
                {historyPayload && (
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-[0.3em] mb-1.5 opacity-60">Verified Ledger Value</span>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)] border-2 border-white/20" />
                            <span className="text-xl font-black text-light-text dark:text-dark-text font-mono tracking-tighter">
                                {formatCurrency(historyPayload.value, 'EUR')}
                            </span>
                        </div>
                    </div>
                )}
                
                {forecastPayload && (
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-[0.3em] mb-1.5 opacity-60">Predictive Node Outcome</span>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-primary-500 shadow-[0_0_12px_rgba(99,102,241,0.5)] border-2 border-white/20" />
                            <span className="text-xl font-black text-primary-500 font-mono tracking-tighter">
                                {formatCurrency(forecastPayload.value, 'EUR')}
                            </span>
                        </div>
                    </div>
                )}
            </div>
            <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/5 flex items-center justify-center">
                <p className="text-[7px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-[0.4em] opacity-30">Security Level: Enterprise High</p>
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
      return date.toLocaleDateString('en-US', { month: 'short' });
    }
    
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };
  
  const gradientId = `colorNetWorth-${lineColor.replace('#', '')}`;
  const forecastGradientId = `colorForecast-${lineColor.replace('#', '')}`;

  return (
    <div className="flex-grow relative w-full h-[400px]">
      <ResponsiveContainer width="100%" height="100%" debounce={50}>
        <AreaChart
          data={chartData}
          margin={{ top: 20, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
              <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id={forecastGradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={lineColor} stopOpacity={0.15}/>
              <stop offset="95%" stopColor={lineColor} stopOpacity={0}/>
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="subtle-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <CartesianGrid strokeDasharray="6 6" stroke="currentColor" opacity={0.03} vertical={false} />
          <XAxis 
            dataKey="name" 
            stroke="currentColor" 
            opacity={0.3} 
            fontSize={9} 
            tickFormatter={tickFormatter} 
            minTickGap={60} 
            interval="preserveStartEnd"
            axisLine={false} 
            tickLine={false} 
            dy={10}
            className="font-black uppercase tracking-[0.2em]"
          />
          <YAxis 
            stroke="currentColor" 
            opacity={0.3} 
            fontSize={9} 
            tickFormatter={yAxisTickFormatter} 
            axisLine={false} 
            tickLine={false} 
            className="font-black font-mono"
          />
          <Tooltip 
            cursor={{ stroke: lineColor, strokeWidth: 1, strokeDasharray: '6 6', opacity: 0.3 }}
            content={<CustomTooltip />} 
           />
          <Legend 
            verticalAlign="top" 
            align="right"
            height={48} 
            iconType="circle" 
            wrapperStyle={{ 
                fontSize: '9px', 
                fontWeight: '900', 
                textTransform: 'uppercase', 
                letterSpacing: '0.25em',
                paddingBottom: '30px',
                opacity: 0.4
            }} 
          />
          
          <ReferenceLine 
            x={todayStr} 
            stroke="#6366F1" 
            strokeWidth={1} 
            strokeDasharray="4 4"
            className="opacity-40"
          >
            <Label 
                value="TEMPORAL ORIGIN" 
                position="insideTopLeft" 
                fill="#6366F1" 
                fontSize={8} 
                fontWeight={900}
                letterSpacing="0.4em"
                className="opacity-60"
            />
          </ReferenceLine>

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
                    strokeDasharray="4 4"
                    strokeOpacity={0.4}
                >
                    <Label 
                        value={goal.name.toUpperCase()} 
                        position="insideTop" 
                        fill="#F59E0B" 
                        fontSize={8} 
                        fontWeight={900}
                        angle={-90}
                        dy={40}
                        dx={-8}
                        letterSpacing="0.3em"
                        className="opacity-40"
                    />
                </ReferenceLine>
              );
          })}

          {showForecast && (
              <Area 
                type="monotone" 
                dataKey="forecast" 
                name="Node Projection" 
                stroke={lineColor} 
                fill={`url(#${forecastGradientId})`}
                strokeDasharray="8 8"
                strokeWidth={2}
                strokeOpacity={0.6}
                dot={false}
                connectNulls
                activeDot={{ r: 4, fill: 'white', stroke: lineColor, strokeWidth: 2 }}
              />
          )}

          <Area 
            type="monotone" 
            dataKey="actual" 
            name="Confirmed Velocity" 
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
