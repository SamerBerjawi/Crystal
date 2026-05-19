import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Account, Transaction, LoanPaymentOverrides } from '../types';
import { formatCurrency, generateAmortizationSchedule, parseLocalDate } from '../utils';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { motion } from 'motion/react';

interface PropertyAccountViewProps {
  account: Account;
  accounts: Account[];
  transactions: Transaction[];
  loanPaymentOverrides: LoanPaymentOverrides;
  onAddTransaction: () => void;
  onUpdateValuation?: () => void;
  onBack: () => void;
  onSyncLinkedAccount?: () => void;
  isLinkedToEnableBanking?: boolean;
  onCloseAsset?: () => void;
  onRevertClosure?: () => void;
  showBalanceAdjustments?: boolean;
}

const MetricTile = ({ label, value, icon, subValue, trend, colorClass = 'primary' }: { 
    label: string; 
    value: string; 
    icon: string; 
    subValue?: string;
    trend?: { val: string; positive: boolean };
    colorClass?: 'primary' | 'emerald' | 'rose' | 'amber' | 'blue' | 'indigo' | 'orange' | 'purple';
}) => {
    const colors = {
        primary: 'bg-primary-500/10 text-primary-500',
        emerald: 'bg-emerald-500/10 text-emerald-500',
        rose: 'bg-rose-500/10 text-rose-500',
        amber: 'bg-amber-500/10 text-amber-500',
        blue: 'bg-blue-500/10 text-blue-500',
        indigo: 'bg-indigo-500/10 text-indigo-500',
        orange: 'bg-orange-500/10 text-orange-500',
        purple: 'bg-purple-500/10 text-purple-500',
    };

    return (
        <div className="bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 rounded-3xl p-6 relative overflow-hidden group hover:shadow-xl hover:shadow-black/5 dark:hover:shadow-white/5 transition-all duration-500 h-full">
            <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full blur-3xl opacity-20 transition-opacity group-hover:opacity-40 ${colors[colorClass].split(' ')[1].replace('text-', 'bg-')}`}></div>
            <div className="flex justify-between items-start relative z-10">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${colors[colorClass]}`}>
                    <span className="material-symbols-outlined text-2xl">{icon}</span>
                </div>
                {trend && (
                    <div className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg ${trend.positive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                         <span className="material-symbols-outlined text-[10px]">{trend.positive ? 'trending_up' : 'trending_down'}</span>
                         {trend.val}
                    </div>
                )}
            </div>
            <div className="mt-6 relative z-10">
                <p className="text-[10px] font-semibold tracking-wider text-light-text-secondary/70 dark:text-dark-text-secondary/90 mb-1">{label}</p>
                <h4 className="text-2xl font-semibold text-light-text dark:text-dark-text tracking-tight tabular-nums">{value}</h4>
                {subValue && <p className="text-[10px] font-medium text-light-text-secondary/50 dark:text-dark-text-secondary/70 mt-1 tracking-tight">{subValue}</p>}
            </div>
        </div>
    );
};

