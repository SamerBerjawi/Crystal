
import React, { useMemo } from 'react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Label, Legend } from 'recharts';
import { formatCurrency, parseDateAsUTC } from '../utils';
import { FinancialGoal, Account } from '../types';
import { ACCOUNT_TYPE_STYLES, INVESTMENT_SUB_TYPE_STYLES } from '../constants';

// Helper to generate distinct colors if needed, or map to brand/account type colors
const getColorForAccount = (account: Account, index: number) => {
    const palette = [
        '#6366F1', '#FBBF24', '#10B981', '#EF4444', '#8B5CF6', 
        '#EC4899', '#14B8A6', '#F97316', '#06B6D4', '#84CC16'
    ];
    
    // Try to match account type style first for consistency
    if (account.type && ACCOUNT_TYPE_STYLES[account.type]) {
       // Since constants store Tailwind classes like 'text-blue-500', we can map or just use palette.
       // For simplicity and better contrast on chart lines, let's cycle through the vivid palette.
       return palette[index % palette.length];
    }
    return palette[index % palette.length];
};


interface ChartData {
  date: string;
  value: number; // Total
  [key: string]: number | string; // Dynamic keys for account IDs
}

interface ForecastChartProps {
  data: ChartData[];
  oneTimeGoals: FinancialGoal[];
  lowestPoint: {
      value: number;
      date: string;
  };
  showIndividualLines?: boolean;
  accounts?: Account[];
  showGoalLines?: boolean;
  onDataPointClick?: (date: string) => void;
}

