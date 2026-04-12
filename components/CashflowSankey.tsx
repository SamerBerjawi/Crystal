
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

const OTHER_LABEL = 'Misc';
const MAX_SUBS_PER_CAT = 5;

// Colors
const COLOR_HUB = '#6366F1'; // Indigo
const COLOR_SAVINGS = '#10B981'; // Emerald
const COLOR_DEFICIT = '#F59E0B'; // Amber

const getCategoryColor = (name: string, categories: Category[]) => {
    const cat = categories.find(c => c.name === name);
    return cat?.color || '#94A3B8';
};

const CashflowSankey: React.FC<CashflowSankeyProps> = ({ transactions, incomeCategories, expenseCategories }) => {
  
  const { nodes, links, gradients, totalFlow } = useMemo(() => {
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

    let totalIncome = 0;
    let totalExpense = 0;
    const incMap = new Map<string, Map<string, number>>(); 
    const expMap = new Map<string, Map<string, number>>(); 

    transactions.forEach(tx => {
      if (tx.transferId) return;
      const amount = Math.abs(convertToEur(tx.amount, tx.currency));
      if (amount < 0.01) return;

      const isIncome = tx.type === 'income';
      const categories = isIncome ? incomeCategories : expenseCategories;
      const targetMap = isIncome ? incMap : expMap;
      
      let categoryName = tx.category;
      let parentName = '';

      const parentMatch = categories.find(c => c.subCategories.some(s => s.name === categoryName));
      if (parentMatch) {
        parentName = parentMatch.name;
      } else {
        const directMatch = categories.find(c => c.name === categoryName);
        parentName = directMatch ? directMatch.name : 'Uncategorized';
        categoryName = 'Direct';
      }

      if (isIncome) totalIncome += amount; else totalExpense += amount;

      if (!targetMap.has(parentName)) targetMap.set(parentName, new Map());
      const subMap = targetMap.get(parentName)!;
      subMap.set(categoryName, (subMap.get(categoryName) || 0) + amount);
    });

    const netSurplus = Math.max(0, totalIncome - totalExpense);
    const capitalDrawdown = Math.max(0, totalExpense - totalIncome);
    const flowVolume = Math.max(totalIncome, totalExpense);

    const hubIdx = addNode('hub', 'Cashflow Hub', COLOR_HUB, FLOW_DEPTH.net);

    incMap.forEach((subs, parentName) => {
        const pColor = getCategoryColor(parentName, incomeCategories);
        const pNodeIdx = addNode(`inc_p_${parentName}`, parentName, pColor, FLOW_DEPTH.catIn);
        
        let pTotal = 0;
        const sortedSubs = Array.from(subs.entries()).sort((a, b) => b[1] - a[1]);
        const topSubs = sortedSubs.slice(0, MAX_SUBS_PER_CAT);
        const otherSubs = sortedSubs.slice(MAX_SUBS_PER_CAT);

        topSubs.forEach(([subName, val]) => {
            const sNodeIdx = addNode(`inc_s_${parentName}_${subName}`, subName, pColor, FLOW_DEPTH.subIn);
            addLink(sNodeIdx, pNodeIdx, val, pColor, pColor);
            pTotal += val;
        });

        if (otherSubs.length > 0) {
            const otherVal = otherSubs.reduce((s, [, v]) => s + v, 0);
            const sNodeIdx = addNode(`inc_s_${parentName}_other`, OTHER_LABEL, pColor, FLOW_DEPTH.subIn);
            addLink(sNodeIdx, pNodeIdx, otherVal, pColor, pColor);
            pTotal += otherVal;
        }

        addLink(pNodeIdx, hubIdx, pTotal, pColor, COLOR_HUB);
    });

    if (capitalDrawdown > 0) {
        const drawIdx = addNode('drawdown', 'Capital Drawdown', COLOR_DEFICIT, FLOW_DEPTH.catIn);
        addLink(drawIdx, hubIdx, capitalDrawdown, COLOR_DEFICIT, COLOR_HUB);
    }

    expMap.forEach((subs, parentName) => {
        const pColor = getCategoryColor(parentName, expenseCategories);
        const pNodeIdx = addNode(`exp_p_${parentName}`, parentName, pColor, FLOW_DEPTH.catOut);
        
        let pTotal = 0;
        const sortedSubs = Array.from(subs.entries()).sort((a, b) => b[1] - a[1]);
        const topSubs = sortedSubs.slice(0, MAX_SUBS_PER_CAT);
        const otherSubs = sortedSubs.slice(MAX_SUBS_PER_CAT);

        topSubs.forEach(([subName, val]) => {
            const sNodeIdx = addNode(`exp_s_${parentName}_${subName}`, subName, pColor, FLOW_DEPTH.subOut);
            addLink(pNodeIdx, sNodeIdx, val, pColor, pColor);
            pTotal += val;
        });

        if (otherSubs.length > 0) {
            const otherVal = otherSubs.reduce((s, [, v]) => s + v, 0);
            const sNodeIdx = addNode(`exp_s_${parentName}_other`, OTHER_LABEL, pColor, FLOW_DEPTH.subOut);
            addLink(pNodeIdx, sNodeIdx, otherVal, pColor, pColor);
            pTotal += otherVal;
        }

        addLink(hubIdx, pNodeIdx, pTotal, COLOR_HUB, pColor);
    });

    if (netSurplus > 0) {
        const surplusIdx = addNode('surplus', 'Retained Savings', COLOR_SAVINGS, FLOW_DEPTH.catOut);
        addLink(hubIdx, surplusIdx, netSurplus, COLOR_HUB, COLOR_SAVINGS);
    }

    return { nodes, links, gradients, totalFlow: flowVolume };
  }, [transactions, incomeCategories, expenseCategories]);

  const SankeyNode = ({ x, y, width, height, index, payload }: any) => {
      if (payload.value < 0.01) return null;
      const isRight = payload.depth > 2;
      const isCenter = payload.depth === 2;
      const textAnchor = isCenter ? 'middle' : (isRight ? 'start' : 'end');
      const textX = isCenter ? x + width / 2 : (isRight ? x + width + 8 : x - 8);

      return (
        <Layer key={`node-${index}`}>
          <Rectangle
            x={x} y={y} width={width} height={height}
            fill={payload.color}
            fillOpacity={0.9}
            rx={6} ry={6} // Increased roundness for nodes
          />
          <text
            x={textX}
            y={y + height / 2}
            textAnchor={textAnchor}
            fontSize={11}
            fontWeight={isCenter ? 800 : 600}
            fill="currentColor"
            className="dark:fill-gray-200 fill-gray-700"
          >
            {payload.name}
          </text>
        </Layer>
      );
  };

  const SankeyLink = (props: any) => {
      const { sourceX, sourceY, targetX, targetY, linkWidth, payload } = props;
      if (linkWidth < 1) return null;

      // Calculate deep curves using half the horizontal distance as control offset
      const curvature = (targetX - sourceX) / 2;
      
      const path = `
        M${sourceX},${sourceY + linkWidth / 2}
        C${sourceX + curvature},${sourceY + linkWidth / 2}
         ${targetX - curvature},${targetY + linkWidth / 2}
         ${targetX},${targetY + linkWidth / 2}
        L${targetX},${targetY - linkWidth / 2}
        C${targetX - curvature},${targetY - linkWidth / 2}
         ${sourceX + curvature},${sourceY - linkWidth / 2}
         ${sourceX},${sourceY - linkWidth / 2}
        Z
      `;

      return (
        <Layer key={`link-${props.index}`}>
          <path 
            d={path} 
            fill={`url(#${payload.gradientId})`} 
            fillOpacity={0.35}
            className="transition-all duration-300 hover:fill-opacity-70"
          />
        </Layer>
      );
  };

  if (totalFlow === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-light-text-secondary opacity-40">
          <span className="material-symbols-outlined text-5xl mb-2">account_tree</span>
          <p className="font-medium">No cash flow activity in this period.</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full" style={{ minHeight: '600px' }}>
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
                nodePadding={24}
                margin={{ left: 100, right: 100, top: 20, bottom: 20 }}
            >
                <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--light-card)', backdropFilter: 'blur(10px)', border: 'none', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    formatter={(value: number) => {
                        const pct = ((value / totalFlow) * 100).toFixed(1);
                        return [`${formatCurrency(value, 'EUR')} (${pct}%)`, 'Volume'];
                    }}
                />
            </Sankey>
        </ResponsiveContainer>
    </div>
  );
};

export default React.memo(CashflowSankey);
