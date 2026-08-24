import React, { useMemo } from 'react';
import { ScheduledItem } from '../types';
import { parseLocalDate, toLocalISOString, formatCurrency } from '../utils';
import {
  HeatmapChart,
  HeatmapCells,
  HeatmapXAxis,
  HeatmapYAxis,
  HeatmapTooltip,
  type HeatmapColumn,
  type HeatmapLevelStyles,
} from '../src/components/charts/heatmap';

interface ScheduleHeatmapProps {
  items: ScheduledItem[];
  hideLegend?: boolean;
}

// Exact categorical colors from previous design:
// Level 0: No Activity (gray-200 in light, gray-700 in dark)
// Level 1: Transfer (slate/gray)
// Level 2: Income (green-500)
// Level 3: Expense (red-500)
// Level 4: Mixed (purple-500)
const NO_ACTIVITY_COLOR = 'var(--heatmap-no-activity, #e2e8f0)';
const TRANSFER_COLOR = '#94a3b8'; // slate-400
const INCOME_COLOR = '#22c55e'; // green-500
const EXPENSE_COLOR = '#ef4444'; // red-500
const MIXED_COLOR = '#a855f7'; // purple-500

enum ActivityLevel {
  None = 0,
  Transfer = 1,
  Income = 2,
  Expense = 3,
  Mixed = 4,
}

