import React, { useMemo, useState } from 'react';
import { Account, ScheduledPayment } from '../types';
import { currencySign, formatCurrency, generateAmortizationSchedule, parseLocalDate } from '../utils';
import { parseAmountInput } from '../utils/scheduleModel';
import { DetailList } from './AccountFrame';
import { Button } from './ui/Actions';
import { AmountInput } from './ui/Fields';
import { Amount } from './ui/Money';
import { SidePanel } from './ui/Overlays';
import { Select } from './ui/Pickers';

const PRESETS = [250, 500, 1000, 2500];

interface LoanEarlyPaymentModalProps {
  onClose: () => void;
  account: Account;
  schedule: ScheduledPayment[];
  defaultPaymentNumber?: number;
  onRecordTransferPayment: (payment: ScheduledPayment, description: string) => void;
  onApplyScheduleOverride: (paymentNumber: number, extraPrincipal: number) => void;
}

const LoanEarlyPaymentModal: React.FC<LoanEarlyPaymentModalProps> = ({ onClose, account, schedule, defaultPaymentNumber, onRecordTransferPayment, onApplyScheduleOverride }) => {
  const unpaid = useMemo(() => schedule.filter(payment => payment.status !== 'Paid'), [schedule]);
  const [target, setTarget] = useState(() => unpaid.find(payment => payment.paymentNumber === defaultPaymentNumber)?.paymentNumber ?? unpaid[0]?.paymentNumber ?? 1);
  const [extraAmount, setExtraAmount] = useState('1000');

  const paymentOptions = useMemo(() => unpaid.map(payment => ({
    id: String(payment.paymentNumber),
    label: `Payment ${payment.paymentNumber}, ${parseLocalDate(payment.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}`,
  })), [unpaid]);

  const targetPayment = schedule.find(payment => payment.paymentNumber === target) || unpaid[0] || schedule[0];
  const outstanding = targetPayment ? targetPayment.outstandingBalance : account.principalAmount || 0;
  const typed = parseAmountInput(extraAmount);
  const extra = Number.isNaN(typed) || typed < 0 ? 0 : Math.min(typed, outstanding);

  // Reruns the schedule with the extra principal to find the interest and time it saves.
  const impact = useMemo(() => {
    if (!targetPayment || extra <= 0) return { interestSaved: 0, monthsSaved: 0, payoffDate: null };

    const simulated = generateAmortizationSchedule(account, [], {
      [targetPayment.paymentNumber]: {
        principal: (targetPayment.principal || 0) + extra,
        totalPayment: (targetPayment.totalPayment || 0) + extra,
      },
    });
    const interestSaved = Math.max(0, schedule.reduce((sum, payment) => sum + payment.interest, 0) - simulated.reduce((sum, payment) => sum + payment.interest, 0));
    const lastPayment = simulated.find(payment => payment.outstandingBalance <= 0.01) ?? simulated[simulated.length - 1];
    const payoffDate = lastPayment ? parseLocalDate(lastPayment.date) : null;
    const originalEnd = schedule.length > 0 ? parseLocalDate(schedule[schedule.length - 1].date) : null;
    const monthsSaved = originalEnd && payoffDate
      ? Math.max(0, (originalEnd.getFullYear() - payoffDate.getFullYear()) * 12 + originalEnd.getMonth() - payoffDate.getMonth())
      : 0;

    return { interestSaved, monthsSaved, payoffDate };
  }, [account, schedule, targetPayment, extra]);

  const record = () => {
    if (!targetPayment) return;
    onRecordTransferPayment(
      { ...targetPayment, principal: targetPayment.principal + extra, totalPayment: targetPayment.totalPayment + extra, extraPrincipal: extra },
      `Early Principal Payment (+${formatCurrency(extra, account.currency)}) for ${account.name}`
    );
    onClose();
  };

  const applyToPlan = () => {
    if (!targetPayment) return;
    onApplyScheduleOverride(targetPayment.paymentNumber, extra);
    onClose();
  };

  return (
    <SidePanel
      isOpen
      onClose={onClose}
      title="Early payment"
      description="Extra money goes straight to the principal."
      footer={close => (
        <div className="flex flex-col-reverse gap-2 md:flex-row md:items-center md:justify-end">
          <Button variant="ghost" className="md:mr-auto" onPress={close}>Cancel</Button>
          <Button variant="secondary" isDisabled={extra <= 0} onPress={applyToPlan}>Add to plan only</Button>
          <Button isDisabled={extra <= 0} onPress={record}>{extra >= outstanding - 0.01 ? 'Record full payoff' : 'Record payment'}</Button>
        </div>
      )}
    >
      <div className="space-y-4">
        <Select label="Add it to" options={paymentOptions} value={String(target)} onChange={id => setTarget(Number(id))} />
        <AmountInput autoFocus label="Extra amount" currency={currencySign(account.currency)} value={extraAmount} onChange={setExtraAmount} />
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(preset => <Button key={preset} variant="secondary" size="sm" onPress={() => setExtraAmount(String(preset))}><Amount value={preset} currency={account.currency} /></Button>)}
          <Button variant="secondary" size="sm" onPress={() => setExtraAmount(String(Math.ceil(outstanding)))}>Full balance</Button>
        </div>
        <DetailList items={[
          { label: 'Balance at this payment', value: <Amount value={outstanding} currency={account.currency} /> },
          { label: 'Interest saved', value: <Amount value={impact.interestSaved} currency={account.currency} /> },
          { label: 'Time saved', value: `${impact.monthsSaved} ${impact.monthsSaved === 1 ? 'month' : 'months'}` },
          { label: 'New end date', value: impact.payoffDate?.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) ?? '—' },
          ...(targetPayment ? [{ label: 'This payment in total', value: <Amount value={targetPayment.totalPayment + extra} currency={account.currency} /> }] : []),
        ]} />
      </div>
    </SidePanel>
  );
};

export default LoanEarlyPaymentModal;
