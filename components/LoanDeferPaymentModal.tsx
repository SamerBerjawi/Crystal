import React, { useMemo, useState } from 'react';
import { Account, ScheduledPayment } from '../types';
import { parseLocalDate } from '../utils';
import { DetailList } from './AccountFrame';
import { Button } from './ui/Actions';
import { Radio, RadioGroup, Slider } from './ui/Fields';
import { Amount } from './ui/Money';
import { SidePanel } from './ui/Overlays';
import { Select } from './ui/Pickers';

type DeferralType = 'full' | 'interest_only';

interface LoanDeferPaymentModalProps {
  onClose: () => void;
  account: Account;
  schedule: ScheduledPayment[];
  defaultStartPaymentNumber?: number;
  onApplyDeferral: (startPaymentNumber: number, durationMonths: number, deferralType: DeferralType) => void;
  onClearDeferrals?: () => void;
}

const LoanDeferPaymentModal: React.FC<LoanDeferPaymentModalProps> = ({ onClose, account, schedule, defaultStartPaymentNumber, onApplyDeferral, onClearDeferrals }) => {
  const unpaid = useMemo(() => schedule.filter(payment => payment.status !== 'Paid'), [schedule]);
  const [start, setStart] = useState(() => unpaid.find(payment => payment.paymentNumber === defaultStartPaymentNumber)?.paymentNumber ?? unpaid[0]?.paymentNumber ?? 1);
  const [months, setMonths] = useState(1);
  const [deferralType, setDeferralType] = useState<DeferralType>('full');

  const paymentOptions = useMemo(() => unpaid.map(payment => ({
    id: String(payment.paymentNumber),
    label: `Payment ${payment.paymentNumber}, ${parseLocalDate(payment.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}`,
  })), [unpaid]);

  const deferred = schedule.filter(payment => payment.status === 'Deferred').length;
  const relieved = schedule.filter(payment => payment.paymentNumber >= start && payment.paymentNumber < start + months).reduce((sum, payment) => sum + payment.totalPayment, 0);
  const lastPayment = schedule[schedule.length - 1];
  const newEnd = lastPayment ? parseLocalDate(lastPayment.date) : null;
  newEnd?.setMonth(newEnd.getMonth() + months);

  const apply = () => {
    onApplyDeferral(start, months, deferralType);
    onClose();
  };

  return (
    <SidePanel
      isOpen
      onClose={onClose}
      title="Defer payments"
      description="Later payments move back, and the loan ends later."
      footer={close => (
        <div className="flex flex-col-reverse gap-2 md:flex-row md:items-center">
          {deferred > 0 && onClearDeferrals && <Button variant="ghost" className="md:mr-auto" onPress={() => { onClearDeferrals(); onClose(); }}>Remove {deferred} deferred</Button>}
          <Button variant="ghost" onPress={close}>Cancel</Button>
          <Button onPress={apply}>Defer</Button>
        </div>
      )}
    >
      <div className="space-y-4">
        <Select label="First payment to defer" options={paymentOptions} value={String(start)} onChange={id => setStart(Number(id))} />
        <Slider label="Months" minValue={1} maxValue={12} value={months} onChange={value => setMonths(value as number)} />
        <RadioGroup label="During those months" value={deferralType} onChange={value => setDeferralType(value as DeferralType)}>
          <Radio value="full">Pay nothing</Radio>
          <Radio value="interest_only">Pay interest only</Radio>
        </RadioGroup>
        <DetailList items={[
          { label: 'Payments deferred', value: months === 1 ? `${start}` : `${start} to ${start + months - 1}` },
          { label: 'Not due now', value: <Amount value={relieved} currency={account.currency} /> },
          { label: 'New end date', value: newEnd?.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) },
        ]} />
      </div>
    </SidePanel>
  );
};

export default LoanDeferPaymentModal;
