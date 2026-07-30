
import React, { useMemo, useState, useCallback } from 'react';
import { Transaction, Category } from '../types';
import { convertToEur, formatCurrency } from '../utils';
import {
  SankeyChart,
  SankeyNode,
  SankeyLink,
  SankeyTooltip,
  type SankeyData,
} from '../src/components/charts/sankey';

interface CashflowSankeyProps {
  transactions: Transaction[];
  incomeCategories: Category[];
  expenseCategories: Category[];
}

const OTHER_LABEL = 'Misc';
const MAX_SUBS_PER_CAT = 5;

// Base Colors
const COLOR_HUB = '#6366F1'; // Indigo
const COLOR_SAVINGS = '#10B981'; // Emerald
const COLOR_DEFICIT = '#F59E0B'; // Amber

const getCategoryColor = (name: string, categories: Category[]) => {
  const cat = categories.find(c => c.name === name);
  return cat?.color || '#94A3B8';
};

const CashflowSankey: React.FC<CashflowSankeyProps> = ({
  transactions,
  incomeCategories,
  expenseCategories,
}) => {
  const [viewMode, setViewMode] = useState<'detailed' | 'category'>('category');

  const { sankeyData, totalFlow } = useMemo(() => {
    const nodes: { id: string; name: string; color: string; category: "source" | "landing" | "outcome" }[] = [];
    const links: { source: number; target: number; value: number }[] = [];

    const isDetailed = viewMode === 'detailed';

    const addNode = (
      id: string,
      displayName: string,
      color: string,
      catType: "source" | "landing" | "outcome"
    ) => {
      const existingIndex = nodes.findIndex(n => n.id === id);
      if (existingIndex !== -1) return existingIndex;
      nodes.push({ id, name: displayName, color, category: catType });
      return nodes.length - 1;
    };

    const addLink = (source: number, target: number, value: number) => {
      if (value < 0.01) return;
      links.push({ source, target, value: Math.round(value * 100) / 100 });
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

      const parentMatch = categories.find(c =>
        c.subCategories.some(s => s.name === categoryName)
      );
      if (parentMatch) {
        parentName = parentMatch.name;
      } else {
        const directMatch = categories.find(c => c.name === categoryName);
        parentName = directMatch ? directMatch.name : 'Uncategorized';
        categoryName = 'Direct';
      }

      if (isIncome) totalIncome += amount;
      else totalExpense += amount;

      if (!targetMap.has(parentName)) targetMap.set(parentName, new Map());
      const subMap = targetMap.get(parentName)!;
      subMap.set(categoryName, (subMap.get(categoryName) || 0) + amount);
    });

    const netSurplus = Math.max(0, totalIncome - totalExpense);
    const capitalDrawdown = Math.max(0, totalExpense - totalIncome);
    const flowVolume = Math.max(totalIncome, totalExpense);

    const hubIdx = addNode('hub', 'Cashflow Hub', COLOR_HUB, 'landing');

    incMap.forEach((subs, parentName) => {
      const pColor = getCategoryColor(parentName, incomeCategories);
      const sortedSubs = Array.from(subs.entries()).sort((a, b) => b[1] - a[1]);
      const hasRealSubcategories = isDetailed && (sortedSubs.length > 1 || (sortedSubs.length === 1 && sortedSubs[0][0] !== 'Direct'));

      if (hasRealSubcategories) {
        const pNodeIdx = addNode(`inc_p_${parentName}`, parentName, pColor, 'source');
        let pTotal = 0;
        const topSubs = sortedSubs.slice(0, MAX_SUBS_PER_CAT);
        const otherSubs = sortedSubs.slice(MAX_SUBS_PER_CAT);

        topSubs.forEach(([subName, val]) => {
          const displayName = subName === 'Direct' ? parentName : subName;
          const sNodeIdx = addNode(
            `inc_s_${parentName}_${subName}`,
            displayName,
            pColor,
            'source'
          );
          addLink(sNodeIdx, pNodeIdx, val);
          pTotal += val;
        });

        if (otherSubs.length > 0) {
          const otherVal = otherSubs.reduce((s, [, v]) => s + v, 0);
          const sNodeIdx = addNode(
            `inc_s_${parentName}_other`,
            OTHER_LABEL,
            pColor,
            'source'
          );
          addLink(sNodeIdx, pNodeIdx, otherVal);
          pTotal += otherVal;
        }

        addLink(pNodeIdx, hubIdx, pTotal);
      } else {
        const pTotal = Array.from(subs.values()).reduce((sum, val) => sum + val, 0);
        const pNodeIdx = addNode(`inc_p_${parentName}`, parentName, pColor, 'source');
        addLink(pNodeIdx, hubIdx, pTotal);
      }
    });

    if (capitalDrawdown > 0) {
      const drawIdx = addNode(
        'drawdown',
        'Capital Drawdown',
        COLOR_DEFICIT,
        'source'
      );
      addLink(drawIdx, hubIdx, capitalDrawdown);
    }

    expMap.forEach((subs, parentName) => {
      const pColor = getCategoryColor(parentName, expenseCategories);
      const sortedSubs = Array.from(subs.entries()).sort((a, b) => b[1] - a[1]);
      const hasRealSubcategories = isDetailed && (sortedSubs.length > 1 || (sortedSubs.length === 1 && sortedSubs[0][0] !== 'Direct'));

      if (hasRealSubcategories) {
        const pNodeIdx = addNode(
          `exp_p_${parentName}`,
          parentName,
          pColor,
          'outcome'
        );
        let pTotal = 0;
        const topSubs = sortedSubs.slice(0, MAX_SUBS_PER_CAT);
        const otherSubs = sortedSubs.slice(MAX_SUBS_PER_CAT);

        topSubs.forEach(([subName, val]) => {
          const displayName = subName === 'Direct' ? parentName : subName;
          const sNodeIdx = addNode(
            `exp_s_${parentName}_${subName}`,
            displayName,
            pColor,
            'outcome'
          );
          addLink(pNodeIdx, sNodeIdx, val);
          pTotal += val;
        });

        if (otherSubs.length > 0) {
          const otherVal = otherSubs.reduce((s, [, v]) => s + v, 0);
          const sNodeIdx = addNode(
            `exp_s_${parentName}_other`,
            OTHER_LABEL,
            pColor,
            'outcome'
          );
          addLink(pNodeIdx, sNodeIdx, otherVal);
          pTotal += otherVal;
        }

        addLink(hubIdx, pNodeIdx, pTotal);
      } else {
        const pTotal = Array.from(subs.values()).reduce((sum, val) => sum + val, 0);
        const pNodeIdx = addNode(
          `exp_p_${parentName}`,
          parentName,
          pColor,
          'outcome'
        );
        addLink(hubIdx, pNodeIdx, pTotal);
      }
    });

    if (netSurplus > 0) {
      const surplusIdx = addNode(
        'surplus',
        'Retained Savings',
        COLOR_SAVINGS,
        'outcome'
      );
      addLink(hubIdx, surplusIdx, netSurplus);
    }

    const sankeyData: SankeyData = { nodes, links };
    return { sankeyData, totalFlow: flowVolume };
  }, [transactions, incomeCategories, expenseCategories, viewMode]);

  const getNodeColor = useCallback((node: any) => {
    return node.color || '#6366F1';
  }, []);

  const formatNodeValue = useCallback((value: number) => {
    return formatCurrency(value, 'EUR');
  }, []);

  const formatTooltipValue = useCallback((value: number) => {
    const pct = totalFlow > 0 ? ((value / totalFlow) * 100).toFixed(1) : '0';
    return `${formatCurrency(value, 'EUR')} (${pct}%)`;
  }, [totalFlow]);

  if (totalFlow === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-light-text-secondary opacity-40">
        <span className="material-symbols-outlined text-5xl mb-2">account_tree</span>
        <p className="font-medium">No cash flow activity in this period.</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative min-h-[500px] flex flex-col justify-between">
      <div className="flex justify-end mb-4 z-20">
        <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-xl border border-black/5 dark:border-white/5 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setViewMode('category')}
            className={`px-4 py-1.5 rounded-lg text-[10px] font-bold tracking-widest transition-all cursor-pointer ${
              viewMode === 'category'
                ? 'bg-white dark:bg-dark-card text-primary-500 shadow-sm'
                : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'
            }`}
          >
            Categories
          </button>
          <button
            type="button"
            onClick={() => setViewMode('detailed')}
            className={`px-4 py-1.5 rounded-lg text-[10px] font-bold tracking-widest transition-all cursor-pointer ${
              viewMode === 'detailed'
                ? 'bg-white dark:bg-dark-card text-primary-500 shadow-sm'
                : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'
            }`}
          >
            Subcategories
          </button>
        </div>
      </div>

      <div className="w-full flex-1 min-h-[450px]">
        <SankeyChart
          data={sankeyData}
          aspectRatio="2 / 1"
          nodeWidth={18}
          nodePadding={viewMode === 'detailed' ? 14 : 20}
          margin={{ top: 30, right: 160, bottom: 30, left: 160 }}
        >
          <SankeyLink useGradient={true} getNodeColor={getNodeColor} />
          <SankeyNode lineCap={4} getNodeColor={getNodeColor} formatValue={formatNodeValue} />
          <SankeyTooltip formatValue={formatTooltipValue} />
        </SankeyChart>
      </div>
    </div>
  );
};

export default React.memo(CashflowSankey);
