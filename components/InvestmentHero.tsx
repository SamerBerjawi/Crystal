import React from 'react';
import { formatCurrency } from '../utils';
import Icon from './ui/Icon';
import { BentoGrid, BentoCard } from './ui/bento-grid';

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
        <BentoGrid className="grid-cols-1 lg:grid-cols-3 auto-rows-auto gap-4">
            {/* Primary Column - Net Investment Value & Core Indicators */}
            <BentoCard 
                className="lg:col-span-2 !p-0 min-h-[300px] bg-[#0A0A0B] text-white border-white/[0.08] shadow-2xl relative overflow-hidden"
                background={
                    <>
                        <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[120%] bg-primary-600/20 blur-[120px] rounded-full pointer-events-none opacity-60" />
                        <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[100%] bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none opacity-40" />
                        <div className="absolute top-[20%] left-[30%] w-[30%] h-[60%] bg-blue-500/10 blur-[80px] rounded-full pointer-events-none opacity-30" />
                        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                             style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
                        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    </>
                }
            >
                <div className="relative z-10 p-6 sm:p-8 lg:p-10 flex flex-col justify-between h-full">
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 border border-white/10 shadow-inner">
                                <Icon name="account_balance_wallet" className="text-primary-400 text-lg" />
                            </div>
                            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400/80">Net Investment Value</span>
                        </div>

                        <div className="space-y-1 mb-8">
                            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tighter privacy-blur leading-none">
                                {formatCurrency(totalValue, 'EUR')}
                            </h2>
                            <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-4">
                                <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold border ${isPositive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'} shadow-lg shadow-black/20`}>
                                    <Icon name={isPositive ? 'trending_up' : 'trending_down'} className="text-base" />
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

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 pt-6 border-t border-white/[0.08]">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Portfolio Yield</p>
                            <p className="text-xl font-bold text-white">+8.4% <span className="text-xs text-gray-400 font-semibold ml-1">APY</span></p>
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Risk Exposure</p>
                            <div className="flex items-center gap-2">
                                <span className="text-xl font-bold text-primary-400">Moderate</span>
                                <div className="flex gap-0.5">
                                    <div className="w-1 h-3 rounded-full bg-primary-400"></div>
                                    <div className="w-1 h-3 rounded-full bg-primary-400"></div>
                                    <div className="w-1 h-3 rounded-full bg-white/10"></div>
                                </div>
                            </div>
                        </div>
                        <div className="hidden sm:block">
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Next Rebalance</p>
                            <p className="text-xl font-bold text-white">MAY 24 <span className="text-xs text-gray-400 font-semibold ml-1">2026</span></p>
                        </div>
                    </div>
                </div>
            </BentoCard>

            {/* Secondary Column - Breakdown & Capital Allocation */}
            <BentoCard 
                className="!col-span-1 !p-0 min-h-[300px] bg-[#0A0A0B] text-white border-white/[0.08] shadow-2xl relative overflow-hidden"
                background={
                    <>
                        <div className="absolute top-0 right-0 w-[80%] h-[80%] bg-primary-600/10 blur-[100px] rounded-full pointer-events-none opacity-50" />
                        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    </>
                }
            >
                <div className="relative z-10 p-6 sm:p-8 flex flex-col justify-between h-full gap-6">
                    <div className="space-y-6">
                        <div className="group">
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3 group-hover:text-primary-400 transition-colors">Capital Allocation</p>
                            <div className="space-y-2">
                                <div className="flex justify-between items-end">
                                    <p className="text-2xl font-bold text-white privacy-blur">{formatCurrency(investedCapital, 'EUR')}</p>
                                    <p className="text-xs font-medium text-gray-400">{((investedCapital / (totalValue || 1)) * 100).toFixed(0)}% Utilized</p>
                                </div>
                                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-primary-500/80 rounded-full" style={{ width: `${Math.min(100, (investedCapital / (totalValue || 1)) * 100)}%` }}></div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-all cursor-pointer">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Active Positions</p>
                                    <p className="text-2xl font-bold text-white">{activeHoldingsCount}</p>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400">
                                    <Icon name="pie_chart" />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                            <div className="flex -space-x-2.5">
                                {[1,2,3,4].map(i => (
                                    <div key={i} className="w-8 h-8 rounded-full border-2 border-[#0A0A0B] bg-gray-800 flex items-center justify-center text-2xs font-bold text-gray-400 shadow-xl overflow-hidden">
                                        {i === 1 ? <img src="https://logo.clearbit.com/apple.com" className="w-full h-full p-1.5 opacity-80" alt="Apple" /> : 
                                         i === 2 ? <img src="https://logo.clearbit.com/nvidia.com" className="w-full h-full p-1.5 opacity-80" alt="Nvidia" /> :
                                         i === 3 ? <img src="https://logo.clearbit.com/microsoft.com" className="w-full h-full p-1.5 opacity-80" alt="Microsoft" /> : 
                                         <Icon name="add" className="text-xs" />}
                                    </div>
                                ))}
                            </div>
                            <span className="text-xs font-bold text-primary-400 uppercase tracking-wider hover:underline cursor-pointer">Analytics Report</span>
                        </div>
                    </div>
                </div>
            </BentoCard>
        </BentoGrid>
    );
};

export default InvestmentHero;
