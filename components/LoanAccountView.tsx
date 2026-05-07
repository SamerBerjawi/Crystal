
import React, { useMemo } from 'react';
import { Account, Transaction, ScheduledPayment } from '../types';
import { formatCurrency, generateAmortizationSchedule, parseLocalDate } from '../utils';
import Card from './Card';
import MortgageAmortizationChart from './MortgageAmortizationChart';
import PaymentPlanTable from './PaymentPlanTable';
import PageHeader from './PageHeader';
import BankCard from './BankCard';
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
}

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
}) => {
  const isLending = account.type === 'Lending';

  const loanDetails = useMemo(() => {
    const schedule = generateAmortizationSchedule(account, transactions, loanPaymentOverrides);
    
    const totalScheduledPrincipal = schedule.reduce((sum, p) => sum + p.principal, 0);
    const totalScheduledInterest = schedule.reduce((sum, p) => sum + p.interest, 0);

    const totalPaidPrincipal = schedule.reduce((acc, p) => p.status === 'Paid' ? acc + p.principal : acc, 0);
    const totalPaidInterest = schedule.reduce((acc, p) => p.status === 'Paid' ? acc + p.interest : acc, 0);
    
    // Outstanding values
    const outstandingPrincipal = Math.max(0, totalScheduledPrincipal - totalPaidPrincipal);
    const outstandingInterest = Math.max(0, totalScheduledInterest - totalPaidInterest);
    const totalOutstanding = outstandingPrincipal + outstandingInterest;

    const linkedAsset = accounts.find(a => a.id === account.linkedAssetId) || accounts.find(a => a.type === 'Property' && a.linkedLoanId === account.id);
    
    let ltv = 0;
    let marketEquity = 0;
    
    if (linkedAsset) {
      const assetValue = linkedAsset.balance;
      const loanBalance = outstandingPrincipal;
      if (assetValue > 0) ltv = (loanBalance / assetValue) * 100;
      marketEquity = assetValue - loanBalance;
    }
    
    // Invested Equity: Principal Paid + Down Payment
    const equity = totalPaidPrincipal + (account.downPayment || 0);
    
    const lastPayment = schedule[schedule.length - 1];
    const payoffDate = lastPayment ? parseLocalDate(lastPayment.date) : null;
    
    const progress = account.totalAmount && account.totalAmount > 0 
        ? Math.min(100, (totalPaidPrincipal / account.totalAmount) * 100)
        : 0;
    
    const daysRemaining = payoffDate ? Math.ceil((payoffDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0;

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
        payoffDate,
        progress,
        daysRemaining
    };
  }, [account, transactions, loanPaymentOverrides, accounts]);

  return (
    <div className="space-y-8 pb-12">
      <PageHeader 
        markerIcon={isLending ? "payments" : "account_balance"}
        markerLabel={`Structured ${account.type} • ${account.interestRate}% APR • ${account.currency}`}
        title={account.name}
        subtitle="Debt structure analysis and automated amortization schedule tracking."
        className="mb-8"
        actions={
          <div className="flex items-center gap-2">
            <button 
                onClick={onBack} 
                className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-all group"
                title="Back to All Accounts"
            >
                <span className="material-symbols-outlined text-xl">arrow_back</span>
            </button>
             <button onClick={onAddTransaction} className="flex items-center gap-2 px-5 py-2.5 bg-rose-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-rose-500/25 hover:bg-rose-600 transition-all">
                <span className="material-symbols-outlined text-lg font-black">payments</span>
                <span className="hidden sm:inline">Log Payment</span>
             </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Visuals and Main Stats */}
        <div className="lg:col-span-4 space-y-8">
            <BankCard 
                name={account.name}
                balance={account.balance}
                currency={account.currency}
                last4={account.last4}
                institution={account.financialInstitution}
                type={account.type}
                color={isLending ? 'emerald' : 'rose'}
            />

            <div className="grid grid-cols-1 gap-4">
                <div className="p-6 rounded-[2.5rem] bg-white dark:bg-white/[0.03] border border-black/5 dark:border-white/5 shadow-sm relative overflow-hidden group">
                     <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-700">
                         <span className="material-symbols-outlined text-6xl">published_with_changes</span>
                     </div>
                     <p className="text-[10px] font-black uppercase tracking-widest text-light-text-secondary mb-3 opacity-60 leading-none">Amortization Stage</p>
                     <div className="flex items-end justify-between mb-4">
                        <span className="text-3xl font-black tracking-tighter text-light-text dark:text-dark-text leading-none">{loanDetails.progress.toFixed(1)}%</span>
                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded-lg">Principal Focus</span>
                     </div>
                     <div className="h-2 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                         <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${loanDetails.progress}%` }}
                            transition={{ duration: 1, ease: 'easeOut' }}
                            className={`h-full ${isLending ? 'bg-emerald-500' : 'bg-rose-500'} rounded-full`}
                         />
                     </div>
                </div>

                <div className="p-6 rounded-[2.5rem] bg-white dark:bg-white/[0.03] border border-black/5 dark:border-white/5 shadow-sm relative overflow-hidden group">
                     <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-700">
                         <span className="material-symbols-outlined text-6xl">event_upcoming</span>
                     </div>
                     <p className="text-[10px] font-black uppercase tracking-widest text-light-text-secondary mb-3 opacity-60 leading-none">Maturation Window</p>
                     <div className="space-y-1">
                        <h3 className="text-2xl font-black tracking-tighter text-light-text dark:text-dark-text leading-none">
                            {loanDetails.payoffDate ? loanDetails.payoffDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric', day: 'numeric' }) : 'Indefinite'}
                        </h3>
                        <p className="text-[10px] font-bold text-light-text-secondary uppercase tracking-widest opacity-60">Estimated {loanDetails.daysRemaining} days until payoff</p>
                     </div>
                </div>
            </div>
        </div>

        {/* Center/Right: Ledger and Forecast */}
        <div className="lg:col-span-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-8 !rounded-[2.5rem]">
                    <div className="flex items-center gap-4 mb-8 pb-4 border-b border-black/5 dark:border-white/5">
                        <div className="w-12 h-12 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center">
                            <span className="material-symbols-outlined text-primary-500">analytics</span>
                        </div>
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-light-text dark:text-dark-text leading-none mb-1">Exposure Analysis</h3>
                            <p className="text-[10px] font-bold text-light-text-secondary opacity-60 uppercase tracking-widest">Global Debt Metrics</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="flex justify-between items-center group/metric">
                             <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-light-text-secondary opacity-20 group-hover/metric:opacity-100 transition-opacity" />
                                <span className="text-xs font-black uppercase tracking-widest text-light-text-secondary">Outstanding Principal</span>
                             </div>
                             <span className="text-lg font-black text-light-text dark:text-dark-text tracking-tight privacy-blur">{formatCurrency(loanDetails.outstandingPrincipal, account.currency)}</span>
                        </div>
                        <div className="flex justify-between items-center group/metric">
                             <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-rose-500 opacity-20 group-hover/metric:opacity-100 transition-opacity" />
                                <span className="text-xs font-black uppercase tracking-widest text-light-text-secondary">Scheduled Interest</span>
                             </div>
                             <span className="text-lg font-black text-rose-500 tracking-tight privacy-blur">{formatCurrency(loanDetails.outstandingInterest, account.currency)}</span>
                        </div>
                         <div className="flex justify-between items-center group/metric pt-4 border-t border-black/5 dark:border-white/5">
                             <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-primary-500 opacity-20 group-hover/metric:opacity-100 transition-opacity" />
                                <span className="text-xs font-black uppercase tracking-widest font-black text-light-text dark:text-dark-text">Total Payoff Value</span>
                             </div>
                             <span className="text-2xl font-black text-primary-500 tracking-tightest privacy-blur">{formatCurrency(loanDetails.totalOutstanding, account.currency)}</span>
                        </div>
                    </div>
                </Card>

                <Card className="p-8 !rounded-[2.5rem] bg-black text-white dark:bg-white dark:text-black shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none">
                        <span className="material-symbols-outlined text-8xl">balance</span>
                    </div>
                    <div className="relative z-10 flex flex-col h-full justify-between">
                         <div>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-xl bg-white/20 dark:bg-black/10 flex items-center justify-center backdrop-blur-md">
                                    <span className="material-symbols-outlined text-white dark:text-black">home</span>
                                </div>
                                <h3 className="text-xs font-black uppercase tracking-widest opacity-60">Leverage Analysis</h3>
                            </div>
                            
                            <div className="space-y-4">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Loan to Value (LTV)</p>
                                    <span className={`text-5xl font-black tracking-tightest ${loanDetails.ltv > 80 ? 'text-rose-500' : 'text-emerald-500'}`}>{loanDetails.ltv.toFixed(1)}%</span>
                                </div>
                                
                                {loanDetails.linkedAsset && (
                                    <div className="pt-4 flex items-center justify-between border-t border-white/10 dark:border-black/5">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black uppercase tracking-widest opacity-40 leading-none">Collateral</span>
                                            <button 
                                                onClick={() => setViewingAccountId(loanDetails.linkedAsset!.id)} 
                                                className="text-xs font-black tracking-tight hover:underline text-left leading-tight"
                                            >
                                                {loanDetails.linkedAsset.name}
                                            </button>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[9px] font-black uppercase tracking-widest opacity-40 leading-none">Net Equity</span>
                                            <p className="text-sm font-black text-emerald-400 privacy-blur leading-none">{formatCurrency(loanDetails.marketEquity, account.currency)}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                         </div>
                    </div>
                </Card>
            </div>

            <div className="bg-white dark:bg-dark-card rounded-[2.5rem] p-8 border border-black/5 dark:border-white/5 shadow-sm">
                 <div className="flex items-center gap-4 mb-8">
                    <div className="w-10 h-10 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center">
                        <span className="material-symbols-outlined">timeline</span>
                    </div>
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-light-text dark:text-dark-text leading-none mb-1">Amortization Forecast</h3>
                        <p className="text-[10px] font-bold text-light-text-secondary opacity-60 uppercase tracking-widest leading-none">Principal vs Interest Decay Curve</p>
                    </div>
                 </div>
                 <div className="h-[280px]">
                    <MortgageAmortizationChart schedule={loanDetails.schedule} currency={account.currency} accountType={account.type} />
                 </div>
            </div>
        </div>
      </div>

      <div className="pt-8">
          <div className="flex items-center gap-4 mb-8">
            <h3 className="text-2xl font-black tracking-tighter text-light-text dark:text-dark-text leading-none">Payment Schedule</h3>
            <div className="flex-1 h-px bg-black/5 dark:bg-white/5" />
          </div>
          <PaymentPlanTable 
            account={account} 
            transactions={transactions} 
            onMakePayment={onMakePayment} 
            overrides={loanPaymentOverrides || {}} 
            onOverridesChange={onOverridesChange} 
          />
      </div>
    </div>
  );
};

export default LoanAccountView;
