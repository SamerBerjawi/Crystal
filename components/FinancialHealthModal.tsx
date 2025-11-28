
import React from 'react';
import Modal from './Modal';
import { FinancialHealthScore, formatCurrency } from '../utils';
import { BTN_PRIMARY_STYLE } from '../constants';

interface FinancialHealthModalProps {
    isOpen: boolean;
    onClose: () => void;
    healthScore: FinancialHealthScore;
}

const ProgressBar: React.FC<{ score: number; max: number; colorClass: string }> = ({ score, max, colorClass }) => (
    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mt-2">
        <div className={`h-2.5 rounded-full ${colorClass}`} style={{ width: `${(score / max) * 100}%` }}></div>
    </div>
);

const DetailCard: React.FC<{ 
    title: string; 
    score: number; 
    max: number; 
    status: string; 
    valueDisplay: string; 
    advice: string;
    icon: string;
}> = ({ title, score, max, status, valueDisplay, advice, icon }) => {
    let colorClass = 'bg-red-500';
    if (score >= max * 0.8) colorClass = 'bg-green-500';
    else if (score >= max * 0.5) colorClass = 'bg-blue-500';
    else if (score >= max * 0.3) colorClass = 'bg-yellow-500';

    return (
        <div className="p-4 bg-light-bg dark:bg-dark-bg rounded-xl border border-black/5 dark:border-white/5">
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary-500">{icon}</span>
                    <h4 className="font-semibold text-light-text dark:text-dark-text">{title}</h4>
                </div>
                <span className="text-xs font-bold bg-white dark:bg-white/10 px-2 py-1 rounded border border-black/10 dark:border-white/10">{status}</span>
            </div>
            
            <div className="flex justify-between text-sm mt-3 mb-1">
                 <span className="text-light-text-secondary dark:text-dark-text-secondary">{valueDisplay}</span>
                 <span className="font-bold">{score} / {max} pts</span>
            </div>
            <ProgressBar score={score} max={max} colorClass={colorClass} />
            
            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-3 italic">
                💡 {advice}
            </p>
        </div>
    );
};

const FinancialHealthModal: React.FC<FinancialHealthModalProps> = ({ isOpen, onClose, healthScore }) => {
    const { breakdown, score, rank } = healthScore;
    
    if (!isOpen) return null;

    return (
        <Modal onClose={onClose} title="Financial Health Breakdown">
            <div className="text-center mb-6">
                <div className="inline-block p-4 rounded-full bg-primary-100 dark:bg-primary-900/30 mb-2">
                    <span className="text-4xl font-extrabold text-primary-600 dark:text-primary-400">{score}</span>
                </div>
                <h3 className="text-xl font-bold">{rank}</h3>
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Your score is calculated based on the 4 pillars of personal finance.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DetailCard 
                    title="Liquidity" 
                    icon="savings"
                    score={breakdown.liquidity.score} 
                    max={breakdown.liquidity.max}
                    status={breakdown.liquidity.status}
                    valueDisplay={`${breakdown.liquidity.value.toFixed(1)} months runway`}
                    advice={breakdown.liquidity.value < 3 ? "Aim to save at least 3 months of expenses in liquid cash." : "Great job keeping a healthy emergency fund!"}
                />
                <DetailCard 
                    title="Solvency" 
                    icon="account_balance"
                    score={breakdown.solvency.score} 
                    max={breakdown.solvency.max}
                    status={breakdown.solvency.status}
                    valueDisplay={`${breakdown.solvency.value.toFixed(1)}% Debt Ratio`}
                    advice={breakdown.solvency.value > 30 ? "Try to pay down high-interest debt to lower your ratio." : "Your debt levels are sustainable."}
                />
                <DetailCard 
                    title="Savings Rate" 
                    icon="trending_up"
                    score={breakdown.savings.score} 
                    max={breakdown.savings.max}
                    status={breakdown.savings.status}
                    valueDisplay={`${breakdown.savings.value.toFixed(1)}% Savings Rate`}
                    advice={breakdown.savings.value < 20 ? "Look for ways to cut discretionary spending to boost savings." : "You are saving aggressively. Keep it up!"}
                />
                <DetailCard 
                    title="Discipline" 
                    icon="rule"
                    score={breakdown.budget.score} 
                    max={breakdown.budget.max}
                    status={breakdown.budget.status}
                    valueDisplay={`${breakdown.budget.value} Categories Over Budget`}
                    advice={breakdown.budget.value > 0 ? "Review your budget limits for categories where you consistently overspend." : "You are sticking to your budgets perfectly."}
                />
            </div>
            
            <div className="mt-6 flex justify-end">
                <button onClick={onClose} className={BTN_PRIMARY_STYLE}>Close</button>
            </div>
        </Modal>
    );
};

export default FinancialHealthModal;