const PropertyAccountView: React.FC<PropertyAccountViewProps> = ({
  account,
  accounts,
  transactions,
  loanPaymentOverrides,
  onAddTransaction,
  onUpdateValuation,
  onBack,
  onSyncLinkedAccount,
  isLinkedToEnableBanking,
  onCloseAsset,
  onRevertClosure,
  showBalanceAdjustments = true,
}) => {
  const navigate = useNavigate();
  const isClosed = account.status === 'closed';
  const linkedLoan = accounts.find(a => a.id === account.linkedLoanId) || accounts.find(a => a.type === 'Loan' && a.linkedAssetId === account.id);
  
  const currentMarketValue = account.balance;
  let outstandingLoanBalance = 0;
  let principalPaidViaLoan = 0;

  if (linkedLoan) {
      const filteredTxs = transactions.filter(tx => showBalanceAdjustments || !tx.isBalanceAdjustment);
      if (linkedLoan.principalAmount && linkedLoan.duration && linkedLoan.loanStartDate && linkedLoan.interestRate !== undefined) {
          const overrides = loanPaymentOverrides[linkedLoan.id] || {};
          const schedule = generateAmortizationSchedule(linkedLoan, filteredTxs, overrides);
          const totalScheduledPrincipal = schedule.reduce((sum, p) => sum + p.principal, 0);
          const totalPaidPrincipal = schedule.reduce((acc, p) => p.status === 'Paid' ? acc + p.principal : acc, 0);
          outstandingLoanBalance = Math.max(0, totalScheduledPrincipal - totalPaidPrincipal);
          principalPaidViaLoan = totalPaidPrincipal;
      } else {
          outstandingLoanBalance = Math.abs(linkedLoan.balance);
          principalPaidViaLoan = filteredTxs
            .filter(tx => tx.accountId === linkedLoan.id && tx.type === 'income')
            .reduce((sum, tx) => sum + (tx.principalAmount || 0), 0);
      }
  }

  const purchasePrice = linkedLoan 
    ? ((linkedLoan.principalAmount || 0) + (linkedLoan.downPayment || 0)) 
    : (account.purchasePrice || 0);

  const marketEquity = currentMarketValue - outstandingLoanBalance;
  const investedEquity = linkedLoan ? (principalPaidViaLoan + (linkedLoan.downPayment || 0)) : (account.principalOwned || 0);
  const appreciation = currentMarketValue - (purchasePrice || 0);
  const appreciationPercent = purchasePrice ? (appreciation / purchasePrice) * 100 : 0;
  const ownershipPercent = currentMarketValue > 0 ? (marketEquity / currentMarketValue) * 100 : 0;

  const features = [
      account.hasBasement ? { label: 'Basement', icon: 'foundation' } : null,
      account.hasAttic ? { label: 'Attic', icon: 'roofing' } : null,
      account.hasGarden ? { label: `Garden ${account.gardenSize ? `(${account.gardenSize} m²)` : ''}`, icon: 'yard' } : null,
      account.hasTerrace ? { label: `Terrace ${account.terraceSize ? `(${account.terraceSize} m²)` : ''}`, icon: 'deck' } : null,
      account.indoorParkingSpaces ? { label: `Indoor (${account.indoorParkingSpaces})`, icon: 'garage' } : null,
      account.outdoorParkingSpaces ? { label: `Outdoor (${account.outdoorParkingSpaces})`, icon: 'local_parking' } : null,
  ].filter(Boolean) as { label: string; icon: string }[];

  return (
    <div className="space-y-10 animate-fade-in-up pb-10">
      {/* Dynamic Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative">
          <div className="flex items-center gap-6">
              <button 
                  onClick={onBack}
                  className="w-12 h-12 rounded-2xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 flex items-center justify-center hover:bg-primary-500 hover:text-white transition-all shadow-sm group active:scale-95"
              >
                  <span className="material-symbols-outlined transition-transform group-hover:-translate-x-1">arrow_back</span>
              </button>
              <div>
                  <div className="flex items-center gap-2 mb-1">
                       <span className="text-[10px] font-semibold text-primary-500 bg-primary-500/10 px-2 py-0.5 rounded-lg border border-primary-500/20">Real estate asset</span>
                       <span className="text-[10px] font-bold text-light-text-secondary/30 dark:text-dark-text-secondary/30">•</span>
                       <span className="text-[10px] font-bold text-light-text-secondary/60 dark:text-dark-text-secondary/80">{account.address || 'Global Portfolio'}</span>
                  </div>
                  <h1 className="text-4xl font-semibold text-light-text dark:text-dark-text tracking-tighter flex items-center gap-3">
                      {account.name}
                      <span className="material-symbols-outlined text-light-text-secondary/40 dark:text-dark-text-secondary/40 font-light">home</span>
                  </h1>
              </div>
          </div>
          
          <div className="flex gap-3 w-full md:w-auto">
              {!isClosed && (
                <button onClick={onUpdateValuation || onAddTransaction} className={`${BTN_PRIMARY_STYLE} rounded-2xl !px-6 h-12 shadow-lg shadow-primary-500/20`}>
                    <span className="material-symbols-outlined text-lg mr-2">add</span>
                    Value Update
                </button>
              )}
              {isClosed && onRevertClosure && (
                    <button onClick={onRevertClosure} className={`${BTN_SECONDARY_STYLE} rounded-2xl !px-6 h-12 shadow-sm border-black/5 dark:border-white/5 bg-white dark:bg-dark-card`}>
                        <span className="material-symbols-outlined text-lg mr-2">history</span>
                        Reopen
                    </button>
              )}
              {!isClosed && onCloseAsset && (
                    <button onClick={onCloseAsset} className="h-12 px-6 rounded-2xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white font-semibold text-[10px] tracking-wider transition-all shadow-lg shadow-rose-500/5 flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">sell</span>
                        Record Sale
                    </button>
              )}
          </div>
      </header>

      {/* Closure Banner */}
      {isClosed && account.closureDetails && (
        <motion.div 
           initial={{ opacity: 0, scale: 0.95 }}
           animate={{ opacity: 1, scale: 1 }}
           className="bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800/40 rounded-[2.5rem] p-10 flex flex-col md:flex-row items-center gap-10"
        >
            <div className="w-24 h-24 rounded-full bg-rose-500 flex items-center justify-center text-white shadow-xl shadow-rose-500/20">
                <span className="material-symbols-outlined text-5xl">lock</span>
            </div>
            <div className="flex-grow text-center md:text-left">
                <h3 className="text-2xl font-semibold text-rose-900 dark:text-rose-100 mb-2">Portfolio exit logged</h3>
                <p className="text-sm text-rose-700/80 dark:text-rose-300/60 font-medium leading-relaxed max-w-2xl">
                    Finalized as <span className="text-rose-900 dark:text-white font-semibold px-2 py-0.5 rounded-lg bg-rose-200/50 dark:bg-rose-500/20">{account.closureDetails.closureType}</span> on {parseLocalDate(account.closureDetails.date).toLocaleDateString(undefined, { dateStyle: 'long' })}. 
                    Net internal value at exit was {formatCurrency(account.closureDetails.value || 0, account.currency)}.
                </p>
                {account.closureDetails.notes && (
                    <p className="mt-4 text-xs text-rose-800/60 dark:text-rose-200/40 font-medium border-l-2 border-rose-200 dark:border-rose-800/40 pl-4">{account.closureDetails.notes}</p>
                )}
            </div>
        </motion.div>
      )}

      {/* Hero Financial Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
           {/* Immersive Property Card */}
           <div className="lg:col-span-5 xl:col-span-4">
               <motion.div 
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   className="relative h-full min-h-[440px] rounded-[3rem] bg-slate-950 text-white p-10 shadow-2xl overflow-hidden flex flex-col justify-between border border-white/10 group"
               >
                   <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent"></div>
                   <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                   
                   <div className="relative z-10">
                        <div className="flex justify-between items-start mb-12">
                             <span className="px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-[10px] font-bold tracking-wider border border-white/10">
                                 {account.propertyType || 'Residential'}
                             </span>
                             <div className="text-right">
                                  <p className="text-[10px] font-bold tracking-wider text-slate-400 mb-1">Equity ownership</p>
                                  <p className="text-3xl font-semibold tabular-nums text-emerald-400">{ownershipPercent.toFixed(0)}%</p>
                             </div>
                        </div>
                        
                        <p className="text-[10px] font-black tracking-wider text-slate-400 mb-2">Estimated market value</p>
                        <h2 className="text-5xl font-black tracking-tight tabular-nums drop-shadow-sm mb-12">
                            {formatCurrency(currentMarketValue, account.currency)}
                        </h2>
                        
                        <div className="space-y-6">
                            <div className="relative h-2.5 w-full bg-white/10 rounded-full overflow-hidden flex border border-white/5">
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${ownershipPercent}%` }}
                                    className="h-full bg-emerald-500 relative"
                                />
                                <div className="absolute inset-y-0 right-0 w-px bg-white/40 h-full"></div>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-semibold tracking-wider">
                                <div className="flex items-center gap-2">
                                     <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                     <span className="text-slate-400">Net equity:</span>
                                     <span className="text-white font-semibold">{formatCurrency(marketEquity, account.currency)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                     <div className="w-2 h-2 rounded-full bg-slate-600"></div>
                                     <span className="text-slate-400">Total debt:</span>
                                     <span className="text-white font-semibold">{formatCurrency(outstandingLoanBalance, account.currency)}</span>
                                </div>
                            </div>
                        </div>
                   </div>

                   <div className="relative z-10 pt-10 border-t border-white/5 grid grid-cols-2 gap-8">
                       <div>
                           <p className="text-[10px] tracking-wider text-slate-500 font-bold mb-1">Purchase cost</p>
                           <p className="font-semibold text-xl text-white tabular-nums">{formatCurrency(purchasePrice, account.currency)}</p>
                       </div>
                       <div>
                           <p className="text-[10px] tracking-wider text-slate-500 font-bold mb-1">Internal IRR</p>
                           <p className="font-semibold text-xl text-emerald-400 tabular-nums">+{appreciationPercent.toFixed(1)}%</p>
                       </div>
                   </div>
               </motion.div>
           </div>

           {/* Performance Analytics */}
           <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <MetricTile 
                        label="Portfolio Gains" 
                        value={formatCurrency(appreciation, account.currency)} 
                        icon="trending_up" 
                        colorClass="emerald"
                        subValue="Unrealized appreciation"
                        trend={{ val: `${appreciationPercent.toFixed(1)}%`, positive: appreciation >= 0 }}
                    />
                    <MetricTile 
                        label="Invested Capital" 
                        value={formatCurrency(investedEquity, account.currency)} 
                        icon="savings" 
                        colorClass="blue"
                        subValue="Total principal owned"
                    />
                    <MetricTile 
                        label="Property Tax" 
                        value={formatCurrency(account.propertyTaxAmount || 0, account.currency)} 
                        icon="gavel" 
                        colorClass="amber"
                        subValue="Annual recurring levy"
                    />
                </div>

                {/* Valuation Trajectory */}
                <div className="bg-white dark:bg-dark-card rounded-[2.5rem] border border-black/5 dark:border-white/5 p-8 flex-grow flex flex-col group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                         <span className="material-symbols-outlined text-8xl">architecture</span>
                    </div>
                    <div className="flex justify-between items-center mb-10 relative z-10">
                        <div>
                             <h3 className="text-xl font-semibold text-light-text dark:text-dark-text tracking-tight">Valuation trend</h3>
                             <p className="text-xs font-medium text-light-text-secondary/60 dark:text-dark-text-secondary/80 mt-1 tracking-wider">Asset appreciation over time</p>
                        </div>
                    </div>
                    
                    <div className="flex-grow w-full h-full min-h-[220px] relative z-10">
                        {account.priceHistory && account.priceHistory.length > 1 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={account.priceHistory}>
                                    <defs>
                                        <linearGradient id="propValGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366F1" stopOpacity={0.1}/>
                                            <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.06} />
                                    <XAxis 
                                        dataKey="date" 
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.3, fontWeight: 700 }}
                                    />
                                    <YAxis 
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.3, fontWeight: 700 }}
                                        tickFormatter={(val) => `€${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`}
                                    />
                                     <Tooltip 
                                         contentStyle={{ 
                                            backgroundColor: 'var(--light-card)', 
                                            backdropFilter: 'blur(15px) saturate(180%) brightness(105%)', 
                                            WebkitBackdropFilter: 'blur(15px) saturate(180%) brightness(105%)',
                                            border: 'none', 
                                            borderRadius: '24px', 
                                            boxShadow: 'inset 2px 2px 1px rgba(255, 255, 255, 0.05), inset -2px -2px 2px rgba(0, 0, 0, 0.05), 0 8px 32px rgba(0, 0, 0, 0.1)' 
                                        }}
                                         itemStyle={{ fontSize: '12px', fontWeight: '900', color: '#6366F1' }}
                                         labelStyle={{ fontSize: '10px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.1em' }}
                                         formatter={(val: number) => [`${formatCurrency(val, account.currency)}`, 'Value']}
                                     />
                                    <Area type="monotone" dataKey="price" stroke="#6366F1" strokeWidth={4} fill="url(#propValGradient)" animationDuration={1500} />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-black/5 dark:bg-white/5 rounded-[2rem] border-2 border-dashed border-black/5 dark:border-white/5">
                                <span className="material-symbols-outlined text-4xl text-light-text-secondary/20 mb-4 font-light">insights</span>
                                <p className="text-sm font-bold text-light-text-secondary/60 tracking-wider">Awaiting valuation points</p>
                            </div>
                        )}
                    </div>
                </div>
           </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
           {/* Detailed Specs */}
           <div className="xl:col-span-8 space-y-8">
                <div className="bg-white dark:bg-dark-card rounded-[2.5rem] border border-black/5 dark:border-white/5 p-10 group">
                    <h3 className="text-[11px] font-black tracking-widest text-light-text-secondary/30 dark:text-dark-text-secondary/40 mb-8 uppercase">Property architecture</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
                        <div className="space-y-1">
                             <p className="text-[10px] font-semibold tracking-wider text-light-text-secondary/40 dark:text-dark-text-secondary/50">Lot size</p>
                             <p className="text-xl font-semibold text-light-text dark:text-dark-text tracking-tight">{account.propertySize ? `${account.propertySize} m²` : '—'}</p>
                        </div>
                        <div className="space-y-1">
                             <p className="text-[10px] font-semibold tracking-wider text-light-text-secondary/40 dark:text-dark-text-secondary/50">Year built</p>
                             <p className="text-xl font-semibold text-light-text dark:text-dark-text tracking-tight">{account.yearBuilt || '—'}</p>
                        </div>
                        <div className="space-y-1">
                             <p className="text-[10px] font-semibold tracking-wider text-light-text-secondary/40 dark:text-dark-text-secondary/50">Floors</p>
                             <p className="text-xl font-semibold text-light-text dark:text-dark-text tracking-tight">{account.floors || '—'}</p>
                        </div>
                        <div className="space-y-1">
                             <p className="text-[10px] font-semibold tracking-wider text-light-text-secondary/40 dark:text-dark-text-secondary/50">Bed/bath</p>
                             <p className="text-xl font-semibold text-light-text dark:text-dark-text tracking-tight">{account.bedrooms || '0'}/{account.bathrooms || '0'}</p>
                        </div>
                    </div>
                    
                    {features.length > 0 && (
                        <div className="mt-12 flex flex-wrap gap-4 pt-10 border-t border-black/5 dark:border-white/5">
                            {features.map((f, i) => (
                                <div key={i} className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white dark:bg-dark-fill border border-black/5 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow group/chip">
                                    <span className="material-symbols-outlined text-primary-500 font-light group-hover/chip:scale-110 transition-transform">{f.icon}</span>
                                    <span className="text-xs font-bold tracking-wider text-light-text dark:text-dark-text">{f.label}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
           </div>

           {/* Debt & Cashflow Column */}
           <div className="xl:col-span-4 space-y-8">
                <div className="bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 rounded-[2.5rem] p-8 group overflow-hidden">
                     <h3 className="text-[11px] font-black tracking-widest text-light-text-secondary/30 dark:text-dark-text-secondary/40 mb-8 uppercase">Infrastructure Configuration</h3>
                     <div className="space-y-6">
                         <div className="flex justify-between items-end border-b border-black/5 dark:border-white/5 pb-4 last:border-0 last:pb-0">
                              <span className="text-[9px] font-black tracking-widest text-light-text-secondary/40 dark:text-dark-text-secondary/50 uppercase">Asset Genesis</span>
                              <span className="text-xs font-black text-light-text dark:text-dark-text tracking-tight">{account.purchaseDate ? parseLocalDate(account.purchaseDate).toLocaleDateString() : '—'}</span>
                         </div>
                         <div className="flex justify-between items-end border-b border-black/5 dark:border-white/5 pb-4 last:border-0 last:pb-0">
                              <span className="text-[9px] font-black tracking-widest text-light-text-secondary/40 dark:text-dark-text-secondary/50 uppercase">Settlement Engine</span>
                              <span className="text-xs font-black text-light-text dark:text-dark-text tracking-tight">{account.currency}</span>
                         </div>
                         <div className="flex justify-between items-end border-b border-black/5 dark:border-white/5 pb-4 last:border-0 last:pb-0">
                              <span className="text-[9px] font-black tracking-widest text-light-text-secondary/40 dark:text-dark-text-secondary/50 uppercase">Logical Serial</span>
                              <span className="text-xs font-black text-light-text dark:text-dark-text tracking-tight font-mono opacity-60 break-all">{account.id.slice(0, 8)}</span>
                         </div>
                     </div>
                </div>
                {linkedLoan ? (
                    <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        className="bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 rounded-[2.5rem] p-8 relative overflow-hidden group border-l-8 border-l-rose-500 h-full"
                    >
                         <div className="flex justify-between items-start mb-8">
                             <div>
                                 <h3 className="text-xl font-semibold text-light-text dark:text-dark-text tracking-tight">Active mortgage</h3>
                                 <button onClick={() => navigate(`/accounts/${linkedLoan.id}`)} className="text-[10px] font-semibold tracking-wider text-primary-500 hover:text-primary-600 transition-colors mt-2 flex items-center gap-2">
                                     Loan profile <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                                 </button>
                             </div>
                             <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                                 <span className="material-symbols-outlined text-2xl">request_quote</span>
                             </div>
                         </div>
                         <div className="space-y-6">
                              <div className="flex justify-between items-center">
                                  <span className="text-[10px] font-semibold tracking-wider text-light-text-secondary/50 dark:text-dark-text-secondary/70">Principal owed</span>
                                  <span className="font-semibold text-rose-500 tabular-nums">{formatCurrency(outstandingLoanBalance, linkedLoan.currency)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                  <span className="text-[10px] font-semibold tracking-wider text-light-text-secondary/50 dark:text-dark-text-secondary/70">Rate</span>
                                  <span className="font-semibold text-light-text dark:text-dark-text tabular-nums">{linkedLoan.interestRate}% APR</span>
                              </div>
                              <div className="flex justify-between items-center pt-6 border-t border-black/5 dark:border-white/5">
                                  <span className="text-[10px] font-semibold tracking-wider text-light-text-secondary/50 dark:text-dark-text-secondary/70">Monthly impact</span>
                                  <span className="font-semibold text-light-text dark:text-dark-text tabular-nums">{linkedLoan.monthlyPayment ? formatCurrency(linkedLoan.monthlyPayment, linkedLoan.currency) : 'N/A'}</span>
                              </div>
                         </div>
                    </motion.div>
                ) : (
                    <div className="h-full min-h-[200px] rounded-[2.5rem] border-4 border-dashed border-black/5 dark:border-white/5 flex flex-col items-center justify-center text-center p-8 grayscale opacity-40">
                         <span className="material-symbols-outlined text-4xl mb-2 font-light">account_balance</span>
                         <p className="text-[10px] font-bold tracking-wider text-light-text-secondary/40 dark:text-dark-text-secondary/50">No Mortgage Link</p>
                    </div>
                )}
           </div>
      </div>
    </div>
  );
};

export default PropertyAccountView;
