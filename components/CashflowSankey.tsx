
import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  Sankey,
  Tooltip,
  Layer,
  Rectangle,
} from 'recharts';
import { Transaction, Category } from '../types';
import { convertToEur, formatCurrency } from '../utils';

interface CashflowSankeyProps {
  transactions: Transaction[];
  incomeCategories: Category[];
  expenseCategories: Category[];
}

const FLOW_DEPTH = {
  subIn: 0,
  catIn: 1,
  net: 2,
  catOut: 3,
  subOut: 4,
} as const;

const OTHER_SUBCATEGORY = 'Other';
const UNCATEGORIZED = 'Uncategorized';
const MIN_FLOW_VALUE = 0.01;
// Subcategories smaller than this fraction of the parent will be merged into "Other"
const SUBCATEGORY_MIN_RATIO = 0.05; // 3%

interface CashflowNode {
  name: string;
  displayName: string;
  color: string;
  depth: number;
}

interface CashflowLink {
  source: number;
  target: number;
  value: number;
  gradientId: string;
}

interface GradientDef {
  id: string;
  start: string;
  end: string;
}

// Local interface definitions for Recharts Sankey props
interface SankeyNodeProps {
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
  payload: CashflowNode & { value: number };
}

interface SankeyLinkProps {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  linkWidth: number;
  index: number;
  payload: CashflowLink & { gradientId: string };
}

const getCategoryColor = (
  name: string,
  parentName: string | null,
  categories: Category[],
): string => {
  if (parentName) {
    const parent = categories.find((c) => c.name === parentName);
    if (parent) {
      if (name === parentName) return parent.color;
      const sub = parent.subCategories.find((s) => s.name === name);
      if (sub) return sub.color;
      return parent.color;
    }
  } else {
    const parent = categories.find((c) => c.name === name);
    if (parent) return parent.color;
  }
  return '#9CA3AF';
};

type SubTotalsByParent = Map<string, Map<string, number>>;

interface CashflowGraph {
  nodes: CashflowNode[];
  links: CashflowLink[];
  gradients: GradientDef[];
}

