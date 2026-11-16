"use client";

import { arc as arcGenerator } from "@visx/shape";
import { memo, useMemo } from "react";
import { usePieHover, usePieStable } from "./pie-context";

export type PieTicksHoverEffect = "tick" | "grow" | "translate" | "none";

export interface PieTicksProps {
  /** Visual response when a slice is hovered. Default: `"tick"`. */
  hoverEffect?: PieTicksHoverEffect;
  /** Number of radial ticks around the ring. Default: `72`. */
  totalTicks?: number;
  /** Stroke width of each tick in pixels. Default: `2.5`. */
  tickWidth?: number;
  /** Extra radial length in pixels on hover. Defaults to `PieChart`'s `hoverOffset`. */
  hoverOffset?: number;
  /** Additional CSS class for the ticks group. */
  className?: string;
}

/**
 * Renders radial tick marks around a donut/pie chart, with interactive slice
 * hover detection synced to {@link PieCenter}.
 */
export const PieTicks = memo(function PieTicks({
  hoverEffect = "tick",
  totalTicks = 72,
  tickWidth = 2.5,
  hoverOffset: hoverOffsetProp,
  className,
}: PieTicksProps) {
  const { arcs, innerRadius, outerRadius, hoverOffset: contextHoverOffset, getFill } =
    usePieStable();
  const { hoveredIndex, setHoveredIndex } = usePieHover();

  const effectiveHoverOffset = hoverOffsetProp ?? contextHoverOffset;

  const ticks = useMemo(() => {
    if (arcs.length === 0 || outerRadius <= 0 || totalTicks <= 0) {
      return [];
    }
    const minStart = arcs[0]!.startAngle;
    const maxEnd = arcs[arcs.length - 1]!.endAngle;
    const sweep = maxEnd - minStart;
    if (sweep <= 0) {
      return [];
    }

    const rInner = Math.max(4, innerRadius + 2);
    const rOuter = Math.max(rInner + 4, outerRadius);

    return Array.from({ length: totalTicks }, (_, i) => {
      const theta = minStart + ((i + 0.5) / totalTicks) * sweep;
      const slice =
        arcs.find((a) => theta >= a.startAngle && theta <= a.endAngle) ??
        arcs[arcs.length - 1]!;
      const sin = Math.sin(theta);
      const cos = Math.cos(theta);
      return {
        index: i,
        sliceIndex: slice.index,
        fill: getFill(slice.index),
        sin,
        cos,
        rInner,
        rOuter,
      };
    });
  }, [arcs, innerRadius, outerRadius, totalTicks, getFill]);

  const hitArcs = useMemo(() => {
    if (arcs.length === 0 || outerRadius <= 0) {
      return [];
    }
    const gen = arcGenerator<unknown>({
      innerRadius: Math.max(0, innerRadius),
      outerRadius: outerRadius + Math.max(4, effectiveHoverOffset),
    });
    return arcs.map((a) => ({
      index: a.index,
      path:
        gen({
          startAngle: a.startAngle,
          endAngle: a.endAngle,
        } as unknown as null) || "",
    }));
  }, [arcs, innerRadius, outerRadius, effectiveHoverOffset]);

  if (ticks.length === 0) {
    return null;
  }

  return (
    <g className={className}>
      {ticks.map((t) => {
        const isHovered = hoveredIndex === t.sliceIndex;
        const isFaded = hoveredIndex !== null && hoveredIndex !== t.sliceIndex;
        const activeBoost =
          isHovered && hoverEffect !== "none"
            ? Math.max(4, effectiveHoverOffset * 0.6)
            : 0;
        const rStart =
          hoverEffect === "translate" && isHovered
            ? t.rInner + activeBoost * 0.4
            : t.rInner;
        const rEnd = t.rOuter + activeBoost;

        return (
          <line
            key={t.index}
            x1={t.sin * rStart}
            y1={-t.cos * rStart}
            x2={t.sin * rEnd}
            y2={-t.cos * rEnd}
            stroke={t.fill}
            strokeWidth={tickWidth}
            strokeLinecap="round"
            opacity={isFaded ? 0.35 : 1}
            style={{
              transition: "all 180ms cubic-bezier(0.22, 1, 0.36, 1)",
              pointerEvents: "none",
            }}
          />
        );
      })}
      {hitArcs.map((hit) => (
        <path
          key={`hit-${hit.index}`}
          d={hit.path}
          fill="transparent"
          className="cursor-pointer"
          onMouseEnter={() => setHoveredIndex(hit.index)}
          onMouseLeave={() => setHoveredIndex(null)}
        />
      ))}
    </g>
  );
});

PieTicks.displayName = "PieTicks";

export default PieTicks;
