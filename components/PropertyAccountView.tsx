
import React, { useMemo } from 'react';
import { Account, Transaction } from '../types';
import { formatCurrency } from '../utils';
import Card from './Card';
import { BTN_PRIMARY_STYLE, ACCOUNT_TYPE_STYLES } from '../constants';
import { useGoalsContext } from '../contexts/FinancialDataContext';

interface PropertyAccountViewProps {
  account: Account;
  accounts: Account[];
  transactions: Transaction[];
  onAddTransaction: () => void;
  setViewingAccountId: (id: string | null) => void;
  onBack: () => void;
}

const PropertyAccountView: React.FC<PropertyAccountViewProps> = ({
  account,
  accounts,
  transactions,
  onAddTransaction,
  setViewingAccountId,
  onBack
}) => {
  const { financialGoals } = useGoalsContext();
  const linkedLoan = accounts.find(a => a.id === account.linkedLoanId);
  
  // --- Linked Goals ---
  const linkedGoals = useMemo(() => {
    return financialGoals.filter(g => g.paymentAccountId === account.id);
  }, [financialGoals, account.id]);

  // Calculate Equity and Appreciation
  // Principal owned is mostly relevant if there is a loan, otherwise it's the value
  const principalOwned = linkedLoan 
    ? (transactions.filter(tx => tx.accountId === linkedLoan.id && tx.type === 'income').reduce((sum, tx) => sum + (tx.principalAmount || 0), 0) + (linkedLoan.downPayment || 0)) 
    : (account.principalOwned || 0);
    
  const purchasePrice = linkedLoan 
    ? ((linkedLoan.principalAmount || 0) + (linkedLoan.downPayment || 0)) 
    : (account.purchasePrice || 0);

  // Market Equity: Current Value - Outstanding Loan Balance
  const marketEquity = linkedLoan ? account.balance - Math.abs(linkedLoan.balance) : account.balance;
  
  // Invested Equity: Down Payment + Principal Paid
  const investedEquity = principalOwned;

  const appreciation = account.balance - (purchasePrice || 0);
  const appreciationPercent = purchasePrice ? (appreciation / purchasePrice) * 100 : 0;

  const features = [
      account.hasBasement ? { label: 'Basement', icon: 'foundation' } : null,
      account.hasAttic ? { label: 'Attic', icon: 'roofing' } : null,
      account.hasGarden ? { label: `Garden ${account.gardenSize ? `(${account.gardenSize} m²)` : ''}`, icon: 'yard' } : null,
      account.hasTerrace ? { label: `Terrace ${account.terraceSize ? `(${account.terraceSize} m²)` : ''}`, icon: 'deck' } : null,
      account.indoorParkingSpaces ? { label: `Indoor Parking (${account.indoorParkingSpaces})`, icon: 'garage' } : null,
      account.outdoorParkingSpaces ? { label: `Outdoor Parking (${account.outdoorParkingSpaces})`, icon: 'local_parking' } : null,
  ].filter(Boolean) as { label: string; icon: string }[];

  return (
    <div className="space-y-6 animate-fade-in-up">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4 w-full">
          <button onClick={onBack} className="text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex-shrink-0">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex items-center gap-4 w-full">
            <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${ACCOUNT_TYPE_STYLES[account.type]?.color || 'text-gray-600'} bg-current/10 border border-current/20`}>
              <span className="material-symbols-outlined text-4xl">{account.icon || 'home'}</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-light-text dark:text-dark-text">{account.name}</h1>
              <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                <span>{account.propertyType || 'Property'}</span>
                {account.address && <><span>•</span><span className="truncate max-w-[200px]" title={account.address}>{account.address}</span></>}
              </div>
            </div>
            <div className="ml-auto">
              <button onClick={onAddTransaction} className={BTN_PRIMARY_STYLE}>Add Transaction</button>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card><p className="text-xs uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary font-semibold mb-1">Current Value</p><p className="text-2xl font-bold text-light-text dark:text-dark-text">{formatCurrency(account.balance, account.currency)}</p></Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary font-semibold mb-1">Market Equity</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(marketEquity, account.currency)}</p>
          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Value - Debt</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary font-semibold mb-1">Invested Equity</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(investedEquity, account.currency)}</p>
          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Principal + Down Payment</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary font-semibold mb-1">Appreciation</p>
          <div className="flex items-baseline gap-2">
            <p className={`text-2xl font-bold ${appreciation >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {appreciation >= 0 ? '+' : ''}{formatCurrency(appreciation, account.currency)}
            </p>
            <p className={`text-sm font-semibold ${appreciation >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              ({appreciationPercent >= 0 ? '+' : ''}{appreciationPercent.toFixed(1)}%)
            </p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <h3 className="text-base font-semibold text-light-text dark:text-dark-text mb-4">Property Details</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
            <div><p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">Size</p><p className="font-semibold text-lg">{account.propertySize ? `${account.propertySize} m²` : 'N/A'}</p></div>
            <div><p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">Year Built</p><p className="font-semibold text-lg">{account.yearBuilt || 'N/A'}</p></div>
            <div><p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">Floors</p><p className="font-semibold text-lg">{account.floors || 'N/A'}</p></div>
            <div><p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">Bedrooms</p><p className="font-semibold text-lg">{account.bedrooms || 'N/A'}</p></div>
            <div><p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">Bathrooms</p><p className="font-semibold text-lg">{account.bathrooms || 'N/A'}</p></div>
            <div>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">Linked Loan</p>
                {linkedLoan ? (
                    <button onClick={() => setViewingAccountId(linkedLoan.id)} className="font-semibold text-lg text-primary-500 hover:underline truncate max-w-full block text-left">
                        {linkedLoan.name}
                    </button>
                ) : (
                    <p className="font-semibold text-lg text-gray-400">None</p>
                )}
            </div>
          </div>
        </Card>
        <div className="space-y-6">
          {linkedGoals.length > 0 && (
            <Card className="flex-shrink-0">
                <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-500">flag</span>
                    Linked Goals
                </h3>
                <div className="space-y-4">
                    {linkedGoals.map(goal => {
                        const progress = Math.min(100, Math.max(0, (goal.currentAmount / goal.amount) * 100));
                        return (
                            <div key={goal.id} className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-semibold text-sm text-light-text dark:text-dark-text">{goal.name}</span>
                                    <span className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary">{progress.toFixed(0)}%</span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden mb-2">
                                    <div className="h-full bg-amber-500 rounded-full" style={{ width: `${progress}%` }}></div>
                                </div>
                                <div className="flex justify-between text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                    <span>{formatCurrency(goal.currentAmount, 'EUR')}</span>
                                    <span>Target: {formatCurrency(goal.amount, 'EUR')}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Card>
          )}

          <Card>
            <h3 className="text-base font-semibold text-light-text dark:text-dark-text mb-4">Features & Amenities</h3>
            {features.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {features.map(feature => (
                  <div key={`${feature.label}-${feature.icon}`} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-light-fill dark:bg-dark-fill border border-black/5 dark:border-white/10">
                    <span className="material-symbols-outlined text-primary-500">{feature.icon}</span>
                    <span className="text-sm font-medium text-light-text dark:text-dark-text">{feature.label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm">No features listed.</p>
            )}
          </Card>
          <Card>
            <h3 className="text-base font-semibold text-light-text dark:text-dark-text mb-4">Recurring Costs & Income</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">Property Tax</span><span className="font-medium">{account.propertyTaxAmount ? formatCurrency(account.propertyTaxAmount, account.currency) : 'N/A'}</span></div>
              <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">Insurance</span><span className="font-medium">{account.insuranceAmount ? formatCurrency(account.insuranceAmount, account.currency) : 'N/A'}</span></div>
              <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">HOA Fees</span><span className="font-medium">{account.hoaFeeAmount ? formatCurrency(account.hoaFeeAmount, account.currency) : 'N/A'}</span></div>
              {account.isRental && (
                <div className="flex justify-between border-t border-black/5 dark:border-white/5 pt-2 mt-1">
                  <span className="text-light-text-secondary dark:text-dark-text-secondary">Rental Income</span>
                  <span className="font-medium text-green-500">+{account.rentalIncomeAmount ? formatCurrency(account.rentalIncomeAmount, account.currency) : '0'}</span>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PropertyAccountView;