const buildCashflowGraph = (
  transactions: Transaction[],
  incomeCategories: Category[],
  expenseCategories: Category[],
): CashflowGraph => {
  const nodes: CashflowNode[] = [];
  const links: CashflowLink[] = [];
  const gradients: GradientDef[] = [];
  const nodeIndexByKey = new Map<string, number>();

  const addNode = (
    key: string,
    displayName: string,
    color: string,
    depth: number,
  ): number => {
    const existingIndex = nodeIndexByKey.get(key);
    if (existingIndex !== undefined) return existingIndex;

    const newIndex = nodes.length;
    nodes.push({ name: key, displayName, color, depth });
    nodeIndexByKey.set(key, newIndex);
    return newIndex;
  };

  const addLink = (
    source: number,
    target: number,
    value: number,
    colorStart: string,
    colorEnd: string,
  ) => {
    if (value < MIN_FLOW_VALUE) return;
    const gradientId = `grad-${source}-${target}`;
    gradients.push({ id: gradientId, start: colorStart, end: colorEnd });
    links.push({ source, target, value, gradientId });
  };

  const incCatTotals = new Map<string, number>();
  const incSubTotals: SubTotalsByParent = new Map();

  const expCatTotals = new Map<string, number>();
  const expSubTotals: SubTotalsByParent = new Map();

  // --- Aggregate raw values ---
  transactions.forEach((tx) => {
    if (tx.transferId) return;

    const amount = Math.abs(convertToEur(tx.amount, tx.currency));
    if (amount < MIN_FLOW_VALUE) return;

    const isIncome = tx.type === 'income';
    const categories = isIncome ? incomeCategories : expenseCategories;

    let categoryName = tx.category;
    let parentName: string;

    const parentMatch = categories.find((c) =>
      c.subCategories.some((s) => s.name === categoryName),
    );

    if (parentMatch) {
      parentName = parentMatch.name;
    } else {
      const directMatch = categories.find((c) => c.name === categoryName);
      if (directMatch) {
        parentName = directMatch.name;
        categoryName = OTHER_SUBCATEGORY;
      } else {
        parentName = UNCATEGORIZED;
        categoryName = OTHER_SUBCATEGORY;
      }
    }

    const catTotals = isIncome ? incCatTotals : expCatTotals;
    const subTotals = isIncome ? incSubTotals : expSubTotals;

    catTotals.set(parentName, (catTotals.get(parentName) ?? 0) + amount);

    const parentSubMap = subTotals.get(parentName) ?? new Map<string, number>();
    parentSubMap.set(categoryName, (parentSubMap.get(categoryName) ?? 0) + amount);
    subTotals.set(parentName, parentSubMap);
  });

  // Center node
  const centerNodeIdx = addNode(
    'Net Cash Flow',
    'Net Cash Flow',
    '#0EA5E9',
    FLOW_DEPTH.net,
  );

  // Helper: merges tiny subs into OTHER_SUBCATEGORY
  const buildDisplaySubs = (
    rawSubs: Map<string, number> | undefined,
    parentTotal: number,
  ): Map<string, number> => {
    const result = new Map<string, number>();
    if (!rawSubs) return result;

    let otherBucket = 0;

    rawSubs.forEach((val, subName) => {
      if (val < MIN_FLOW_VALUE) return;

      if (subName === OTHER_SUBCATEGORY) {
        otherBucket += val;
        return;
      }

      const ratio = parentTotal > 0 ? val / parentTotal : 0;
      if (ratio < SUBCATEGORY_MIN_RATIO) {
        otherBucket += val;
      } else {
        result.set(subName, val);
      }
    });

    if (otherBucket >= MIN_FLOW_VALUE) {
      result.set(
        OTHER_SUBCATEGORY,
        (result.get(OTHER_SUBCATEGORY) ?? 0) + otherBucket,
      );
    }

    return result;
  };

  // INCOME SIDE
  incCatTotals.forEach((totalVal, parentName) => {
    if (totalVal < MIN_FLOW_VALUE) return;

    const color = getCategoryColor(parentName, null, incomeCategories);
    const catNodeIdx = addNode(
      `inc_cat_${parentName}`,
      parentName,
      color,
      FLOW_DEPTH.catIn,
    );

    addLink(catNodeIdx, centerNodeIdx, totalVal, color, '#0EA5E9');

    const rawSubs = incSubTotals.get(parentName);
    const displaySubs = buildDisplaySubs(rawSubs, totalVal);

    displaySubs.forEach((val, subName) => {
      if (val < MIN_FLOW_VALUE) return;
      const subColor =
        subName === OTHER_SUBCATEGORY
          ? color
          : getCategoryColor(subName, parentName, incomeCategories);
      const subNodeIdx = addNode(
        `inc_sub_${parentName}_${subName}`,
        subName,
        subColor,
        FLOW_DEPTH.subIn,
      );
      addLink(subNodeIdx, catNodeIdx, val, subColor, color);
    });
  });

  // EXPENSE SIDE
  expCatTotals.forEach((totalVal, parentName) => {
    if (totalVal < MIN_FLOW_VALUE) return;

    const color = getCategoryColor(parentName, null, expenseCategories);
    const catNodeIdx = addNode(
      `exp_cat_${parentName}`,
      parentName,
      color,
      FLOW_DEPTH.catOut,
    );

    addLink(centerNodeIdx, catNodeIdx, totalVal, '#0EA5E9', color);

    const rawSubs = expSubTotals.get(parentName);
    const displaySubs = buildDisplaySubs(rawSubs, totalVal);

    displaySubs.forEach((val, subName) => {
      if (val < MIN_FLOW_VALUE) return;
      const subColor =
        subName === OTHER_SUBCATEGORY
          ? color
          : getCategoryColor(subName, parentName, expenseCategories);
      const subNodeIdx = addNode(
        `exp_sub_${parentName}_${subName}`,
        subName,
        subColor,
        FLOW_DEPTH.subOut,
      );
      addLink(catNodeIdx, subNodeIdx, val, color, subColor);
    });
  });

  return { nodes, links, gradients };
};

const CustomSankeyTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  const isLink = 'source' in data && 'target' in data;

  // Helper to clean up internal IDs if displayName isn't available
  const getName = (node: any) => {
    return node.displayName || node.name.replace(/^(inc|exp)_(sub|cat)_/, '').replace(/_/g, ' ');
  };

  if (isLink) {
    const sourceName = getName(data.source);
    const targetName = getName(data.target);
    
    return (
      <div className="bg-light-card dark:bg-dark-card p-3 rounded-lg shadow-xl border border-black/5 dark:border-white/10 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-1 text-xs text-light-text-secondary dark:text-dark-text-secondary font-medium uppercase tracking-wider">
          <span>{sourceName}</span>
          <span className="material-symbols-outlined text-xs">arrow_forward</span>
          <span>{targetName}</span>
        </div>
        <p className="text-lg font-bold text-light-text dark:text-dark-text font-mono">
          {formatCurrency(data.value, 'EUR')}
        </p>
      </div>
    );
  }

  // Node
  return (
    <div className="bg-light-card dark:bg-dark-card p-3 rounded-lg shadow-xl border border-black/5 dark:border-white/10 backdrop-blur-sm">
      <p className="text-sm font-bold text-light-text dark:text-dark-text mb-1">
        {getName(data)}
      </p>
      <p className="text-lg font-bold text-primary-500 font-mono">
        {formatCurrency(data.value, 'EUR')}
      </p>
    </div>
  );
};

