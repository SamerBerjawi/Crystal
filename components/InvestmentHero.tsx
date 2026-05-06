
import React from 'react';
import { formatCurrency } from '../utils';
import Card from './Card';

interface InvestmentHeroProps {
    totalValue: number;
    totalGainLoss: number;
    totalGainLossPercent: number;
    investedCapital: number;
    activeHoldingsCount: number;
}

const InvestmentHero: React.FC<InvestmentHeroProps> = ({
    totalValue,
    totalGainLoss,
    totalGainLossPercent,
    investedCapital,
    activeHoldingsCount
}) => {
    const isPositive = totalGainLoss >= 0;

    return (
        <Card className="relative overflow-hidden border-none !p-0 bg-[#0A0A0B] text-white min-h-[300px] shadow-2xl">
            {/* Background Decorative Elements - Mesh Gradient Style */}
            <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[120%] bg-primary-600/20 blur-[120px] rounded-full -z-1 opacity-60" />
            <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[100%] bg-emerald-500/10 blur-[100px] rounded-full -z-1 opacity-40" />
            <div className="absolute top-[20%] left-[30%] w-[30%] h-[60%] bg-blue-500/10 blur-[80px] rounded-full -z-1 opacity-30" />
            
            {/* Subtle Grid Pattern Overlay */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                 style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>

            <div className="relative z-10 flex flex-col lg:flex-row h-full">
                {/* Primary Column - The "Big Number" */}
                <div className="flex-1 p-8 lg:p-10 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 border border-white/10 shadow-inner">
                                <span className="material-symbols-outlined text-primary-400 text-lg">account_balance_wallet</span>
                            </div>
                            <span className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-400/80">Net Investment Value</span>
                        </div>

                        <div className="space-y-1 mb-8">
                            <h2 className="text-6xl lg:text-7xl font-black tracking-tighter privacy-blur leading-none">
                                {formatCurrency(totalValue, 'EUR')}
                            </h2>
                            <div className="flex flex-wrap items-center gap-4 mt-4">
                                <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-black border ${isPositive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'} shadow-lg shadow-black/20`}>
                                    <span className="material-symbols-outlined text-base">
                                        {isPositive ? 'trending_up' : 'trending_down'}
                                    </span>
                                    {isPositive ? '+' : ''}{totalGainLossPercent.toFixed(2)}%
                                </div>
                                <div className="text-sm font-bold text-gray-300 flex items-center gap-2 privacy-blur">
                                    <span className="opacity-40">Profit/Loss:</span>
                                    <span className={isPositive ? 'text-emerald-400' : 'text-rose-400'}>
                                        {isPositive ? '+' : ''}{formatCurrency(totalGainLoss, 'EUR')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-8 mt-4 pt-10 border-t border-white/[0.06]">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Portfolio Yield</p>
                            <p className="text-xl font-black text-white">+8.4% <span className="text-[10px] text-gray-500 font-bold ml-1">APY</span></p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Risk Exposure</p>
                            <div className="flex items-center gap-2">
                                <span className="text-xl font-black text-primary-400 uppercase">Moderate</span>
                                <div className="flex gap-0.5">
                                    <div className="w-1 h-3 rounded-full bg-primary-400"></div>
                                    <div className="w-1 h-3 rounded-full bg-primary-400"></div>
                                    <div className="w-1 h-3 rounded-full bg-white/10"></div>
                                </div>
                            </div>
                        </div>
                        <div className="hidden lg:block">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Next Rebalance</p>
                            <p className="text-xl font-black text-white">MAY 24 <span className="text-[10px] text-gray-500 font-bold ml-1">2026</span></p>
                        </div>
                    </div>
                </div>

                {/* Secondary Column - Breakdown Cards */}
                <div className="w-full lg:w-[380px] bg-white/[0.03] backdrop-blur-md border-l border-white/[0.06] p-8 lg:p-10 flex flex-col gap-8">
                    <div className="space-y-6">
                        <div className="group">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3 group-hover:text-primary-400 transition-colors">Capital Allocation</p>
                            <div className="space-y-2">
                                <div className="flex justify-between items-end">
                                    <p className="text-2xl font-black text-white privacy-blur">{formatCurrency(investedCapital, 'EUR')}</p>
                                    <p className="text-xs font-bold text-gray-500">{( (investedCapital / totalValue) * 100).toFixed(0)}% Utilized</p>
                                </div>
                                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-primary-500/80 rounded-full" style={{ width: `${Math.min(100, (investedCapital / totalValue) * 100)}%` }}></div>
                                </div>
                            </div>
                        </div>

                        <div className="p-5 rounded-2xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-all cursor-pointer">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Active Positions</p>
                                    <p className="text-2xl font-black text-white">{activeHoldingsCount}</p>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400">
                                    <span className="material-symbols-outlined">pie_chart</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <div className="flex -space-x-3">
                                {[1,2,3,4].map(i => (
                                    <div key={i} className="w-8 h-8 rounded-full border-2 border-[#0A0A0B] bg-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-400 shadow-xl overflow-hidden">
                                        {i === 1 ? <img src="https://logo.clearbit.com/apple.com" className="w-full h-full p-1.5 opacity-80" /> : 
                                         i === 2 ? <img src="https://logo.clearbit.com/nvidia.com" className="w-full h-full p-1.5 opacity-80" /> :
                                         i === 3 ? <img src="https://logo.clearbit.com/microsoft.com" className="w-full h-full p-1.5 opacity-80" /> : 
                                         <span className="material-symbols-outlined text-xs">add</span>}
                                    </div>
                                ))}
                            </div>
                            <span className="text-[10px] font-black text-primary-400 uppercase tracking-widest hover:underline cursor-pointer">Analytics Report</span>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Glossy highlight at the top */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
        </Card>
    );
};

export default InvestmentHero;
