
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { SankeyChart, SankeyNode, SankeyLink, SankeyTooltip } from '@/src/components/charts/sankey';
import { Transaction, Category } from '../types';
import { convertToEur, formatCurrency } from '../utils';
import Icon from './ui/Icon';

interface CashflowSankeyProps {
  transactions: Transaction[];
  incomeCategories: Category[];
  expenseCategories: Category[];
}

const OTHER_LABEL = 'Misc';
const MAX_SUBS_PER_CAT = 5;

const getCategoryColor = (name: string, categories: Category[]) => {
  const cat = categories.find(c => c.name === name);
  return cat?.color || '#94A3B8';
};

const CashflowSankey: React.FC<CashflowSankeyProps> = ({ transactions, incomeCategories, expenseCategories }) => {
  const [viewMode, setViewMode] = useState<'detailed' | 'category'>('category');
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const checkDarkMode = () => document.documentElement.classList.contains('dark');
    setIsDarkMode(checkDarkMode());

    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const COLOR_HUB = isDarkMode ? '#818CF8' : '#4F46E5';
  const COLOR_SAVINGS = isDarkMode ? '#34D399' : '#059669';
  const COLOR_DEFICIT = isDarkMode ? '#FBBF24' : '#D97706';

  const { data, nodeColors, totalFlow } = useMemo(() => {
    const nodes: { name: string; category?: 'source' | 'landing' | 'outcome'; color: string }[] = [];
    const links: { source: number; target: number; value: number }[] = [];
    const nodeColors: string[] = [];

    const isDetailed = viewMode === 'detailed';

    const addNode = (displayName: string, color: string, category: 'source' | 'landing' | 'outcome') => {
      const existingIndex = nodes.findIndex(n => n.name === displayName && n.category === category);
      if (existingIndex !== -1) return existingIndex;
      nodes.push({ name: displayName, category, color });
      nodeColors.push(color);
      return nodes.length - 1;
    };

    const addLink = (source: number, target: number, value: number) => {
      if (value < 0.01) return;
      links.push({ source, target, value: Number(value.toFixed(2)) });
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

    const hubIdx = addNode('Cashflow Hub', COLOR_HUB, 'landing');

    incMap.forEach((subs, parentName) => {
      const pColor = getCategoryColor(parentName, incomeCategories);
      const pNodeIdx = addNode(parentName, pColor, 'source');

      let pTotal = 0;
      const sortedSubs = Array.from(subs.entries()).sort((a, b) => b[1] - a[1]);
      const topSubs = sortedSubs.slice(0, MAX_SUBS_PER_CAT);
      const otherSubs = sortedSubs.slice(MAX_SUBS_PER_CAT);

      if (isDetailed) {
        topSubs.forEach(([subName, val]) => {
          const sNodeIdx = addNode(subName, pColor, 'source');
          addLink(sNodeIdx, pNodeIdx, val);
          pTotal += val;
        });

        if (otherSubs.length > 0) {
          const otherVal = otherSubs.reduce((s, [, v]) => s + v, 0);
          const sNodeIdx = addNode(`${parentName} (${OTHER_LABEL})`, pColor, 'source');
          addLink(sNodeIdx, pNodeIdx, otherVal);
          pTotal += otherVal;
        }
        addLink(pNodeIdx, hubIdx, pTotal);
      } else {
        pTotal = Array.from(subs.values()).reduce((sum, val) => sum + val, 0);
        addLink(pNodeIdx, hubIdx, pTotal);
      }
    });

    if (capitalDrawdown > 0) {
      const drawIdx = addNode('Capital Drawdown', COLOR_DEFICIT, 'source');
      addLink(drawIdx, hubIdx, capitalDrawdown);
    }

    expMap.forEach((subs, parentName) => {
      const pColor = getCategoryColor(parentName, expenseCategories);
      const pNodeIdx = addNode(parentName, pColor, 'outcome');

      let pTotal = 0;
      const sortedSubs = Array.from(subs.entries()).sort((a, b) => b[1] - a[1]);
      const topSubs = sortedSubs.slice(0, MAX_SUBS_PER_CAT);
      const otherSubs = sortedSubs.slice(MAX_SUBS_PER_CAT);

      if (isDetailed) {
        topSubs.forEach(([subName, val]) => {
          const sNodeIdx = addNode(subName, pColor, 'outcome');
          addLink(pNodeIdx, sNodeIdx, val);
          pTotal += val;
        });

        if (otherSubs.length > 0) {
          const otherVal = otherSubs.reduce((s, [, v]) => s + v, 0);
          const sNodeIdx = addNode(`${parentName} (${OTHER_LABEL})`, pColor, 'outcome');
          addLink(pNodeIdx, sNodeIdx, otherVal);
          pTotal += otherVal;
        }
        addLink(hubIdx, pNodeIdx, pTotal);
      } else {
        pTotal = Array.from(subs.values()).reduce((sum, val) => sum + val, 0);
        addLink(hubIdx, pNodeIdx, pTotal);
      }
    });

    if (netSurplus > 0) {
      const surplusIdx = addNode('Retained Savings', COLOR_SAVINGS, 'outcome');
      addLink(hubIdx, surplusIdx, netSurplus);
    }

    return { data: { nodes, links }, nodeColors, totalFlow: flowVolume };
  }, [transactions, incomeCategories, expenseCategories, viewMode, COLOR_HUB, COLOR_SAVINGS, COLOR_DEFICIT]);

  const getNodeColor = useCallback((node: any, index: number) => {
    return nodeColors[index] || node.color || (isDarkMode ? '#60A5FA' : '#2563EB');
  }, [nodeColors, isDarkMode]);

  if (totalFlow === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-light-text-secondary opacity-40">
        <Icon name="account_tree" className="text-5xl mb-2" />
        <p className="font-medium">No cash flow activity in this period.</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col relative min-h-[420px]">
      <div className="flex items-center justify-between mb-2 z-20">
        <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-xl border border-black/5 dark:border-white/5 backdrop-blur-md ml-auto">
          <button
            type="button"
            onClick={() => setViewMode('category')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${viewMode === 'category'
                ? 'bg-white dark:bg-dark-card text-primary-500 shadow-sm'
                : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'
              }`}
          >
            Categories
          </button>
          <button
            type="button"
            onClick={() => setViewMode('detailed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${viewMode === 'detailed'
                ? 'bg-white dark:bg-dark-card text-primary-500 shadow-sm'
                : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'
              }`}
          >
            Subcategories
          </button>
        </div>
      </div>

      <div className="flex-1 w-full relative min-h-[360px]">
        <SankeyChart
          data={data}
          aspectRatio={undefined}
          nodeWidth={18}
          nodePadding={viewMode === 'detailed' ? 14 : 26}
          margin={{ top: 20, right: 140, bottom: 20, left: 140 }}
          className="w-full h-full"
        >
          <SankeyLink
            useGradient={true}
            getNodeColor={getNodeColor}
            strokeOpacity={isDarkMode ? 0.55 : 0.42}
            fadedOpacity={0.08}
          />
          <SankeyNode
            lineCap={4}
            labelOrientation="horizontal"
            getNodeColor={getNodeColor}
            formatValue={(val) => formatCurrency(val, 'EUR')}
          />
          <SankeyTooltip />
        </SankeyChart>
      </div>
    </div>
  );
};

export default React.memo(CashflowSankey);

