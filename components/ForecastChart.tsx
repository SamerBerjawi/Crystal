
import React, { useMemo } from 'react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Label, ReferenceDot } from 'recharts';
import { formatCurrency, getPreferredTimeZone, parseDateAsUTC } from '../utils';
import { FinancialGoal, Account } from '../types';
import { ACCOUNT_TYPE_STYLES } from '../constants';

// Helper to generate distinct colors if needed, or map to brand/account type colors
const getColorForAccount = (account: Account, index: number) => {
    const palette = [
        '#6366F1', '#FBBF24', '#10B981', '#EF4444', '#8B5CF6', 
        '#EC4899', '#14B8A6', '#F97316', '#06B6D4', '#84CC16'
    ];
    
    if (account.type && ACCOUNT_TYPE_STYLES[account.type]) {
       return palette[index % palette.length];
    }
    return palette[index % palette.length];
};

interface ChartData {
  date: string;
  value: number; // Total
  [key: string]: number | string | { description: string, amount: number, type: string }[]; 
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
      const timeZone = getPreferredTimeZone();
      const formattedDate = new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', { timeZone, year: 'numeric', month: 'long', day: 'numeric' });
      
      const sortedPayload = [...payload].sort((a, b) => b.value - a.value);
      const dataPoint = payload[0].payload;
      const dailySummary = dataPoint.dailySummary as { description: string; amount: number; type: string }[] | undefined;
      const summaryToShow = dailySummary ? dailySummary.slice(0, 5) : [];
      const remainingCount = dailySummary ? dailySummary.length - 5 : 0;

