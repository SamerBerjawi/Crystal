"use client";

import { useId } from "react";

export interface DashTailStrokeProps {
  /** SVG path `d` for the full series (single curved path). */
  pathD: string | null;
  /** Total length of `pathD` in user units. */
  pathLength?: number;
  /** Path length at which the dashed tail begins. */
  dashStartLength?: number;
  /** X coordinate (chart inner space) where the tail clip begins. */
  dashStartX: number;
  innerWidth: number;
  innerHeight: number;
  /** Stroke paint — solid color or gradient url. */
  stroke: string;
  strokeWidth: number;
  dashArray: string;
}

export function DashTailStroke({
  pathD,
  dashStartX,
  innerWidth,
  innerHeight,
  stroke,
  strokeWidth,
  dashArray,
}: DashTailStrokeProps) {
  const reactId = useId().replace(/:/g, "");
  const headClipId = `clip-head-${reactId}`;
  const tailClipId = `clip-tail-${reactId}`;

  if (!pathD) {
    return null;
  }

  const pad = strokeWidth * 2;
  const headWidth = Math.max(0, dashStartX + strokeWidth);
  const tailWidth = Math.max(0, innerWidth - dashStartX + pad);

  return (
    <>
      <defs>
        <clipPath id={headClipId}>
          <rect
            height={innerHeight + pad}
            width={headWidth}
            x={-pad}
            y={-strokeWidth}
          />
        </clipPath>
        <clipPath id={tailClipId}>
          <rect
            height={innerHeight + pad}
            width={tailWidth}
            x={dashStartX - strokeWidth}
            y={-strokeWidth}
          />
        </clipPath>
      </defs>

      {/* Solid head up to dashStartX */}
      <path
        clipPath={`url(#${headClipId})`}
        d={pathD}
        fill="none"
        stroke={stroke}
        strokeLinecap="round"
        strokeWidth={strokeWidth}
      />

      {/* Dashed tail from dashStartX onwards */}
      <path
        clipPath={`url(#${tailClipId})`}
        d={pathD}
        fill="none"
        stroke={stroke}
        strokeDasharray={dashArray}
        strokeLinecap="round"
        strokeWidth={strokeWidth}
      />
    </>
  );
}
