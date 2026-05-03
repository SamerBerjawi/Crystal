import React, { useMemo } from 'react';
import { Account, MileageLog, Transaction, LoanPaymentOverrides } from '../types';
import { formatCurrency, parseLocalDate, generateAmortizationSchedule } from '../utils';
import Card from './Card';
import VehicleMileageChart from './VehicleMileageChart';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';

interface VehicleAccountViewProps {
  account: Account;
  accounts: Account[];
  transactions: Transaction[];
  loanPaymentOverrides: LoanPaymentOverrides;
  onAddTransaction: () => void;
  onUpdateValuation?: () => void;
  onAddLog: () => void;
  onEditLog: (log: MileageLog) => void;
  onDeleteLog: (id: string) => void;
  onBack: () => void;
  setViewingAccountId: (id: string | null) => void;
  onSyncLinkedAccount?: () => void;
  isLinkedToEnableBanking?: boolean;
  onCloseAsset?: () => void;
  onRevertClosure?: () => void;
}

const VehicleAccountView: React.FC<VehicleAccountViewProps> = ({
  account,
  accounts,
  transactions,
  loanPaymentOverrides,
  onAddTransaction,
  onUpdateValuation,
  onAddLog,
  onEditLog,
  onDeleteLog,
  onBack,
  setViewingAccountId,
  onSyncLinkedAccount,
  isLinkedToEnableBanking,
  onCloseAsset,
  onRevertClosure,
}) => {
  const isLeased = account.ownership === 'Leased';
  const isClosed = account.status === 'closed';

  const linkedLoan = accounts.find(a => a.type === 'Loan' && a.linkedAssetId === account.id);

  // Calculate Outstanding Loan Balance if linked
  let outstandingLoanBalance = 0;
  if (linkedLoan) {
      if (linkedLoan.principalAmount && linkedLoan.duration && linkedLoan.loanStartDate && linkedLoan.interestRate !== undefined) {
          const overrides = loanPaymentOverrides[linkedLoan.id] || {};
          const schedule = generateAmortizationSchedule(linkedLoan, transactions, overrides);
          const totalScheduledPrincipal = schedule.reduce((sum, p) => sum + p.principal, 0);
          const totalPaidPrincipal = schedule.reduce((acc, p) => p.status === 'Paid' ? acc + p.principal : acc, 0);
          outstandingLoanBalance = Math.max(0, totalScheduledPrincipal - totalPaidPrincipal);
      } else {
          outstandingLoanBalance = Math.abs(linkedLoan.balance);
      }
  }

  const sortedMileageLogs = useMemo(() => {
    return [...(account.mileageLogs || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [account.mileageLogs]);

  const sortedMileageLogsDesc = useMemo(() => {
    return [...sortedMileageLogs].reverse();
  }, [sortedMileageLogs]);

  const currentMileage = useMemo(() => {
    if (sortedMileageLogs.length === 0) return 0;
    return sortedMileageLogs[sortedMileageLogs.length - 1].reading;
  }, [sortedMileageLogs]);

  const leaseStats = useMemo(() => {
    if (account.ownership !== 'Leased' || !account.leaseStartDate || !account.leaseEndDate) return null;
    const start = parseLocalDate(account.leaseStartDate);
    const end = parseLocalDate(account.leaseEndDate);
    const now = new Date();
    const totalDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    const elapsedDays = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    const progress = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
    
    let mileageStatus: 'Over Budget' | 'Under Budget' | 'On Track' = 'On Track';
    let mileageDiff = 0;
    let projectedMileage = 0;
    let totalAllowance = 0;
    
    if (account.annualMileageAllowance) {
        const dailyAllowance = account.annualMileageAllowance / 365;
        const expectedMileage = elapsedDays * dailyAllowance;
        const years = totalDays / 365;
        totalAllowance = account.annualMileageAllowance * years;

        mileageDiff = currentMileage - expectedMileage;
        projectedMileage = elapsedDays > 0 ? (currentMileage / elapsedDays) * totalDays : 0;
        
        if (mileageDiff > 1000) mileageStatus = 'Over Budget';
        else if (mileageDiff < -1000) mileageStatus = 'Under Budget';
    }
    
    return { start, end, progress, mileageStatus, mileageDiff, daysRemaining: Math.max(0, Math.ceil(totalDays - elapsedDays)), projectedMileage, totalAllowance };
  }, [account, currentMileage]);

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      {/* Top Bar Actions */}
      <motion.header 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-2"
      >
         <button onClick={onBack} className="group flex items-center gap-2 text-light-text-secondary dark:text-dark-text-secondary hover:text-primary-500 transition-colors">
            <span className="material-symbols-outlined transition-transform group-hover:-translate-x-1">arrow_back</span>
            <span className="text-sm font-bold uppercase tracking-widest">Back to Accounts</span>
          </button>
           <div className="flex items-center gap-2">
             {isLinkedToEnableBanking && onSyncLinkedAccount && (
               <button onClick={onSyncLinkedAccount} className={BTN_SECONDARY_STYLE}>
                 <span className="material-symbols-outlined text-sm">sync</span>
                 Sync
               </button>
             )}
             {!isClosed && (
               <button onClick={onUpdateValuation || onAddTransaction} className={BTN_SECONDARY_STYLE}>
                  <span className="material-symbols-outlined text-sm">edit</span>
                  Update Value
               </button>
             )}
             {!isClosed && (
               <button onClick={onAddTransaction} className={BTN_PRIMARY_STYLE}>
                  <span className="material-symbols-outlined text-sm">add</span>
                  Add Transaction
               </button>
             )}
             {isClosed && onRevertClosure && (
               <button onClick={onRevertClosure} className={BTN_SECONDARY_STYLE}>
                  <span className="material-symbols-outlined text-sm">settings_backup_restore</span>
                  Revert Closure
               </button>
             )}
             {!isClosed && onCloseAsset && (
                <button onClick={onCloseAsset} className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-red-500/5">
                   <span className="material-symbols-outlined text-sm">no_accounts</span>
                   {isLeased ? 'Return Vehicle' : 'Sell Vehicle'}
                </button>
             )}
           </div>
      </motion.header>

      {/* Hero Section - Immersive Design */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="relative bg-white dark:bg-dark-card rounded-[2.5rem] p-8 lg:p-12 shadow-2xl border border-black/5 dark:border-white/5 overflow-hidden"
      >
           {/* Dynamic Background Element */}
           <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 dark:opacity-[0.03] pointer-events-none">
                 <span className="material-symbols-outlined text-[20rem] translate-x-1/4 -translate-y-1/4">directions_car</span>
           </div>
           
           <div className="relative z-10 flex flex-col lg:flex-row items-center gap-12">
                {/* Vehicle Image / Icon Branding */}
                <div className="flex-shrink-0">
                    <div className="relative group">
                         {/* Circle Glow */}
                         <div className="absolute inset-0 bg-primary-500/20 blur-3xl rounded-full scale-150 group-hover:scale-[1.7] transition-transform duration-1000 opacity-50"></div>
                         
                         {account.imageUrl ? (
                             <div className="relative w-56 h-56 lg:w-64 lg:h-64 flex items-center justify-center p-4">
                                 <img 
                                    src={account.imageUrl} 
                                    alt="Vehicle" 
                                    className="max-w-full max-h-full object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-500" 
                                    loading="lazy" 
                                    decoding="async" 
                                 />
                             </div>
                         ) : (
                             <div className="relative w-48 h-48 lg:w-56 lg:h-56 rounded-[3rem] flex items-center justify-center bg-gradient-to-br from-primary-400 via-primary-500 to-indigo-600 text-white shadow-2xl shadow-primary-500/20">
                                 <span className="material-symbols-outlined text-[6rem]">directions_car</span>
                             </div>
                         )}
                    </div>
                </div>

                {/* Primary Info */}
                <div className="flex-grow flex flex-col items-center lg:items-start">
                    <div className="flex items-center gap-3 mb-4 flex-wrap justify-center lg:justify-start">
                        {isClosed ? (
                          <span className="px-4 py-1.5 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm flex items-center gap-1.5 border border-black/5 dark:border-white/5">
                              <span className="material-symbols-outlined text-sm">lock</span>
                              Account Closed
                          </span>
                        ) : (
                          <>
                            {account.licensePlate && (
                                <div className="flex items-center rounded-lg bg-gray-100 dark:bg-white/5 border border-black/10 dark:border-white/10 overflow-hidden shadow-sm">
                                    {account.registrationCountryCode && (
                                        <div className="px-2 py-1 bg-blue-600 text-white text-[10px] font-black flex items-center justify-center h-full">
                                            {account.registrationCountryCode}
                                        </div>
                                    )}
                                    <span className="px-3 py-1 text-sm font-mono font-bold tracking-wider text-gray-800 dark:text-gray-200">
                                        {account.licensePlate}
                                    </span>
                                </div>
                            )}
                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-sm ${account.ownership === 'Leased' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'}`}>
                                {account.ownership}
                            </span>
                          </>
                        )}
                        <span className="px-4 py-1.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-1.5 shadow-sm">
                            <span className="material-symbols-outlined text-sm">local_gas_station</span>
                            {account.fuelType}
                        </span>
                    </div>

                    <h1 className="text-4xl lg:text-6xl font-black text-light-text dark:text-dark-text mb-2 tracking-tight">
                        {account.name}
                    </h1>
                    <p className="text-xl lg:text-2xl text-light-text-secondary dark:text-dark-text-secondary font-medium opacity-80 mb-8">
                        {account.year} {account.make} {account.model}
                    </p>

                     {/* Stats Ribbon */}
                    <div className="grid grid-cols-2 gap-8 lg:gap-16 w-full lg:w-auto">
                        <div className="flex flex-col items-center lg:items-start border-l-4 border-primary-500 pl-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary mb-1">
                              {isClosed ? 'Value at Closure' : 'Current Value'}
                            </p>
                            <p className="text-3xl font-black text-light-text dark:text-dark-text privacy-blur">
                              {formatCurrency(isClosed ? (account.closureDetails?.value || 0) : account.balance, account.currency)}
                            </p>
                        </div>
                        <div className="flex flex-col items-center lg:items-start border-l-4 border-indigo-500 pl-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary mb-1">
                              {isClosed ? 'Closure Date' : 'Odometer'}
                            </p>
                            <p className="text-3xl font-black text-light-text dark:text-dark-text">
                              {isClosed ? (
                                account.closureDetails?.date ? parseLocalDate(account.closureDetails.date).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—'
                              ) : (
                                <>{currentMileage.toLocaleString()} <span className="text-sm font-bold opacity-40">km</span></>
                              )}
                            </p>
                        </div>
                    </div>
                </div>
           </div>
      </motion.div>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          {/* Closure Details Banner */}
          {isClosed && account.closureDetails && (
            <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/40 rounded-3xl p-8 shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-red-500 flex items-center justify-center text-white shrink-0">
                  <span className="material-symbols-outlined">info</span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-red-900 dark:text-red-100 mb-1">Asset Decommissioned</h3>
                  <p className="text-sm text-red-700/80 dark:text-red-300/60 mb-4 font-medium leading-relaxed">
                    This account was marked as <strong className="text-red-900 dark:text-red-100">{account.closureDetails.closureType}</strong> on {parseLocalDate(account.closureDetails.date).toLocaleDateString(undefined, { dateStyle: 'long' })}. 
                  </p>
                  {account.closureDetails.notes && (
                    <div className="bg-white/50 dark:bg-black/20 p-4 rounded-xl mb-4 border border-red-200/50 dark:border-red-800/20 italic text-sm text-red-800 dark:text-red-200">
                      "{account.closureDetails.notes}"
                    </div>
                  )}
                  {account.closureDetails.closureType === 'Sold' && account.closureDetails.incomeAccountId && (
                    <div className="flex items-center gap-2 text-xs font-bold text-red-800 dark:text-red-200 uppercase tracking-wider">
                      <span className="material-symbols-outlined text-sm">payments</span>
                      Proceeds deposited to {accounts.find(a => a.id === account.closureDetails?.incomeAccountId)?.name}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Lease Insights Dashboard */}
          {isLeased && leaseStats && (
            <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: 0.2 }}
               className="bg-white dark:bg-dark-card rounded-3xl p-8 border border-black/5 dark:border-white/5 shadow-xl relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-96 h-96 bg-primary-500/10 dark:bg-primary-500/20 rounded-full blur-[80px] -mr-40 -mt-40 pointer-events-none"></div>
              
              <div className="relative z-10">
                  <div className="flex justify-between items-center mb-8">
                      <div className="flex items-center gap-3">
                         <div className="w-12 h-12 rounded-2xl bg-primary-500/10 flex items-center justify-center text-primary-500">
                           <span className="material-symbols-outlined text-2xl">assignment</span>
                         </div>
                         <div>
                            <h3 className="text-xl font-black text-light-text dark:text-dark-text">Lease Agreement</h3>
                            {account.leaseProvider && <p className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest">{account.leaseProvider}</p>}
                         </div>
                      </div>
                      <div className={`px-4 py-1.5 rounded-full text-xs font-bold ${leaseStats.mileageStatus === 'Over Budget' ? 'bg-red-500/10 text-red-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
                         {leaseStats.mileageStatus}
                      </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-10">
                     <div className="flex flex-col gap-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary">Time Left</p>
                        <p className="text-3xl font-black text-light-text dark:text-dark-text leading-tight">
                            {leaseStats.daysRemaining} <span className="text-xs font-bold text-light-text-secondary uppercase">days</span>
                        </p>
                        <div className="relative w-full h-2 bg-black/5 dark:bg-white/10 rounded-full mt-2 overflow-hidden">
                            <motion.div 
                               initial={{ width: 0 }}
                               animate={{ width: `${leaseStats.progress}%` }}
                               transition={{ duration: 1, ease: "easeOut" }}
                               className="absolute inset-y-0 left-0 bg-primary-500 rounded-full"
                            ></motion.div>
                        </div>
                        <p className="text-[10px] font-bold text-right text-light-text-secondary dark:text-dark-text-secondary mt-1">{leaseStats.progress.toFixed(0)}% elapsed</p>
                     </div>
                     
                     <div className="flex flex-col gap-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary">Mileage Balance</p>
                        <div className="flex items-baseline gap-2">
                             <p className={`text-3xl font-black ${leaseStats.mileageDiff > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                 {leaseStats.mileageDiff > 0 ? '−' : '+'}{Math.abs(Math.round(leaseStats.mileageDiff)).toLocaleString()}
                             </p>
                             <span className="text-[10px] font-bold text-light-text-secondary uppercase">km</span>
                        </div>
                        <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary mt-1">Relative to expected usage</p>
                     </div>

                     <div className="flex flex-col gap-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary">Annual Limit</p>
                        <p className="text-3xl font-black text-light-text dark:text-dark-text leading-tight">
                            {account.annualMileageAllowance?.toLocaleString()} <span className="text-xs font-bold text-light-text-secondary uppercase">km/yr</span>
                        </p>
                        <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary mt-1">Total allowance: {leaseStats.totalAllowance.toLocaleString()} km</p>
                     </div>
                  </div>
                  
                  {account.annualMileageAllowance && (
                      <div className="pt-8 border-t border-black/5 dark:border-white/5">
                        <div className="flex justify-between items-end mb-4">
                           <div className="space-y-0.5">
                               <p className="text-[10px] font-black uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary">Overall Usage Projection</p>
                               <p className="text-lg font-black text-light-text dark:text-dark-text">Projecting {Math.round(leaseStats.projectedMileage).toLocaleString()} km at lease end</p>
                           </div>
                           <div className="text-right">
                               <p className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary">{((currentMileage / leaseStats.totalAllowance) * 100).toFixed(1)}% used</p>
                           </div>
                        </div>
                        <div className="relative w-full h-4 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                           {/* Perfect path indicator */}
                           <div className="absolute top-0 bottom-0 w-1 bg-white dark:bg-black z-20 shadow-sm transition-all duration-1000" style={{ left: `${leaseStats.progress}%`, opacity: 0.8 }}></div>
                           
                           {/* Actual usage bar */}
                           <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min((currentMileage / leaseStats.totalAllowance) * 100, 100)}%` }}
                              transition={{ duration: 1.5, ease: "easeOut" }}
                              className={`h-full transition-colors duration-500 ${leaseStats.mileageStatus === 'Over Budget' ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]'}`}
                           />
                        </div>
                      </div>
                    )}
              </div>
            </motion.div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Mileage History Chart */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="h-full flex flex-col justify-between">
                    <div className="mb-6 flex justify-between items-start">
                        <div>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary mb-1">Utilization</h3>
                            <h4 className="text-xl font-black text-light-text dark:text-dark-text">Mileage Trends</h4>
                        </div>
                         <div className="flex flex-col items-end">
                            <span className="text-sm font-black text-primary-500">{(currentMileage / (leaseStats?.totalAllowance || currentMileage) * 100).toFixed(0)}% Used</span>
                        </div>
                    </div>
                    <div className="h-[240px]">
                        <VehicleMileageChart logs={sortedMileageLogs} />
                    </div>
                </Card>
              </motion.div>

              {/* Valuation Chart */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Card className="h-full flex flex-col justify-between">
                   <div className="mb-6 flex justify-between items-start">
                        <div>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary mb-1">Asset Health</h3>
                            <h4 className="text-xl font-black text-light-text dark:text-dark-text">Market Valuation</h4>
                        </div>
                        {account.priceHistory && account.priceHistory.length > 1 && (
                            <div className="flex flex-col items-end">
                                {(() => {
                                    const latest = account.priceHistory[account.priceHistory.length - 1].price;
                                    const initialPrice = account.priceHistory[0].price;
                                    const perc = ((latest - initialPrice) / initialPrice) * 100;
                                    return (
                                        <span className={`text-sm font-black ${perc >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                            {perc >= 0 ? '+' : ''}{perc.toFixed(1)}%
                                        </span>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                    <div className="h-[240px] w-full">
                        {account.priceHistory && account.priceHistory.length > 1 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={account.priceHistory}>
                                    <defs>
                                        <linearGradient id="colorValuationVehicle" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#06B6D4" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.05} />
                                    <XAxis 
                                        dataKey="date" 
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.4 }}
                                        tickFormatter={(date) => parseLocalDate(date).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}
                                    />
                                    <YAxis 
                                        hide
                                    />
                                    <Tooltip 
                                        contentStyle={{ 
                                            backgroundColor: 'rgba(31, 41, 55, 0.9)', 
                                            borderRadius: '16px', 
                                            border: 'none', 
                                            backdropFilter: 'blur(10px)',
                                            color: '#fff'
                                        }}
                                        itemStyle={{ fontSize: '13px', fontWeight: '800' }}
                                        labelStyle={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                                        formatter={(value: number) => [formatCurrency(value, account.currency), 'Value']}
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="price" 
                                        stroke="#06B6D4" 
                                        strokeWidth={4}
                                        fillOpacity={1} 
                                        fill="url(#colorValuationVehicle)" 
                                        animationDuration={1500}
                                        animationEasing="ease-in-out"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-black/5 dark:bg-white/5 rounded-3xl border border-dashed border-black/10 dark:border-white/10">
                                <span className="material-symbols-outlined text-4xl text-gray-300 dark:text-gray-600 mb-2">trending_down</span>
                                <p className="text-sm font-bold text-light-text-secondary dark:text-dark-text-secondary">Insufficient Records</p>
                                <p className="text-[10px] text-light-text-secondary/60 dark:text-dark-text-secondary/60 mt-1 uppercase tracking-widest leading-relaxed px-4">Log more valuations to analyze depreciation trends</p>
                            </div>
                        )}
                    </div>
                </Card>
              </motion.div>
          </div>
        </div>

        {/* Sidebar Info - High Density */}
        <div className="lg:col-span-4 space-y-8">
             {/* Linked Loan Integrated Header */}
             {linkedLoan && (
                 <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                 >
                    <Card className="bg-gradient-to-br from-red-500/5 to-transparent border-l-4 border-l-red-500 shadow-lg !p-6">
                        <div className="flex justify-between items-start mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-red-500 flex items-center justify-center text-white shadow-lg shadow-red-500/20">
                                <span className="material-symbols-outlined text-2xl">account_balance_wallet</span>
                            </div>
                            <button 
                                onClick={() => setViewingAccountId(linkedLoan.id)}
                                className="w-8 h-8 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center transition-colors text-light-text-secondary dark:text-dark-text-secondary"
                            >
                                <span className="material-symbols-outlined text-xl">open_in_new</span>
                            </button>
                        </div>
                        
                        <h3 className="text-2xl font-black text-light-text dark:text-dark-text mb-1">Financial Link</h3>
                        <p className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-[0.2em] mb-6">Linked Auto Loan</p>
                        
                        <div className="space-y-4">
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary opacity-60">Remaining Debt</span>
                                <span className="text-2xl font-black text-red-600 dark:text-red-400 leading-none">{formatCurrency(outstandingLoanBalance, linkedLoan.currency)}</span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-black/5 dark:border-white/5">
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary opacity-60">Rate</span>
                                    <p className="font-black text-sm">{linkedLoan.interestRate}% APR</p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary opacity-60">Installment</span>
                                    <p className="font-black text-sm">{linkedLoan.monthlyPayment ? formatCurrency(linkedLoan.monthlyPayment, linkedLoan.currency) : 'N/A'}</p>
                                </div>
                            </div>
                        </div>
                    </Card>
                 </motion.div>
             )}

             {/* Vehicle Technical Specs */}
             <motion.div
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               transition={{ delay: 0.6 }}
             >
                <Card className="!p-0 overflow-hidden">
                    <div className="px-6 py-5 bg-gray-50/50 dark:bg-white/[0.02] border-b border-black/5 dark:border-white/5">
                        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary">Configuration</h3>
                    </div>
                    <div className="divide-y divide-black/5 dark:divide-white/5">
                        {[
                            { label: 'Serial Number (VIN)', value: account.vin, isMono: true },
                            { label: 'License Plate', value: account.licensePlate, isBadge: true },
                            { label: 'Registration', value: account.registrationCountryCode },
                            { 
                                label: isLeased ? 'Lease Commencement' : 'Acquisition Date', 
                                value: (isLeased ? account.leaseStartDate : account.purchaseDate) ? parseLocalDate((isLeased ? account.leaseStartDate : account.purchaseDate)!).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—' 
                            },
                            ...(isLeased ? [{ label: 'Contract Maturity', value: account.leaseEndDate ? parseLocalDate(account.leaseEndDate).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—' }] : [])
                        ].map((item, idx) => (
                            <div key={idx} className="px-6 py-4 flex flex-col gap-1">
                                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-light-text-secondary dark:text-dark-text-secondary opacity-60">{item.label}</span>
                                <span className={`text-sm font-black ${item.isMono ? 'font-mono tracking-tighter' : ''} ${item.isBadge ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400 px-2 py-0.5 rounded-md w-fit' : 'text-light-text dark:text-dark-text'}`}>
                                    {item.value || 'Not Configured'}
                                </span>
                            </div>
                        ))}
                    </div>
                </Card>
             </motion.div>

            {/* Mileage Activity Log */}
            <motion.div
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               transition={{ delay: 0.7 }}
               className="h-full max-h-[600px]"
            >
                <Card className="flex flex-col h-full !p-0 overflow-hidden">
                    <div className="flex justify-between items-center px-6 py-5 border-b border-black/5 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02]">
                        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary">Mileage Journal</h3>
                        <button 
                            onClick={onAddLog} 
                            className="w-10 h-10 rounded-full bg-primary-500 text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg shadow-primary-500/20"
                        >
                            <span className="material-symbols-outlined text-lg">add</span>
                        </button>
                    </div>
                    <div className="flex-grow overflow-y-auto px-6 py-4 custom-scrollbar">
                    {sortedMileageLogsDesc.length > 0 ? (
                        <div className="space-y-4">
                            {sortedMileageLogsDesc.map((log, index, arr) => {
                                 const prevLog = arr[index + 1];
                                 const diff = prevLog ? log.reading - prevLog.reading : 0;
                                 return (
                                    <div key={log.id} className="group relative pl-6 pb-2 last:pb-0 border-l-2 border-black/5 dark:border-white/10">
                                        {/* Timeline Dot */}
                                        <div className="absolute left-[-5px] top-0 w-2 h-2 rounded-full bg-primary-500 shadow-[0_0_5px_rgba(59,130,246,0.5)]"></div>
                                        
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-xs font-black text-light-text dark:text-dark-text mb-1">{parseLocalDate(log.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-black/5 dark:bg-white/5 font-mono">{log.reading.toLocaleString()} km</span>
                                                    {diff > 0 && <span className="text-[10px] font-bold text-emerald-500">+{diff.toLocaleString()} km</span>}
                                                </div>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => onEditLog(log)} className="w-8 h-8 rounded-lg hover:bg-primary-500/10 text-primary-500 flex items-center justify-center transition-colors">
                                                    <span className="material-symbols-outlined text-sm">edit</span>
                                                </button>
                                                <button onClick={() => onDeleteLog(log.id)} className="w-8 h-8 rounded-lg hover:bg-red-500/10 text-red-500 flex items-center justify-center transition-colors">
                                                    <span className="material-symbols-outlined text-sm">delete</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                 );
                            })}
                        </div>
                    ) : (
                        <div className="h-40 flex flex-col items-center justify-center text-center opacity-40">
                             <span className="material-symbols-outlined text-4xl mb-3">history</span>
                            <p className="text-sm font-bold uppercase tracking-widest">No Activity Recorded</p>
                        </div>
                    )}
                    </div>
                </Card>
            </motion.div>
        </div>
      </div>
    </div>
  );
};

export default VehicleAccountView;