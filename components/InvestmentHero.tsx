
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
        <Card className="relative overflow-hidden border-none !p-0 bg-gray-950 text-white min-h-[280px]">
            {/* Background Decorative Elements */}
            <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-br from-primary-600/20 to-transparent blur-3xl -z-1" />
            <div className="absolute bottom-0 left-0 w-1/3 h-1/2 bg-gradient-to-tr from-green-500/10 to-transparent blur-3xl -z-1" />
            
            <div className="relative z-10 flex flex-col md:flex-row h-full">
                {/* Primary Column */}
                <div className="flex-1 p-8 flex flex-col justify-between border-b md:border-b-0 md:border-r border-white/5">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
                            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400">Total Portfolio Value</span>
                        </div>
                        <h2 className="text-5xl md:text-6xl font-black tracking-tighter mb-4 privacy-blur">
                            {formatCurrency(totalValue, 'EUR')}
                        </h2>
                        
                        <div className="flex items-center gap-4">
                            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black ${isPositive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                <span className="material-symbols-outlined text-sm font-bold">
                                    {isPositive ? 'north_east' : 'south_east'}
                                </span>
                                {isPositive ? '+' : ''}{totalGainLossPercent.toFixed(2)}%
                            </div>
                            <div className="text-sm font-medium text-gray-400 font-mono privacy-blur">
                                {isPositive ? '+' : ''}{formatCurrency(totalGainLoss, 'EUR')} total gain
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-8 border-t border-white/5 grid grid-cols-2 gap-8">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Inception Date</p>
                            <p className="text-sm font-mono text-gray-300">JAN 2024</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Risk Profile</p>
                            <p className="text-sm font-bold text-primary-400">MODERATE-HIGH</p>
                        </div>
                    </div>
                </div>

                {/* Secondary Column (Metrics Grid) */}
                <div className="w-full md:w-80 bg-white/5 flex flex-col">
                    <div className="flex-1 p-8 flex flex-col justify-center border-b border-white/5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Invested Capital</p>
                        <p className="text-2xl font-bold text-white font-mono privacy-blur">{formatCurrency(investedCapital, 'EUR')}</p>
                    </div>
                    
                    <div className="flex-1 p-8 flex flex-col justify-center border-b border-white/5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Active Positions</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-3xl font-black text-white">{activeHoldingsCount}</p>
                            <p className="text-[10px] font-bold text-gray-500 uppercase">Diversified assets</p>
                        </div>
                    </div>

                    <div className="p-8 group hover:bg-white/10 transition-colors cursor-pointer">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-primary-400 mb-1">Portfolio Alpha</p>
                                <p className="text-xl font-black text-white">+4.2%</p>
                            </div>
                            <span className="material-symbols-outlined text-gray-600 group-hover:text-primary-400 transition-colors">arrow_forward</span>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Visual bottom accent */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-500 via-green-500 to-primary-500 opacity-50" />
        </Card>
    );
};

export default InvestmentHero;
