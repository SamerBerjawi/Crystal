
import React, { useMemo } from 'react';
import { Account, Transaction, ScheduledPayment } from '../types';
import { formatCurrency, generateAmortizationSchedule, parseLocalDate } from '../utils';
import MortgageAmortizationChart from './MortgageAmortizationChart';
import PaymentPlanTable from './PaymentPlanTable';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import { motion } from 'motion/react';

interface LoanAccountViewProps {
  account: Account;
  transactions: Transaction[];
  accounts: Account[];
  loanPaymentOverrides: Record<number, Partial<ScheduledPayment>>;
  onOverridesChange: (overrides: Record<number, Partial<ScheduledPayment>>) => void;
  onMakePayment: (payment: ScheduledPayment, description: string) => void;
  onAddTransaction: () => void;
  setViewingAccountId: (id: string | null) => void;
  onBack: () => void;
  onSyncLinkedAccount?: () => void;
  isLinkedToEnableBanking?: boolean;
  showBalanceAdjustments?: boolean;
}

const MetricTile = ({ label, value, icon, subValue, colorClass = 'primary' }: { 
    label: string; 
    value: string; 
    icon?: string; 
    subValue?: string;
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
        <div className="bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 rounded-[2rem] p-6 relative overflow-hidden group hover:shadow-xl hover:shadow-black/5 dark:hover:shadow-white/5 transition-all duration-500 h-full">
            <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full blur-3xl opacity-20 transition-opacity group-hover:opacity-40 ${colors[colorClass].split(' ')[1].replace('text-', 'bg-')}`}></div>
            <div className="flex justify-between items-start relative z-10">
                {icon ? (
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${colors[colorClass]}`}>
                        <span className="material-symbols-outlined text-xl">{icon}</span>
                    </div>
                ) : <div />}
            </div>
            <div className="mt-4 relative z-10">
                <p className="text-[10px] font-semibold tracking-wider text-light-text-secondary/70 dark:text-dark-text-secondary mb-1">{label}</p>
                <h4 className="text-xl font-semibold text-light-text dark:text-dark-text tracking-tight tabular-nums">{value}</h4>
                {subValue && <p className="text-[10px] font-medium text-light-text-secondary/50 dark:text-dark-text-secondary/70 mt-1 tracking-tight">{subValue}</p>}
            </div>
        </div>
    );
};

