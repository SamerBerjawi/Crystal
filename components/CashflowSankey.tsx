
import React, { useMemo } from 'react';
import { ResponsiveContainer, Sankey, Tooltip, Layer, Rectangle } from 'recharts';
import { Transaction, Category } from '../types';
import { convertToEur, formatCurrency } from '../utils';

interface CashflowSankeyProps {
  transactions: Transaction[];
  incomeCategories: Category[];
  expenseCategories: Category[];
}

// Helper to find category details
const getCategoryInfo = (name: string, categories: Category[]) => {
  for (const cat of categories) {
    if (cat.name === name) return { color: cat.color, isParent: true };
    const sub = cat.subCategories.find(s => s.name === name);
    if (sub) return { color: sub.color, isParent: false, parentColor: cat.color };
  }
  return { color: '#9CA3AF', isParent: true }; // Default gray
};

const CashflowSankey: React.FC<CashflowSankeyProps> = ({ transactions, incomeCategories, expenseCategories }) => {
  
  const { nodes, links, gradients } = useMemo(() => {
    const nodes: { name: string; color: string; depth: number }[] = [];
    const links: { source: number; target: number; value: number; gradientId: string }[] = [];
    const gradients: { id: string; start: string; end: string }[] = [];

    const incSub = new Map<string, { value: number; parent: string }>();
    const incCat = new Map<string, number>();
    const expCat = new Map<string, number>();
    const expSub = new Map<string, { value: number; parent: string }>();

    transactions.forEach(tx => {
      if (tx.transferId) return;

      const amount = Math.abs(convertToEur(tx.amount, tx.currency));

      if (tx.type === 'income') {
        let categoryName = tx.category;
        let parentName = '';

        const parentMatch = incomeCategories.find(c => c.subCategories.some(s => s.name === categoryName));
        if (parentMatch) {
          parentName = parentMatch.name;
        } else {
          parentName = categoryName;
          categoryName = '';
        }

        incCat.set(parentName, (incCat.get(parentName) || 0) + amount);

        if (categoryName) {
          const key = `${categoryName}::${parentName}`;
          incSub.set(key, { value: (incSub.get(key)?.value || 0) + amount, parent: parentName });
        }
      } else {
        let categoryName = tx.category;
        let parentName = '';

        const parentMatch = expenseCategories.find(c => c.subCategories.some(s => s.name === categoryName));
        if (parentMatch) {
          parentName = parentMatch.name;
        } else {
          parentName = categoryName;
          categoryName = '';
        }

        expCat.set(parentName, (expCat.get(parentName) || 0) + amount);

        if (categoryName) {
          const key = `${categoryName}::${parentName}`;
          expSub.set(key, { value: (expSub.get(key)?.value || 0) + amount, parent: parentName });
        }
      }
    });

    const addNode = (name: string, color: string, depth: number) => {
      const existingIndex = nodes.findIndex(n => n.name === name && n.depth === depth);
      if (existingIndex !== -1) return existingIndex;
      nodes.push({ name, color, depth });
      return nodes.length - 1;
    };

    const addLink = (source: number, target: number, value: number, colorStart: string, colorEnd: string) => {
      if (value < 1) return;
      const gradientId = `grad-${source}-${target}-${Math.floor(value)}`;
      gradients.push({ id: gradientId, start: colorStart, end: colorEnd });
      links.push({ source, target, value, gradientId });
    };

    const centerNodeIdx = addNode('Net Cash Flow', '#0EA5E9', 2);

    incCat.forEach((val, name) => {
      const catInfo = getCategoryInfo(name, incomeCategories);
      const catIdx = addNode(name, catInfo.color, 1);

      let directValue = val;
      incSub.forEach(data => {
        if (data.parent === name) directValue -= data.value;
      });

      if (directValue > 0) {
        const fallbackSubIdx = addNode(`${name} (direct)`, catInfo.color, 0);
        addLink(fallbackSubIdx, catIdx, directValue, catInfo.color, catInfo.color);
      }

      addLink(catIdx, centerNodeIdx, val, catInfo.color, '#22C55E');
    });

    incSub.forEach((data, key) => {
      const subName = key.split('::')[0];
      const parentName = data.parent;
      const catInfo = getCategoryInfo(parentName, incomeCategories);
      const subInfo = getCategoryInfo(subName, incomeCategories);

      const subIdx = addNode(subName, subInfo.color, 0);
      const catIdx = addNode(parentName, catInfo.color, 1);

      addLink(subIdx, catIdx, data.value, subInfo.color, catInfo.color);
    });

    expCat.forEach((val, name) => {
      const catInfo = getCategoryInfo(name, expenseCategories);
      const catIdx = addNode(name, catInfo.color, 3);

      addLink(centerNodeIdx, catIdx, val, '#EF4444', catInfo.color);

      let directValue = val;
      expSub.forEach(data => {
        if (data.parent === name) directValue -= data.value;
      });

      if (directValue > 0) {
        const fallbackSubIdx = addNode(`${name} (direct)`, catInfo.color, 4);
        addLink(catIdx, fallbackSubIdx, directValue, catInfo.color, '#EF4444');
      }
    });

    expSub.forEach((data, key) => {
      const subName = key.split('::')[0];
      const parentName = data.parent;
      const catInfo = getCategoryInfo(parentName, expenseCategories);
      const subInfo = getCategoryInfo(subName, expenseCategories);

      const catIdx = addNode(parentName, catInfo.color, 3);
      const subIdx = addNode(subName, subInfo.color, 4);

      addLink(catIdx, subIdx, data.value, catInfo.color, subInfo.color);
    });

    return { nodes, links, gradients };
  }, [transactions, incomeCategories, expenseCategories]);

  // --- Custom Renderers ---

  const SankeyNode = ({ x, y, width, height, index, payload }: any) => {
      const isCenter = payload.name === 'Net Cash Flow';
      const isOut = payload.depth >= 3;

      if (payload.value < 1) return null;

      return (
        <Layer key={`node-${index}`}>
          <Rectangle
            x={x} y={y} width={width} height={height}
            fill={payload.color}
            fillOpacity="1"
            rx={2} ry={2}
          />
          <text
            x={isCenter ? x + width / 2 : (isOut ? x + width + 6 : x - 6)}
            y={y + height / 2}
            textAnchor={isCenter ? 'middle' : (isOut ? 'start' : 'end')}
            alignmentBaseline="middle"
            fontSize={11}
            fontWeight={isCenter ? 700 : 500}
            fill="currentColor" // Handled by CSS class in container
            className="dark:fill-gray-300 fill-gray-600"
          >
            {payload.name}
          </text>
           <text
            x={isCenter ? x + width / 2 : (isOut ? x + width + 6 : x - 6)}
            y={y + height / 2 + 12}
            textAnchor={isCenter ? 'middle' : (isOut ? 'start' : 'end')}
            alignmentBaseline="middle"
            fontSize={9}
            fill="currentColor"
            className="dark:fill-gray-500 fill-gray-400 font-mono"
          >
            {formatCurrency(payload.value, 'EUR')}
          </text>
        </Layer>
      );
  };

  const SankeyLink = (props: any) => {
      const { sourceX, sourceY, targetX, targetY, linkWidth, payload } = props;
      const gradientId = payload.gradientId;

      // Create a bezier curve path
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
        {/* Define Gradients */}
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
                         if (props.payload.source && props.payload.target) {
                             return [formatCurrency(value, 'EUR'), `${props.payload.source.name} → ${props.payload.target.name}`];
                         }
                         return [formatCurrency(value, 'EUR'), name];
                    }}
                />
            </Sankey>
        </ResponsiveContainer>
    </div>
  );
};

export default CashflowSankey;
