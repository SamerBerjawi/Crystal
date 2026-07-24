import React, { useMemo } from 'react';
import { Account, MileageLog, Transaction, LoanPaymentOverrides } from '../types';
import { formatCurrency, parseLocalDate, generateAmortizationSchedule, calculateTrendLine } from '../utils';
import VehicleMileageChart from './VehicleMileageChart';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import { ResponsiveContainer, AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { motion } from 'motion/react';
import { MobileAccountHeader } from './MobileAccountHeader';
import { usePreferencesSelector } from '../contexts/DomainProviders';
import { getMerchantLogoUrl } from '../utils/brandfetch';

const CAR_MAKE_DOMAINS: Record<string, string> = {
  bmw: 'bmw.com',
  tesla: 'tesla.com',
  audi: 'audi.com',
  mercedes: 'mercedes-benz.com',
  'mercedes-benz': 'mercedes-benz.com',
  ford: 'ford.com',
  toyota: 'toyota.com',
  honda: 'honda.com',
  porsche: 'porsche.com',
  volkswagen: 'volkswagen.com',
  vw: 'volkswagen.com',
  nissan: 'nissan-global.com',
  chevrolet: 'chevrolet.com',
  hyundai: 'hyundai.com',
  kia: 'kia.com',
  lexus: 'lexus.com',
  subaru: 'subaru.com',
  mazda: 'mazda.com',
  volvo: 'volvocars.com',
  jaguar: 'jaguar.com',
  landrover: 'landrover.com',
  'land rover': 'landrover.com',
  ferrari: 'ferrari.com',
  lamborghini: 'lamborghini.com',
  jeep: 'jeep.com',
  dodge: 'dodge.com',
  chrysler: 'chrysler.com',
  fiat: 'fiat.com',
  peugeot: 'peugeot.com',
  renault: 'renaultgroup.com',
  citroen: 'citroen.com',
  alfa: 'alfaromeo.com',
  'alfa romeo': 'alfaromeo.com',
  saab: 'saab.com',
  aston: 'astonmartin.com',
  'aston martin': 'astonmartin.com',
  bentley: 'bentleymotors.com',
  maserati: 'maserati.com',
  bugatti: 'bugatti.com',
  byd: 'byd.com',
  rivian: 'rivian.com',
  lucid: 'lucidmotors.com',
  polestar: 'polestar.com',
};

const LicensePlate: React.FC<{ plate?: string; countryCode?: string }> = ({ plate, countryCode }) => {
  if (!plate || plate.trim() === '') {
    return (
      <div className="inline-flex items-center h-10 bg-black/5 dark:bg-white/5 border border-dashed border-black/10 dark:border-white/10 rounded-xl px-4 text-xs font-semibold text-light-text-secondary/40 dark:text-dark-text-secondary/40 select-none  tracking-widest">
        No Plate Set
      </div>
    );
  }
  
  const displayCountry = (countryCode || 'EU').toUpperCase().trim().slice(0, 3);
  
  return (
    <div className="inline-flex items-center bg-[#FDFDFD] border-[1.5px] border-slate-950 dark:border-slate-800 rounded-[6px] overflow-hidden shadow-md font-mono text-slate-900 select-none h-11 px-0.5 relative shrink-0" style={{ minWidth: '160px' }}>
      {/* EU Blue strip on left */}
      <div className="w-6 h-full bg-[#003399] flex flex-col items-center justify-between py-1 text-white shrink-0">
        <div className="text-[6px] text-yellow-300 leading-none font-bold origin-center select-none scale-90">
          ★
        </div>
        <span className="text-[9px] font-black leading-none tracking-tighter">{displayCountry}</span>
      </div>
      
      {/* Plate characters */}
      <div className="px-3 flex-grow flex items-center justify-center font-black tracking-widest text-sm md:text-base  text-[#141414] drop-shadow-[0.5px_0.5px_0px_rgba(255,255,255,0.8)] leading-none">
        {plate}
      </div>
      
      {/* Small sticker decals */}
      <div className="flex flex-col gap-0.5 mr-1.5 shrink-0 select-none">
        <div className="w-3.5 h-3.5 rounded-full bg-amber-400 border border-amber-600/30 flex items-center justify-center text-[6.5px] font-bold text-amber-950 leading-none shadow-sm">
          26
        </div>
      </div>
    </div>
  );
};

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
                {subValue && <p className="text-[11px] font-medium text-light-text-secondary/50 dark:text-dark-text-secondary/70 mt-1 tracking-tight">{subValue}</p>}
            </div>
        </div>
    );
};

