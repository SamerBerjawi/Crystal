import React, { useState, useMemo } from 'react';
import Modal from './Modal';
import { Account, ScheduledPayment } from '../types';
import { formatCurrency, parseLocalDate } from '../utils';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE } from '../constants';
import Icon from './ui/Icon';

interface LoanDeferPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account;
  schedule: ScheduledPayment[];
  defaultStartPaymentNumber?: number;
  onApplyDeferral: (
    startPaymentNumber: number,
    durationMonths: number,
    deferralType: 'full' | 'interest_only'
  ) => void;
  onClearDeferrals?: () => void;
}

const LoanDeferPaymentModal: React.FC<LoanDeferPaymentModalProps> = ({
  isOpen,
  onClose,
  account,
  schedule,
  defaultStartPaymentNumber,
  onApplyDeferral,
  onClearDeferrals,
}) => {
  // Find eligible starting payments (upcoming, due, or overdue, not yet paid)
  const eligiblePayments = useMemo(() => {
    return schedule.filter(p => p.status !== 'Paid');
  }, [schedule]);

  const defaultStart = useMemo(() => {
    if (defaultStartPaymentNumber) {
      const match = eligiblePayments.find(p => p.paymentNumber === defaultStartPaymentNumber);
      if (match) return match.paymentNumber;
    }
    return eligiblePayments[0]?.paymentNumber || 1;
  }, [eligiblePayments, defaultStartPaymentNumber]);

  const [startPaymentNumber, setStartPaymentNumber] = useState<number>(defaultStart);
  const [durationMonths, setDurationMonths] = useState<number>(1);
  const [deferralType, setDeferralType] = useState<'full' | 'interest_only'>('full');

  // Count existing deferred payments
  const existingDeferredCount = useMemo(() => {
    return schedule.filter(p => p.status === 'Deferred').length;
  }, [schedule]);

  const targetPayments = useMemo(() => {
    return schedule.filter(
      p => p.paymentNumber >= startPaymentNumber && p.paymentNumber < startPaymentNumber + durationMonths
    );
  }, [schedule, startPaymentNumber, durationMonths]);

  const currentPayoffDate = useMemo(() => {
    const last = schedule[schedule.length - 1];
    return last ? parseLocalDate(last.date) : null;
  }, [schedule]);

  const projectedPayoffDate = useMemo(() => {
    if (!currentPayoffDate) return null;
    const date = new Date(currentPayoffDate);
    date.setMonth(date.getMonth() + durationMonths);
    return date;
  }, [currentPayoffDate, durationMonths]);

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (durationMonths <= 0) return;
    onApplyDeferral(startPaymentNumber, durationMonths, deferralType);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal
      onClose={onClose}
      title="Defer Loan Payments"
      size="lg"
    >
      <form onSubmit={handleApply} className="space-y-6">
        {/* Intro Banner */}
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-xs text-amber-800 dark:text-amber-300">
          <Icon name="info" className="text-lg shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1 leading-relaxed">
            <p className="font-semibold text-amber-900 dark:text-amber-200">Payment Grace Period & Deferral</p>
            <p>
              Postpone upcoming monthly obligations. Scheduled payments will be deferred and the loan maturity
              date will dynamically extend by the deferral duration.
            </p>
          </div>
        </div>

        {/* Start Payment Selector */}
        <div className="space-y-2">
          <label htmlFor="defer-start" className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Start Deferral From Installment
          </label>
          <select
            id="defer-start"
            value={startPaymentNumber}
            onChange={(e) => setStartPaymentNumber(parseInt(e.target.value, 10))}
            className={`${INPUT_BASE_STYLE} h-12 font-medium`}
          >
            {eligiblePayments.map((p) => (
              <option key={p.paymentNumber} value={p.paymentNumber}>
                Payment #{p.paymentNumber} — {parseLocalDate(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} ({formatCurrency(p.totalPayment, account.currency)})
              </option>
            ))}
          </select>
        </div>

        {/* Duration Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Deferral Duration
            </label>
            <span className="text-xs font-semibold text-primary-500">
              {durationMonths} {durationMonths === 1 ? 'Month' : 'Months'}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 6].map((months) => (
              <button
                key={months}
                type="button"
                onClick={() => setDurationMonths(months)}
                className={`py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all ${
                  durationMonths === months
                    ? 'bg-primary-500 text-white border-primary-500 shadow-sm'
                    : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-primary-500/50'
                }`}
              >
                {months} {months === 1 ? 'Mo' : 'Mos'}
              </button>
            ))}
          </div>

          <div className="pt-2">
            <input
              type="range"
              min="1"
              max="12"
              value={durationMonths}
              onChange={(e) => setDurationMonths(parseInt(e.target.value, 10))}
              className="w-full accent-primary-500"
            />
          </div>
        </div>

        {/* Deferral Type Selector */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Deferral Structure
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label
              className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                deferralType === 'full'
                  ? 'bg-amber-500/10 border-amber-500 text-amber-900 dark:text-amber-200 shadow-sm'
                  : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-amber-500/40'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Full Holiday</span>
                <input
                  type="radio"
                  name="deferralType"
                  value="full"
                  checked={deferralType === 'full'}
                  onChange={() => setDeferralType('full')}
                  className="sr-only"
                />
                {deferralType === 'full' && <Icon name="check_circle" className="text-amber-500 text-sm" />}
              </div>
              <p className="text-2xs opacity-80 leading-relaxed">
                Pay $0 during this period. Zero principal and zero interest due now.
              </p>
            </label>

            <label
              className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                deferralType === 'interest_only'
                  ? 'bg-primary-500/10 border-primary-500 text-primary-900 dark:text-primary-200 shadow-sm'
                  : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-primary-500/40'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Interest Only</span>
                <input
                  type="radio"
                  name="deferralType"
                  value="interest_only"
                  checked={deferralType === 'interest_only'}
                  onChange={() => setDeferralType('interest_only')}
                  className="sr-only"
                />
                {deferralType === 'interest_only' && <Icon name="check_circle" className="text-primary-500 text-sm" />}
              </div>
              <p className="text-2xs opacity-80 leading-relaxed">
                Principal payments are paused ($0), while regular monthly interest is settled.
              </p>
            </label>
          </div>
        </div>

        {/* Impact Summary Card */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Deferral Impact Summary
          </p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-light-text-secondary dark:text-dark-text-secondary block">Deferred Payments</span>
              <span className="font-bold text-slate-900 dark:text-white">
                #{startPaymentNumber} — #{startPaymentNumber + durationMonths - 1}
              </span>
            </div>
            <div>
              <span className="text-light-text-secondary dark:text-dark-text-secondary block">New Payoff Date</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">
                {projectedPayoffDate ? projectedPayoffDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : 'N/A'}
              </span>
            </div>
          </div>
          {targetPayments.length > 0 && (
            <div className="pt-2 border-t border-slate-200/60 dark:border-white/10 text-2xs text-light-text-secondary dark:text-dark-text-secondary">
              Relieves <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(targetPayments.reduce((s, p) => s + p.totalPayment, 0), account.currency)}</span> in immediate cash outflow across {durationMonths} month(s).
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-3 pt-2">
          {existingDeferredCount > 0 && onClearDeferrals ? (
            <button
              type="button"
              onClick={() => {
                onClearDeferrals();
                onClose();
              }}
              className="text-xs font-bold uppercase tracking-wider text-rose-500 hover:text-rose-600 py-2 px-3 rounded-xl hover:bg-rose-500/10 transition-colors"
            >
              Reset Deferrals ({existingDeferredCount})
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className={`${BTN_SECONDARY_STYLE} h-11 px-5 text-xs font-bold uppercase tracking-wider`}
            >
              Cancel
            </button>
          )}

          <button
            type="submit"
            className={`${BTN_PRIMARY_STYLE} h-11 px-6 text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-md active:scale-95`}
          >
            <Icon name="check" className="text-base" />
            <span>Apply Deferral</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default LoanDeferPaymentModal;
