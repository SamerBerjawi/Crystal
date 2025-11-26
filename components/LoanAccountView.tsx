
import React, { useMemo } from 'react';
import { Account, Transaction, ScheduledPayment } from '../types';
import { formatCurrency, generateAmortizationSchedule, parseDateAsUTC } from '../utils';
import Card from './Card';
import MortgageAmortizationChart from './MortgageAmortizationChart';
import PaymentPlanTable from './PaymentPlanTable';
import { BTN_PRIMARY_STYLE } from '../constants';
import { useGoalsContext } from '../contexts/FinancialDataContext';

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
  onBack
}) => {
  const { financialGoals } = useGoalsContext();
  const isLending = account.type === 'Lending';

  const loanDetails = useMemo(() => {
    const schedule = generateAmortizationSchedule(account, transactions, loanPaymentOverrides);
    const totalPaidPrincipal = schedule.reduce((acc, p) => p.status === 'Paid' ? acc + p.principal : acc, 0);
    const totalPaidInterest = schedule.reduce((acc, p) => p.status === 'Paid' ? acc + p.interest : acc, 0);
    const linkedProperty = accounts.find(a => a.type === 'Property' && a.linkedLoanId === account.id);
    
    let ltv = 0;
    let marketEquity = 0;
    
    if (linkedProperty) {
      const propertyValue = linkedProperty.balance;
      const loanBalance = Math.abs(account.balance);
      if (propertyValue > 0) ltv = (loanBalance / propertyValue) * 100;
      marketEquity = propertyValue - loanBalance;
    }
    
    // Invested Equity: Principal Paid + Down Payment
    const equity = totalPaidPrincipal + (account.downPayment || 0);
    
    const lastPayment = schedule[schedule.length - 1];
    const payoffDate = lastPayment ? parseDateAsUTC(lastPayment.date) : null;
    
    return { schedule, totalPaidPrincipal, totalPaidInterest, linkedProperty, ltv, equity, marketEquity, payoffDate };
  }, [account, transactions, loanPaymentOverrides, accounts]);

  // Linked Goals
  const linkedGoals = useMemo(() => {
    return financialGoals.filter(g => g.paymentAccountId === account.id);
  }, [financialGoals, account.id]);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4 w-full">
          <button onClick={onBack} className="text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex-shrink-0">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex items-center gap-4 w-full">
            <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${isLending ? 'text-teal-500 bg-teal-500/10 border-teal-500/20' : 'text-red-500 bg-red-500/10 border-red-500/20'} border`}>
              <span className="material-symbols-outlined text-4xl">{isLending ? 'real_estate_agent' : 'request_quote'}</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-light-text dark:text-dark-text">{account.name}</h1>
              <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                <span>{isLending ? 'Lending' : 'Loan'}</span>
                {account.interestRate && <><span>•</span><span>{account.interestRate}% Interest</span></>}
              </div>
            </div>
            <div className="ml-auto">
              <button onClick={onAddTransaction} className={BTN_PRIMARY_STYLE}>Add Transaction</button>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Card>
              <p className="text-xs uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary font-semibold mb-1">{isLending ? 'Outstanding Principal' : 'Outstanding Balance'}</p>
              <p className={`text-2xl font-bold ${isLending ? 'text-teal-600 dark:text-teal-400' : 'text-red-600 dark:text-red-400'}`}>{formatCurrency(Math.abs(account.balance), account.currency)}</p>
            </Card>
            <Card>
              <p className="text-xs uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary font-semibold mb-1">{isLending ? 'Principal Received' : 'Principal Paid'}</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(loanDetails.totalPaidPrincipal, account.currency)}</p>
            </Card>
            <Card>
              <p className="text-xs uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary font-semibold mb-1">{isLending ? 'Interest Earned' : 'Interest Paid'}</p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{formatCurrency(loanDetails.totalPaidInterest, account.currency)}</p>
            </Card>
          </div>
          <div className="flex-1 min-h-[300px]">
             <MortgageAmortizationChart schedule={loanDetails.schedule} currency={account.currency} accountType={account.type} />
          </div>
        </div>
        <div className="space-y-6 flex flex-col">
          <Card>
            <h3 className="text-base font-semibold text-light-text dark:text-dark-text mb-4">Loan Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">Total Amount</span><span className="font-medium">{formatCurrency(account.totalAmount || 0, account.currency)}</span></div>
              <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">Start Date</span><span className="font-medium">{account.loanStartDate ? parseDateAsUTC(account.loanStartDate).toLocaleDateString() : 'N/A'}</span></div>
              <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">Term</span><span className="font-medium">{account.duration} months</span></div>
              <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">Payoff Date</span><span className="font-medium">{loanDetails.payoffDate ? loanDetails.payoffDate.toLocaleDateString() : 'N/A'}</span></div>
              {account.linkedAccountId && <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">Linked Account</span><span className="font-medium text-right truncate max-w-[150px]">{accounts.find(a=>a.id===account.linkedAccountId)?.name}</span></div>}
            </div>
          </Card>
          {!isLending && (
            <Card>
              <h3 className="text-base font-semibold text-light-text dark:text-dark-text mb-4">Equity & LTV</h3>
              <div className="space-y-3 text-sm">
                {loanDetails.linkedProperty && (
                  <div className="flex justify-between items-center pb-2 border-b border-black/5 dark:border-white/5">
                    <span className="text-light-text-secondary dark:text-dark-text-secondary">Property</span>
                    <button onClick={() => setViewingAccountId(loanDetails.linkedProperty!.id)} className="text-primary-500 hover:underline font-medium truncate max-w-[150px]">{loanDetails.linkedProperty.name}</button>
                  </div>
                )}
                <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">LTV Ratio</span><span className={`font-bold ${loanDetails.ltv > 80 ? 'text-red-500' : 'text-green-500'}`}>{loanDetails.ltv.toFixed(1)}%</span></div>
                <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">Down Payment</span><span className="font-medium">{formatCurrency(account.downPayment || 0, account.currency)}</span></div>
                <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">Principal Paid</span><span className="font-medium">{formatCurrency(loanDetails.totalPaidPrincipal, account.currency)}</span></div>
                <div className="flex justify-between border-t border-black/5 dark:border-white/5 pt-2"><span className="text-light-text-secondary dark:text-dark-text-secondary font-semibold">Invested Equity</span><span className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency(loanDetails.equity, account.currency)}</span></div>
                <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary font-semibold">Market Equity</span><span className="font-bold text-green-600 dark:text-green-400">{formatCurrency(loanDetails.marketEquity, account.currency)}</span></div>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary italic mt-2">
                    Invested Equity = Down Payment + Principal Paid. <br/>
                    Market Equity = Current Property Value - Outstanding Loan.
                </p>
              </div>
            </Card>
          )}

          {/* Linked Goals */}
          <Card className="flex-grow flex flex-col">
              <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-yellow-500">flag</span>
                  Linked Goals
              </h3>
              <div className="flex-grow overflow-y-auto max-h-[200px] space-y-3 pr-1">
              {linkedGoals.length > 0 ? (
                  <div className="space-y-4">
                      {linkedGoals.map(goal => {
                          const progress = goal.amount > 0 ? (goal.currentAmount / goal.amount) * 100 : 0;
                          return (
                              <div key={goal.id} className="group">
                                  <div className="flex justify-between text-sm font-medium mb-1">
                                      <span className="text-light-text dark:text-dark-text">{goal.name}</span>
                                      <span className="text-light-text-secondary dark:text-dark-text-secondary">{Math.min(progress, 100).toFixed(0)}%</span>
                                  </div>
                                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-1">
                                      <div className="bg-yellow-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${Math.min(progress, 100)}%` }}></div>
                                  </div>
                                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary text-right">
                                      {formatCurrency(goal.currentAmount, 'EUR')} of {formatCurrency(goal.amount, 'EUR')}
                                  </p>
                              </div>
                          );
                      })}
                  </div>
              ) : (
                  <div className="h-full flex flex-col items-center justify-center text-light-text-secondary dark:text-dark-text-secondary opacity-60">
                        <span className="material-symbols-outlined text-4xl mb-2">outlined_flag</span>
                      <p className="text-sm">No goals linked.</p>
                  </div>
              )}
              </div>
          </Card>
        </div>
      </div>
      <PaymentPlanTable 
        account={account} 
        transactions={transactions} 
        onMakePayment={onMakePayment} 
        overrides={loanPaymentOverrides || {}} 
        onOverridesChange={onOverridesChange} 
      />
    </div>
  );
};

export default LoanAccountView;