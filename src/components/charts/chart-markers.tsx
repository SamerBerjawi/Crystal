"use client";

import React, { useMemo } from "react";
import { useChartStable, useChartHover } from "./chart-context";

export interface ChartMarker {
  date: Date;
  icon?: React.ReactNode;
  title: string;
  description?: string;
  content?: React.ReactNode;
  color?: string;
  onClick?: () => void;
  href?: string;
  target?: "_blank" | "_self";
}

export interface ChartMarkersProps {
  items: ChartMarker[];
  size?: number;
  showLines?: boolean;
  animate?: boolean;
}

export function useActiveMarkers(markers: ChartMarker[]): ChartMarker[] {
  const { tooltipData } = useChartHover();
  const { xAccessor } = useChartStable();

  return useMemo(() => {
    if (!tooltipData?.point || !markers || !markers.length) return [];
    const hoveredDate = xAccessor(tooltipData.point);
    if (!hoveredDate || isNaN(hoveredDate.getTime())) return [];

    const hDateStr = hoveredDate.toISOString().split("T")[0];

    return markers.filter((m) => {
      const mDate = m.date instanceof Date ? m.date : new Date(m.date);
      if (isNaN(mDate.getTime())) return false;
      return mDate.toISOString().split("T")[0] === hDateStr;
    });
  }, [tooltipData, markers, xAccessor]);
}

export function MarkerTooltipContent({ markers }: { markers: ChartMarker[] }) {
  if (!markers || markers.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 pt-1 border-t border-neutral-200 dark:border-neutral-800/80 mt-2">
      {markers.map((marker, idx) => (
        <div
          key={idx}
          className="flex items-start gap-2 text-xs p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700/50"
        >
          <div>
            <div className="font-bold text-neutral-800 dark:text-neutral-100">{marker.title}</div>
            {marker.description && (
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                {marker.description}
              </div>
            )}
            {marker.content}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChartMarkers({
  items,
  size = 28,
  showLines = true,
  animate = true,
}: ChartMarkersProps) {
  const { xScale, margin, height } = useChartStable();

  if (!items || items.length === 0 || !xScale) return null;

  const innerHeight = height - margin.top - margin.bottom;

  return (
    <g className="chart-markers-layer pointer-events-none">
      {items.map((marker, index) => {
        const mDate = marker.date instanceof Date ? marker.date : new Date(marker.date);
        if (isNaN(mDate.getTime())) return null;

        const xPos = xScale(mDate);
        if (xPos == null || isNaN(xPos)) return null;

        const strokeColor = marker.color || "#F59E0B";

        return (
          <g
            key={index}
            className={`transition-all duration-300 ${animate ? "animate-in fade-in zoom-in-50" : ""}`}
            transform={`translate(${xPos}, ${margin.top})`}
          >
            {showLines && (
              <line
                x1={0}
                y1={0}
                x2={0}
                y2={innerHeight}
                stroke={strokeColor}
                strokeDasharray="3 3"
                strokeOpacity={0.65}
                strokeWidth={1.5}
              />
            )}
            {/* Vertical Goal / Milestone Label text along the line */}
            <text
              x={-10}
              y={-5}
              transform="rotate(-90)"
              textAnchor="end"
              fill={strokeColor}
              className="text-[10px] font-extrabold tracking-wider pointer-events-auto cursor-pointer select-none"
              onClick={marker.onClick}
            >
              <title>{`${marker.title}${marker.description ? ` - ${marker.description}` : ""}`}</title>
              {marker.title}
            </text>
          </g>
        );
      })}
    </g>
  );
}
