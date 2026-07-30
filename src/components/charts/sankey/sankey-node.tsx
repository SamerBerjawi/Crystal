"use client";

import type { SankeyNode as SankeyNodeType } from "d3-sankey";
import { motion, type Transition } from "motion/react";
import { type ReactNode, useCallback, useMemo } from "react";
import { intFmt } from "../chart-formatters";
import { transitionWithDelay } from "../motion-utils";
import {
  type SankeyLinkDatum,
  type SankeyNodeDatum,
  useSankey,
} from "./sankey-context";

// Helper to get node index from link source/target
type NodeOrIndex = SankeyNodeType<SankeyNodeDatum, SankeyLinkDatum> | number;

export type SankeyLabelOrientation = "horizontal" | "vertical";

function getNodeIndex(nodeOrIndex: NodeOrIndex): number | undefined {
  if (typeof nodeOrIndex === "number") {
    return nodeOrIndex;
  }
  return nodeOrIndex.index;
}

export interface SankeyNodeProps {
  /** Fill color for nodes. Default: uses theme colors */
  fill?: string;
  /** Corner radius for nodes. Default: 4 */
  lineCap?: number;
  /** Opacity when another node/link is hovered. Default: 0.4 */
  fadedOpacity?: number;
  /** Show node labels. Default: true */
  showLabels?: boolean;
  /** Show value labels under node names. Default: true */
  showValueLabels?: boolean;
  /**
   * Label reading direction for outside node labels.
   * - "horizontal": labels sit left/right of nodes (default).
   * - "vertical": labels rotate 90° and read along the node edge.
   */
  labelOrientation?: SankeyLabelOrientation;
  /** Format value function */
  formatValue?: (value: number) => string;
  /** Custom node color function */
  getNodeColor?: (
    node: SankeyNodeType<SankeyNodeDatum, SankeyLinkDatum>,
    index: number
  ) => string;
}

type TextAnchor = "start" | "middle" | "end";

interface NodeLabelLayout {
  x: number;
  y: number;
  textAnchor: TextAnchor;
  dy: string;
  textLocalX: number;
  rotate: number;
  initialX: number;
  initialY: number;
}

const LABEL_OFFSET = 12;
const VALUE_LABEL_GAP = 16;
function computeResolvedYPositions(
  items: Array<{ id: string; targetY: number }>,
  labelHeight: number,
  minGap: number,
  containerHeight: number
): Map<string, number> {
  const map = new Map<string, number>();
  if (items.length === 0) return map;

  const sorted = [...items].sort((a, b) => a.targetY - b.targetY);
  const pos = sorted.map(item => ({ id: item.id, y: item.targetY }));
  const halfH = labelHeight / 2;

  // 1. Forward pass (push down overlapping labels)
  for (let i = 1; i < pos.length; i++) {
    const prevBottom = pos[i - 1].y + halfH + minGap;
    if (pos[i].y - halfH < prevBottom) {
      pos[i].y = prevBottom + halfH;
    }
  }

  // 2. Backward pass (pull back up if last overflows bottom)
  const maxY = Math.max(containerHeight - halfH - 8, halfH + 8);
  if (pos[pos.length - 1].y > maxY) {
    pos[pos.length - 1].y = maxY;
    for (let i = pos.length - 2; i >= 0; i--) {
      const nextTop = pos[i + 1].y - halfH - minGap;
      if (pos[i].y + halfH > nextTop) {
        pos[i].y = nextTop - halfH;
      }
    }
  }

  // 3. Top clamp
  const minY = halfH + 8;
  if (pos[0].y < minY) {
    pos[0].y = minY;
    for (let i = 1; i < pos.length; i++) {
      const prevBottom = pos[i - 1].y + halfH + minGap;
      if (pos[i].y - halfH < prevBottom) {
        pos[i].y = prevBottom + halfH;
      }
    }
  }

  pos.forEach(p => map.set(p.id, p.y));
  return map;
}

