
import React from 'react';
import { Account, Transaction, LoanPaymentOverrides } from '../types';
import { formatCurrency, generateAmortizationSchedule, parseLocalDate } from '../utils';
import Card from './Card';
import PageHeader from './PageHeader';
import BankCard from './BankCard';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';

interface PropertyAccountViewProps {
  account: Account;
  accounts: Account[];
  transactions: Transaction[];
  loanPaymentOverrides: LoanPaymentOverrides;
  onAddTransaction: () => void;
  onUpdateValuation?: () => void;
  setViewingAccountId: (id: string | null) => void;
  onBack: () => void;
  onSyncLinkedAccount?: () => void;
  isLinkedToEnableBanking?: boolean;
  onCloseAsset?: () => void;
  onRevertClosure?: () => void;
}

const PropertyAccountView: React.FC<PropertyAccountViewProps> = ({
  account,
  accounts,
  transactions,
  loanPaymentOverrides,
  onAddTransaction,
  onUpdateValuation,
  setViewingAccountId,
  onBack,
  onSyncLinkedAccount,
  isLinkedToEnableBanking,
  onCloseAsset,
  onRevertClosure,
}) => {
  const isClosed = account.status === 'closed';
  const linkedLoan = accounts.find(a => a.id === account.linkedLoanId) || accounts.find(a => a.type === 'Loan' && a.linkedAssetId === account.id);
  
  // --- Financial Calculations ---
  const currentMarketValue = account.balance;

  // Calculate Outstanding Loan Balance (Principal Only) based on amortization if possible
  let outstandingLoanBalance = 0;
  let principalPaidViaLoan = 0;

  if (linkedLoan) {
      if (linkedLoan.principalAmount && linkedLoan.duration && linkedLoan.loanStartDate && linkedLoan.interestRate !== undefined) {
          const overrides = loanPaymentOverrides[linkedLoan.id] || {};
          const schedule = generateAmortizationSchedule(linkedLoan, transactions, overrides);
          
          const totalScheduledPrincipal = schedule.reduce((sum, p) => sum + p.principal, 0);
          const totalPaidPrincipal = schedule.reduce((acc, p) => p.status === 'Paid' ? acc + p.principal : acc, 0);
          
          outstandingLoanBalance = Math.max(0, totalScheduledPrincipal - totalPaidPrincipal);
          principalPaidViaLoan = totalPaidPrincipal;
      } else {
          // Fallback if loan isn't fully configured
          outstandingLoanBalance = Math.abs(linkedLoan.balance);
          
          // Estimate principal paid for manual loans (raw income transactions on loan account)
          principalPaidViaLoan = transactions
            .filter(tx => tx.accountId === linkedLoan.id && tx.type === 'income')
            .reduce((sum, tx) => sum + (tx.principalAmount || 0), 0);
      }
  }

  const purchasePrice = linkedLoan 
    ? ((linkedLoan.principalAmount || 0) + (linkedLoan.downPayment || 0)) 
    : (account.purchasePrice || 0);

  // Market Equity: Current Value - Outstanding Loan Balance (Debt)
  const marketEquity = currentMarketValue - outstandingLoanBalance;
  
  // Invested Equity (Principal Paid + Down Payment) OR manual override
  const investedEquity = linkedLoan 
    ? (principalPaidViaLoan + (linkedLoan.downPayment || 0))
    : (account.principalOwned || 0);

  const appreciation = currentMarketValue - (purchasePrice || 0);
  const appreciationPercent = purchasePrice ? (appreciation / purchasePrice) * 100 : 0;

  // Ownership Percentage (Market Equity / Market Value)
  const ownershipPercent = currentMarketValue > 0 ? (marketEquity / currentMarketValue) * 100 : 0;

  const features = [
      account.hasBasement ? { label: 'Basement', icon: 'foundation' } : null,
      account.hasAttic ? { label: 'Attic', icon: 'roofing' } : null,
      account.hasGarden ? { label: `Garden ${account.gardenSize ? `(${account.gardenSize} m²)` : ''}`, icon: 'yard' } : null,
      account.hasTerrace ? { label: `Terrace ${account.terraceSize ? `(${account.terraceSize} m²)` : ''}`, icon: 'deck' } : null,
      account.indoorParkingSpaces ? { label: `Indoor Parking (${account.indoorParkingSpaces})`, icon: 'garage' } : null,
      account.outdoorParkingSpaces ? { label: `Outdoor Parking (${account.outdoorParkingSpaces})`, icon: 'local_parking' } : null,
  ].filter(Boolean) as { label: string; icon: string }[];

  const PropertyStatItem = ({ icon, label, value }: { icon: string, label: string, value: string }) => (
      <div className="flex items-center gap-4 p-4 rounded-3xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 hover:border-black/10 dark:hover:border-white/10 transition-all">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-white dark:bg-white/5 text-primary-500 shadow-sm border border-black/5 dark:border-white/5">
              <span className="material-symbols-outlined text-xl">{icon}</span>
          </div>
          <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary opacity-60 leading-none mb-1">{label}</p>
              <p className="text-sm font-black text-light-text dark:text-dark-text tracking-tight leading-none">{value}</p>
          </div>
      </div>
  );

  return (
    <div className="space-y-8 pb-12">
      <PageHeader 
        markerIcon="location_on"
        markerLabel={`${account.address || 'Location Specified'} • Asset Acquisition: ${account.purchasePrice ? formatCurrency(account.purchasePrice, account.currency, { compact: true }) : 'N/A'}`}
        title={account.name}
        subtitle={isClosed ? `Asset liquidated on ${account.closureDetails?.date ? parseLocalDate(account.closureDetails.date).toLocaleDateString() : 'recent date'}.` : "High-fidelity real estate tracking with equity analysis and mortgage integration."}
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
             {!isClosed && (
                <button onClick={onUpdateValuation || onAddTransaction} className="flex items-center gap-2 px-5 py-2.5 bg-sky-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-sky-500/25 hover:bg-sky-600 transition-all">
                    <span className="material-symbols-outlined text-lg font-black">edit_location_alt</span>
                    <span className="hidden sm:inline">Update Value</span>
                </button>
             )}
          </div>
        }
      />

      {isClosed && account.closureDetails && (
        <motion.div 
           initial={{ opacity: 0, scale: 0.98 }}
           animate={{ opacity: 1, scale: 1 }}
           className="bg-rose-500 text-white rounded-[2.5rem] p-8 shadow-2xl shadow-rose-500/20 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none">
              <span className="material-symbols-outlined text-8xl">sell</span>
          </div>
          <div className="relative z-10 flex items-start gap-6">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md border border-white/20">
              <span className="material-symbols-outlined text-3xl">info</span>
            </div>
            <div className="space-y-4">
              <div>
                  <h3 className="text-xl font-black uppercase tracking-widest leading-none mb-1">Asset Divested</h3>
                  <p className="text-sm font-bold opacity-80 leading-relaxed max-w-2xl">
                    This property was archived as <strong className="underline underline-offset-4">{account.closureDetails.closureType}</strong> on {parseLocalDate(account.closureDetails.date).toLocaleDateString(undefined, { dateStyle: 'long' })}. 
                  </p>
              </div>
              {account.closureDetails.notes && (
                <p className="text-sm italic opacity-70 bg-white/10 p-4 rounded-2xl border border-white/10">"{account.closureDetails.notes}"</p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Card and Core Metrics */}
        <div className="lg:col-span-4 space-y-8">
            <BankCard 
                name={account.name}
                balance={account.balance}
                currency={account.currency}
                last4={account.last4}
                institution={account.financialInstitution}
                type="Property"
                color="sky"
            />

            <div className="grid grid-cols-1 gap-4">
                <div className="p-8 rounded-[2.5rem] bg-white dark:bg-white/[0.03] border border-black/5 dark:border-white/5 shadow-sm relative overflow-hidden group">
                     <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-700">
                         <span className="material-symbols-outlined text-8xl text-emerald-500">trending_up</span>
                     </div>
                     <p className="text-[10px] font-black uppercase tracking-widest text-light-text-secondary mb-4 opacity-60 leading-none">Total Value Gained</p>
                     <div className="space-y-1 mb-6">
                        <h3 className="text-4xl font-black tracking-tightest text-emerald-500 leading-none privacy-blur">
                            {appreciation >= 0 ? '+' : ''}{formatCurrency(appreciation, account.currency)}
                        </h3>
                        <p className="text-xs font-bold text-emerald-500/60 uppercase tracking-widest">{appreciationPercent.toFixed(1)}% Appreciation ROI</p>
                     </div>
                     <div className="h-1 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                         <div className="h-full bg-emerald-500 rounded-full" style={{ width: '100%' }} />
                     </div>
                </div>

                <div className="p-8 rounded-[2.5rem] bg-black text-white dark:bg-white dark:text-black shadow-2xl relative overflow-hidden group">
                     <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none group-hover:scale-110 transition-transform duration-700">
                         <span className="material-symbols-outlined text-8xl">balance</span>
                     </div>
                     <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-4 leading-none">Equity Distribution</p>
                     <div className="flex items-end justify-between mb-6">
                        <span className="text-5xl font-black tracking-tightest leading-none">{ownershipPercent.toFixed(0)}%</span>
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-60 bg-white/20 dark:bg-black/10 px-2 py-1 rounded-lg">Owned</span>
                     </div>
                     <div className="h-2 w-full bg-white/10 dark:bg-black/5 rounded-full overflow-hidden flex shadow-inner">
                        <div className="h-full bg-emerald-400" style={{ width: `${ownershipPercent}%` }} />
                        <div className="h-full bg-rose-400 opacity-50" style={{ width: `${100 - ownershipPercent}%` }} />
                     </div>
                </div>
            </div>
        </div>

        {/* Right Column: Specs and History */}
        <div className="lg:col-span-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <Card className="p-8 !rounded-[2.5rem]">
                    <div className="flex items-center gap-4 mb-8 pb-4 border-b border-black/5 dark:border-white/5">
                        <div className="w-12 h-12 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center">
                            <span className="material-symbols-outlined text-primary-500">apartment</span>
                        </div>
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-light-text dark:text-dark-text leading-none mb-1">Asset Profile</h3>
                            <p className="text-[10px] font-bold text-light-text-secondary opacity-60 uppercase tracking-widest">Property Matrix</p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <PropertyStatItem icon="straighten" label="Lot size" value={account.propertySize ? `${account.propertySize} m²` : 'Urban'} />
                        <PropertyStatItem icon="bed" label="Sleep" value={account.bedrooms ? `${account.bedrooms} Units` : 'Studio'} />
                        <PropertyStatItem icon="stairs" label="Vertical" value={account.floors ? `${account.floors} Floors` : 'Ground'} />
                        <PropertyStatItem icon="garage" label="Parking" value={(account.indoorParkingSpaces || account.outdoorParkingSpaces) ? `${(account.indoorParkingSpaces || 0) + (account.outdoorParkingSpaces || 0)} Lots` : 'N/A'} />
                    </div>
                 </Card>

                 <Card className="p-8 !rounded-[2.5rem]">
                    <div className="flex items-center gap-4 mb-8 pb-4 border-b border-black/5 dark:border-white/5">
                        <div className="w-12 h-12 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center">
                            <span className="material-symbols-outlined text-rose-500">account_balance</span>
                        </div>
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-light-text dark:text-dark-text leading-none mb-1">Liability Ledger</h3>
                            <p className="text-[10px] font-bold text-light-text-secondary opacity-60 uppercase tracking-widest">Mortgage Status</p>
                        </div>
                    </div>
                    
                    {linkedLoan ? (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center group/loan">
                                 <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-rose-500 opacity-20 group-hover/loan:opacity-100 transition-opacity" />
                                    <span className="text-xs font-black uppercase tracking-widest text-light-text-secondary">Outstanding Debt</span>
                                 </div>
                                 <span className="text-lg font-black text-rose-500 tracking-tight privacy-blur">{formatCurrency(outstandingLoanBalance, account.currency)}</span>
                            </div>
                            <div className="flex justify-between items-center group/loan">
                                 <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 opacity-20 group-hover/loan:opacity-100 transition-opacity" />
                                    <span className="text-xs font-black uppercase tracking-widest text-light-text-secondary">Active Equity</span>
                                 </div>
                                 <span className="text-lg font-black text-emerald-500 tracking-tight privacy-blur">{formatCurrency(marketEquity, account.currency)}</span>
                            </div>
                            <button 
                                onClick={() => setViewingAccountId(linkedLoan.id)}
                                className="w-full py-3 mt-2 rounded-2xl bg-black/5 dark:bg-white/5 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                            >
                                Inspect Mortgage Details
                            </button>
                        </div>
                    ) : (
                        <div className="h-32 flex flex-col items-center justify-center text-center opacity-40">
                             <span className="material-symbols-outlined text-3xl mb-2">link_off</span>
                             <p className="text-[10px] font-black uppercase tracking-widest">Unleveraged Asset</p>
                        </div>
                    )}
                 </Card>
            </div>

            <div className="bg-white dark:bg-dark-card rounded-[2.5rem] p-8 border border-black/5 dark:border-white/5 shadow-sm">
                 <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center">
                            <span className="material-symbols-outlined">timeline</span>
                        </div>
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-light-text dark:text-dark-text leading-none mb-1">Strategic Valuation</h3>
                            <p className="text-[10px] font-bold text-light-text-secondary opacity-60 uppercase tracking-widest leading-none">Historical Market Sentiment</p>
                        </div>
                    </div>
                 </div>

                 <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={account.priceHistory || []}>
                            <defs>
                                <linearGradient id="propValGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.05} />
                            <XAxis 
                                dataKey="date" 
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 10, fontWeight: 900, fill: 'currentColor', opacity: 0.4 }}
                            />
                            <YAxis 
                                hide={true}
                            />
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: 'rgba(255, 255, 255, 0.9)', 
                                    borderRadius: '1.5rem', 
                                    border: 'none', 
                                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1)',
                                    color: '#000'
                                }}
                                itemStyle={{ fontSize: '14px', fontWeight: 900 }}
                                labelStyle={{ fontSize: '9px', fontWeight: 900, color: '#666', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                                formatter={(value: number) => [formatCurrency(value, account.currency), 'Market Value']}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="price" 
                                stroke="#0ea5e9" 
                                strokeWidth={4}
                                fillOpacity={1} 
                                fill="url(#propValGradient)" 
                                animationDuration={2000}
                                animationEasing="ease-in-out"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                 </div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
            <Card className="p-8 !rounded-[2.5rem] space-y-6">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-light-text-secondary opacity-60">Features</h3>
                <div className="flex flex-wrap gap-2">
                    {features.length > 0 ? features.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
                            <span className="material-symbols-outlined text-lg text-primary-500">{f.icon}</span>
                            <span className="text-[10px] font-black uppercase tracking-widest">{f.label}</span>
                        </div>
                    )) : <p className="text-[10px] font-black uppercase tracking-widest opacity-40 italic">Minimalist Setup</p>}
                </div>
            </Card>

            <Card className="p-8 !rounded-[2.5rem] space-y-6 col-span-2">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-light-text-secondary opacity-60">Maintenance Costs</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                            <span className="material-symbols-outlined">gavel</span>
                        </div>
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-widest opacity-40">Annual Tax</p>
                            <p className="text-sm font-black">{account.propertyTaxAmount ? formatCurrency(account.propertyTaxAmount, account.currency) : 'Exempt'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                            <span className="material-symbols-outlined">shield</span>
                        </div>
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-widest opacity-40">Premium</p>
                            <p className="text-sm font-black">{account.insuranceAmount ? formatCurrency(account.insuranceAmount, account.currency) : 'Self-Insured'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                            <span className="material-symbols-outlined">cleaning_services</span>
                        </div>
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-widest opacity-40">HOA Dues</p>
                            <p className="text-sm font-black">{account.hoaFeeAmount ? formatCurrency(account.hoaFeeAmount, account.currency) : 'N/A'}</p>
                        </div>
                    </div>
                </div>
            </Card>
      </div>

      {!isClosed && onCloseAsset && (
        <div className="pt-12 text-center">
            <button 
                onClick={onCloseAsset}
                className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-rose-500/60 hover:text-rose-500 transition-colors"
            >
                <span className="material-symbols-outlined text-sm">archive</span>
                Initiate Asset Closure Protocol
            </button>
        </div>
      )}
    </div>
  );
};

export default PropertyAccountView;
