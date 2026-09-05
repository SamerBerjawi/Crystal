import React, { useState, useMemo } from 'react';
import Modal from './Modal';
import { Account, ScheduledPayment } from '../types';
import { formatCurrency, parseLocalDate, generateAmortizationSchedule } from '../utils';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE } from '../constants';
import Icon from './ui/Icon';

interface LoanEarlyPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account;
  schedule: ScheduledPayment[];
  transactions?: any[];
  defaultPaymentNumber?: number;
  onRecordTransferPayment: (payment: ScheduledPayment, description: string) => void;
  onApplyScheduleOverride: (paymentNumber: number, extraPrincipal: number) => void;
}

const LoanEarlyPaymentModal: React.FC<LoanEarlyPaymentModalProps> = ({
  isOpen,
  onClose,
  account,
  schedule,
  defaultPaymentNumber,
  onRecordTransferPayment,
  onApplyScheduleOverride,
}) => {
  const eligiblePayments = useMemo(() => {
    return schedule.filter(p => p.status !== 'Paid');
  }, [schedule]);

  const defaultTarget = useMemo(() => {
    if (defaultPaymentNumber) {
      const match = eligiblePayments.find(p => p.paymentNumber === defaultPaymentNumber);
      if (match) return match.paymentNumber;
    }
    return eligiblePayments[0]?.paymentNumber || 1;
  }, [eligiblePayments, defaultPaymentNumber]);

  const [targetPaymentNumber, setTargetPaymentNumber] = useState<number>(defaultTarget);
  const [extraAmount, setExtraAmount] = useState<string>('1000');

  const targetPayment = useMemo(() => {
    return schedule.find(p => p.paymentNumber === targetPaymentNumber) || eligiblePayments[0] || schedule[0];
  }, [schedule, targetPaymentNumber, eligiblePayments]);

  const currentOutstanding = useMemo(() => {
    return targetPayment ? targetPayment.outstandingBalance : account.principalAmount || 0;
  }, [targetPayment, account.principalAmount]);

  const parsedExtraPrincipal = useMemo(() => {
    const val = parseFloat(extraAmount);
    return isNaN(val) || val < 0 ? 0 : Math.min(val, currentOutstanding);
  }, [extraAmount, currentOutstanding]);

  // Simulate schedule with the extra principal to calculate interest savings and time saved
  const simulation = useMemo(() => {
    if (!targetPayment || parsedExtraPrincipal <= 0) {
      return {
        interestSaved: 0,
        monthsSaved: 0,
        simulatedPayoffDate: null,
      };
    }

    const currentTotalInterest = schedule.reduce((sum, p) => sum + p.interest, 0);
    const lastOriginalPayment = schedule[schedule.length - 1];
    const originalPayoffDate = lastOriginalPayment ? parseLocalDate(lastOriginalPayment.date) : null;

    // Build temporary override map
    const simOverrides: Record<number, Partial<ScheduledPayment>> = {};
    simOverrides[targetPayment.paymentNumber] = {
      principal: (targetPayment.principal || 0) + parsedExtraPrincipal,
      totalPayment: (targetPayment.totalPayment || 0) + parsedExtraPrincipal,
    };

    const simulatedSchedule = generateAmortizationSchedule(account, [], simOverrides);
    const simulatedTotalInterest = simulatedSchedule.reduce((sum, p) => sum + p.interest, 0);
    const interestSaved = Math.max(0, currentTotalInterest - simulatedTotalInterest);

    // Find first month where balance reaches 0 in simulated schedule
    const payoffIndex = simulatedSchedule.findIndex(p => p.outstandingBalance <= 0.01);
    const simulatedPayoffPayment = payoffIndex >= 0 ? simulatedSchedule[payoffIndex] : simulatedSchedule[simulatedSchedule.length - 1];
    const simulatedPayoffDate = simulatedPayoffPayment ? parseLocalDate(simulatedPayoffPayment.date) : null;

    let monthsSaved = 0;
    if (originalPayoffDate && simulatedPayoffDate) {
      const diffMonths =
        (originalPayoffDate.getFullYear() - simulatedPayoffDate.getFullYear()) * 12 +
        (originalPayoffDate.getMonth() - simulatedPayoffDate.getMonth());
      monthsSaved = Math.max(0, diffMonths);
    }

    return {
      interestSaved,
      monthsSaved,
      simulatedPayoffDate,
    };
  }, [account, schedule, targetPayment, parsedExtraPrincipal]);

  const handleRecordTransfer = () => {
    if (!targetPayment) return;
    const combinedPayment: ScheduledPayment = {
      ...targetPayment,
      principal: targetPayment.principal + parsedExtraPrincipal,
      totalPayment: targetPayment.totalPayment + parsedExtraPrincipal,
      extraPrincipal: parsedExtraPrincipal,
    };
    onRecordTransferPayment(
      combinedPayment,
      `Early Principal Payment (+${formatCurrency(parsedExtraPrincipal, account.currency)}) for ${account.name}`
    );
    onClose();
  };

  const handleSimulateInSchedule = () => {
    if (!targetPayment || parsedExtraPrincipal <= 0) return;
    onApplyScheduleOverride(targetPayment.paymentNumber, parsedExtraPrincipal);
    onClose();
  };

  const isFullPayoff = parsedExtraPrincipal >= currentOutstanding - 0.01;

  if (!isOpen) return null;

  return (
    <Modal
      onClose={onClose}
      title="Early Loan Payment / Extra Principal"
      size="lg"
    >
      <div className="space-y-6">
        {/* Banner */}
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3 text-xs text-emerald-900 dark:text-emerald-300">
          <Icon name="savings" className="text-lg shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
          <div className="space-y-1 leading-relaxed">
            <p className="font-semibold text-emerald-950 dark:text-emerald-200">Accelerate Debt Freedom</p>
            <p>
              Applying extra money directly to principal decreases outstanding debt immediately, eliminating future
              compounding interest and shaving months off your term.
            </p>
          </div>
        </div>

        {/* Target Installment */}
        <div className="space-y-2">
          <label htmlFor="early-target" className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Apply Extra Payment To Installment
          </label>
          <select
            id="early-target"
            value={targetPaymentNumber}
            onChange={(e) => setTargetPaymentNumber(parseInt(e.target.value, 10))}
            className={`${INPUT_BASE_STYLE} h-12 font-medium`}
          >
            {eligiblePayments.map((p) => (
              <option key={p.paymentNumber} value={p.paymentNumber}>
                Payment #{p.paymentNumber} — {parseLocalDate(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} (Scheduled: {formatCurrency(p.totalPayment, account.currency)})
              </option>
            ))}
          </select>
        </div>

        {/* Extra Principal Input */}
        <div className="space-y-3">
          <label htmlFor="extra-amount" className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Extra Principal Amount ({account.currency})
          </label>
          <div className="relative group">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-gray-400 group-focus-within:text-primary-500 transition-colors">
              {account.currency === 'EUR' ? '€' : account.currency === 'USD' ? '$' : account.currency}
            </span>
            <input
              id="extra-amount"
              type="number"
              step="any"
              min="1"
              max={currentOutstanding}
              value={extraAmount}
              onChange={(e) => setExtraAmount(e.target.value)}
              className={`${INPUT_BASE_STYLE} pl-10 h-14 !text-2xl font-black tabular-nums`}
              placeholder="0.00"
              autoFocus
            />
          </div>

          {/* Quick Preset Buttons */}
          <div className="grid grid-cols-4 gap-2">
            {[250, 500, 1000, 2500].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setExtraAmount(String(preset))}
                className="py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-white/5 hover:bg-primary-500/10 hover:text-primary-600 dark:hover:text-primary-400 border border-slate-200 dark:border-white/10 transition-colors"
              >
                +{formatCurrency(preset, account.currency)}
              </button>
            ))}
          </div>

          {/* Payoff entire balance button */}
          <button
            type="button"
            onClick={() => setExtraAmount(String(Math.ceil(currentOutstanding)))}
            className="w-full py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-1.5"
          >
            <Icon name="check_circle" className="text-sm" />
            <span>Pay Off Full Balance ({formatCurrency(currentOutstanding, account.currency)})</span>
          </button>
        </div>

        {/* Impact Live Calculation Card */}
        <div className="p-5 rounded-3xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Financial Impact Preview
            </span>
            {simulation.monthsSaved > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <Icon name="trending_down" className="text-xs" />
                {simulation.monthsSaved} Months Faster
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3.5 rounded-2xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 shadow-xs">
              <span className="text-2xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary block mb-1">
                Total Interest Saved
              </span>
              <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatCurrency(simulation.interestSaved, account.currency)}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 shadow-xs">
              <span className="text-2xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary block mb-1">
                New Payoff Date
              </span>
              <p className="text-xl font-black text-slate-900 dark:text-white tabular-nums">
                {simulation.simulatedPayoffDate
                  ? simulation.simulatedPayoffDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
                  : 'N/A'}
              </p>
            </div>
          </div>

          {targetPayment && (
            <div className="text-2xs text-light-text-secondary dark:text-dark-text-secondary flex justify-between border-t border-slate-200/60 dark:border-white/10 pt-3">
              <span>Payment #{targetPayment.paymentNumber} Total Outflow:</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {formatCurrency(targetPayment.totalPayment + parsedExtraPrincipal, account.currency)}
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className={`${BTN_SECONDARY_STYLE} w-full sm:w-auto h-12 px-5 text-xs font-bold uppercase tracking-wider`}
          >
            Cancel
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleSimulateInSchedule}
              disabled={parsedExtraPrincipal <= 0}
              className={`${BTN_SECONDARY_STYLE} flex-1 sm:flex-initial h-12 px-4 text-xs font-bold uppercase tracking-wider disabled:opacity-50`}
              title="Apply as plan override without initiating bank transaction"
            >
              Simulate in Plan
            </button>

            <button
              type="button"
              onClick={handleRecordTransfer}
              disabled={parsedExtraPrincipal <= 0}
              className={`${BTN_PRIMARY_STYLE} flex-1 sm:flex-initial h-12 px-5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-primary-500/20 active:scale-95 disabled:opacity-50`}
            >
              <Icon name="payments" className="text-base" />
              <span>{isFullPayoff ? 'Record Full Payoff' : 'Record Payment Now'}</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default LoanEarlyPaymentModal;