function getNodeLabelLayouts({
  labelOrientation,
  isFarLeft,
  isFarRight,
  x,
  y,
  width,
  height,
  showValueLabels,
  overrideY,
}: {
  labelOrientation: SankeyLabelOrientation;
  isFarLeft: boolean;
  isFarRight: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  showValueLabels: boolean;
  overrideY?: number;
}): { name: NodeLabelLayout; value: NodeLabelLayout | null; isInside: boolean } {
  // Intermediate column node (Column 1, 2, 3)
  if (!isFarLeft && !isFarRight) {
    const centerX = x + width / 2;
    const isTall = height >= 20;

    if (isTall) {
      const centerY = y + height / 2;
      return {
        isInside: true,
        name: {
          x: centerX,
          y: showValueLabels ? centerY - 6 : centerY,
          textAnchor: "middle",
          dy: "0.35em",
          textLocalX: 0,
          rotate: 0,
          initialX: centerX,
          initialY: y + height / 2,
        },
        value: showValueLabels
          ? {
              x: centerX,
              y: centerY + 8,
              textAnchor: "middle",
              dy: "0.35em",
              textLocalX: 0,
              rotate: 0,
              initialX: centerX,
              initialY: y + height / 2,
            }
          : null,
      };
    }

    // Short intermediate node: place above node bar
    return {
      isInside: false,
      name: {
        x: centerX,
        y: y - 8,
        textAnchor: "middle",
        dy: "0.35em",
        textLocalX: 0,
        rotate: 0,
        initialX: centerX,
        initialY: y,
      },
      value: null,
    };
  }

  const centerY = overrideY ?? (y + height / 2);
  const labelX = isFarLeft ? x - LABEL_OFFSET : x + width + LABEL_OFFSET;
  const textAnchor: TextAnchor = isFarLeft ? "end" : "start";
  const initialX = isFarLeft ? x + 8 : x + width - 8;

  if (labelOrientation === "horizontal") {
    return {
      isInside: false,
      name: {
        x: labelX,
        y: centerY,
        textAnchor,
        dy: "0.35em",
        textLocalX: 0,
        rotate: 0,
        initialX,
        initialY: centerY,
      },
      value: showValueLabels
        ? {
            x: labelX,
            y: centerY + VALUE_LABEL_GAP,
            textAnchor,
            dy: "0.35em",
            textLocalX: 0,
            rotate: 0,
            initialX,
            initialY: centerY + VALUE_LABEL_GAP,
          }
        : null,
    };
  }

  const rotate = isFarLeft ? -90 : 90;
  const halfGap = VALUE_LABEL_GAP / 2;
  let nameLocalX = 0;
  if (showValueLabels) {
    nameLocalX = isFarLeft ? halfGap : -halfGap;
  }
  const valueLocalX = isFarLeft ? -halfGap : halfGap;

  return {
    isInside: false,
    name: {
      x: labelX,
      y: centerY,
      textAnchor: "middle",
      dy: "0.35em",
      textLocalX: nameLocalX,
      rotate,
      initialX,
      initialY: centerY,
    },
    value: showValueLabels
      ? {
          x: labelX,
          y: centerY,
          textAnchor: "middle",
          dy: "0.35em",
          textLocalX: valueLocalX,
          rotate,
          initialX,
          initialY: centerY,
        }
      : null,
  };
}

interface AnimatedNodeProps {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  rx: number;
  index: number;
  totalNodes: number;
  isFaded: boolean;
  fadedOpacity: number;
  animationDuration: number;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  name: string;
  value: number;
  isFarLeft: boolean;
  isFarRight: boolean;
  showLabels: boolean;
  showValueLabels: boolean;
  labelOrientation: SankeyLabelOrientation;
  formatValue?: (value: number) => string;
  overrideY?: number;
}

function NodeLabel({
  layout,
  opacity,
  transition,
  className,
  children,
}: {
  layout: NodeLabelLayout;
  opacity: number;
  transition: Transition;
  className: string;
  children: ReactNode;
}) {
  return (
    <motion.g
      animate={{
        opacity,
        x: layout.x,
        y: layout.y,
        rotate: layout.rotate,
      }}
      initial={{
        opacity: 0,
        x: layout.initialX,
        y: layout.initialY,
        rotate: layout.rotate,
      }}
      transition={transition}
    >
      <text
        className={className}
        dy={layout.dy}
        textAnchor={layout.textAnchor}
        x={layout.textLocalX}
      >
        {children}
      </text>
    </motion.g>
  );
}

