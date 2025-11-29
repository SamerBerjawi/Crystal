
import React, { useMemo } from 'react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Label, Legend } from 'recharts';
import { formatCurrency, getPreferredTimeZone, parseDateAsUTC } from '../utils';
import { FinancialGoal, Account } from '../types';
import { ACCOUNT_TYPE_STYLES } from '../constants';

// Helper to generate distinct colors if needed, or map to brand/account type colors
const getColorForAccount = (account: Account, index: number) => {
    const palette = [
        '#6366F1', '#FBBF24', '#10B981', '#EF4444', '#8B5CF6', 
        '#EC4899', '#14B8A6', '#F97316', '#06B6D4', '#84CC16'
    ];
    return palette[index % palette.length];
};


interface ChartData {
  date: string;
  value: number; // Total
  [key: string]: number | string | { description: string, amount: number, type: string }[]; // Dynamic keys for account IDs + dailySummary
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
      
      // Sort payload by value descending for cleaner tooltip
      const sortedPayload = [...payload].sort((a, b) => b.value - a.value);
      const dataPoint = payload[0].payload;
      const dailySummary = dataPoint.dailySummary as { description: string; amount: number; type: string }[] | undefined;
      const summaryToShow = dailySummary ? dailySummary.slice(0, 5) : [];
      const remainingCount = dailySummary ? dailySummary.length - 5 : 0;