const CashflowSankey: React.FC<CashflowSankeyProps> = ({
  transactions,
  incomeCategories,
  expenseCategories,
}) => {
  const { nodes, links, gradients } = useMemo(
    () => buildCashflowGraph(transactions, incomeCategories, expenseCategories),
    [transactions, incomeCategories, expenseCategories],
  );

  const [hoveredNode, setHoveredNode] = useState<number | null>(null);
  const [hoveredLink, setHoveredLink] = useState<number | null>(null);

  const resetHover = () => {
    setHoveredNode(null);
    setHoveredLink(null);
  };

  const getNodeOpacity = (index: number): number => {
    if (links.length === 0) return 1;

    if (hoveredLink !== null && links[hoveredLink]) {
      const link = links[hoveredLink];
      return link.source === index || link.target === index ? 1 : 0.15;
    }

    if (hoveredNode !== null) {
      if (index === hoveredNode) return 1;

      const isAdjacent = links.some(
        (l) => (l.source === hoveredNode && l.target === index) ||
               (l.target === hoveredNode && l.source === index),
      );
      return isAdjacent ? 0.8 : 0.15;
    }

    return 1;
  };

  const getLinkOpacity = (index: number): number => {
    if (links.length === 0) return 0.5;

    if (hoveredLink !== null) {
      return index === hoveredLink ? 0.8 : 0.1;
    }

    if (hoveredNode !== null) {
      const link = links[index];
      return link.source === hoveredNode || link.target === hoveredNode ? 0.6 : 0.1;
    }

    return 0.4;
  };

  const SankeyNode = (
    props: SankeyNodeProps,
  ) => {
    const { x, y, width, height, index, payload } = props;
    if (payload.value < MIN_FLOW_VALUE || typeof index !== 'number') return null;

    const isCenter = payload.depth === FLOW_DEPTH.net;
    const isRight = payload.depth > FLOW_DEPTH.net;

    const opacity = getNodeOpacity(index);
    // Labels for Depth 0 are positioned to the right of the node (start anchor)
    // Labels for Depth 4 are positioned to the left of the node (end anchor)
    // This prevents clipping at the edges
    const isLeftEdge = payload.depth === 0;
    const isRightEdge = payload.depth === 4;
    
    let labelX;
    let textAnchor;

    if (isCenter) {
      labelX = x! + width! / 2;
      textAnchor = 'middle';
    } else if (isLeftEdge) {
      labelX = x! + width! + 6;
      textAnchor = 'start';
    } else if (isRightEdge) {
      labelX = x! - 6;
      textAnchor = 'end';
    } else if (isRight) {
      labelX = x! + width! + 6;
      textAnchor = 'start';
    } else {
      labelX = x! - 6;
      textAnchor = 'end';
    }

    return (
      <Layer
        key={`node-${index}`}
        onMouseEnter={() => {
          setHoveredLink(null);
          setHoveredNode(index);
        }}
        onMouseLeave={resetHover}
      >
        <Rectangle
          x={x}
          y={y}
          width={width}
          height={height}
          fill={payload.color}
          fillOpacity={opacity}
          rx={2}
          ry={2}
          className="transition-opacity duration-300 cursor-pointer"
        />
        <text
          x={labelX}
          y={y! + height! / 2}
          textAnchor={textAnchor}
          alignmentBaseline="middle"
          fontSize={12}
          fontWeight={600}
          opacity={opacity}
          className="dark:fill-gray-200 fill-gray-800 transition-opacity duration-300 pointer-events-none"
        >
          {payload.displayName}
        </text>
        <text
          x={labelX}
          y={y! + height! / 2 + 14}
          textAnchor={textAnchor}
          alignmentBaseline="middle"
          fontSize={10}
          opacity={opacity}
          className="dark:fill-gray-400 fill-gray-500 font-mono transition-opacity duration-300 pointer-events-none"
        >
          {formatCurrency(payload.value, 'EUR')}
        </text>
      </Layer>
    );
  };

  const SankeyLink = (
    props: SankeyLinkProps,
  ) => {
    const { sourceX, sourceY, targetX, targetY, linkWidth, index, payload } = props;
    if (typeof index !== 'number') return null;

    const { gradientId } = payload;
    const path = `
      M${sourceX},${sourceY + linkWidth / 2}
      C${sourceX + 100},${sourceY + linkWidth / 2}
       ${targetX - 100},${targetY + linkWidth / 2}
       ${targetX},${targetY + linkWidth / 2}
      L${targetX},${targetY - linkWidth / 2}
      C${targetX - 100},${targetY - linkWidth / 2}
       ${sourceX + 100},${sourceY - linkWidth / 2}
       ${sourceX},${sourceY - linkWidth / 2}
      Z
    `;

    const opacity = getLinkOpacity(index);

    return (
      <Layer
        key={`link-${index}`}
        onMouseEnter={() => {
          setHoveredNode(null);
          setHoveredLink(index);
        }}
        onMouseLeave={resetHover}
      >
        <path
          d={path}
          fill={`url(#${gradientId})`}
          fillOpacity={opacity}
          stroke="none"
          className="transition-opacity duration-300 cursor-pointer"
        />
      </Layer>
    );
  };

  if (links.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-light-text-secondary dark:text-dark-text-secondary opacity-60">
        <p>Not enough data for flow analysis.</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full" style={{ minHeight: '500px' }} onMouseLeave={resetHover}>
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          {gradients.map((g) => (
            <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={g.start} />
              <stop offset="100%" stopColor={g.end} />
            </linearGradient>
          ))}
        </defs>
      </svg>

      <ResponsiveContainer width="100%" height="100%">
        <Sankey
          data={{ nodes, links }}
          node={<SankeyNode {...({} as any)} />}
          link={<SankeyLink {...({} as any)} />}
          nodePadding={10}
          margin={{ left: 20, right: 20, top: 20, bottom: 20 }}
        >
          <Tooltip content={<CustomSankeyTooltip />} />
        </Sankey>
      </ResponsiveContainer>
    </div>
  );
};

export default CashflowSankey;
