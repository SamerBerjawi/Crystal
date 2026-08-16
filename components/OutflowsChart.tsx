import React, { useMemo, useState, useRef, useEffect } from 'react';
import { CategorySpending } from '../types';
import { formatCurrency } from '../utils';
import Icon from './ui/Icon';

interface OutflowsChartProps {
  data: CategorySpending[];
  onCategoryClick: (categoryName: string) => void;
}

const OutflowsChart: React.FC<OutflowsChartProps> = ({ data, onCategoryClick }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState<number>(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const totalOutflow = useMemo(() => {
    return (data || []).reduce((sum, item) => sum + item.value, 0);
  }, [data]);

  const maxVal = useMemo(() => {
    return Math.max(...(data || []).map(d => d.value), 1);
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-light-text-secondary dark:text-dark-text-secondary opacity-60 flex-col gap-2 p-6 text-center">
        <Icon name="pie_chart" className="text-3xl opacity-40" />
        <p className="text-sm font-medium">No outflow data for this period.</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full w-full flex flex-col justify-between overflow-hidden">
      {/* Scrollable list of categories with responsive horizontal progress bars */}
      <div className="flex-1 w-full overflow-y-auto space-y-2.5 pr-1.5 custom-scrollbar">
        {data.map((item) => {
          const percent = totalOutflow > 0 ? (item.value / totalOutflow) * 100 : 0;
          const barWidthPercent = Math.max((item.value / maxVal) * 100, 3);
          const itemColor = item.color || '#3B82F6';

          return (
            <div
              key={item.name}
              onClick={() => onCategoryClick(item.name)}
              className="group cursor-pointer rounded-xl p-1.5 -mx-1.5 transition-all hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.99]"
              title={`Click to filter by ${item.name}`}
            >
              {/* Category Info Header */}
              <div className="flex items-center justify-between gap-2 mb-1 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  {item.icon ? (
                    <div
                      className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 shadow-2xs"
                      style={{ backgroundColor: `${itemColor}20`, color: itemColor }}
                    >
                      <Icon name={item.icon} className="text-[13px]" />
                    </div>
                  ) : (
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: itemColor }}
                    />
                  )}
                  <span className="font-semibold text-primary truncate max-w-[140px] sm:max-w-[220px]">
                    {item.name}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-medium text-tertiary">
                    {percent.toFixed(1)}%
                  </span>
                  <span className="font-mono font-bold text-primary">
                    {formatCurrency(item.value, 'EUR')}
                  </span>
                </div>
              </div>

              {/* Responsive Progress Bar */}
              <div className="w-full bg-black/5 dark:bg-white/5 rounded-full h-2 overflow-hidden relative">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out group-hover:brightness-110"
                  style={{
                    width: `${barWidthPercent}%`,
                    backgroundColor: itemColor,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OutflowsChart;
