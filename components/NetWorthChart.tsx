
import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { formatCurrency, parseDateAsUTC, getPreferredTimeZone } from '../utils';

interface ChartData {
  name: string;
  value: number;
}

interface NetWorthChartProps {
  data: ChartData[];
}

const yAxisTickFormatter = (value: number) => {
    if (value === 0) return '€0';
    if (Math.abs(value) >= 1000000) return `€${(value / 1000000).toFixed(1)}M`;
    if (Math.abs(value) >= 1000) return `€${(value / 1000).toFixed(0)}K`;
    return `€${value}`;
};

const NetWorthChart: React.FC<NetWorthChartProps> = ({ data }) => {

  const gradientOffset = useMemo(() => {
    const dataMax = Math.max(...data.map((i) => i.value));
    const dataMin = Math.min(...data.map((i) => i.value));
  
    if (dataMax <= 0) return 0;
    if (dataMin >= 0) return 1;
  
    return dataMax / (dataMax - dataMin);
  }, [data]);

  const CustomTooltip = ({ active, payload, label }: any) => {
      if (active && payload && payload.length) {
        const date = parseDateAsUTC(label);
        const timeZone = getPreferredTimeZone();
        const formattedDate = date.toLocaleDateString('en-US', { timeZone, year: 'numeric', month: 'long', day: 'numeric' });
        const value = payload[0].value;
        const isPositive = value >= 0;

        return (
          <div className="bg-white/95 dark:bg-dark-card/95 backdrop-blur-md p-4 rounded-xl shadow-2xl border border-black/5 dark:border-white/10 text-sm ring-1 ring-black/5">
            <p className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide mb-1">{formattedDate}</p>
            <p className={`text-xl font-bold ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {formatCurrency(value, 'EUR')}
            </p>
            <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary mt-1">Net Worth</p>
          </div>
        );
      }
      return null;
  };

  const tickFormatter = (dateStr: string) => {
    const date = parseDateAsUTC(dateStr);
    const timeZone = getPreferredTimeZone();

    if (data.length <= 1) return '';

    const startDate = parseDateAsUTC(data[0].name);
    const endDate = parseDateAsUTC(data[data.length - 1].name);
    const rangeInDays = (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24);

    if (rangeInDays <= 60) {
        return date.toLocaleDateString('en-US', { timeZone, month: 'short', day: 'numeric' });
    }
    
    return date.toLocaleDateString('en-US', { timeZone, month: 'short', year: '2-digit' });
  };
  
  if (!data || data.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-light-text-secondary dark:text-dark-text-secondary">
            <p>No data available</p>
        </div>
      )
  }

  return (
    <div className="flex-grow" style={{ width: '100%', height: '270px' }}>
      <ResponsiveContainer minWidth={0} minHeight={0} debounce={50}>
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="splitColorNetWorth" x1="0" y1="0" x2="0" y2="1">
              <stop offset={gradientOffset} stopColor="#10B981" stopOpacity={0.2}/>
              <stop offset={gradientOffset} stopColor="#F43F5E" stopOpacity={0.2}/>
            </linearGradient>
            <linearGradient id="splitStrokeNetWorth" x1="0" y1="0" x2="0" y2="1">
                <stop offset={gradientOffset} stopColor="#10B981" stopOpacity={1}/>
                <stop offset={gradientOffset} stopColor="#F43F5E" stopOpacity={1}/>
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
            width={45} 
          />
          
          <Tooltip 
            cursor={{ stroke: 'currentColor', strokeWidth: 1, strokeDasharray: '3 3', opacity: 0.2 }}
            content={<CustomTooltip />} 
           />
           
          <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} />
          
          <Area 
            type="monotone" 
            dataKey="value" 
            name="Net Worth" 
            stroke="url(#splitStrokeNetWorth)" 
            fill="url(#splitColorNetWorth)" 
            strokeWidth={3}
            activeDot={{ r: 6, strokeWidth: 0, fill: 'url(#splitStrokeNetWorth)' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default NetWorthChart;
