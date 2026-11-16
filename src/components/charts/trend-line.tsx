"use client";

import { memo, useMemo } from "react";
import { useChartStable, useYScale } from "./chart-context";

export interface TrendLineProps {
  /** Key in data to compute a linear regression trend line for. */
  dataKey: string;
  /** Line stroke color. Default: `"var(--chart-1)"`. */
  stroke?: string;
  /** Stroke width in pixels. Default: `2`. */
  strokeWidth?: number;
  /** SVG stroke-dasharray pattern. Default: `"4,4"`. */
  strokeDasharray?: string;
  /** Opacity of the trend line. Default: `0.85`. */
  opacity?: number;
  /** Y-axis scale group id. Default: `"left"`. */
  yAxisId?: string | number;
}

const TrendLineInner = memo(function TrendLineInner({
  dataKey,
  stroke = "var(--chart-1)",
  strokeWidth = 2,
  strokeDasharray = "4,4",
  opacity = 0.85,
  yAxisId = "left",
}: TrendLineProps) {
  const { data, barScale, bandWidth, barXAccessor, orientation } =
    useChartStable();
  const yScale = useYScale(yAxisId);

  const path = useMemo(() => {
    if (orientation === "horizontal" || !barScale || !bandWidth) {
      return null;
    }

    const points: { index: number; x: number; value: number }[] = [];
    for (let i = 0; i < data.length; i += 1) {
      const datum = data[i];
      if (!datum) continue;
      const raw = datum[dataKey];
      if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
      const key = barXAccessor ? barXAccessor(datum) : String(i);
      const bandX = barScale(key);
      if (bandX === undefined) continue;
      points.push({ index: i, x: bandX + bandWidth / 2, value: raw });
    }

    const n = points.length;
    if (n < 2) {
      return null;
    }

    let sumX = 0;
    let sumY = 0;
    for (const pt of points) {
      sumX += pt.index;
      sumY += pt.value;
    }
    const meanX = sumX / n;
    const meanY = sumY / n;

    let num = 0;
    let den = 0;
    for (const pt of points) {
      const dx = pt.index - meanX;
      num += dx * (pt.value - meanY);
      den += dx * dx;
    }

    const slope = den !== 0 ? num / den : 0;
    const intercept = meanY - slope * meanX;
    const [domainMin] = yScale.domain() as [number, number];
    const clampToZero = typeof domainMin === "number" && domainMin >= 0;

    const first = points[0];
    const last = points[n - 1];
    const rawStart = intercept + slope * first.index;
    const rawEnd = intercept + slope * last.index;
    const startVal = clampToZero ? Math.max(0, rawStart) : rawStart;
    const endVal = clampToZero ? Math.max(0, rawEnd) : rawEnd;

    const y0 = yScale(startVal) ?? 0;
    const y1 = yScale(endVal) ?? 0;
    return `M ${first.x} ${y0} L ${last.x} ${y1}`;
  }, [orientation, barScale, bandWidth, data, dataKey, barXAccessor, yScale]);

  if (!path) {
    return null;
  }

  return (
    <path
      d={path}
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeDasharray={strokeDasharray}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={opacity}
      pointerEvents="none"
    />
  );
});

/** Renders a linear trend line overlay across bars inside a `BarChart`. */
export function TrendLine(props: TrendLineProps) {
  return <TrendLineInner {...props} />;
}

TrendLine.displayName = "TrendLine";
(TrendLine as unknown as { __isBarDepthLayer: boolean }).__isBarDepthLayer =
  true;

export default TrendLine;
