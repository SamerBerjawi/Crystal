import React, { useMemo } from 'react';
import { Account, MileageLog, Transaction, LoanPaymentOverrides } from '../types';
import { formatCurrency, parseLocalDate, generateAmortizationSchedule } from '../utils';
import Card from './Card';
import VehicleMileageChart from './VehicleMileageChart';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, ACCOUNT_TYPE_STYLES } from '../constants';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface VehicleAccountViewProps {
  account: Account;
  accounts: Account[];
  transactions: Transaction[];
  loanPaymentOverrides: LoanPaymentOverrides;
  onAddTransaction: () => void;
  onAddLog: () => void;
  onEditLog: (log: MileageLog) => void;
  onDeleteLog: (id: string) => void;
  onBack: () => void;
  setViewingAccountId: (id: string | null) => void;
  onSyncLinkedAccount?: () => void;
  isLinkedToEnableBanking?: boolean;
}

const VehicleAccountView: React.FC<VehicleAccountViewProps> = ({
  account,
  accounts,
  transactions,
  loanPaymentOverrides,
  onAddTransaction,
  onAddLog,
  onEditLog,
  onDeleteLog,
  onBack,
  setViewingAccountId,
  onSyncLinkedAccount,
  isLinkedToEnableBanking,
}) => {
  const isLeased = account.ownership === 'Leased';

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
    <div className="space-y-8 animate-fade-in-up">
      {/* Top Bar */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
         <button onClick={onBack} className="text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex-shrink-0 -ml-2">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
           <div className="flex items-center gap-2">
             {isLinkedToEnableBanking && onSyncLinkedAccount && (
               <button onClick={onSyncLinkedAccount} className={BTN_SECONDARY_STYLE}>Sync</button>
             )}
             <button onClick={onAddTransaction} className={BTN_PRIMARY_STYLE}>Add Transaction</button>
           </div>
      </header>

      {/* Hero Section */}
      <div className="bg-white dark:bg-dark-card rounded-3xl p-6 lg:p-8 shadow-card border border-black/5 dark:border-white/5 flex flex-col lg:flex-row items-center gap-8 relative overflow-hidden">
           <div className="absolute top-0 right-0 p-4 opacity-5 dark:opacity-[0.02] pointer-events-none">
                 <span className="material-symbols-outlined text-9xl">directions_car</span>
           </div>

           {/* Vehicle Image / Icon */}
           <div className="flex-shrink-0 relative group">
                {account.imageUrl ? (
                    <div className="w-40 h-40 lg:w-48 lg:h-48 flex items-center justify-center">
                        <img src={account.imageUrl} alt="Vehicle" className="max-w-full max-h-full object-contain" loading="lazy" decoding="async" />
                    </div>
                ) : (
                    <div className={`w-32 h-32 lg:w-40 lg:h-40 rounded-2xl flex items-center justify-center bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg`}>
                        <span className="material-symbols-outlined text-6xl">directions_car</span>
                    </div>
                )}
           </div>

           {/* Vehicle Info */}
           <div className="flex-grow text-center lg:text-left">
               <div className="mb-4">
                    <h1 className="text-3xl lg:text-4xl font-bold text-light-text dark:text-dark-text mb-1 tracking-tight">{account.name}</h1>
                    <p className="text-lg text-light-text-secondary dark:text-dark-text-secondary font-medium">
                        {account.year} {account.make} {account.model}
                    </p>
               </div>
               <div className="flex flex-wrap justify-center lg:justify-start gap-3">
                   {account.licensePlate && (
                       <div className="flex items-center rounded-md bg-gray-100 dark:bg-white/10 border border-black/10 dark:border-white/10 overflow-hidden h-7">
                           {account.registrationCountryCode && (
                               <div className="px-1.5 bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center h-full">
                                   {account.registrationCountryCode}
                               </div>
                           )}
                           <span className="px-2 text-sm font-mono font-semibold text-gray-800 dark:text-gray-200">
                               {account.licensePlate}
                           </span>
                       </div>
                   )}
                   <span className={`px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wide ${account.ownership === 'Leased' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'}`}>
                       {account.ownership}
                   </span>
                   <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-sm font-semibold flex items-center gap-1">
                       <span className="material-symbols-outlined text-sm">local_gas_station</span>
                       {account.fuelType}
                   </span>
               </div>
           </div>

            {/* Key Stats High Level */}
            <div className="flex flex-col sm:flex-row gap-6 text-center lg:text-right border-t lg:border-t-0 lg:border-l border-black/5 dark:border-white/5 pt-6 lg:pt-0 lg:pl-8">
                <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1">Current Value</p>
                    <p className="text-2xl font-bold text-light-text dark:text-dark-text">{formatCurrency(account.balance, account.currency)}</p>
                </div>
                 <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1">Odometer</p>
                    <p className="text-2xl font-bold text-light-text dark:text-dark-text">{currentMileage.toLocaleString()} km</p>
                </div>
            </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Lease Dashboard */}
          {isLeased && leaseStats && (
            <div className="bg-white dark:bg-dark-card rounded-2xl p-6 border border-black/5 dark:border-white/10 shadow-sm relative overflow-hidden group">
              {/* Blurred Colored Background */}
              <div className="absolute top-0 right-0 w-80 h-80 bg-primary-500/10 dark:bg-primary-500/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/10 dark:bg-blue-500/20 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none"></div>
              
              <div className="relative z-10">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-bold text-light-text dark:text-dark-text flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary-500">contract</span>
                          Lease Agreement
                      </h3>
                      {account.leaseProvider && (
                          <span className="text-sm font-semibold bg-white/80 dark:bg-black/20 px-3 py-1 rounded-full border border-black/5 dark:border-white/5 shadow-sm backdrop-blur-sm">
                              {account.leaseProvider}
                          </span>
                      )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
                     <div className="bg-white/60 dark:bg-black/20 rounded-xl p-4 border border-black/5 dark:border-white/5 backdrop-blur-sm">
                        <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary mb-2">Time Remaining</p>
                        <p className="text-2xl font-bold text-light-text dark:text-dark-text">
                            {leaseStats.daysRemaining} <span className="text-sm font-medium text-light-text-secondary">days ({leaseStats.progress.toFixed(0)}%)</span>
                        </p>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-3">
                            <div className="bg-primary-500 h-1.5 rounded-full" style={{ width: `${leaseStats.progress}%` }}></div>
                        </div>
                     </div>
                     
                     <div className="bg-white/60 dark:bg-black/20 rounded-xl p-4 border border-black/5 dark:border-white/5 backdrop-blur-sm">
                        <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary mb-2">Mileage Balance</p>
                        <p className={`text-2xl font-bold ${leaseStats.mileageDiff > 0 ? 'text-red-500' : 'text-green-500'}`}>{leaseStats.mileageDiff > 0 ? '+' : ''}{Math.round(leaseStats.mileageDiff).toLocaleString()}</p>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">vs. expected usage</p>
                     </div>

                     <div className="bg-white/60 dark:bg-black/20 rounded-xl p-4 border border-black/5 dark:border-white/5 backdrop-blur-sm">
                        <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary mb-2">Projected End</p>
                        <p className="text-2xl font-bold text-light-text dark:text-dark-text">{Math.round(leaseStats.projectedMileage).toLocaleString()}</p>
                         <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">km at lease end</p>
                     </div>
                  </div>
                  
                  {account.annualMileageAllowance && (
                      <div className="bg-white/60 dark:bg-black/20 rounded-xl p-5 border border-black/5 dark:border-white/5 backdrop-blur-sm">
                        <div className="flex justify-between text-sm font-medium mb-2">
                          <span className="text-light-text dark:text-dark-text">Total Mileage Usage</span>
                          <span className={leaseStats.mileageStatus === 'Over Budget' ? 'text-red-500 font-bold' : 'text-green-500 font-bold'}>{leaseStats.mileageStatus}</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 relative">
                          {/* Expected mileage marker */}
                          <div className="absolute top-0 bottom-0 w-0.5 bg-black dark:bg-white z-20 shadow-sm" style={{ left: `${Math.min((leaseStats.progress), 100)}%` }} title="Expected Usage based on time elapsed"></div>
                          <div className={`h-3 rounded-full transition-all duration-500 ${leaseStats.mileageStatus === 'Over Budget' ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min((currentMileage / leaseStats.totalAllowance) * 100, 100)}%` }}></div>
                        </div>
                        <div className="flex justify-between text-xs text-light-text-secondary dark:text-dark-text-secondary mt-2">
                            <span>0 km</span>
                            <span>Limit: {leaseStats.totalAllowance.toLocaleString()} km</span>
                        </div>
                      </div>
                    )}
              </div>
            </div>
          )}
          
          {/* Usage Trends */}
          <Card>
             <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-4">Usage Trends</h3>
             <VehicleMileageChart logs={sortedMileageLogs} />
          </Card>

          {/* Valuation History */}
          <Card>
              <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-light-text dark:text-dark-text">Valuation History</h3>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest">
                      <span className="w-3 h-3 rounded-full bg-cyan-500"></span>
                      Market Value
                  </div>
              </div>
              <div className="h-[300px] w-full">
                  {account.priceHistory && account.priceHistory.length > 1 ? (
                      <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={account.priceHistory}>
                              <defs>
                                  <linearGradient id="colorValuationVehicle" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.3}/>
                                      <stop offset="95%" stopColor="#06B6D4" stopOpacity={0}/>
                                  </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
                              <XAxis 
                                  dataKey="date" 
                                  axisLine={false}
                                  tickLine={false}
                                  tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }}
                              />
                              <YAxis 
                                  axisLine={false}
                                  tickLine={false}
                                  tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }}
                                  tickFormatter={(val) => `€${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`}
                              />
                              <Tooltip 
                                  contentStyle={{ 
                                      backgroundColor: 'rgba(255, 255, 255, 0.9)', 
                                      borderRadius: '12px', 
                                      border: 'none', 
                                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                      color: '#1f2937'
                                  }}
                                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                                  labelStyle={{ fontSize: '10px', color: '#6b7280', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                                  formatter={(value: number) => [`€${value.toLocaleString()}`, 'Value']}
                              />
                              <Area 
                                  type="monotone" 
                                  dataKey="price" 
                                  stroke="#06B6D4" 
                                  strokeWidth={3}
                                  fillOpacity={1} 
                                  fill="url(#colorValuationVehicle)" 
                                  animationDuration={1500}
                              />
                          </AreaChart>
                      </ResponsiveContainer>
                  ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-gray-50 dark:bg-white/5 rounded-2xl border border-dashed border-black/10 dark:border-white/10">
                          <span className="material-symbols-outlined text-4xl text-gray-300 dark:text-gray-600 mb-2">show_chart</span>
                          <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">Not enough data to show trend</p>
                          <p className="text-xs text-light-text-secondary/60 dark:text-dark-text-secondary/60 mt-1">Add more valuation points to see how your vehicle value changes over time.</p>
                      </div>
                  )}
              </div>
          </Card>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-8">
             {/* Linked Loan Card */}
             {linkedLoan && (
                 <Card className="bg-gradient-to-br from-gray-50 to-white dark:from-dark-card dark:to-black/20 border-l-4 border-l-red-500">
                      <div className="flex justify-between items-start mb-4">
                          <div>
                              <h3 className="text-lg font-bold text-light-text dark:text-dark-text">Auto Loan</h3>
                              <button onClick={() => setViewingAccountId(linkedLoan.id)} className="text-xs text-primary-500 hover:underline font-medium mt-1 flex items-center gap-1">
                                  View Loan Details <span className="material-symbols-outlined text-[10px]">open_in_new</span>
                              </button>
                          </div>
                          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600 dark:text-red-400">
                              <span className="material-symbols-outlined text-xl">request_quote</span>
                          </div>
                      </div>
                      <div className="space-y-3">
                          <div className="flex justify-between items-center text-sm">
                              <span className="text-light-text-secondary dark:text-dark-text-secondary">Outstanding Principal</span>
                              <span className="font-bold text-red-600 dark:text-red-400">{formatCurrency(outstandingLoanBalance, linkedLoan.currency)}</span>
                          </div>
                          <div className="w-full h-px bg-black/5 dark:bg-white/5"></div>
                          <div className="flex justify-between items-center text-sm">
                              <span className="text-light-text-secondary dark:text-dark-text-secondary">Interest Rate</span>
                              <span className="font-medium text-light-text dark:text-dark-text">{linkedLoan.interestRate}%</span>
                          </div>
                           <div className="flex justify-between items-center text-sm">
                              <span className="text-light-text-secondary dark:text-dark-text-secondary">Monthly Payment</span>
                              <span className="font-medium text-light-text dark:text-dark-text">{linkedLoan.monthlyPayment ? formatCurrency(linkedLoan.monthlyPayment, linkedLoan.currency) : 'N/A'}</span>
                          </div>
                      </div>
                 </Card>
             )}

             {/* Vehicle Details Card */}
             <Card>
                 <h3 className="text-sm font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-4 border-b border-black/5 dark:border-white/5 pb-2">Vehicle Details</h3>
                 <div className="space-y-3 text-sm">
                     <div className="flex justify-between">
                         <span className="text-light-text-secondary dark:text-dark-text-secondary">VIN</span>
                         <span className="font-mono font-medium">{account.vin || '—'}</span>
                     </div>
                      <div className="flex justify-between">
                         <span className="text-light-text-secondary dark:text-dark-text-secondary">License Plate</span>
                         <span className="font-medium bg-gray-100 dark:bg-white/5 px-2 rounded">{account.licensePlate || '—'}</span>
                     </div>
                      <div className="flex justify-between">
                         <span className="text-light-text-secondary dark:text-dark-text-secondary">Registration</span>
                         <span className="font-medium">{account.registrationCountryCode || '—'}</span>
                     </div>
                      <div className="flex justify-between">
                         <span className="text-light-text-secondary dark:text-dark-text-secondary">Purchase/Start Date</span>
                         <span className="font-medium">{(isLeased ? account.leaseStartDate : account.purchaseDate) ? parseLocalDate((isLeased ? account.leaseStartDate : account.purchaseDate)!).toLocaleDateString() : '—'}</span>
                     </div>
                     {isLeased && (
                         <div className="flex justify-between">
                             <span className="text-light-text-secondary dark:text-dark-text-secondary">End Date</span>
                             <span className="font-medium">{account.leaseEndDate ? parseLocalDate(account.leaseEndDate).toLocaleDateString() : '—'}</span>
                         </div>
                     )}
                 </div>
             </Card>

            {/* Log History */}
            <Card className="flex flex-col h-full max-h-[500px] !p-0">
                <div className="flex justify-between items-center p-4 border-b border-black/5 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02]">
                    <h3 className="text-base font-bold text-light-text dark:text-dark-text">Log History</h3>
                    <button onClick={onAddLog} className={`${BTN_SECONDARY_STYLE} !py-1 !px-2 text-xs font-bold rounded-full`}>+ Log</button>
                </div>
                <div className="flex-grow overflow-y-auto px-4 py-2">
                {sortedMileageLogsDesc.length > 0 ? (
                    <div className="divide-y divide-black/5 dark:divide-white/5">
                        {sortedMileageLogsDesc.map((log, index, arr) => {
                             const prevLog = arr[index + 1];
                             const diff = prevLog ? log.reading - prevLog.reading : 0;
                             return (
                                <div key={log.id} className="group flex justify-between items-center py-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors px-2 rounded-lg -mx-2">
                                    <div>
                                        <p className="font-bold text-sm text-light-text dark:text-dark-text">{parseLocalDate(log.date).toLocaleDateString()}</p>
                                        {diff > 0 && <p className="text-[10px] text-green-600 dark:text-green-400 font-medium">+{diff.toLocaleString()} km</p>}
                                    </div>
                                    <div className="text-right">
                                        <p className="font-mono font-medium text-sm">{log.reading.toLocaleString()} km</p>
                                        <div className="flex justify-end gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => onEditLog(log)} className="text-xs text-primary-500 hover:underline">Edit</button>
                                            <button onClick={() => onDeleteLog(log.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                                        </div>
                                    </div>
                                </div>
                             );
                        })}
                    </div>
                ) : (
                    <div className="h-40 flex flex-col items-center justify-center text-light-text-secondary dark:text-dark-text-secondary opacity-60">
                         <span className="material-symbols-outlined text-3xl mb-2">history</span>
                        <p className="text-sm">No mileage logs recorded.</p>
                    </div>
                )}
                </div>
            </Card>
        </div>
      </div>
    </div>
  );
};

export default VehicleAccountView;