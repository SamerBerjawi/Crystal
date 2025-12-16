
import React from 'react';
import { Account, Transaction, LoanPaymentOverrides } from '../types';
import { formatCurrency, generateAmortizationSchedule } from '../utils';
import Card from './Card';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';

interface PropertyAccountViewProps {
  account: Account;
  accounts: Account[];
  transactions: Transaction[];
  loanPaymentOverrides: LoanPaymentOverrides;
  onAddTransaction: () => void;
  setViewingAccountId: (id: string | null) => void;
  onBack: () => void;
  onSyncLinkedAccount?: () => void;
  isLinkedToEnableBanking?: boolean;
}

const PropertyAccountView: React.FC<PropertyAccountViewProps> = ({
  account,
  accounts,
  transactions,
  loanPaymentOverrides,
  onAddTransaction,
  setViewingAccountId,
  onBack,
  onSyncLinkedAccount,
  isLinkedToEnableBanking,
}) => {
  const linkedLoan = accounts.find(a => a.id === account.linkedLoanId);
  
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
      <div className="flex items-center gap-3 p-3 rounded-xl bg-light-fill dark:bg-white/5 border border-black/5 dark:border-white/5">
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white dark:bg-white/10 text-light-text-secondary dark:text-dark-text-secondary shadow-sm">
              <span className="material-symbols-outlined text-xl">{icon}</span>
          </div>
          <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-light-text-secondary dark:text-dark-text-secondary">{label}</p>
              <p className="font-semibold text-light-text dark:text-dark-text">{value}</p>
          </div>
      </div>
  );

  return (
    <div className="space-y-8 animate-fade-in-up pb-12">
      {/* Navigation Header */}
      <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-light-text-secondary dark:text-dark-text-secondary transition-colors">
                <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div>
                <h1 className="text-2xl font-bold text-light-text dark:text-dark-text">{account.name}</h1>
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">location_on</span>
                    {account.address || 'No address set'}
                </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
              {isLinkedToEnableBanking && onSyncLinkedAccount && (
                  <button onClick={onSyncLinkedAccount} className={BTN_SECONDARY_STYLE}>Sync</button>
              )}
              <button onClick={onAddTransaction} className={BTN_PRIMARY_STYLE}>
                  <span className="material-symbols-outlined mr-2 text-lg">add</span>
                  Update Value
              </button>
          </div>
      </header>

      {/* Hero Section: Asset & Equity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Asset Card */}
          <div className="lg:col-span-2 relative overflow-hidden rounded-3xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 shadow-xl min-h-[300px] flex flex-col group">
               {/* Background Image / Placeholder */}
               <div className="absolute inset-0 z-0">
                   {/* Fallback pattern if no image */}
                   <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 opacity-50"></div>
                   <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
               </div>
               
               <div className="relative z-10 p-8 flex flex-col h-full justify-between">
                   <div className="flex justify-between items-start">
                       <span className="px-3 py-1 rounded-full bg-white/80 dark:bg-black/40 backdrop-blur-md text-xs font-bold uppercase tracking-wider shadow-sm border border-black/5 dark:border-white/10">
                           {account.propertyType || 'Property'}
                       </span>
                       {/* LTV Indicator */}
                       <div className="text-right">
                           <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary mb-1">Ownership</p>
                           <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{ownershipPercent.toFixed(0)}%</p>
                       </div>
                   </div>

                   <div className="mt-auto">
                       <p className="text-sm font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary mb-1">Market Value</p>
                       <h2 className="text-5xl font-extrabold text-light-text dark:text-dark-text tracking-tight mb-6">
                           {formatCurrency(currentMarketValue, account.currency)}
                       </h2>
                       
                       {/* Equity Progress Bar */}
                       <div className="w-full h-4 bg-gray-200 dark:bg-black/30 rounded-full overflow-hidden shadow-inner relative flex">
                           {/* Equity Part */}
                           <div 
                                className="h-full bg-emerald-500 relative group/bar" 
                                style={{ width: `${ownershipPercent}%` }}
                                title={`Equity: ${formatCurrency(marketEquity, account.currency)}`}
                           >
                                <div className="absolute inset-0 bg-white/20 opacity-0 group-hover/bar:opacity-100 transition-opacity"></div>
                           </div>
                           {/* Debt Part */}
                           <div 
                                className="h-full bg-red-500 relative group/bar" 
                                style={{ width: `${100 - ownershipPercent}%` }}
                                title={`Debt: ${formatCurrency(outstandingLoanBalance, account.currency)}`}
                           >
                               <div className="absolute inset-0 bg-white/20 opacity-0 group-hover/bar:opacity-100 transition-opacity"></div>
                           </div>
                       </div>
                       <div className="flex justify-between mt-2 text-xs font-semibold">
                           <span className="text-emerald-600 dark:text-emerald-400">Equity: {formatCurrency(marketEquity, account.currency)}</span>
                           <span className="text-red-600 dark:text-red-400">Debt: {formatCurrency(outstandingLoanBalance, account.currency)}</span>
                       </div>
                   </div>
               </div>
          </div>

          {/* Performance Column */}
          <div className="flex flex-col gap-6">
              {/* Appreciation Card */}
              <Card className="flex-1 flex flex-col justify-center relative overflow-hidden bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/10 dark:to-teal-900/10 border-emerald-100 dark:border-emerald-800/30">
                  <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                      <span className="material-symbols-outlined text-8xl text-emerald-600">trending_up</span>
                  </div>
                  <div className="relative z-10">
                      <p className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 mb-1">Total Appreciation</p>
                      <h3 className="text-3xl font-extrabold text-emerald-700 dark:text-emerald-300">
                          {appreciation >= 0 ? '+' : ''}{formatCurrency(appreciation, account.currency)}
                      </h3>
                      <div className="inline-flex items-center gap-1 mt-2 px-2 py-1 rounded-md bg-emerald-100 dark:bg-emerald-800/30 text-emerald-800 dark:text-emerald-200 text-xs font-bold">
                          <span className="material-symbols-outlined text-sm">{appreciation >= 0 ? 'arrow_upward' : 'arrow_downward'}</span>
                          {appreciationPercent.toFixed(1)}% ROI
                      </div>
                  </div>
              </Card>
              
              {/* Invested Capital */}
              <Card className="flex-1 flex flex-col justify-center">
                  <div className="flex justify-between items-start mb-2">
                       <p className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">Purchase Price</p>
                       <span className="material-symbols-outlined text-light-text-secondary dark:text-dark-text-secondary opacity-50">history</span>
                  </div>
                  <h3 className="text-2xl font-bold text-light-text dark:text-dark-text">{formatCurrency(purchasePrice, account.currency)}</h3>
                  <div className="w-full h-px bg-black/5 dark:bg-white/5 my-3"></div>
                  <div className="flex justify-between items-center">
                      <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Invested Equity</p>
                      <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(investedEquity, account.currency)}</p>
                  </div>
              </Card>
          </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          
          {/* Left Column: Details */}
          <div className="xl:col-span-2 space-y-8">
              {/* Property Specs */}
              <Card>
                  <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-6">Property Specifications</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <PropertyStatItem icon="straighten" label="Lot Size" value={account.propertySize ? `${account.propertySize} m²` : '—'} />
                      <PropertyStatItem icon="calendar_month" label="Year Built" value={account.yearBuilt ? `${account.yearBuilt}` : '—'} />
                      <PropertyStatItem icon="stairs" label="Floors" value={account.floors ? `${account.floors}` : '—'} />
                      <PropertyStatItem icon="bed" label="Bedrooms" value={account.bedrooms ? `${account.bedrooms}` : '—'} />
                      <PropertyStatItem icon="bathtub" label="Bathrooms" value={account.bathrooms ? `${account.bathrooms}` : '—'} />
                      <PropertyStatItem icon="garage" label="Parking" value={(account.indoorParkingSpaces || account.outdoorParkingSpaces) ? `${(account.indoorParkingSpaces || 0) + (account.outdoorParkingSpaces || 0)} Spaces` : '—'} />
                  </div>
              </Card>

              {/* Amenities */}
              <Card>
                  <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-4">Features & Amenities</h3>
                  {features.length > 0 ? (
                      <div className="flex flex-wrap gap-3">
                          {features.map((feature, idx) => (
                              <div key={idx} className="flex items-center gap-2 px-4 py-2 rounded-full bg-light-fill dark:bg-dark-fill border border-black/5 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                                  <span className="material-symbols-outlined text-primary-500 text-lg">{feature.icon}</span>
                                  <span className="text-sm font-medium text-light-text dark:text-dark-text">{feature.label}</span>
                              </div>
                          ))}
                      </div>
                  ) : (
                      <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm italic">No features listed. Edit account to add details.</p>
                  )}
              </Card>
          </div>

          {/* Right Column: Liabilities & Costs */}
          <div className="space-y-8">
               {/* Linked Loan Card */}
               {linkedLoan ? (
                   <Card className="bg-gradient-to-br from-gray-50 to-white dark:from-dark-card dark:to-black/20 border-l-4 border-l-red-500">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-light-text dark:text-dark-text">Mortgage</h3>
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
               ) : (
                   <Card className="border-dashed border-2 border-black/10 dark:border-white/10 bg-transparent flex flex-col items-center justify-center py-8 text-center">
                        <span className="material-symbols-outlined text-4xl text-gray-300 dark:text-gray-600 mb-2">link_off</span>
                        <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">No linked loan</p>
                        <button className="text-xs text-primary-500 hover:underline mt-1" onClick={onAddTransaction /* Ideally open edit modal here */}>Link a mortgage</button>
                   </Card>
               )}

               {/* Recurring Costs */}
               <Card>
                   <h3 className="text-base font-bold text-light-text dark:text-dark-text mb-4 uppercase tracking-wider text-xs">Operating Costs</h3>
                   <div className="divide-y divide-black/5 dark:divide-white/5">
                        <div className="py-3 flex justify-between items-center first:pt-0">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-lg">gavel</span>
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-light-text dark:text-dark-text">Property Tax</p>
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Annual</p>
                                </div>
                            </div>
                            <span className="font-medium text-light-text dark:text-dark-text">{account.propertyTaxAmount ? formatCurrency(account.propertyTaxAmount, account.currency) : '—'}</span>
                        </div>

                         <div className="py-3 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-lg">shield</span>
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-light-text dark:text-dark-text">Insurance</p>
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary capitalize">{account.insuranceFrequency || '—'}</p>
                                </div>
                            </div>
                            <span className="font-medium text-light-text dark:text-dark-text">{account.insuranceAmount ? formatCurrency(account.insuranceAmount, account.currency) : '—'}</span>
                        </div>

                         <div className="py-3 flex justify-between items-center last:pb-0">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-lg">cleaning_services</span>
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-light-text dark:text-dark-text">HOA Fees</p>
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary capitalize">{account.hoaFeeFrequency || '—'}</p>
                                </div>
                            </div>
                            <span className="font-medium text-light-text dark:text-dark-text">{account.hoaFeeAmount ? formatCurrency(account.hoaFeeAmount, account.currency) : '—'}</span>
                        </div>
                   </div>
               </Card>
               
               {account.isRental && (
                   <Card className="bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/30">
                       <div className="flex items-center justify-between mb-2">
                           <h3 className="text-sm font-bold text-green-800 dark:text-green-300 uppercase tracking-wider">Rental Income</h3>
                           <span className="material-symbols-outlined text-green-600 dark:text-green-400">payments</span>
                       </div>
                       <p className="text-2xl font-bold text-green-700 dark:text-green-400">{account.rentalIncomeAmount ? formatCurrency(account.rentalIncomeAmount, account.currency) : '—'}</p>
                       <p className="text-xs text-green-600/80 dark:text-green-400/80 mt-1 capitalize">Per {account.rentalIncomeFrequency || 'month'}</p>
                   </Card>
               )}
          </div>
      </div>
    </div>
  );
};

export default PropertyAccountView;
