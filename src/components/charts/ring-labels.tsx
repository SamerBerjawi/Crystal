"use client";

import { memo } from "react";
import { useRingHover, useRingStable } from "./ring-context";

export interface RingLabelsProps {
  /** Color each label to match its corresponding ring. Default: `false`. */
  colorByRing?: boolean;
  /** Offset from the ring start cap along the outward tangent in pixels. Default: `10`. */
  offset?: number;
  /** Additional CSS class for the labels group. */
  className?: string;
}

/** Renders ring labels beside each ring's starting edge inside a {@link RingChart}. */
export const RingLabels = memo(function RingLabels({
  colorByRing = false,
  offset = 10,
  className,
}: RingLabelsProps) {
  const { data, getRingRadii, getColor, startAngle } = useRingStable();
  const { hoveredIndex, setHoveredIndex } = useRingHover();

  if (data.length === 0) {
    return null;
  }

  return (
    <g className={className}>
      {data.map((item, index) => {
        const { innerRadius, outerRadius } = getRingRadii(index);
        const rMid = (innerRadius + outerRadius) / 2;
        const sx = Math.sin(startAngle) * rMid;
        const sy = -Math.cos(startAngle) * rMid;
        const tx = -Math.cos(startAngle);
        const ty = -Math.sin(startAngle);

        return (
          <text
            key={`${item.label}-${index}`}
            x={sx + tx * offset}
            y={sy + ty * offset}
            fill={colorByRing ? getColor(index) : "var(--chart-label)"}
            textAnchor={tx >= 0 ? "start" : "end"}
            dominantBaseline="middle"
            className="cursor-pointer select-none text-[11px] font-medium"
            opacity={
              hoveredIndex !== null && hoveredIndex !== index ? 0.35 : 1
            }
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {item.label}
          </text>
        );
      })}
    </g>
  );
});

RingLabels.displayName = "RingLabels";

export default RingLabels;