const LoanAccountView: React.FC<LoanAccountViewProps> = ({
  account,
  transactions,
  accounts,
  loanPaymentOverrides,
  onOverridesChange,
  onMakePayment,
  onAddTransaction,
  setViewingAccountId,
  onBack,
  onSyncLinkedAccount,
  isLinkedToEnableBanking,
  showBalanceAdjustments = true,
}) => {
  const isLending = account.type === 'Lending';

  const loanDetails = useMemo(() => {
    const filteredTxs = transactions.filter(tx => showBalanceAdjustments || !tx.isBalanceAdjustment);
    const schedule = generateAmortizationSchedule(account, filteredTxs, loanPaymentOverrides);
    
    const totalScheduledPrincipal = schedule.reduce((sum, p) => sum + p.principal, 0);
    const totalScheduledInterest = schedule.reduce((sum, p) => sum + p.interest, 0);

    const totalPaidPrincipal = schedule.reduce((acc, p) => p.status === 'Paid' ? acc + p.principal : acc, 0);
    const totalPaidInterest = schedule.reduce((acc, p) => p.status === 'Paid' ? acc + p.interest : acc, 0);
    
    const outstandingPrincipal = Math.max(0, totalScheduledPrincipal - totalPaidPrincipal);
    const outstandingInterest = Math.max(0, totalScheduledInterest - totalPaidInterest);
    const totalOutstanding = outstandingPrincipal + outstandingInterest;

    const linkedAsset = accounts.find(a => a.id === account.linkedAssetId) || accounts.find(a => a.type === 'Property' && a.linkedLoanId === account.id);
    
    let ltv = 0;
    let marketEquity = 0;
    
    if (linkedAsset) {
      const assetValue = linkedAsset.balance;
      if (assetValue > 0) ltv = (outstandingPrincipal / assetValue) * 100;
      marketEquity = assetValue - outstandingPrincipal;
    }
    
    const equity = totalPaidPrincipal + (account.downPayment || 0);
    const lastPayment = schedule[schedule.length - 1];
    const payoffDate = lastPayment ? parseLocalDate(lastPayment.date) : null;
    
    return { 
        schedule, 
        totalPaidPrincipal, 
        totalPaidInterest, 
        outstandingPrincipal,
        outstandingInterest,
        totalOutstanding,
        linkedAsset, 
        ltv, 
        equity, 
        marketEquity, 
        payoffDate 
    };
  }, [account, transactions, loanPaymentOverrides, accounts, showBalanceAdjustments]);

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
                       <span className={`text-[10px] font-semibold tracking-wider ${isLending ? 'text-emerald-500 bg-emerald-500/10' : 'text-rose-500 bg-rose-500/10'} px-2 py-0.5 rounded-lg border border-current/10`}>
                           {isLending ? 'Lending asset' : 'Liability engine'}
                       </span>
                       <span className="text-[10px] font-medium text-light-text-secondary/30 dark:text-dark-text-secondary/30">•</span>
                       <span className="text-[10px] font-medium tracking-wider text-light-text-secondary/60 dark:text-dark-text-secondary/80">{account.interestRate}% APR</span>
                  </div>
                  <h1 className="text-4xl font-semibold text-light-text dark:text-dark-text tracking-tighter flex items-center gap-3">
                      {account.name}
                      <span className={`material-symbols-outlined font-light ${isLending ? 'text-emerald-500/60 dark:text-emerald-400/80' : 'text-rose-500/60 dark:text-rose-400/80'}`}>
                          {isLending ? 'real_estate_agent' : 'contract'}
                      </span>
                  </h1>
              </div>
          </div>
          
          <div className="flex gap-3 w-full md:w-auto">
              {isLinkedToEnableBanking && onSyncLinkedAccount && (
                  <button onClick={onSyncLinkedAccount} className={`${BTN_SECONDARY_STYLE} rounded-2xl !px-6 h-12 shadow-sm border-black/5 dark:border-white/5 bg-white dark:bg-dark-card`}>Sync</button>
              )}
              <button onClick={onAddTransaction} className={`${BTN_PRIMARY_STYLE} rounded-2xl !px-6 h-12 shadow-lg shadow-primary-500/20`}>
                  Add Payment
              </button>
          </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
           {/* Loan Hero Card */}
           <div className="lg:col-span-5 xl:col-span-4">
               <motion.div 
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   className={`relative h-full min-h-[440px] rounded-[3rem] ${isLending ? 'bg-emerald-950 shadow-emerald-500/10' : 'bg-slate-950 shadow-rose-500/10'} text-white p-10 shadow-2xl overflow-hidden flex flex-col justify-between border border-white/10 group`}
               >
                   <div className={`absolute inset-0 bg-gradient-to-br ${isLending ? 'from-emerald-500/20' : 'from-rose-500/20'} to-transparent`}></div>
                   <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                   
                   <div className="relative z-10">
                        <div className="flex justify-between items-start mb-12">
                             <span className="px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-[10px] font-semibold tracking-wider border border-white/10">
                                 {account.duration} month term
                             </span>
                             <div className="text-right">
                                  <p className="text-[10px] font-semibold tracking-widest text-slate-400 mb-1">Payoff progress</p>
                                  <p className={`text-3xl font-semibold tabular-nums ${isLending ? 'text-emerald-400' : 'text-rose-400'}`}>
                                      {((loanDetails.totalPaidPrincipal / (account.totalAmount || 1)) * 100).toFixed(0)}%
                                  </p>
                             </div>
                        </div>
                        
                        <p className="text-[10px] font-semibold tracking-wider text-slate-400 mb-2">
                            {isLending ? 'Remaining receivable' : 'Total payoff balance'}
                        </p>
                        <h2 className="text-5xl font-black tracking-tight tabular-nums drop-shadow-sm mb-12">
                            {formatCurrency(loanDetails.totalOutstanding, account.currency)}
                        </h2>
                        
                        <div className="space-y-6">
                            <div className="relative h-2.5 w-full bg-white/10 rounded-full overflow-hidden flex border border-white/5">
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(loanDetails.totalPaidPrincipal / (account.totalAmount || 1)) * 100}%` }}
                                    className={`h-full ${isLending ? 'bg-emerald-500' : 'bg-rose-500'} relative`}
                                />
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-semibold tracking-wider">
                                <div className="flex items-center gap-2">
                                     <div className={`w-2 h-2 rounded-full ${isLending ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                                     <span className="text-slate-400">Principal:</span>
                                     <span className="text-white font-semibold">{formatCurrency(loanDetails.outstandingPrincipal, account.currency)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                     <div className="w-2 h-2 rounded-full bg-slate-600"></div>
                                     <span className="text-slate-400">Future interest:</span>
                                     <span className="text-white font-semibold">{formatCurrency(loanDetails.outstandingInterest, account.currency)}</span>
                                </div>
                            </div>
                        </div>
                   </div>

                   <div className="relative z-10 pt-10 border-t border-white/5 grid grid-cols-2 gap-8">
                       <div>
                           <p className="text-[10px] tracking-wider text-slate-500 font-semibold mb-1">Monthly cost</p>
                           <p className="font-semibold text-xl text-white tabular-nums">{formatCurrency(account.monthlyPayment || 0, account.currency)}</p>
                       </div>
                       <div>
                           <p className="text-[10px] tracking-wider text-slate-500 font-semibold mb-1">Target end</p>
                           <p className="font-semibold text-xl text-white tabular-nums">{loanDetails.payoffDate ? loanDetails.payoffDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : 'N/A'}</p>
                       </div>
                   </div>
               </motion.div>
           </div>

           {/* Metrics Grid & Chart */}
           <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <MetricTile 
                        label="Principal Paid" 
                        value={formatCurrency(loanDetails.totalPaidPrincipal, account.currency)} 
                        icon="payments" 
                        colorClass="emerald"
                        subValue="Equity generated"
                    />
                    <MetricTile 
                        label="Service Fees" 
                        value={formatCurrency(loanDetails.totalPaidInterest, account.currency)} 
                        icon="receipt_long" 
                        colorClass="rose"
                        subValue="Total interest cost"
                    />
                    <MetricTile 
                        label="LTV Exposure" 
                        value={`${loanDetails.ltv.toFixed(1)}%`} 
                        icon="show_chart" 
                        colorClass={loanDetails.ltv > 80 ? 'rose' : 'emerald'}
                        subValue="Debt to asset ratio"
                    />
                     <MetricTile 
                        label="Net Equity" 
                        value={formatCurrency(loanDetails.equity, account.currency)} 
                        icon="savings" 
                        colorClass="blue"
                        subValue="Downpayment + Paid"
                    />
                </div>

                {/* Amortization Curve */}
                <div className="bg-white dark:bg-dark-card rounded-[2.5rem] border border-black/5 dark:border-white/5 p-8 flex-grow flex flex-col group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                         <span className="material-symbols-outlined text-8xl">waterfall_chart</span>
                    </div>
                    <div className="flex justify-between items-center mb-6 relative z-10">
                        <div>
                             <h3 className="text-xl font-semibold text-light-text dark:text-dark-text tracking-tight">Amortization trajectory</h3>
                             <p className="text-xs font-medium text-light-text-secondary/60 dark:text-dark-text-secondary/80 mt-1 tracking-wider">Principal vs interest distribution</p>
                        </div>
                    </div>
                    <div className="flex-grow w-full h-[300px] relative z-10">
                         <MortgageAmortizationChart 
                            schedule={loanDetails.schedule} 
                            currency={account.currency} 
                            accountType={account.type} 
                         />
                    </div>
                </div>
           </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
           {/* Schedule Table */}
           <div className="xl:col-span-8">
                <div className="bg-white dark:bg-dark-card rounded-[2.5rem] border border-black/5 dark:border-white/5 overflow-hidden shadow-sm">
                    <PaymentPlanTable 
                        account={account} 
                        transactions={transactions} 
                        onMakePayment={onMakePayment} 
                        overrides={loanPaymentOverrides || {}} 
                        onOverridesChange={onOverridesChange} 
                        showBalanceAdjustments={showBalanceAdjustments}
                    />
                </div>
           </div>

           {/* Linked Details Column */}
           <div className="xl:col-span-4 space-y-8">
                {loanDetails.linkedAsset && (
                    <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        className="bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 rounded-[2.5rem] p-8 relative overflow-hidden group border-l-8 border-l-primary-500"
                    >
                         <div className="flex justify-between items-start mb-8">
                             <div>
                                 <h3 className="text-xl font-semibold text-light-text dark:text-dark-text tracking-tight">Collateral asset</h3>
                                 <button onClick={() => setViewingAccountId(loanDetails.linkedAsset!.id)} className="text-[10px] font-semibold tracking-wider text-primary-500 hover:text-primary-600 transition-colors mt-2 flex items-center gap-2">
                                     Asset portfolio <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                                 </button>
                             </div>
                             <div className="w-12 h-12 rounded-2xl bg-primary-500/10 text-primary-500 flex items-center justify-center">
                                 <span className="material-symbols-outlined text-2xl">home</span>
                             </div>
                         </div>
                         <div className="space-y-6">
                              <div className="flex justify-between items-center">
                                  <span className="text-[10px] font-semibold tracking-wider text-light-text-secondary/40 dark:text-dark-text-secondary/50">Market value</span>
                                  <span className="font-semibold text-light-text dark:text-dark-text tabular-nums">{formatCurrency(loanDetails.linkedAsset.balance, loanDetails.linkedAsset.currency)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                  <span className="text-[10px] font-semibold tracking-wider text-light-text-secondary/40 dark:text-dark-text-secondary/50">Market equity</span>
                                  <span className={`font-semibold tabular-nums ${loanDetails.marketEquity >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                      {formatCurrency(loanDetails.marketEquity, account.currency)}
                                  </span>
                              </div>
                              <div className="pt-6 border-t border-black/5 dark:border-white/5">
                                   <p className="text-[10px] font-semibold tracking-wider text-light-text-secondary/40 dark:text-dark-text-secondary/50 mb-2">Original purchase</p>
                                   <p className="text-xl font-semibold text-light-text dark:text-dark-text">{formatCurrency(account.totalAmount || 0, account.currency)}</p>
                              </div>
                         </div>
                    </motion.div>
                )}

                <div className="bg-slate-50 dark:bg-white/5 rounded-[2.5rem] p-8 border border-black/5 dark:border-white/5">
                     <h3 className="text-[10px] font-semibold tracking-wider text-light-text-secondary/60 dark:text-dark-text-secondary/80 mb-6">Loan configuration</h3>
                     <div className="space-y-6">
                         <div className="flex justify-between">
                             <span className="text-[10px] font-semibold tracking-wider text-light-text-secondary/40 dark:text-dark-text-secondary/50">Term length</span>
                             <span className="text-xs font-semibold text-light-text dark:text-dark-text">{account.duration} mo</span>
                         </div>
                         <div className="flex justify-between">
                             <span className="text-[10px] font-semibold tracking-wider text-light-text-secondary/40 dark:text-dark-text-secondary/50">Started</span>
                             <span className="text-xs font-semibold text-light-text dark:text-dark-text">{account.loanStartDate ? parseLocalDate(account.loanStartDate).toLocaleDateString() : 'N/A'}</span>
                         </div>
                         <div className="flex justify-between">
                             <span className="text-[10px] font-semibold tracking-wider text-light-text-secondary/40 dark:text-dark-text-secondary/50">Down payment</span>
                             <span className="text-xs font-semibold text-light-text dark:text-dark-text">{formatCurrency(account.downPayment || 0, account.currency)}</span>
                         </div>
                     </div>
                </div>
           </div>
      </div>
    </div>
  );
};

export default LoanAccountView;

