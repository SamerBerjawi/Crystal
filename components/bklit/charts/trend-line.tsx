import { useId, useMemo } from "react";
import { useChartStable, useYScale } from "./chart-context";
import {
  type FadeEdges,
  fadeGradientStops,
  resolveFadeSides,
  viewportFadeGradientAttrs,
} from "./fade-edges";

export type TrendLineStrokeStyle = "solid" | "gradient";

export interface TrendLineProps {
  /** Series key in `data` to fit with linear least-squares regression */
  dataKey: string;
  /** Optional Y-axis group id */
  yAxisId?: string | number;
  /** Solid stroke color when `strokeStyle="solid"`. Default: `"var(--chart-3)"` */
  stroke?: string;
  /** Solid or gradient stroke along the trend vector. Default: `"solid"` */
  strokeStyle?: TrendLineStrokeStyle;
  /** Start color for gradient stroke. Default: `"var(--chart-3)"` */
  gradientStart?: string;
  /** End color for gradient stroke. Default: `"var(--chart-1)"` */
  gradientEnd?: string;
  /** Stroke width in px. Default: `2` */
  strokeWidth?: number;
  /** Optional dash pattern */
  strokeDasharray?: string;
  /** Overall stroke opacity. Default: `0.55` to keep trend line subtle behind actual data */
  strokeOpacity?: number;
  /** Fade the trend line toward transparent at the horizontal plot edges */
  fadeEdges?: FadeEdges;
}

export function TrendLine({
  dataKey,
  yAxisId,
  stroke = "var(--chart-3)",
  strokeStyle = "solid",
  gradientStart = "var(--chart-3)",
  gradientEnd = "var(--chart-1)",
  strokeWidth = 2,
  strokeDasharray,
  strokeOpacity = 0.55,
  fadeEdges = false,
}: TrendLineProps) {
  const { data, xScale, xAccessor, innerWidth, innerHeight, chartPhase } =
    useChartStable();
  const yScale = useYScale(yAxisId);
  const uid = useId().replace(/:/g, "");
  const gradId = `trend-line-grad-${uid}`;
  const fadeGradId = `trend-line-fade-grad-${uid}`;
  const fadeMaskId = `trend-line-fade-mask-${uid}`;

  const fadeSides = resolveFadeSides(fadeEdges);
  const fadeStops = useMemo(() => fadeGradientStops(fadeSides), [fadeSides]);

  const geometry = useMemo(() => {
    const valid: { idx: number; x: number; yVal: number }[] = [];
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const raw = row?.[dataKey];
      if (typeof raw === "number" && Number.isFinite(raw)) {
        const x = xScale(xAccessor(row)) ?? 0;
        valid.push({ idx: i, x, yVal: raw });
      }
    }
    if (valid.length < 2) {
      return null;
    }

    const n = valid.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    for (let i = 0; i < n; i++) {
      const pt = valid[i];
      sumX += i;
      sumY += pt.yVal;
      sumXY += i * pt.yVal;
      sumXX += i * i;
    }
    const denom = n * sumXX - sumX * sumX;
    const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;

    const first = valid[0];
    const last = valid[n - 1];
    const yStartVal = intercept;
    const yEndVal = slope * (n - 1) + intercept;

    const x1 = first.x;
    const y1 = yScale(yStartVal) ?? 0;
    const x2 = last.x;
    const y2 = yScale(yEndVal) ?? 0;

    return {
      x1,
      y1,
      x2,
      y2,
      d: `M ${x1.toFixed(2)},${y1.toFixed(2)} L ${x2.toFixed(2)},${y2.toFixed(2)}`,
    };
  }, [data, dataKey, xAccessor, xScale, yScale]);

  const showStroke =
    chartPhase === "revealing" ||
    chartPhase === "ready" ||
    chartPhase === "exitingReady";

  if (!geometry || !showStroke || innerWidth <= 0 || innerHeight <= 0) {
    return null;
  }

  const resolvedStroke =
    strokeStyle === "gradient" ? `url(#${gradId})` : stroke;

  return (
    <g aria-hidden="true" className="chart-trend-line pointer-events-none">
      <defs>
        {strokeStyle === "gradient" && (
          <linearGradient
            gradientUnits="userSpaceOnUse"
            id={gradId}
            x1={geometry.x1}
            x2={geometry.x2}
            y1={geometry.y1}
            y2={geometry.y2}
          >
            <stop offset="0%" stopColor={gradientStart} />
            <stop offset="100%" stopColor={gradientEnd} />
          </linearGradient>
        )}
        {fadeSides.any && (
          <>
            <linearGradient
              id={fadeGradId}
              {...viewportFadeGradientAttrs(innerWidth)}
            >
              {fadeStops.map((stop) => (
                <stop
                  key={stop.offset}
                  offset={stop.offset}
                  stopColor="white"
                  stopOpacity={stop.opacity}
                />
              ))}
            </linearGradient>
            <mask id={fadeMaskId}>
              <rect
                fill={`url(#${fadeGradId})`}
                height={innerHeight}
                width={innerWidth}
                x={0}
                y={0}
              />
            </mask>
          </>
        )}
      </defs>
      <path
        d={geometry.d}
        fill="none"
        mask={fadeSides.any ? `url(#${fadeMaskId})` : undefined}
        stroke={resolvedStroke}
        strokeDasharray={strokeDasharray}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={strokeOpacity}
        strokeWidth={strokeWidth}
      />
    </g>
  );
}

TrendLine.displayName = "TrendLine";

export default TrendLine;