function AnimatedNode({
  x,
  y,
  width,
  height,
  fill,
  rx,
  index,
  totalNodes,
  isFaded,
  fadedOpacity,
  animationDuration,
  onMouseEnter,
  onMouseLeave,
  name,
  value,
  isFarLeft,
  isFarRight,
  showLabels,
  showValueLabels,
  labelOrientation,
  formatValue,
  overrideY,
}: AnimatedNodeProps) {
  const { enterTransition, revealEpoch } = useSankey();

  const nodeAnimDuration = animationDuration * 0.6;
  const staggerDelaySec =
    ((index / totalNodes) * nodeAnimDuration * 0.4) / 1000;
  const nameLabelDelaySec =
    staggerDelaySec + (nodeAnimDuration * 0.6 * 0.3) / 1000;
  const valueLabelDelaySec = nameLabelDelaySec + 0.06;

  const nodeEnter = transitionWithDelay(enterTransition, staggerDelaySec);
  const nameEnter = transitionWithDelay(enterTransition, nameLabelDelaySec);
  const valueEnter = transitionWithDelay(enterTransition, valueLabelDelaySec);
  const nodeOpacity = isFaded ? fadedOpacity : 1;
  const nameOpacity = isFaded ? fadedOpacity : 1;
  const valueOpacity = isFaded ? fadedOpacity * 0.8 : 0.6;

  const labelLayouts = getNodeLabelLayouts({
    labelOrientation,
    isFarLeft,
    isFarRight,
    x,
    y,
    width,
    height,
    showValueLabels,
    overrideY,
  });

  const nameClass = labelLayouts.isInside
    ? "fill-white font-bold text-[11px] drop-shadow-sm"
    : "fill-gray-900 dark:fill-gray-100 font-bold text-[12px]";

  const valueClass = labelLayouts.isInside
    ? "fill-white/90 font-medium text-[10px]"
    : "fill-gray-600 dark:fill-gray-400 font-semibold text-[11px]";

  return (
    <motion.g
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ cursor: "pointer" }}
    >
      <motion.rect
        animate={{ opacity: nodeOpacity, scaleY: 1 }}
        fill={fill}
        height={height}
        initial={{ opacity: 0, scaleY: 0 }}
        key={`node-${index}-${revealEpoch}`}
        rx={rx}
        ry={rx}
        style={{ originY: 0.5 }}
        transition={nodeEnter}
        width={width}
        x={x}
        y={y}
      />
      {showLabels ? (
        <>
          <NodeLabel
            className={nameClass}
            key={`name-${index}-${revealEpoch}`}
            layout={labelLayouts.name}
            opacity={nameOpacity}
            transition={nameEnter}
          >
            {name}
          </NodeLabel>
          {labelLayouts.value ? (
            <NodeLabel
              className={valueClass}
              key={`value-${index}-${revealEpoch}`}
              layout={labelLayouts.value}
              opacity={valueOpacity}
              transition={valueEnter}
            >
              {formatValue ? formatValue(value) : intFmt(value)}
            </NodeLabel>
          ) : null}
        </>
      ) : null}
    </motion.g>
  );
}

