import React, { useMemo } from 'react';
import { ResponsiveContainer, Sankey, Tooltip } from 'recharts';
import { Transaction, Category, SankeyNode as SankeyNodeType, SankeyLink } from '../types';
import { convertToEur } from '../utils';
import SankeyNode from './SankeyNode';

interface CashflowSankeyProps {
    transactions: Transaction[];
    expenseCategories: Category[];
    income: number;
    expenses: number;
}

// Custom link component for gradients
const CustomLink = ({ sourceX, sourceY, sourceControlX, targetX, targetY, targetControlX, linkWidth, index, payload, nodes }: any) => {
    const gradientId = `gradient-link-${index}`;
    
    const path = `
        M${sourceX},${sourceY}
        C${sourceControlX},${sourceY}
        ${targetControlX},${targetY}
        ${targetX},${targetY}
        L${targetX},${targetY + linkWidth}
        C${targetControlX},${targetY + linkWidth}
        ${sourceControlX},${sourceY + linkWidth}
        ${sourceX},${sourceY + linkWidth}
        Z
    `;

    if (!nodes || !payload || payload.source === undefined || payload.target === undefined) {
        return <path d={path} fill="#E5E7EB" opacity={0.6} strokeWidth="0" />;
    }

    const sourceNode = nodes[payload.source];
    const targetNode = nodes[payload.target];

    if (!sourceNode || !targetNode) {
        return <path d={path} fill="#E5E7EB" opacity={0.6} strokeWidth="0" />;
    }

    const sourceColor = sourceNode.color;
    const targetColor = targetNode.color;

    return (
        <g>
            <defs>
                <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={sourceX} y1={sourceY} x2={targetX} y2={targetY}>
                    <stop offset="0%" stopColor={sourceColor} stopOpacity={0.7} />
                    <stop offset="100%" stopColor={targetColor} stopOpacity={0.7} />
                </linearGradient>
            </defs>
            <path
                d={path}
                fill={`url(#${gradientId})`}
                strokeWidth="0"
            />
        </g>
    );
};

const findParentCategory = (categoryName: string, categories: Category[]): Category | undefined => {
    for (const cat of categories) {
        if (cat.name === categoryName) return cat;
        const foundInSub = cat.subCategories.find((sub: Category) => sub.name === categoryName);
        if (foundInSub) return cat;
    }
    return undefined;
};

const CashflowSankey: React.FC<CashflowSankeyProps> = ({ transactions, expenseCategories, income, expenses }) => {

    const sankeyData = useMemo(() => {
        type NodeWithColor = SankeyNodeType & { color: string, value?: number };
        const nodes: NodeWithColor[] = [];
        const links: Omit<SankeyLink, 'color'>[] = [];
        const nodeMap = new Map<string, number>();

        const addNode = (name: string, color: string) => {
            if (!nodeMap.has(name)) {
                nodeMap.set(name, nodes.length);
                nodes.push({ name, color });
            }
            return nodeMap.get(name)!;
        };

        const incomeColor = '#22C55E';
        const cashFlowColor = '#6366F1';
        const surplusColor = '#10B981';
        const deficitColor = '#EF4444';

        // 1. Add Core Nodes
        const incomeNodeIndex = addNode('Income', incomeColor);
        const cashFlowNodeIndex = addNode('Cash Flow', cashFlowColor);

        // 2. Process expenses and add expense nodes
        // The type of `acc` was not being correctly inferred. Typing the initial value of `reduce` ensures `expenseByParentCategory` has the correct type.
        const expenseByParentCategory = transactions
            .filter(tx => tx.type === 'expense' && !tx.transferId)
            // FIX: Explicitly typing the accumulator for `reduce` to resolve 'unknown' type errors.
            .reduce((acc, tx) => {
                const parentCat = findParentCategory(tx.category, expenseCategories);
                const categoryName = parentCat ? parentCat.name : 'Miscellaneous';
                const color = parentCat ? parentCat.color : '#A0AEC0';
                if (!acc[categoryName]) {
                    acc[categoryName] = { value: 0, color };
                }
                acc[categoryName].value += Math.abs(convertToEur(tx.amount, tx.currency));
                return acc;
            // FIX: Type the initial value of reduce to ensure type inference for the accumulator.
            }, {} as Record<string, { value: number; color: string; }>);

        const sortedExpenses = Object.entries(expenseByParentCategory).sort((a, b) => b[1].value - a[1].value);

        sortedExpenses.forEach(([name, data]) => {
            if (data.value > 0) addNode(name, data.color);
        });
        
        const surplus = income - expenses;
        if (surplus > 0) {
            addNode('Surplus', surplusColor);
        }

        // 3. Create Links
        if (income > 0) {
            links.push({ source: incomeNodeIndex, target: cashFlowNodeIndex, value: income });
        }
        
        sortedExpenses.forEach(([name, data]) => {
            if (data.value > 0) {
                const targetIndex = nodeMap.get(name)!;
                links.push({ source: cashFlowNodeIndex, target: targetIndex, value: data.value });
            }
        });

        if (surplus > 0) {
            const surplusIndex = nodeMap.get('Surplus')!;
            links.push({ source: cashFlowNodeIndex, target: surplusIndex, value: surplus });
        }
        
        // Add values to nodes for display
        nodes.forEach((node) => {
            // FIX: Explicitly type 'l' in reduce callback to fix 'unknown' type error.
            const totalOut = links.filter(l => l.source === nodeMap.get(node.name)).reduce((sum, l: Omit<SankeyLink, 'color'>) => sum + l.value, 0);
            // FIX: Explicitly type 'l' in reduce callback to fix 'unknown' type error.
            const totalIn = links.filter(l => l.target === nodeMap.get(node.name)).reduce((sum, l: Omit<SankeyLink, 'color'>) => sum + l.value, 0);
            node.value = Math.max(totalIn, totalOut);
        });
        
        // Handle deficit case where income is less than expenses
        if (income > 0 && surplus < 0) {
            nodes[cashFlowNodeIndex].color = deficitColor;
        }

        return { nodes, links };
    }, [income, expenses, transactions, expenseCategories]);

    if (income === 0 && expenses === 0) {
        return <div className="flex items-center justify-center h-full text-light-text-secondary dark:text-dark-text-secondary">No projected cash flow data for this period.</div>;
    }

    return (
        <div style={{ width: '100%', height: 400 }}>
            <ResponsiveContainer>
                <Sankey
                    data={sankeyData}
                    node={<SankeyNode />}
                    link={<CustomLink nodes={sankeyData.nodes} />}
                    nodePadding={50}
                    margin={{ top: 20, right: 120, bottom: 20, left: 120 }}
                    iterations={32}
                >
                    <Tooltip />
                </Sankey>
            </ResponsiveContainer>
        </div>
    );
};

export default CashflowSankey;