      return (
        <div className="bg-white/95 dark:bg-dark-card/95 backdrop-blur-md p-4 rounded-xl shadow-2xl border border-black/5 dark:border-white/10 text-sm max-w-[320px] ring-1 ring-black/5">
          <p className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide mb-2">{formattedDate}</p>
          
          {showIndividualLines ? (
              <div className="space-y-2 max-h-60 overflow-y-auto mb-3">
                  {sortedPayload.map((entry: any) => {
                      const account = accounts?.find(a => a.id === entry.dataKey);
                      const name = account ? account.name : (entry.name === 'Projected Balance' ? 'Total' : entry.name);
                      return (
                          <div key={entry.dataKey} className="flex justify-between items-center gap-4">
                              <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
                                  <span className="text-light-text dark:text-dark-text font-medium">{name}</span>
                              </div>
                              <span className="font-mono font-semibold">{formatCurrency(entry.value, 'EUR')}</span>
                          </div>
                      );
                  })}
              </div>
          ) : (
             <div className="mb-4">
                <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Projected Balance</span>
                <div className={`text-2xl font-bold ${payload[0].value < 0 ? 'text-red-500' : 'text-light-text dark:text-dark-text'}`}>
                    {formatCurrency(payload[0].value, 'EUR')}
                </div>
             </div>
          )}
          
          {dailySummary && dailySummary.length > 0 && (
            <div className="pt-3 border-t border-black/10 dark:border-white/10">
                <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase mb-2">Events</p>
                <div className="space-y-2">
                    {summaryToShow.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-xs group">
                            <span className="truncate mr-3 text-light-text dark:text-dark-text font-medium">{item.description}</span>
                            <span className={`font-mono whitespace-nowrap ${item.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {item.amount >= 0 ? '+' : ''}{formatCurrency(item.amount, 'EUR')}
                            </span>
                        </div>
                    ))}
                    {remainingCount > 0 && (
                        <p className="text-xs text-primary-500 font-medium text-center mt-2 bg-primary-50 dark:bg-primary-900/20 py-1 rounded">
                            + {remainingCount} more items
                        </p>
                    )}
                </div>
            </div>
          )}

          <p className="text-[10px] text-center mt-3 text-light-text-secondary dark:text-dark-text-secondary opacity-70">Tap to see details</p>
        </div>
      );
    }
    return null;
};

const yAxisTickFormatter = (value: number) => {
    if (value === 0) return '€0';
    if (Math.abs(value) >= 1000000) return `€${(value / 1000000).toFixed(1)}M`;
    if (Math.abs(value) >= 1000) return `€${(value / 1000).toFixed(0)}K`;
    return `€${value}`;
};

const ForecastChart: React.FC<ForecastChartProps> = ({ data, oneTimeGoals, lowestPoint, showIndividualLines = false, accounts = [], showGoalLines = true, onDataPointClick }) => {
  
  const gradientOffset = useMemo(() => {
    if (showIndividualLines || !data.length) return 0;
    
    const dataMax = Math.max(...data.map((i) => i.value));
    const dataMin = Math.min(...data.map((i) => i.value));
  
    if (dataMax <= 0) return 0;
    if (dataMin >= 0) return 1;
  
    return dataMax / (dataMax - dataMin);
  }, [data, showIndividualLines]);
  
  const yDomain = useMemo(() => {
    if (!data || data.length === 0) return [0, 0];

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
    
    // Ensure the lowest point is visible even if it's an outlier
    const absoluteMin = Math.min(dataMin, lowestPoint?.value || Infinity);
    const absoluteMax = Math.max(dataMax);

    // Add padding
    const range = absoluteMax - absoluteMin;
    const buffer = range === 0 ? 1000 : range * 0.15; 

    return [Math.floor(absoluteMin - buffer), Math.ceil(absoluteMax + buffer)];
  }, [data, lowestPoint, showIndividualLines, accounts]);


  const { ticks, tickFormatter } = useMemo(() => {
    if (!data || data.length < 2) return { ticks: [], tickFormatter: () => '' };

    const startDate = data.length ? parseDateAsUTC(data[0].date) : new Date(0);
    const endDate = data.length ? parseDateAsUTC(data[data.length - 1].date) : new Date(0);
    const rangeInDays = (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24);

    if (rangeInDays > 120) { 
        const newTicks: string[] = [];
        const monthSet = new Set<string>();

        for (const item of data) {
            const date = parseDateAsUTC(item.date);
            const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
            if (!monthSet.has(monthKey)) {
                newTicks.push(item.date);
                monthSet.add(monthKey);
            }
        }
        
        const formatter = (dateStr: string) => {
            const [year, month] = dateStr.split('-').map(Number);
            const utcDate = new Date(Date.UTC(year, month - 1, 1));
          const timeZone = getPreferredTimeZone();
          return utcDate.toLocaleDateString('en-US', { timeZone, month: 'short', year: '2-digit' });
        };
        return { ticks: newTicks, tickFormatter: formatter };

    } else {
        const formatter = (dateStr: string) => {
            const [year, month, day] = dateStr.split('-').map(Number);
            const utcDate = new Date(Date.UTC(year, month - 1, day));
          const timeZone = getPreferredTimeZone();
          return utcDate.toLocaleDateString('en-US', { timeZone, month: 'short', day: 'numeric' });
        };
        return { ticks: undefined, tickFormatter: formatter };
    }
  }, [data]);

  const lowestPointDateFormatted = lowestPoint?.date
    ? parseDateAsUTC(lowestPoint.date).toLocaleDateString('en-US', {
        timeZone: getPreferredTimeZone(),
        month: 'short',
        day: 'numeric',
      })
    : '';
  
  const commonAxisProps = {
      stroke: "currentColor",
      opacity: 0.4,
      fontSize: 11,
      tickLine: false,
      axisLine: false,
  };
  
  const handleChartClick = (state: any) => {
      if (state && state.activeLabel && onDataPointClick) {
          onDataPointClick(state.activeLabel);
      }
  };

  if (!data || data.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center h-[400px] text-light-text-secondary dark:text-dark-text-secondary bg-light-bg/50 dark:bg-dark-bg/50 rounded-xl border-2 border-dashed border-light-separator dark:border-dark-separator">
            <span className="material-symbols-outlined text-4xl mb-2 opacity-50">query_stats</span>
            <p>No forecast data available. Select accounts to view projections.</p>
        </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '400px' }}>
      <ResponsiveContainer minWidth={0} minHeight={0} debounce={50}>
        {showIndividualLines ? (
             <LineChart 
                data={data} 
                margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
                onClick={handleChartClick}
             >
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.05} vertical={false} />
                <XAxis dataKey="date" {...commonAxisProps} tickFormatter={tickFormatter} ticks={ticks} minTickGap={40} dy={10} />
                <YAxis {...commonAxisProps} tickFormatter={yAxisTickFormatter} domain={yDomain} allowDataOverflow={true} width={60} />
                <Tooltip content={<CustomTooltip showIndividualLines={true} accounts={accounts} />} cursor={{stroke: 'rgba(0,0,0,0.1)', strokeWidth: 2}} />
                
                {accounts.map((acc, idx) => (
                    <Line 
                        key={acc.id}
                        type="monotone" 
                        dataKey={acc.id} 
                        name={acc.name}
                        stroke={getColorForAccount(acc, idx)} 
                        strokeWidth={2} 
                        dot={false} 
                        activeDot={{ r: 5, strokeWidth: 0 }}
                        cursor="pointer"
                    />
                ))}
                
                {showGoalLines && oneTimeGoals.map(goal => (
                    <ReferenceLine key={goal.id} x={goal.date} stroke="#F59E0B" strokeDasharray="4 4" strokeWidth={2}>
                        <Label 
                            value={goal.name} 
                            position="insideTopRight" 
                            fill="#B45309" 
                            className="fill-amber-700 dark:fill-amber-400 text-xs font-bold bg-white"
                            angle={-90}
                            dx={10}
                            dy={20}
                        />
                    </ReferenceLine>
                ))}
             </LineChart>
        ) : (
            <AreaChart 
                data={data} 
                margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
                onClick={handleChartClick}
            >
              <defs>
                <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset={gradientOffset} stopColor="#10B981" stopOpacity={0.25} />
                  <stop offset={gradientOffset} stopColor="#EF4444" stopOpacity={0.25} />
                </linearGradient>
                <linearGradient id="splitStroke" x1="0" y1="0" x2="0" y2="1">
                  <stop offset={gradientOffset} stopColor="#10B981" stopOpacity={1} />
                  <stop offset={gradientOffset} stopColor="#EF4444" stopOpacity={1} />
                </linearGradient>
              </defs>
              
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.05} vertical={false} />
              
              <XAxis 
                dataKey="date" 
                {...commonAxisProps}
                tickFormatter={tickFormatter}
                ticks={ticks}
                minTickGap={40}
                dy={10}
              />
              
              <YAxis 
                {...commonAxisProps}
                tickFormatter={yAxisTickFormatter}
                domain={yDomain}
                allowDataOverflow={true}
                width={60}
              />
              
              <Tooltip content={<CustomTooltip showIndividualLines={false} />} cursor={{stroke: 'rgba(0,0,0,0.1)', strokeWidth: 2, strokeDasharray: '5 5'}} />
              
              {/* Zero Line */}
              <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.3} strokeWidth={1} />

              {/* Goals */}
              {showGoalLines && oneTimeGoals.map(goal => (
                  <ReferenceLine key={goal.id} x={goal.date} stroke="#F59E0B" strokeDasharray="6 4" strokeWidth={1.5} isFront>
                       <Label 
                           content={({ viewBox }) => {
                               const x = viewBox?.x || 0;
                               const y = 20; // Fixed top position
                               return (
                                   <g transform={`translate(${x}, ${y})`}>
                                       <rect x="-4" y="-15" width="20" height="20" rx="4" fill="#F59E0B" />
                                       <text x="6" y="0" fill="white" fontSize="12" textAnchor="middle" fontWeight="bold">★</text>
                                       <text x="0" y="0" transform="rotate(90, 10, 10)" fill="#F59E0B" fontSize="11" fontWeight="600" dy={10}>{goal.name}</text>
                                   </g>
                               );
                           }}
                       />
                  </ReferenceLine>
              ))}
              
              {/* Area with Split Gradient */}
              <Area 
                  type="monotone" 
                  dataKey="value" 
                  name="Projected Balance" 
                  stroke="url(#splitStroke)" 
                  fill="url(#splitColor)" 
                  strokeWidth={3} 
                  dot={false} 
                  activeDot={{ r: 6, strokeWidth: 0, fill: 'url(#splitStroke)' }} 
                  cursor="pointer"
              />
              
              {/* Lowest Point Marker */}
              {data.length > 0 && lowestPoint && (
                  <ReferenceDot
                     x={lowestPoint.date}
                     y={lowestPoint.value}
                     r={6}
                     fill="#EF4444"
                     stroke="white"
                     strokeWidth={2}
                     isFront
                  />
              )}
              
              {data.length > 0 && lowestPoint && (
                  <ReferenceLine
                      key="lowest-point-line"
                      x={lowestPoint.date}
                      stroke="#EF4444" 
                      strokeDasharray="2 2"
                      strokeOpacity={0.5}
                      isFront // Make sure line is in front
                  >
                    <Label 
                        position="top" 
                        content={({ viewBox }) => {
                             const x = viewBox?.x || 0;
                             // Draw a badge at the top of the line
                             return (
                                 <g transform={`translate(${x}, ${20})`}> 
                                     <rect x="-50" y="0" width="100" height="36" rx="6" fill="#EF4444" />
                                     <text x="0" y="14" fill="white" fontSize="10" fontWeight="bold" textAnchor="middle">LOWEST</text>
                                     <text x="0" y="28" fill="white" fontSize="11" fontWeight="bold" textAnchor="middle">{formatCurrency(lowestPoint.value, 'EUR')}</text>
                                     <path d="M0 36 L-6 42 L6 42 Z" fill="#EF4444" /> {/* Triangle pointer */}
                                 </g>
                             )
                        }}
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
