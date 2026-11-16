"use client";

import { memo, useMemo } from "react";
import { useRingStable } from "./ring-context";

export interface RingGridProps {
  /** Number of radial spoke lines across the arc. Default: `4`. */
  spokeCount?: number;
  /** Stroke color for the grid spokes. Default: `"var(--chart-grid)"`. */
  stroke?: string;
  /** SVG stroke-dasharray pattern. Default: `"2,3"`. */
  strokeDasharray?: string;
  /** Stroke opacity for grid spokes. Default: `0.6`. */
  strokeOpacity?: number;
  /** Additional CSS class for the grid group. */
  className?: string;
}

/** Renders subtle radial grid lines across the arc of a {@link RingChart}. */
export const RingGrid = memo(function RingGrid({
  spokeCount = 4,
  stroke = "var(--chart-grid)",
  strokeDasharray = "2,3",
  strokeOpacity = 0.6,
  className,
}: RingGridProps) {
  const { data, baseInnerRadius, getRingRadii, startAngle, endAngle } =
    useRingStable();

  const spokes = useMemo(() => {
    if (data.length === 0 || spokeCount <= 0) {
      return [];
    }
    const rInner = Math.max(0, baseInnerRadius - 4);
    const rOuter = getRingRadii(data.length - 1).outerRadius + 4;
    const steps = Math.max(1, spokeCount - 1);

    return Array.from({ length: spokeCount }, (_, k) => {
      const theta = startAngle + (k / steps) * (endAngle - startAngle);
      const sin = Math.sin(theta);
      const cos = Math.cos(theta);
      return {
        key: k,
        x1: sin * rInner,
        y1: -cos * rInner,
        x2: sin * rOuter,
        y2: -cos * rOuter,
      };
    });
  }, [data.length, spokeCount, baseInnerRadius, getRingRadii, startAngle, endAngle]);

  if (spokes.length === 0) {
    return null;
  }

  return (
    <g className={className} pointerEvents="none">
      {spokes.map((s) => (
        <line
          key={s.key}
          x1={s.x1}
          y1={s.y1}
          x2={s.x2}
          y2={s.y2}
          stroke={stroke}
          strokeDasharray={strokeDasharray}
          strokeOpacity={strokeOpacity}
          strokeWidth={1}
        />
      ))}
    </g>
  );
});

RingGrid.displayName = "RingGrid";

export default RingGrid;
