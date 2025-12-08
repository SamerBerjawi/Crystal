
import React, { useMemo } from 'react';
import { ResponsiveContainer, Sankey, Tooltip, Layer, Rectangle } from 'recharts';
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
    subOut: 4
};

const OTHER_SUBCATEGORY = 'Others';
const MAX_VISIBLE_SUBCATEGORIES = 10;

// Helper to find color safely
const getCategoryColor = (name: string, parentName: string | null, categories: Category[]) => {
    if (parentName) {
        const parent = categories.find(c => c.name === parentName);
        if (parent) {
            if (name === parentName) return parent.color;
            const sub = parent.subCategories.find(s => s.name === name);
            if (sub) return sub.color;
            return parent.color; // Fallback to parent color for direct/other
        }
    } else {
        // Try to find as parent
        const parent = categories.find(c => c.name === name);
        if (parent) return parent.color;
    }
    return '#9CA3AF'; // Default gray
};

const CashflowSankey: React.FC<CashflowSankeyProps> = ({ transactions, incomeCategories, expenseCategories }) => {
  
  const { nodes, links, gradients } = useMemo(() => {
    const nodes: { id: string; name: string; color: string; depth: number }[] = [];
    const links: { source: number; target: number; value: number; gradientId: string }[] = [];
    const gradients: { id: string; start: string; end: string }[] = [];

    const addNode = (id: string, displayName: string, color: string, depth: number) => {
      const existingIndex = nodes.findIndex(n => n.id === id);
      if (existingIndex !== -1) return existingIndex;
      nodes.push({ id, name: displayName, color, depth });
      return nodes.length - 1;
    };

    const addLink = (source: number, target: number, value: number, colorStart: string, colorEnd: string) => {
      if (value < 0.01) return;
      const gradientId = `grad-${source}-${target}-${Math.floor(value * 100)}-${Math.random().toString(36).substr(2, 5)}`; 
      gradients.push({ id: gradientId, start: colorStart, end: colorEnd });
      links.push({ source, target, value, gradientId });
    };

    // Aggregation Structures
    const incCatTotals = new Map<string, number>();
    const incSubTotals = new Map<string, number>(); // Key: "Sub::Parent"

    const expCatTotals = new Map<string, number>();
    const expSubTotals = new Map<string, number>();

    transactions.forEach(tx => {
      if (tx.transferId) return;

      const amount = Math.abs(convertToEur(tx.amount, tx.currency));
      if (amount < 0.01) return;

      const isIncome = tx.type === 'income';
      const categories = isIncome ? incomeCategories : expenseCategories;
      
      let categoryName = tx.category;
      let parentName = '';

      // Identify Parent and Sub to enforce 5-stage flow
      const parentMatch = categories.find(c => c.subCategories.some(s => s.name === categoryName));
      if (parentMatch) {
        parentName = parentMatch.name;
      } else {
        const directMatch = categories.find(c => c.name === categoryName);
        if (directMatch) {
            parentName = directMatch.name;
            categoryName = OTHER_SUBCATEGORY; // Directly assigned parents terminate in the implicit sub-category
        } else {
            parentName = 'Uncategorized';
            categoryName = OTHER_SUBCATEGORY;
        }
      }

      if (isIncome) {
          incCatTotals.set(parentName, (incCatTotals.get(parentName) || 0) + amount);
          const key = `${categoryName}::${parentName}`;
          incSubTotals.set(key, (incSubTotals.get(key) || 0) + amount);
      } else {
          expCatTotals.set(parentName, (expCatTotals.get(parentName) || 0) + amount);
          const key = `${categoryName}::${parentName}`;
          expSubTotals.set(key, (expSubTotals.get(key) || 0) + amount);
      }
    });

    const limitSubcategories = (subTotals: Map<string, number>) => {
        const limited = new Map<string, number>();
        const overflowTotals = new Map<string, number>();

        const groupedByParent = new Map<string, { subName: string; value: number }[]>();
        subTotals.forEach((value, key) => {
            const [subName, parentName] = key.split('::');
            if (!groupedByParent.has(parentName)) {
                groupedByParent.set(parentName, []);
            }
            groupedByParent.get(parentName)!.push({ subName, value });
        });

        groupedByParent.forEach((entries, parentName) => {
            const sorted = entries.sort((a, b) => b.value - a.value);
            if (sorted.length <= MAX_VISIBLE_SUBCATEGORIES) {
                sorted.forEach(({ subName, value }) => {
                    limited.set(`${subName}::${parentName}`, value);
                });
            } else {
                const visible = sorted.slice(0, MAX_VISIBLE_SUBCATEGORIES - 1);
                const remaining = sorted.slice(MAX_VISIBLE_SUBCATEGORIES - 1);
                const otherTotal = remaining.reduce((sum, entry) => sum + entry.value, 0);

                visible.forEach(({ subName, value }) => {
                    limited.set(`${subName}::${parentName}`, value);
                });

                if (otherTotal > 0.01) {
                    overflowTotals.set(parentName, (overflowTotals.get(parentName) || 0) + otherTotal);
                }
            }
        });

        return { limited, overflowTotals };
    };

    const { limited: limitedIncSubTotals, overflowTotals: incOverflowTotals } = limitSubcategories(incSubTotals);
    const { limited: limitedExpSubTotals, overflowTotals: expOverflowTotals } = limitSubcategories(expSubTotals);

    // --- Build Graph ---

    // Center Node (Depth 2)
    const centerNodeIdx = addNode('net_cash_flow', 'Net Cash Flow', '#0EA5E9', FLOW_DEPTH.net);

    // INCOME SIDE (Left)
    // Depth 1: Parent Categories
    // Depth 0: Sub Categories (Terminals)
    incCatTotals.forEach((totalVal, parentName) => {
        if (totalVal < 0.01) return;

        const color = getCategoryColor(parentName, null, incomeCategories);
        const catNodeIdx = addNode(`inc_cat_${parentName}`, parentName, color, FLOW_DEPTH.catIn);

        const visibleTotal = Array.from(limitedIncSubTotals.entries())
            .filter(([key]) => key.endsWith(`::${parentName}`))
            .reduce((sum, [, val]) => sum + val, 0);

        // Link Category -> Net Cash Flow using visible portion only (overflow will be grouped under Others)
        if (visibleTotal >= 0.01) {
            addLink(catNodeIdx, centerNodeIdx, visibleTotal, color, '#0EA5E9');
        }

        // Link Subs -> Category
        limitedIncSubTotals.forEach((val, key) => {
            const [subName, pName] = key.split('::');
            if (pName === parentName) {
                // If 'Other', use lighter/faded color
                const subColor = subName === OTHER_SUBCATEGORY ? color : getCategoryColor(subName, parentName, incomeCategories);
                const subNodeIdx = addNode(`inc_sub_${parentName}_${subName}`, subName, subColor, FLOW_DEPTH.subIn);
                addLink(subNodeIdx, catNodeIdx, val, subColor, color);
            }
        });
    });

    const incOverflowTotal = Array.from(incOverflowTotals.values()).reduce((sum, val) => sum + val, 0);
    if (incOverflowTotal >= 0.01) {
        const otherColor = '#9CA3AF';
        const catNodeIdx = addNode(`inc_cat_${OTHER_SUBCATEGORY}`, OTHER_SUBCATEGORY, otherColor, FLOW_DEPTH.catIn);
        const subNodeIdx = addNode(`inc_sub_${OTHER_SUBCATEGORY}`, OTHER_SUBCATEGORY, otherColor, FLOW_DEPTH.subIn);

        addLink(subNodeIdx, catNodeIdx, incOverflowTotal, otherColor, otherColor);
        addLink(catNodeIdx, centerNodeIdx, incOverflowTotal, otherColor, '#0EA5E9');
    }

    // EXPENSE SIDE (Right)
    // Depth 3: Parent Categories
    // Depth 4: Sub Categories (Terminals)
    expCatTotals.forEach((totalVal, parentName) => {
        if (totalVal < 0.01) return;

        const color = getCategoryColor(parentName, null, expenseCategories);
        const catNodeIdx = addNode(`exp_cat_${parentName}`, parentName, color, FLOW_DEPTH.catOut);

        const visibleTotal = Array.from(limitedExpSubTotals.entries())
            .filter(([key]) => key.endsWith(`::${parentName}`))
            .reduce((sum, [, val]) => sum + val, 0);

        // Link Net Cash Flow -> Category using visible portion only (overflow will be grouped under Others)
        if (visibleTotal >= 0.01) {
            addLink(centerNodeIdx, catNodeIdx, visibleTotal, '#0EA5E9', color);
        }

        // Link Category -> Subs
        limitedExpSubTotals.forEach((val, key) => {
            const [subName, pName] = key.split('::');
            if (pName === parentName) {
                const subColor = subName === OTHER_SUBCATEGORY ? color : getCategoryColor(subName, parentName, expenseCategories);
                const subNodeIdx = addNode(`exp_sub_${parentName}_${subName}`, subName, subColor, FLOW_DEPTH.subOut);
                addLink(catNodeIdx, subNodeIdx, val, color, subColor);
            }
        });
    });

    const expOverflowTotal = Array.from(expOverflowTotals.values()).reduce((sum, val) => sum + val, 0);
    if (expOverflowTotal >= 0.01) {
        const otherColor = '#9CA3AF';
        const catNodeIdx = addNode(`exp_cat_${OTHER_SUBCATEGORY}`, OTHER_SUBCATEGORY, otherColor, FLOW_DEPTH.catOut);
        const subNodeIdx = addNode(`exp_sub_${OTHER_SUBCATEGORY}`, OTHER_SUBCATEGORY, otherColor, FLOW_DEPTH.subOut);

        addLink(centerNodeIdx, catNodeIdx, expOverflowTotal, '#0EA5E9', otherColor);
        addLink(catNodeIdx, subNodeIdx, expOverflowTotal, otherColor, otherColor);
    }

    return { nodes, links, gradients };
  }, [transactions, incomeCategories, expenseCategories]);

  // --- Custom Renderers ---

  const SankeyNode = ({ x, y, width, height, index, payload }: any) => {
      if (payload.value < 0.01) return null;

      const isCenter = payload.depth === 2;
      const isRight = payload.depth > 2;

      const labelX = isCenter ? x + width / 2 : (isRight ? x + width - 6 : x + 6);
      const textAnchor = isCenter ? 'middle' : (isRight ? 'end' : 'start');

      return (
        <Layer key={`node-${index}`}>
          <Rectangle
            x={x} y={y} width={width} height={height}
            fill={payload.color}
            fillOpacity="1"
            rx={2} ry={2}
          />
          <text
            x={labelX}
            y={y + height / 2}
            textAnchor={textAnchor}
            alignmentBaseline="middle"
            fontSize={11}
            fontWeight={isCenter ? 700 : 500}
            fill="currentColor"
            className="dark:fill-gray-300 fill-gray-600"
          >
            {payload.name}
          </text>
          <text
            x={labelX}
            y={y + height / 2 + 12}
            textAnchor={textAnchor}
            alignmentBaseline="middle"
            fontSize={9}
            className="font-mono fill-black dark:fill-white"
          >
            {formatCurrency(payload.value, 'EUR')}
          </text>
        </Layer>
      );
  };

  const SankeyLink = (props: any) => {
      const { sourceX, sourceY, targetX, targetY, linkWidth, payload } = props;
      const gradientId = payload.gradientId;

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

      return (
        <Layer key={`link-${props.index}`}>
          <path 
            d={path} 
            fill={`url(#${gradientId})`} 
            fillOpacity={0.5}
            stroke="none"
            className="transition-opacity duration-300 hover:fill-opacity-80"
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
    <div className="h-full w-full" style={{ minHeight: '500px' }}>
        <svg width="0" height="0" style={{ position: 'absolute' }}>
            <defs>
                {gradients.map(g => (
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
                node={<SankeyNode />}
                link={<SankeyLink />}
                nodePadding={10}
                margin={{ left: 10, right: 10, top: 10, bottom: 10 }}
            >
                <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--light-card)', borderColor: 'rgba(0,0,0,0.1)', borderRadius: '8px', fontSize: '12px' }}
                    itemStyle={{ color: 'var(--light-text)' }}
                    formatter={(value: number, name: string, props: any) => {
                         const sourceName = props.payload.source?.name;
                         const targetName = props.payload.target?.name;
                         const nodeName = props.payload.name;

                         if (sourceName && targetName) {
                             return [formatCurrency(value, 'EUR'), `${sourceName} → ${targetName}`];
                         }
                         return [formatCurrency(value, 'EUR'), nodeName];
                    }}
                />
            </Sankey>
        </ResponsiveContainer>
    </div>
  );
};

export default CashflowSankey;