      return (
        <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md p-4 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 text-sm max-w-[320px] z-50">
          <p className="font-bold text-gray-900 dark:text-white mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">{formattedDate}</p>
          
          {showIndividualLines ? (
              <div className="space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                  {sortedPayload.map((entry: any) => {
                      // Map dataKey (accountId) to account Name
                      const account = accounts?.find(a => a.id === entry.dataKey);
                      const name = account ? account.name : (entry.name === 'Projected Balance' ? 'Total' : entry.name);
                      return (
                          <div key={entry.dataKey} className="flex justify-between gap-6 text-xs">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
                                <span className="text-gray-600 dark:text-gray-300 font-medium truncate max-w-[140px]">{name}</span>
                              </div>
                              <span className="font-mono font-semibold text-gray-900 dark:text-white">{formatCurrency(entry.value, 'EUR')}</span>
                          </div>
                      );
                  })}
              </div>
          ) : (
             <div className="mb-4">
                <div className="flex justify-between items-end">
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">Projected Balance</span>
                    <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400 font-mono">{formatCurrency(payload[0].value, 'EUR')}</span>
                </div>
             </div>
          )}
          
          {dailySummary && dailySummary.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Transactions</p>
                <div className="space-y-2">
                    {summaryToShow.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-start text-xs gap-3">
                            <span className="text-gray-700 dark:text-gray-300 leading-tight line-clamp-1">{item.description}</span>
                            <span className={`font-mono font-medium whitespace-nowrap ${item.amount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                {formatCurrency(item.amount, 'EUR')}
                            </span>
                        </div>
                    ))}
                    {remainingCount > 0 && (
                        <p className="text-xs text-indigo-500 dark:text-indigo-400 font-medium text-center mt-2">
                            + {remainingCount} more
                        </p>
                    )}
                </div>
            </div>
          )}
          <div className="mt-3 text-[10px] text-gray-400 text-center font-medium">
              Click point for details
          </div>
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
  
  // Handle empty data gracefully
  if (!data || data.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center h-[400px] text-gray-400 dark:text-gray-600 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50/50 dark:bg-black/20">
            <span className="material-symbols-outlined text-4xl mb-2">query_stats</span>
            <p className="text-sm font-medium">No forecast data available.</p>
            <p className="text-xs mt-1">Try selecting different accounts or adding recurring transactions.</p>
        </div>
    );
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
    const buffer = range === 0 ? 5000 : range * 0.15; // 15% buffer for better padding

    return [Math.floor(absoluteMin - buffer), Math.ceil(absoluteMax + buffer)];
  }, [data, lowestPoint, showIndividualLines, accounts]);


  const { ticks, tickFormatter } = useMemo(() => {
    if (data.length < 2) return { ticks: [], tickFormatter: () => '' };

    const startDate = data.length ? parseDateAsUTC(data[0].date) : new Date(0);
    const endDate = data.length ? parseDateAsUTC(data[data.length - 1].date) : new Date(0);
    const rangeInDays = (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24);

    if (rangeInDays > 120) { // For ranges longer than ~4 months, show one tick per month.
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

    } else { // For shorter ranges, show day and month
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
  
  // Common Props
  const commonAxisProps = {
      stroke: "#9CA3AF", // gray-400
      strokeOpacity: 0.5,
      tick: { fill: '#9CA3AF', fontSize: 11, fontWeight: 500 },
      tickLine: false,
      axisLine: false,
      tickMargin: 10,
  };
  
  const handleChartClick = (state: any) => {
      if (state && state.activeLabel && onDataPointClick) {
          onDataPointClick(state.activeLabel);
      }
  };

  return (
    <div style={{ width: '100%', height: '400px' }} className="relative">
      <ResponsiveContainer minWidth={0} minHeight={0} debounce={50}>
        {showIndividualLines ? (
             <LineChart 
                data={data} 
                margin={{ top: 20, right: 30, left: 10, bottom: 10 }}
                onClick={handleChartClick}
             >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--light-separator)" strokeOpacity={0.3} />
                <XAxis dataKey="date" {...commonAxisProps} tickFormatter={tickFormatter} ticks={ticks} minTickGap={50} />
                <YAxis {...commonAxisProps} tickFormatter={yAxisTickFormatter} domain={yDomain} allowDataOverflow={true} width={50} />
                <Tooltip 
                    content={<CustomTooltip showIndividualLines={true} accounts={accounts} />} 
                    cursor={{ stroke: '#6366F1', strokeWidth: 1, strokeDasharray: '5 5' }}
                />
                
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
                        activeDot={{ r: 6, strokeWidth: 0, fill: getColorForAccount(acc, idx) }}
                        cursor="pointer"
                    />
                ))}

                {showGoalLines && oneTimeGoals.map(goal => (
                    <ReferenceLine key={goal.id} x={goal.date} stroke="#F59E0B" strokeDasharray="3 3" strokeOpacity={0.8}>
                        <Label 
                            value={goal.name} 
                            position="insideTopRight" 
                            fill="#F59E0B" 
                            fontSize={11} 
                            fontWeight={600}
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
                margin={{ top: 20, right: 30, left: 10, bottom: 10 }}
                onClick={handleChartClick}
            >
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--light-separator)" strokeOpacity={0.3} />
              
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
                width={50}
              />
              
              <Tooltip 
                content={<CustomTooltip showIndividualLines={false} />} 
                cursor={{ stroke: '#6366F1', strokeWidth: 1, strokeDasharray: '5 5' }}
              />
              
              <ReferenceLine y={0} stroke="#9CA3AF" strokeDasharray="3 3" opacity={0.4} />
              
              {showGoalLines && oneTimeGoals.map(goal => (
                  <ReferenceLine key={goal.id} x={goal.date} stroke="#F59E0B" strokeDasharray="3 3" strokeWidth={1.5}>
                      <Label 
                        value={`Goal: ${goal.name}`} 
                        position="insideTopRight" 
                        fill="#F59E0B" 
                        fontSize={11} 
                        fontWeight={600}
                        angle={-90} 
                        dx={12} 
                        dy={20}
                      />
                  </ReferenceLine>
              ))}

              <Area 
                  type="monotone" 
                  dataKey="value" 
                  name="Projected Balance" 
                  stroke="#6366F1" 
                  strokeWidth={3}
                  fill="url(#colorValue)" 
                  dot={false} 
                  activeDot={{ r: 6, strokeWidth: 4, stroke: '#fff', fill: '#6366F1' }} 
                  cursor="pointer"
              />

              {data.length > 0 && lowestPoint && (
                  <ReferenceLine
                      key="lowest-point-line"
                      x={lowestPoint.date}
                      stroke="#EF4444" // Red-500
                      strokeDasharray="3 3"
                      strokeWidth={1.5}
                  >
                    <Label 
                        value={`Low: ${formatCurrency(lowestPoint.value, 'EUR')}`}
                        position="insideBottomRight" 
                        fill="#EF4444" 
                        fontSize={11} 
                        fontWeight={700}
                        angle={-90} 
                        dx={12} 
                        dy={-20} 
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