export function SankeyNode({
  fill,
  lineCap = 4,
  fadedOpacity = 0.4,
  showLabels = true,
  showValueLabels = true,
  labelOrientation = "horizontal",
  formatValue,
  getNodeColor: getNodeColorProp,
}: SankeyNodeProps) {
  const {
    nodes,
    links,
    width,
    height,
    margin,
    hoveredNodeIndex,
    hoveredLinkIndex,
    setHoveredNodeIndex,
    setTooltipData,
    animationDuration,
  } = useSankey();

  // Default colors using CSS variables
  const defaultColors = useMemo(
    () => [
      "var(--chart-1)",
      "var(--chart-2)",
      "var(--chart-3)",
      "var(--chart-4)",
      "var(--chart-5)",
    ],
    []
  );

  // Get color for a node
  const getColor = useCallback(
    (
      node: SankeyNodeType<SankeyNodeDatum, SankeyLinkDatum>,
      index: number
    ): string => {
      if (fill) {
        return fill;
      }
      if (getNodeColorProp) {
        return getNodeColorProp(node, index);
      }

      return defaultColors[index % defaultColors.length] ?? "var(--chart-1)";
    },
    [fill, getNodeColorProp, defaultColors]
  );

  // Check if a node is connected to the hovered element
  const isNodeConnected = useCallback(
    (nodeIndex: number) => {
      if (hoveredNodeIndex !== null) {
        if (hoveredNodeIndex === nodeIndex) {
          return true;
        }
        return links.some((link) => {
          const sIdx = getNodeIndex(link.source as NodeOrIndex);
          const tIdx = getNodeIndex(link.target as NodeOrIndex);
          return (
            (sIdx === hoveredNodeIndex && tIdx === nodeIndex) ||
            (tIdx === hoveredNodeIndex && sIdx === nodeIndex)
          );
        });
      }
      if (hoveredLinkIndex !== null) {
        const link = links[hoveredLinkIndex];
        if (!link) {
          return false;
        }
        const sIdx = getNodeIndex(link.source as NodeOrIndex);
        const tIdx = getNodeIndex(link.target as NodeOrIndex);
        return sIdx === nodeIndex || tIdx === nodeIndex;
      }
      return false;
    },
    [hoveredNodeIndex, hoveredLinkIndex, links]
  );

  const isAnyHovered = hoveredNodeIndex !== null || hoveredLinkIndex !== null;
  const innerHeight = height - margin.top - margin.bottom;

  // Compute minX and maxX to identify far-left and far-right columns dynamically
  const { minX, maxX } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    nodes.forEach((n) => {
      const x0 = n.x0 ?? 0;
      const x1 = n.x1 ?? 0;
      if (x0 < min) min = x0;
      if (x1 > max) max = x1;
    });
    return { minX: min, maxX: max };
  }, [nodes]);

  const resolvedYMap = useMemo(() => {
    const leftItems: Array<{ id: string; targetY: number }> = [];
    const rightItems: Array<{ id: string; targetY: number }> = [];

    nodes.forEach((node) => {
      const nodeX0 = node.x0 ?? 0;
      const nodeX1 = node.x1 ?? 0;
      const nodeY = node.y0 ?? 0;
      const nodeH = (node.y1 ?? 0) - nodeY;
      const targetY = nodeY + nodeH / 2;

      const isFarLeft = Math.abs(nodeX0 - minX) < 15;
      const isFarRight = Math.abs(nodeX1 - maxX) < 15;

      if (isFarLeft) {
        leftItems.push({ id: node.name, targetY });
      } else if (isFarRight) {
        rightItems.push({ id: node.name, targetY });
      }
    });

    const labelHeight = showValueLabels ? 28 : 16;
    const leftResolved = computeResolvedYPositions(leftItems, labelHeight, 4, innerHeight);
    const rightResolved = computeResolvedYPositions(rightItems, labelHeight, 4, innerHeight);

    const combined = new Map<string, number>();
    leftResolved.forEach((v, k) => combined.set(k, v));
    rightResolved.forEach((v, k) => combined.set(k, v));
    return combined;
  }, [nodes, minX, maxX, innerHeight, showValueLabels]);

  return (
    <g className="sankey-nodes">
      {nodes.map((node, index) => {
        const nodeX = node.x0 ?? 0;
        const nodeY = node.y0 ?? 0;
        const nodeWidth = (node.x1 ?? 0) - nodeX;
        const nodeHeight = (node.y1 ?? 0) - nodeY;

        const isConnected = isNodeConnected(index);
        const isFaded = isAnyHovered && !isConnected;

        const isFarLeft = Math.abs(nodeX - minX) < 15;
        const isFarRight = Math.abs((node.x1 ?? 0) - maxX) < 15;

        let displayValue = 0;
        for (const l of links) {
          const sIdx = getNodeIndex(l.source as NodeOrIndex);
          const tIdx = getNodeIndex(l.target as NodeOrIndex);
          if (node.category === "source" && sIdx === index) {
            displayValue += l.value;
          } else if (node.category !== "source" && tIdx === index) {
            displayValue += l.value;
          }
        }

        const handleMouseEnter = () => {
          setHoveredNodeIndex(index);
          setTooltipData({
            type: "node",
            nodeIndex: index,
            x: 0,
            y: 0,
            data: node,
          });
        };

        const handleMouseLeave = () => {
          setHoveredNodeIndex(null);
          setTooltipData(null);
        };

        return (
          <AnimatedNode
            animationDuration={animationDuration}
            fadedOpacity={fadedOpacity}
            fill={getColor(node, index)}
            formatValue={formatValue}
            height={nodeHeight}
            index={index}
            isFaded={isFaded}
            isFarLeft={isFarLeft}
            isFarRight={isFarRight}
            key={`node-${node.name}`}
            labelOrientation={labelOrientation}
            name={node.name}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            overrideY={resolvedYMap.get(node.name)}
            rx={lineCap}
            showLabels={showLabels}
            showValueLabels={showValueLabels}
            totalNodes={nodes.length}
            value={displayValue}
            width={nodeWidth}
            x={nodeX}
            y={nodeY}
          />
        );
      })}
    </g>
  );
}

export default SankeyNode;