const CustomTooltip: React.FC<{ active?: boolean; payload?: any[]; label?: string, showIndividualLines?: boolean, accounts?: Account[] }> = ({ active, payload, label, showIndividualLines, accounts }) => {
    if (active && payload && payload.length) {
      const [year, month, day] = label!.split('-').map(Number);
      const formattedDate = new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' });
      
      // Sort payload by value descending for cleaner tooltip
      const sortedPayload = [...payload].sort((a, b) => b.value - a.value);

      return (
        <div className="bg-light-card dark:bg-dark-card p-3 rounded-lg shadow-lg border border-black/5 dark:border-white/5 text-sm">
          <p className="label font-bold text-light-text dark:text-dark-text mb-2">{formattedDate}</p>
          
          {showIndividualLines ? (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                  {sortedPayload.map((entry: any) => {
                      // Map dataKey (accountId) to account Name
                      const account = accounts?.find(a => a.id === entry.dataKey);
                      const name = account ? account.name : (entry.name === 'Projected Balance' ? 'Total' : entry.name);
                      return (
                          <div key={entry.dataKey} className="flex justify-between gap-4">
                              <span style={{ color: entry.color }}>{name}:</span>
                              <span className="font-mono">{formatCurrency(entry.value, 'EUR')}</span>
                          </div>
                      );
                  })}
                  <div className="pt-2 mt-2 border-t border-black/10 dark:border-white/10 flex justify-between gap-4 font-bold">
                        {/* Placeholder for total logic if needed later */}
                  </div>
              </div>
          ) : (
             <p style={{ color: payload[0].color }}>
                <span className="font-semibold">Balance: </span>
                <span>{formatCurrency(payload[0].value, 'EUR')}</span>
             </p>
          )}
          <p className="text-xs text-center mt-2 text-light-text-secondary dark:text-dark-text-secondary italic">Click to view details</p>
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

const ForecastChart: React.FC<ForecastChartProps> = ({ data, oneTimeGoals, lowestPoint, showIndividualLines = false, accounts = [], showGoalLines = true, onDataPointClick }) => {
  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-full text-light-text-secondary dark:text-dark-text-secondary">Select accounts and a period to generate a forecast.</div>;
  }
  
  const yDomain = useMemo(() => {
    const values = data.map(d => d.value); 
    let allValues: number[] = [];
    
    if (showIndividualLines) {
        data.forEach(row => {
            accounts.forEach(acc => {
                if (typeof row[acc.id] === 'number') allValues.push(row[acc.id] as number);
            });
        });
    } else {
        allValues = values;
    }
    
    if (allValues.length === 0) allValues = [0];

    const dataMin = Math.min(...allValues);
    const dataMax = Math.max(...allValues);
    
    const absoluteMin = Math.min(dataMin, lowestPoint?.value || Infinity);
    const absoluteMax = Math.max(dataMax);

    const range = absoluteMax - absoluteMin;
    const buffer = range === 0 ? 5000 : range * 0.1; // 10% buffer

    return [Math.floor(absoluteMin - buffer), Math.ceil(absoluteMax + buffer)];
  }, [data, lowestPoint, showIndividualLines, accounts]);


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
  
  // Common Props
  const commonAxisProps = {
      stroke: "currentColor",
      opacity: 0.6,
      fontSize: 12,
      tickLine: false,
      axisLine: false,
  };
  
  const handleChartClick = (state: any) => {
      if (state && state.activeLabel && onDataPointClick) {
          onDataPointClick(state.activeLabel);
      }
  };

  return (
    <div style={{ width: '100%', height: '400px' }}>
      <ResponsiveContainer>
        {showIndividualLines ? (
             <LineChart 
                data={data} 
                margin={{ top: 5, right: 20, left: 20, bottom: 20 }}
                onClick={handleChartClick}
             >
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                <XAxis dataKey="date" {...commonAxisProps} tickFormatter={tickFormatter} ticks={ticks} minTickGap={50} />
                <YAxis {...commonAxisProps} tickFormatter={yAxisTickFormatter} domain={yDomain} allowDataOverflow={true} width={60} />
                <Tooltip content={<CustomTooltip showIndividualLines={true} accounts={accounts} />} />
                {/* Render a line for each account */}
                {accounts.map((acc, idx) => (
                    <Line 
                        key={acc.id}
                        type="monotone" 
                        dataKey={acc.id} 
                        name={acc.name}
                        stroke={getColorForAccount(acc, idx)} 
                        strokeWidth={2} 
                        dot={false} 
                        activeDot={{ r: 4, onClick: (e: any, payload: any) => { if(onDataPointClick) onDataPointClick(payload.payload.date) } }}
                        cursor="pointer"
                    />
                ))}
                {showGoalLines && oneTimeGoals.map(goal => (
                    <ReferenceLine key={goal.id} x={goal.date} stroke="#FBBF24" strokeDasharray="3 3">
                        <Label value={goal.name} position="insideTopRight" fill="#FBBF24" fontSize={12} angle={-90} dx={10} dy={10} />
                    </ReferenceLine>
                ))}
             </LineChart>
        ) : (
            <AreaChart 
                data={data} 
                margin={{ top: 5, right: 20, left: 20, bottom: 20 }}
                onClick={handleChartClick}
            >
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366F1" stopOpacity={0.7}/><stop offset="95%" stopColor="#6366F1" stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
              <XAxis 
                dataKey="date" 
                {...commonAxisProps}
                tickFormatter={tickFormatter}
                ticks={ticks}
                minTickGap={50}
              />
              <YAxis 
                {...commonAxisProps}
                tickFormatter={yAxisTickFormatter}
                domain={yDomain}
                allowDataOverflow={true}
                width={60}
              />
              <Tooltip content={<CustomTooltip showIndividualLines={false} />} />
              <ReferenceLine y={0} stroke="currentColor" strokeDasharray="4 4" opacity={0.5} />
              {showGoalLines && oneTimeGoals.map(goal => (
                  <ReferenceLine key={goal.id} x={goal.date} stroke="#FBBF24" strokeDasharray="3 3">
                      <Label value={goal.name} position="insideTopRight" fill="#FBBF24" fontSize={12} angle={-90} dx={10} dy={10} />
                  </ReferenceLine>
              ))}
              <Area 
                  type="monotone" 
                  dataKey="value" 
                  name="Projected Balance" 
                  stroke="#6366F1" 
                  fill="url(#colorValue)" 
                  strokeWidth={2.5} 
                  dot={false} 
                  activeDot={{ r: 5, onClick: (e: any, payload: any) => { if(onDataPointClick) onDataPointClick(payload.payload.date) } }} 
                  cursor="pointer"
              />
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
        )}
      </ResponsiveContainer>
    </div>
  );
};

export default ForecastChart;
