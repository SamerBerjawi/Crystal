import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Label } from 'recharts';
import { formatCurrency, parseDateAsUTC } from '../utils';
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

const CustomTooltip: React.FC<{ active?: boolean; payload?: any[]; label?: string }> = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const [year, month, day] = label!.split('-').map(Number);
      const formattedDate = new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' });
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

const yAxisTickFormatter = (value: number) => {
    if (Math.abs(value) >= 1000000) return `€${(value / 1000000).toFixed(1)}M`;
    if (Math.abs(value) >= 1000) return `€${(value / 1000).toFixed(0)}K`;
    return `€${value}`;
};

const ForecastChart: React.FC<ForecastChartProps> = ({ data, oneTimeGoals, lowestPoint }) => {
  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-full text-light-text-secondary dark:text-dark-text-secondary">Select accounts and a period to generate a forecast.</div>;
  }
  
  const yDomain = useMemo(() => {
    const values = data.map(d => d.value);
    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);
    
    // Also consider the lowest point's value in case it's not in the visible data range
    const absoluteMin = Math.min(dataMin, lowestPoint?.value || Infinity);
    const absoluteMax = Math.max(dataMax);

    const range = absoluteMax - absoluteMin;
    const buffer = range === 0 ? 5000 : range * 0.2; // 20% buffer, with a minimum

    return [Math.floor(absoluteMin - buffer), Math.ceil(absoluteMax + buffer)];
  }, [data, lowestPoint]);


  const { ticks, tickFormatter } = useMemo(() => {
    if (data.length < 2) return { ticks: [], tickFormatter: () => '' };

    const startDate = new Date(data[0].date.replace(/-/g, '/'));
    const endDate = new Date(data[data.length - 1].date.replace(/-/g, '/'));
    const rangeInDays = (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24);

    if (rangeInDays > 120) { // For ranges longer than ~4 months, show one tick per month.
        const newTicks: string[] = [];
        const monthSet = new Set<string>();

        for (const item of data) {
            const date = new Date(item.date.replace(/-/g, '/'));
            const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
            if (!monthSet.has(monthKey)) {
                newTicks.push(item.date);
                monthSet.add(monthKey);
            }
        }
        
        const formatter = (dateStr: string) => {
            const [year, month] = dateStr.split('-').map(Number);
            const utcDate = new Date(Date.UTC(year, month - 1, 1));
            return utcDate.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', year: '2-digit' });
        };
        return { ticks: newTicks, tickFormatter: formatter };

    } else { // For shorter ranges, show day and month, let recharts decide tick placement.
        const formatter = (dateStr: string) => {
            const [year, month, day] = dateStr.split('-').map(Number);
            const utcDate = new Date(Date.UTC(year, month - 1, day));
            return utcDate.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
        };
        return { ticks: undefined, tickFormatter: formatter };
    }
  }, [data]);

  const lowestPointDateFormatted = lowestPoint?.date
    ? parseDateAsUTC(lowestPoint.date).toLocaleDateString('en-US', {
        timeZone: 'UTC',
        month: 'short',
        day: 'numeric',
      })
    : '';
  
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
            tickFormatter={tickFormatter}
            ticks={ticks}
            minTickGap={80}
          />
          <YAxis 
            stroke="currentColor" 
            opacity={0.6} 
            fontSize={12} 
            tickFormatter={yAxisTickFormatter}
            domain={yDomain}
            allowDataOverflow={true}
            width={90}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="currentColor" strokeDasharray="4 4" opacity={0.5} />
          {oneTimeGoals.map(goal => (
              <ReferenceLine key={goal.id} x={goal.date} stroke="#FBBF24" strokeDasharray="3 3">
                  <Label value={goal.name} position="insideTopRight" fill="#FBBF24" fontSize={12} angle={-90} dx={10} dy={10} />
              </ReferenceLine>
          ))}
          <Area type="monotone" dataKey="value" name="Projected Balance" stroke="#6366F1" fill="url(#colorValue)" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
          {data.length > 0 && lowestPoint && (
              <ReferenceLine
                  key="lowest-point-line"
                  x={lowestPoint.date}
                  stroke="#FF3B30" // Red
                  strokeDasharray="3 3"
              >
                <Label 
                    value={`Lowest: ${formatCurrency(lowestPoint.value, 'EUR')} on ${lowestPointDateFormatted}`}
                    position="insideTopRight" 
                    fill="#FF3B30" 
                    fontSize={12} 
                    angle={-90} 
                    dx={10} 
                    dy={20} 
                    fontWeight="bold"
                />
              </ReferenceLine>
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ForecastChart;