const ScheduleHeatmap: React.FC<ScheduleHeatmapProps> = ({ items, hideLegend = false }) => {
  const { heatmapData, dayStatsMap } = useMemo(() => {
    const now = new Date();
    // Start from the 1st of the current month in LOCAL time
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    startDate.setHours(0, 0, 0, 0);

    // Show 12 full months (covers a year)
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 12, 0);
    endDate.setHours(23, 59, 59, 999);

    const statsMap = new Map<
      string,
      {
        incomeCount: number;
        expenseCount: number;
        transferCount: number;
        totalIncome: number;
        totalExpense: number;
        totalTransfer: number;
      }
    >();

    items.forEach(item => {
      const itemDate = parseLocalDate(item.date);
      if (itemDate >= startDate && itemDate <= endDate) {
        const dateStr = item.date;
        const current = statsMap.get(dateStr) || {
          incomeCount: 0,
          expenseCount: 0,
          transferCount: 0,
          totalIncome: 0,
          totalExpense: 0,
          totalTransfer: 0,
        };

        if (item.isTransfer) {
          current.transferCount += 1;
          current.totalTransfer += Math.abs(item.amount);
        } else if (item.amount > 0) {
          current.incomeCount += 1;
          current.totalIncome += item.amount;
        } else {
          current.expenseCount += 1;
          current.totalExpense += Math.abs(item.amount);
        }

        statsMap.set(dateStr, current);
      }
    });

    // Align start to the previous Sunday (bklit heatmap default)
    const gridStart = new Date(startDate);
    gridStart.setDate(gridStart.getDate() - gridStart.getDay());
    gridStart.setHours(0, 0, 0, 0);

    const gridEnd = new Date(endDate);
    gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));
    gridEnd.setHours(23, 59, 59, 999);

    const columns: HeatmapColumn[] = [];
    let cur = new Date(gridStart);
    let colIdx = 0;

    while (cur <= gridEnd) {
      const bins = [];
      for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
        const binDate = new Date(cur);
        const dateKey = toLocalISOString(binDate);
        const dayStat = statsMap.get(dateKey);

        let activityLevel = ActivityLevel.None;
        if (dayStat) {
          if (dayStat.transferCount > 0 && dayStat.incomeCount === 0 && dayStat.expenseCount === 0) {
            activityLevel = ActivityLevel.Transfer;
          } else if (dayStat.incomeCount > 0 && dayStat.expenseCount > 0) {
            activityLevel = ActivityLevel.Mixed;
          } else if (dayStat.incomeCount > 0) {
            activityLevel = ActivityLevel.Income;
          } else if (dayStat.expenseCount > 0) {
            activityLevel = ActivityLevel.Expense;
          } else if (dayStat.transferCount > 0) {
            activityLevel = ActivityLevel.Transfer;
          }
        }

        bins.push({
          bin: dayOfWeek,
          count: activityLevel,
          date: binDate,
        });

        cur.setDate(cur.getDate() + 1);
      }

      columns.push({
        bin: colIdx,
        bins,
      });
      colIdx++;
    }

    return { heatmapData: columns, dayStatsMap: statsMap };
  }, [items]);

  // Pass custom levelStyles so fillScale renders the exact categorical colors on the SVG rects
  const scheduleLevelStyles: HeatmapLevelStyles = useMemo(
    () => [
      { color: 'oklch(0.92 0.01 260 / 0.35)', fillMode: 'solid', pattern: 'none' }, // Level 0: No Activity
      { color: TRANSFER_COLOR, fillMode: 'solid', pattern: 'none' },                 // Level 1: Transfer
      { color: INCOME_COLOR, fillMode: 'solid', pattern: 'none' },                   // Level 2: Income
      { color: EXPENSE_COLOR, fillMode: 'solid', pattern: 'none' },                  // Level 3: Expense
      { color: MIXED_COLOR, fillMode: 'solid', pattern: 'none' },                    // Level 4: Mixed
    ],
    []
  );

  const customTooltipLabel = (_count: number, date: Date) => {
    const dateKey = toLocalISOString(date);
    const dayStat = dayStatsMap.get(dateKey);

    if (!dayStat || (dayStat.incomeCount === 0 && dayStat.expenseCount === 0 && dayStat.transferCount === 0)) {
      return 'No Activity';
    }

    const parts: string[] = [];
    if (dayStat.transferCount > 0) {
      parts.push(`${dayStat.transferCount} transfer(s)`);
    }
    if (dayStat.incomeCount > 0) {
      parts.push(`${dayStat.incomeCount} income (+${formatCurrency(dayStat.totalIncome, 'EUR')})`);
    }
    if (dayStat.expenseCount > 0) {
      parts.push(`${dayStat.expenseCount} expense(s) (-${formatCurrency(dayStat.totalExpense, 'EUR')})`);
    }

    return parts.join(', ');
  };

  return (
    <div className="w-full flex flex-col items-center justify-center gap-3">
      <div className="overflow-x-auto w-full flex justify-center items-center py-1">
        <div className="w-fit max-w-full flex justify-center items-center mx-auto">
          <HeatmapChart
            data={heatmapData}
            weekStartDay={1} // Monday start (Row 0 = Mon, Row 6 = Sun)
            binSize={14} // Exact 14px cell size as original
            gap={4} // Exact 4px gap as original
            levelStyles={scheduleLevelStyles}
            layout="fluid"
            margin={{ top: 20, right: 8, bottom: 4, left: 28 }}
          >
            <HeatmapCells cornerRadius={2} />
            <HeatmapXAxis className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-medium" />
            <HeatmapYAxis
              tickFilter="all"
              labelFormat="full"
              className="text-xs text-right pr-1 text-light-text-secondary dark:text-dark-text-secondary font-medium"
            />
            <HeatmapTooltip formatLabel={customTooltipLabel} />
          </HeatmapChart>
        </div>
      </div>

      {/* Exact original legend styling */}
      {!hideLegend && (
        <div className="flex flex-wrap justify-center items-center gap-4 text-xs text-light-text-secondary dark:text-dark-text-secondary">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-xs bg-gray-200 dark:bg-gray-700" />
            <span>No Activity</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-xs bg-slate-400" />
            <span>Transfer</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-xs bg-green-500" />
            <span>Income</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-xs bg-red-500" />
            <span>Expense</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-xs bg-purple-500" />
            <span>Mixed</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleHeatmap;
