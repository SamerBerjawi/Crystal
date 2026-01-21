
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency, parseLocalDate } from '../utils';

interface NetWorthDataPoint {
  date: string;
  actual?: number | null;
  forecast?: number | null;
}

interface NetWorthChartProps {
  data: NetWorthDataPoint[];
  lineColor?: string;
  showForecast?: boolean;
  onToggleForecast?: (show: boolean) => void;
}

const yAxisTickFormatter = (value: number) => {
    if (Math.abs(value) >= 1000000) return `€${(value / 1000000).toFixed(1)}M`;
    if (Math.abs(value) >= 1000) return `€${(value / 1000).toFixed(0)}K`;
    return `€${value}`;
};

const NetWorthChart: React.FC<NetWorthChartProps> = ({ data, lineColor = '#6366F1', showForecast = false, onToggleForecast }) => {

  const CustomTooltip = ({ active, payload, label }: any) => {
      if (active && payload && payload.length) {
        const dateStr = label;
        const actual = payload.find((p: any) => p.dataKey === 'actual');
        const forecast = payload.find((p: any) => p.dataKey === 'forecast');

        return (
          <div className="bg-white dark:bg-dark-card p-3 rounded-xl shadow-lg border border-black/5 dark:border-white/10 z-50">
            <p className="label font-semibold text-light-text-secondary dark:text-dark-text-secondary text-xs mb-1">{parseLocalDate(dateStr).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            {actual && (
                 <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: lineColor }}></div>
                    <p className="font-bold text-lg text-light-text dark:text-dark-text">{formatCurrency(actual.value, 'EUR')}</p>
                 </div>
            )}
            {forecast && (
                 <div className="flex items-center gap-2 mt-1">
                    <div className="w-2 h-2 rounded-full border border-current" style={{ color: lineColor }}></div>
                    <p className="font-bold text-lg text-light-text dark:text-dark-text opacity-70">{formatCurrency(forecast.value, 'EUR')} <span className="text-[10px] uppercase font-normal ml-1">(Est)</span></p>
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

    const startDate = parseLocalDate(data[0].date);
    const endDate = parseLocalDate(data[data.length - 1].date);
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
    <div className="flex-grow relative group" style={{ width: '100%', height: '270px' }}>
      {onToggleForecast && (
          <div className="absolute top-0 right-0 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
               <button 
                  onClick={(e) => { e.stopPropagation(); onToggleForecast(!showForecast); }}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold border transition-colors ${showForecast ? 'bg-primary-50 border-primary-200 text-primary-700 dark:bg-primary-900/30 dark:border-primary-800 dark:text-primary-300' : 'bg-white dark:bg-white/5 border-black/10 dark:border-white/10 text-light-text-secondary dark:text-dark-text-secondary hover:bg-gray-50 dark:hover:bg-white/10'}`}
               >
                   <span className={`w-2 h-2 rounded-full ${showForecast ? 'bg-primary-500' : 'border border-current'}`}></span>
                   Forecast
               </button>
          </div>
      )}

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
            <pattern id="forecastPattern" patternUnits="userSpaceOnUse" width="4" height="4">
                <path d="M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2" style={{ stroke: lineColor, strokeWidth: 1, opacity: 0.1 }} />
            </pattern>
             <linearGradient id={forecastGradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={lineColor} stopOpacity={0.15}/>
              <stop offset="95%" stopColor={lineColor} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.05} vertical={false} />
          <XAxis 
            dataKey="date" 
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
          
          {/* Actual Data Area */}
          <Area 
            type="monotone" 
            dataKey="actual" 
            name="Net Worth" 
            stroke={lineColor} 
            fill={`url(#${gradientId})`} 
            strokeWidth={3}
            activeDot={{ r: 6, fill: 'white', stroke: lineColor, strokeWidth: 3 }}
            connectNulls
          />

          {/* Forecast Data Area */}
           <Area 
            type="monotone" 
            dataKey="forecast" 
            name="Forecast" 
            stroke={lineColor} 
            strokeDasharray="5 5"
            fill={`url(#${forecastGradientId})`} 
            strokeWidth={2}
            activeDot={{ r: 4, fill: 'white', stroke: lineColor, strokeWidth: 2, strokeDasharray: '' }}
            connectNulls
          />

        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default NetWorthChart;