export interface VehicleAccountViewProps {
  account: Account;
  accounts: Account[];
  transactions: Transaction[];
  loanPaymentOverrides: LoanPaymentOverrides;
  onAddTransaction: (transaction?: Omit<Transaction, 'id' | 'createdAt'>) => void;
  onUpdateValuation: () => void;
  onAddLog: () => void;
  onEditLog: (log: MileageLog) => void;
  onDeleteLog: (logId: string) => void;
  onBack: () => void;
  setViewingAccountId?: (id: string | null) => void;
  onSyncLinkedAccount?: (accountId: string) => void;
  isLinkedToEnableBanking?: boolean;
  onCloseAsset?: () => void;
  onRevertClosure?: () => void;
  showBalanceAdjustments?: boolean;
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
  showBalanceAdjustments = true,
}) => {
  const brandfetchClientId = usePreferencesSelector(p => (p.brandfetchClientId || '').trim());
  const merchantLogoOverrides = usePreferencesSelector(p => p.merchantLogoOverrides || {});

  const brandLogoUrl = useMemo(() => {
    if (!brandfetchClientId || !account.make) return null;
    const makeKey = account.make.trim().toLowerCase();
    const domain = CAR_MAKE_DOMAINS[makeKey] || (makeKey.includes('.') ? makeKey : `${makeKey}.com`);
    return getMerchantLogoUrl(domain, brandfetchClientId, merchantLogoOverrides, { type: 'icon', fallback: 'transparent', width: 128, height: 128 });
  }, [account.make, brandfetchClientId, merchantLogoOverrides]);

  const isLeased = account.ownership === 'Leased';
  const isClosed = account.status === 'closed';
  const linkedLoan = accounts.find(a => a.type === 'Loan' && a.linkedAssetId === account.id);

  let outstandingLoanBalance = 0;
  if (linkedLoan) {
      const filteredTxs = transactions.filter(tx => showBalanceAdjustments || !tx.isBalanceAdjustment);
      if (linkedLoan.principalAmount && linkedLoan.duration && linkedLoan.loanStartDate && linkedLoan.interestRate !== undefined) {
          const overrides = loanPaymentOverrides[linkedLoan.id] || {};
          const schedule = generateAmortizationSchedule(linkedLoan, filteredTxs, overrides);
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

  const sortedMileageLogsDesc = useMemo(() => [...sortedMileageLogs].reverse(), [sortedMileageLogs]);

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
    
    return { progress, mileageStatus, mileageDiff, daysRemaining: Math.max(0, Math.ceil(totalDays - elapsedDays)), projectedMileage, totalAllowance };
  }, [account, currentMileage]);

  const priceHistoryWithTrend = useMemo(() => {
    if (!account.priceHistory || account.priceHistory.length === 0) return [];
    const trendVals = calculateTrendLine(account.priceHistory, 'price');
    return account.priceHistory.map((ph, idx) => ({
      ...ph,
      trend: trendVals[idx]
    }));
  }, [account.priceHistory]);

  return (
    <div className="space-y-6 md:space-y-10 animate-fade-in-up pb-10">
      {/* Mobile Header */}
      <MobileAccountHeader
        account={account}
        onBack={onBack}
        formattedBalance={formatCurrency(account.balance, account.currency)}
        badgeText={account.ownership || 'Vehicle Asset'}
        subText={`${account.year || ''} ${account.make || ''} ${account.model || ''}`}
        valuationAction={!isClosed ? { label: 'Value Update', icon: 'add', onClick: () => { if (onUpdateValuation) onUpdateValuation(); else if (onAddTransaction) onAddTransaction(); } } : undefined}
        secondaryAction={{ label: 'Add Log', icon: 'speed', onClick: () => onAddLog() }}
      />

      {/* Dynamic Desktop Header */}
      <header className="hidden md:flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative">
          <div className="flex items-center gap-6">
              <button 
                  onClick={onBack}
                  className="w-12 h-12 rounded-2xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 flex items-center justify-center hover:bg-primary-500 hover:text-white transition-all shadow-sm group active:scale-95"
              >
                  <span className="material-symbols-outlined transition-transform group-hover:-translate-x-1">arrow_back</span>
              </button>
              <div>
                  <div className="flex items-center gap-2 mb-1">
                       <span className="text-[10px] font-semibold text-primary-500 bg-primary-500/10 px-2 py-0.5 rounded-lg border border-primary-500/20">Vehicle asset</span>
                       <span className="text-[10px] font-semibold text-light-text-secondary/30 dark:text-dark-text-secondary/30">•</span>
                       <span className="text-[10px] font-semibold text-light-text-secondary/60 dark:text-dark-text-secondary/80">{account.licensePlate || 'Fleet Member'}</span>
                  </div>
                  <h1 className="text-4xl font-semibold text-light-text dark:text-dark-text tracking-tighter flex items-center gap-3">
                      {account.name}
                      <span className="material-symbols-outlined text-light-text-secondary/40 dark:text-dark-text-secondary/40 font-light">directions_car</span>
                  </h1>
              </div>
          </div>
          
          <div className="flex gap-3 w-full md:w-auto">
              {!isClosed && (
                <button onClick={() => { if (onUpdateValuation) { onUpdateValuation(); } else if (onAddTransaction) { onAddTransaction(); } }} className={`${BTN_PRIMARY_STYLE} rounded-2xl !px-6 h-12 shadow-lg shadow-primary-500/20`}>
                    <span className="material-symbols-outlined text-lg mr-2">add</span>
                    Value Update
                </button>
              )}
              {isClosed && onRevertClosure && (
                    <button onClick={() => onRevertClosure()} className={`${BTN_SECONDARY_STYLE} rounded-2xl !px-6 h-12 shadow-sm border-black/5 dark:border-white/5 bg-white dark:bg-dark-card`}>
                        <span className="material-symbols-outlined text-lg mr-2">history</span>
                        Reopen
                    </button>
              )}
              <button 
                  onClick={() => onAddLog()} 
                  className={`${BTN_SECONDARY_STYLE} rounded-2xl !px-6 h-12 shadow-sm border-black/5 dark:border-white/5 bg-white dark:bg-dark-card flex items-center gap-2 hover:bg-primary-500 hover:text-white transition-all`}
              >
                  <span className="material-symbols-outlined text-lg">speed</span>
                  Add Log
              </button>
              {!isClosed && onCloseAsset && (
                    <button onClick={() => onCloseAsset()} className="h-12 px-6 rounded-2xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white font-semibold text-[10px] tracking-wider transition-all shadow-lg shadow-rose-500/5 flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">event_busy</span>
                        Retire Vehicle
                    </button>
              )}
          </div>
      </header>

      {isClosed && account.closureDetails && (
        <motion.div 
           initial={{ opacity: 0, scale: 0.95 }}
           animate={{ opacity: 1, scale: 1 }}
           className="bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800/40 rounded-[2.5rem] p-10 flex flex-col md:flex-row items-center gap-10"
        >
            <div className="w-20 h-20 rounded-full bg-rose-500 flex items-center justify-center text-white shadow-xl shadow-rose-500/20">
                <span className="material-symbols-outlined text-4xl text-white">lock</span>
            </div>
            <div className="flex-grow text-center md:text-left">
                <h3 className="text-2xl font-bold text-rose-900 dark:text-rose-100 mb-2 tracking-tight">Vehicle retired from inventory</h3>
                <p className="text-sm text-rose-700/80 dark:text-rose-300/60 font-black leading-relaxed max-w-2xl tracking-tight">
                    Finalized as <span className="text-rose-900 dark:text-white px-2 py-0.5 rounded-lg bg-rose-200/50 dark:bg-rose-500/20">{account.closureDetails.closureType}</span> on {parseLocalDate(account.closureDetails.date).toLocaleDateString(undefined, { dateStyle: 'long' })}. 
                    Asset valuation at exit was {formatCurrency(account.closureDetails.value || 0, account.currency)}.
                </p>
            </div>
        </motion.div>
      )}

      {/* Hero Financial Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
           {/* Immersive Vehicle Card */}
           <div className="lg:col-span-5 xl:col-span-4">
               <motion.div 
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   className="relative h-full min-h-[460px] rounded-[3rem] bg-slate-950 text-white p-10 shadow-2xl overflow-hidden flex flex-col justify-between border border-white/10 group"
               >
                   {/* Full-bleed background photo of the car with custom gradient masks */}
                   <div className="absolute inset-0 z-0">
                       <img 
                           src={account.imageUrl || "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&q=80&w=600"} 
                           alt={account.name} 
                           className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                           referrerPolicy="no-referrer"
                       />
                       <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/75 to-slate-950/30"></div>
                       <div className="absolute inset-0 bg-gradient-to-br from-[#003399]/25 via-transparent to-slate-950/40"></div>
                   </div>
                   
                   <div className="relative z-10 text-white flex-grow flex flex-col justify-between">
                         <div className="flex justify-between items-start mb-6">
                             <div className="flex flex-col gap-3">
                                 <span className="px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-[10px] font-bold tracking-wider border border-white/10 w-fit">
                                     {account.ownership || 'Private'} • {account.fuelType}
                                 </span>
                                 {brandLogoUrl && (
                                     <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                                         <img 
                                             src={brandLogoUrl} 
                                             alt={account.make || 'Car Brand'} 
                                             className="w-full h-full object-cover"
                                             onError={(e) => { (e.target as HTMLElement).parentElement!.style.display = 'none'; }}
                                             referrerPolicy="no-referrer"
                                         />
                                     </div>
                                 )}
                             </div>
                             <div className="text-right">
                                  <p className="text-[10px] font-semibold tracking-wider text-slate-300 mb-1">Odometer</p>
                                  <p className="text-3xl font-semibold tabular-nums text-cyan-400">{currentMileage.toLocaleString()} km</p>
                             </div>
                        </div>
                        
                        <div className="my-2">
                            <p className="text-[10px] font-bold tracking-wider text-slate-400 mb-1">Estimated Market Value</p>
                            <h2 className="text-5xl font-bold tracking-tight tabular-nums drop-shadow-sm">
                                {formatCurrency(account.balance, account.currency)}
                            </h2>
                        </div>

                        {/* Redesigned License Plate attached into the card */}
                        <div className="my-4 flex flex-col items-start">
                            <p className="text-[10px] font-semibold tracking-wider text-slate-400 mb-2">Registered Plate</p>
                            <LicensePlate plate={account.licensePlate} countryCode={account.registrationCountryCode} />
                        </div>
                        
                        <div className="space-y-4">
                            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                                 <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min(100, (currentMileage / (leaseStats?.totalAllowance || 150000)) * 100)}%` }}
                                    className="h-full bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.5)]"
                                 />
                            </div>
                            <p className="text-[10px] font-semibold tracking-wider text-slate-400 text-center">
                                {isLeased 
                                    ? `Lease Mileage: ${currentMileage.toLocaleString()} of ${(leaseStats?.totalAllowance || 0).toLocaleString()} km budget (${Math.min(100, (currentMileage / (leaseStats?.totalAllowance || 1)) * 100).toFixed(0)}%)`
                                    : `Milestone: ${currentMileage.toLocaleString()} of 150,000 km target lifespan (${Math.min(100, (currentMileage / 150000) * 100).toFixed(0)}%)`
                                }
                            </p>
                        </div>
                   </div>

                   <div className="relative z-10 pt-6 mt-6 border-t border-white/5 grid grid-cols-2 gap-8 shrink-0">
                       <div>
                           <p className="text-[10px] tracking-wider text-slate-400 font-bold mb-1">Model Year</p>
                           <p className="font-black text-xl text-white tabular-nums">{account.year || '—'}</p>
                       </div>
                       <div>
                           <p className="text-[10px] tracking-wider text-slate-300 font-bold mb-1">Ownership</p>
                           <p className="font-black text-xl text-cyan-400 tabular-nums">{account.ownership}</p>
                       </div>
                   </div>
               </motion.div>
           </div>

           {/* Metrics & Analytics */}
           <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <MetricTile 
                        label="Asset Equity" 
                        value={formatCurrency(account.balance - outstandingLoanBalance, account.currency)} 
                        icon="account_balance_wallet" 
                        colorClass="emerald"
                        subValue="Net of liabilities"
                    />
                    <MetricTile 
                        label="Usage Intensity" 
                        value={`${Math.round(currentMileage / 365).toLocaleString()} km`} 
                        icon="speed" 
                        colorClass="blue"
                        subValue="Estimated daily average"
                    />
                    <MetricTile 
                        label="Running Debt" 
                        value={formatCurrency(outstandingLoanBalance, account.currency)} 
                        icon="request_quote" 
                        colorClass="rose"
                        subValue="Linked loan balance"
                    />
                </div>

                {/* Valuation Trajectory */}
                <div className="bg-white dark:bg-dark-card rounded-[2.5rem] border border-black/5 dark:border-white/5 p-8 flex-grow flex flex-col group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                         <span className="material-symbols-outlined text-8xl">trending_down</span>
                    </div>
                    <div className="flex justify-between items-center mb-10 relative z-10">
                        <div>
                             <h3 className="text-xl font-bold text-light-text dark:text-dark-text tracking-tight">Depreciation Alpha</h3>
                             <p className="text-xs font-bold text-light-text-secondary/60 dark:text-dark-text-secondary/80 mt-1 tracking-wider">Asset valuation over time</p>
                        </div>
                    </div>
                    
                    <div className="flex-grow w-full h-full min-h-[220px] relative z-10">
                        {account.priceHistory && account.priceHistory.length > 1 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={priceHistoryWithTrend}>
                                    <defs>
                                        <linearGradient id="vehValGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.1}/>
                                            <stop offset="95%" stopColor="#06B6D4" stopOpacity={0}/>
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
                                         itemStyle={{ fontSize: '12px', fontWeight: '900', color: '#06B6D4' }}
                                         labelStyle={{ fontSize: '10px', fontWeight: '900', color: '#94a3b8',  marginBottom: '4px', letterSpacing: '0.1em' }}
                                         formatter={(val: number) => [`${formatCurrency(val, account.currency)}`, 'Value']}
                                     />
                                    <Area type="monotone" dataKey="price" stroke="#06B6D4" strokeWidth={4} fill="url(#vehValGradient)" name="Price" />
                                    <Line type="monotone" dataKey="trend" stroke="#6366f1" strokeWidth={2} strokeDasharray="4 4" dot={false} activeDot={false} name="Trend Line" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-black/5 dark:bg-white/5 rounded-[2rem] border-2 border-dashed border-black/5 dark:border-white/5">
                                <span className="material-symbols-outlined text-4xl text-light-text-secondary/20 mb-4">insights</span>
                                <p className="text-sm font-bold text-light-text-secondary/60 tracking-wider">Awaiting data points</p>
                            </div>
                        )}
                    </div>
                </div>
           </div>
       </div>

       <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
           {/* Left Column: Infrastructure & Mileage Journal */}
           <div className="xl:col-span-4 flex flex-col gap-8">
                {/* Infrastructure Configuration */}
                <div className="bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 rounded-[2.5rem] p-8 group overflow-hidden shadow-sm">
                     <h3 className="text-[11px] font-bold tracking-tight text-light-text-secondary/30 dark:text-dark-text-secondary/40 mb-8">Infrastructure Configuration</h3>
                     <div className="space-y-6">
                         <div className="flex justify-between items-end border-b border-black/5 dark:border-white/5 pb-4 last:border-0 last:pb-0">
                               <span className="text-xs font-black tracking-widest text-light-text-secondary/60 dark:text-dark-text-secondary/80 ">Asset Genesis</span>
                               <span className="text-sm font-black text-light-text dark:text-dark-text tracking-tight">{account.purchaseDate ? parseLocalDate(account.purchaseDate).toLocaleDateString() : '—'}</span>
                          </div>
                          <div className="flex justify-between items-end border-b border-black/5 dark:border-white/5 pb-4 last:border-0 last:pb-0">
                               <span className="text-xs font-black tracking-widest text-light-text-secondary/60 dark:text-dark-text-secondary/80 ">Settlement Engine</span>
                               <span className="text-sm font-black text-light-text dark:text-dark-text tracking-tight">{account.currency}</span>
                          </div>
                          <div className="flex justify-between items-end border-b border-black/5 dark:border-white/5 pb-4 last:border-0 last:pb-0">
                               <span className="text-xs font-black tracking-widest text-light-text-secondary/60 dark:text-dark-text-secondary/80 ">Logical Serial</span>
                               <span className="text-sm font-black text-light-text dark:text-dark-text tracking-tight font-mono opacity-80 break-all">{account.id.slice(0, 8)}</span>
                          </div>
                     </div>
                </div>

                {/* Mileage Journal */}
                <div className="bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 rounded-[2.5rem] p-8 flex flex-col group h-full shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                         <h3 className="text-xl font-bold text-light-text dark:text-dark-text tracking-tight">Mileage Journal</h3>
                         <span className="material-symbols-outlined text-slate-400">history</span>
                    </div>
                    
                    <div className="flex-grow overflow-y-auto space-y-4 max-h-[500px] pr-2 custom-scrollbar">
                        {sortedMileageLogsDesc.length > 0 ? (
                            sortedMileageLogsDesc.map((log, idx, arr) => {
                                const nextLog = arr[idx + 1];
                                const diff = nextLog ? log.reading - nextLog.reading : 0;
                                return (
                                    <div key={log.id} className="p-5 rounded-2xl bg-black/5 dark:bg-white/10 border border-transparent hover:border-black/10 dark:hover:border-white/20 transition-all group/item">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-xs font-black  tracking-widest text-light-text-secondary dark:text-dark-text-secondary">
                                                {parseLocalDate(log.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </span>
                                            <div className="flex gap-2 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                                <button onClick={() => onEditLog(log)} className="text-primary-500 hover:text-primary-600">
                                                    <span className="material-symbols-outlined text-sm">edit</span>
                                                </button>
                                                <button onClick={() => onDeleteLog(log.id)} className="text-rose-500 hover:text-rose-600">
                                                    <span className="material-symbols-outlined text-sm">delete</span>
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-end">
                                            <p className="text-2xl font-black text-light-text dark:text-dark-text tracking-tighter tabular-nums">{log.reading.toLocaleString()} <span className="text-xs opacity-60 ml-1">km</span></p>
                                            {diff > 0 && (
                                                <span className="text-[11px] font-black text-emerald-500 tabular-nums">+{diff.toLocaleString()} km</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-8">
                                 <span className="material-symbols-outlined text-4xl mb-2 text-light-text-secondary/20 font-light">auto_stories</span>
                                 <p className="text-[10px] font-black tracking-widest text-light-text-secondary/40 dark:text-dark-text-secondary/60 ">No Logs recorded</p>
                            </div>
                        )}
                    </div>
                </div>
           </div>

           {/* Right Column: Lease Monitoring & Technical Configuration */}
           <div className="xl:col-span-8 space-y-8">
                {isLeased && leaseStats && (
                    <div className="bg-white dark:bg-dark-card rounded-[2.5rem] border border-black/5 dark:border-white/5 p-10 border-l-8 border-l-amber-500 shadow-sm">
                         <div className="flex justify-between items-center mb-10">
                            <div>
                                <h3 className="text-xl font-bold text-light-text dark:text-dark-text tracking-tight">Lease Monitoring</h3>
                                <p className="text-xs font-bold text-light-text-secondary/60 dark:text-dark-text-secondary/80 mt-1 tracking-wider">{account.leaseProvider || 'Agreement Terms'}</p>
                            </div>
                            <div className={`px-4 py-2 rounded-xl border font-black text-[10px] tracking-widest ${leaseStats.mileageStatus === 'Over Budget' ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'}`}>
                                {leaseStats.mileageStatus}
                            </div>
                         </div>
                         
                         <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
                            <div className="space-y-4">
                                <div className="flex justify-between text-[10px] font-bold tracking-wider text-slate-500">
                                    <span>Contract Evolution</span>
                                    <span>{leaseStats.progress.toFixed(0)}%</span>
                                </div>
                                <div className="w-full h-2 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                                     <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${leaseStats.progress}%` }}
                                        className="h-full bg-amber-500"
                                     />
                                </div>
                                <p className="text-[10px] font-bold text-light-text-secondary/40 dark:text-dark-text-secondary/50 text-center">{leaseStats.daysRemaining} days left</p>
                            </div>
                            
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold tracking-wider text-light-text-secondary/40 dark:text-dark-text-secondary/50 font-bold">Allowance Variance</p>
                                <p className={`text-2xl font-black tabular-nums ${leaseStats.mileageDiff > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                    {leaseStats.mileageDiff > 0 ? '−' : '+'}{Math.abs(Math.round(leaseStats.mileageDiff)).toLocaleString()} km
                                </p>
                            </div>

                            <div className="space-y-1">
                                <p className="text-[10px] font-bold tracking-wider text-light-text-secondary/40 dark:text-dark-text-secondary/50 font-bold">Projected Final</p>
                                <p className="text-2xl font-black text-light-text dark:text-dark-text tabular-nums">
                                    {Math.round(leaseStats.projectedMileage).toLocaleString()} km
                                </p>
                            </div>
                         </div>
                    </div>
                )}
                
                <div className="bg-white dark:bg-dark-card rounded-[2.5rem] border border-black/5 dark:border-white/5 p-10 group shadow-sm">
                    <h3 className="text-[11px] font-bold tracking-tight text-light-text-secondary/30 dark:text-dark-text-secondary/40 mb-8">Technical Configuration</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                        <div className="space-y-1">
                             <p className="text-[10px] font-bold tracking-wider text-light-text-secondary/40 dark:text-dark-text-secondary/50 font-bold">VIN / Serial</p>
                             <p className="text-lg font-black text-light-text dark:text-dark-text tracking-tight font-mono truncate">{account.vin || '—'}</p>
                        </div>
                        <div className="space-y-1">
                             <p className="text-[11px] font-black tracking-widest text-light-text-secondary dark:text-dark-text-secondary  font-bold">Make / Model</p>
                             <p className="text-xl font-black text-light-text dark:text-dark-text tracking-tighter">{account.make} {account.model}</p>
                        </div>
                    </div>
                    <div className="h-64 mt-12 bg-black/[0.02] dark:bg-white/[0.01] rounded-3xl p-6">
                        <VehicleMileageChart logs={sortedMileageLogs} />
                    </div>
                </div>
           </div>
      </div>
    </div>
  );
};

export default VehicleAccountView;
