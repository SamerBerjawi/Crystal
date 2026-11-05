"use client";

import { motion, useSpring, useTransform } from "motion/react";
import { useEffect, useId, useRef } from "react";
import { useChart } from "./chart-context";

export interface SpotlightIndicatorProps {
  /** Series to follow. Not named `dataKey`, or the chart would treat this layer as a series. */
  seriesKey: string;
  color?: string;
  width?: number;
}

/**
 * Bklit "Custom indicators" recipe: a soft, rounded column that springs between hovered points behind the series,
 * fading from the series colour at the point to transparent at the baseline. Use it with `showCrosshair={false}`.
 */
export function SpotlightIndicator({
  seriesKey,
  color = "var(--chart-1)",
  width = 28,
}: SpotlightIndicatorProps) {
  const { tooltipData, innerHeight } = useChart();
  const id = useId().replace(/:/g, "");
  const x = useSpring(0, { stiffness: 380, damping: 36 });
  const top = useSpring(innerHeight, { stiffness: 380, damping: 36 });
  const opacity = useSpring(0, { stiffness: 300, damping: 30 });
  const height = useTransform(top, (value) => Math.max(0, innerHeight - value));
  const visible = useRef(false);

  const targetX = tooltipData?.x;
  const targetY = tooltipData?.yPositions[seriesKey];

  useEffect(() => {
    if (targetX === undefined || targetY === undefined) {
      visible.current = false;
      opacity.set(0);
      return;
    }
    if (visible.current) {
      x.set(targetX);
      top.set(targetY);
    } else {
      // Appear in place instead of sliding in from the left edge.
      x.jump(targetX);
      top.jump(targetY);
    }
    visible.current = true;
    opacity.set(1);
  }, [targetX, targetY, x, top, opacity]);

  return (
    <g pointerEvents="none">
      <defs>
        <linearGradient id={`${id}-beam`} x1="0" x2="0" y1="0" y2="1">
          <stop offset={0} stopColor={color} stopOpacity={0.32} />
          <stop offset={1} stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <motion.rect
        fill={`url(#${id}-beam)`}
        height={height}
        rx={4}
        style={{ x, y: top, opacity }}
        width={width}
        x={-width / 2}
      />
    </g>
  );
}
