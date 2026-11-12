import React, { useMemo, useState } from 'react';
import { Account, Transaction, ScheduledPayment } from '../types';
import { currencySign, generateAmortizationSchedule, parseLocalDate, round2 } from '../utils';
import { useIsMobile } from '../hooks/useIsMobile';
import { parseAmountInput, withExtraPrincipal } from '../utils/scheduleModel';
import { DetailList } from './AccountFrame';
import LoanDeferPaymentModal from './LoanDeferPaymentModal';
import LoanEarlyPaymentModal from './LoanEarlyPaymentModal';
import LoanPaymentBulkEditModal, { BulkPaymentEntry } from './LoanPaymentBulkEditModal';
import { Button, IconButton } from './ui/Actions';
import { Badge } from './ui/Display';
import { AmountInput } from './ui/Fields';
import { Menu, type MenuAction } from './ui/Menu';
import { Amount } from './ui/Money';
import { Dialog } from './ui/Overlays';
import { EmptyState } from './ui/States';

const TABLE_FROM = 1024;

const STATUS_TONES = { Paid: 'positive', Deferred: 'attention', Overdue: 'negative' } as const;

const StatusBadge: React.FC<{ status: ScheduledPayment['status'] }> = ({ status }) => <Badge tone={STATUS_TONES[status as keyof typeof STATUS_TONES] ?? 'neutral'}>{status}</Badge>;

const paymentDate = (payment: ScheduledPayment) => parseLocalDate(payment.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

type PaymentAmounts = Pick<ScheduledPayment, 'totalPayment' | 'principal' | 'interest'>;

/** Changing the total keeps the interest. Changing either part moves the total. */
const EditPaymentDialog: React.FC<{ payment: ScheduledPayment; currency: string; onClose: () => void; onSave: (amounts: PaymentAmounts) => void }> = ({ payment, currency, onClose, onSave }) => {
  const [total, setTotal] = useState(String(payment.totalPayment));
  const [principal, setPrincipal] = useState(String(payment.principal));
  const [interest, setInterest] = useState(String(payment.interest));

  const amount = (text: string) => parseAmountInput(text) || 0;

  const changeTotal = (text: string) => {
    setTotal(text);
    setPrincipal(String(round2(amount(text) - amount(interest))));
  };
  const changePart = (setPart: (text: string) => void, other: string) => (text: string) => {
    setPart(text);
    setTotal(String(round2(amount(text) + amount(other))));
  };

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title={`Edit payment ${payment.paymentNumber}`}
      description={paymentDate(payment)}
      footer={close => (
        <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button variant="ghost" onPress={close}>Cancel</Button>
          <Button onPress={() => onSave({ totalPayment: amount(total), principal: amount(principal), interest: amount(interest) })}>Save payment</Button>
        </div>
      )}
    >
      <div className="space-y-3">
        <AmountInput autoFocus label="Total" currency={currencySign(currency)} value={total} onChange={changeTotal} />
        <AmountInput label="Principal" currency={currencySign(currency)} value={principal} onChange={changePart(setPrincipal, interest)} />
        <AmountInput label="Interest" currency={currencySign(currency)} value={interest} onChange={changePart(setInterest, principal)} />
      </div>
    </Dialog>
  );
};

interface PaymentPlanTableProps {
  account: Account;
  transactions: Transaction[];
  onMakePayment: (payment: ScheduledPayment, description: string) => void;
  overrides: Record<number, Partial<ScheduledPayment>>;
  onOverridesChange: (overrides: Record<number, Partial<ScheduledPayment>>) => void;
  showBalanceAdjustments?: boolean;
}

const PaymentPlanTable: React.FC<PaymentPlanTableProps> = ({ account, transactions, onMakePayment, overrides, onOverridesChange, showBalanceAdjustments = true }) => {
  const isNarrow = useIsMobile(TABLE_FROM);
  const [editingPayment, setEditingPayment] = useState<ScheduledPayment | null>(null);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [deferring, setDeferring] = useState<{ paymentNumber?: number } | null>(null);
  const [payingEarly, setPayingEarly] = useState<{ paymentNumber?: number } | null>(null);

  const schedule = useMemo(() => {
    const filteredTxs = transactions.filter(tx => showBalanceAdjustments || !tx.isBalanceAdjustment);
    return generateAmortizationSchedule(account, filteredTxs, overrides);
  }, [account, transactions, overrides, showBalanceAdjustments]);

  const totals = useMemo(() => schedule.reduce((sum, payment) => ({
    totalPayment: sum.totalPayment + payment.totalPayment,
    principal: sum.principal + payment.principal,
    interest: sum.interest + payment.interest,
  }), { totalPayment: 0, principal: 0, interest: 0 }), [schedule]);

  const handleBulkApply = (entries: BulkPaymentEntry[]) => {
    const nextOverrides = { ...overrides };
    entries.forEach(entry => {
      nextOverrides[entry.paymentNumber] = { totalPayment: entry.totalPayment, principal: entry.principal, interest: entry.interest };
    });
    onOverridesChange(nextOverrides);
    setIsBulkEditOpen(false);
  };

  const handleApplyDeferral = (startPaymentNumber: number, durationMonths: number, deferralType: 'full' | 'interest_only') => {
    const nextOverrides = { ...overrides };
    for (let i = 0; i < durationMonths; i++) {
      nextOverrides[startPaymentNumber + i] = { status: 'Deferred', deferralType, principal: 0, totalPayment: 0, interest: 0 };
    }
    onOverridesChange(nextOverrides);
  };

  const handleClearDeferrals = () => {
    const nextOverrides = { ...overrides };
    Object.keys(nextOverrides).forEach(key => {
      const num = parseInt(key, 10);
      if (nextOverrides[num]?.status === 'Deferred') delete nextOverrides[num];
    });
    onOverridesChange(nextOverrides);
  };

  const handleApplyEarlyPaymentOverride = (paymentNumber: number, extraPrincipal: number) => onOverridesChange(withExtraPrincipal(overrides, paymentNumber, extraPrincipal));

  if (schedule.length === 0) {
    return <EmptyState icon="pending_actions" title="No payment plan yet" description="Add the principal, interest rate, term and start date in Edit." />;
  }

  const payLabel = account.type === 'Lending' ? 'Receive' : 'Pay';
  const deferredCount = schedule.filter(payment => payment.status === 'Deferred').length;

  const pay = (payment: ScheduledPayment) => onMakePayment(payment, `Payment #${payment.paymentNumber} for ${account.name}`);

  const rowActions = (payment: ScheduledPayment) => {
    if (payment.status === 'Paid') return null;
    const items: MenuAction[] = [
      { id: 'early', label: 'Early payment', icon: 'bolt', onAction: () => setPayingEarly({ paymentNumber: payment.paymentNumber }) },
      { id: 'defer', label: 'Defer', icon: 'calendar', onAction: () => setDeferring({ paymentNumber: payment.paymentNumber }) },
      { id: 'edit', label: 'Edit', icon: 'edit', onAction: () => setEditingPayment(payment) },
    ];
    return (
      <div className="flex items-center justify-end gap-1">
        <Button variant="secondary" size="sm" onPress={() => pay(payment)}>{payLabel}</Button>
        <Menu title={`Payment ${payment.paymentNumber}`} trigger={<IconButton icon="more_horiz" label={`Actions for payment ${payment.paymentNumber}`} tooltipPlacement="left" />} items={items} />
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {deferredCount > 0 && <Badge tone="attention" className="mr-auto">{deferredCount} deferred</Badge>}
        <Button variant="secondary" size="sm" icon="calendar-03" onPress={() => setDeferring({})}>Defer</Button>
        <Button variant="secondary" size="sm" icon="flash" onPress={() => setPayingEarly({})}>Early payment</Button>
        <Button variant="secondary" size="sm" icon="pencil-edit-02" onPress={() => setIsBulkEditOpen(true)}>Bulk edit</Button>
      </div>

      {isNarrow ? (
        <ul className="max-h-[560px] divide-y divide-line overflow-y-auto">
          {schedule.map(payment => (
            <li key={payment.paymentNumber} className="py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="type-body-strong text-ink">{paymentDate(payment)}</p>
                  <p className="type-caption text-muted">Payment {payment.paymentNumber}, <Amount value={payment.outstandingBalance} currency={account.currency} /> left</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="type-figure-row text-ink"><Amount value={payment.totalPayment} currency={account.currency} /></p>
                  <p className="type-caption text-muted"><Amount value={payment.interest} currency={account.currency} /> interest</p>
                </div>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <StatusBadge status={payment.status} />
                {rowActions(payment)}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="max-h-[560px] overflow-auto rounded-[var(--radius-lg)] border border-line">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr>
                {['#', 'Date', 'Total', 'Principal', 'Interest', 'Balance', 'Status', ''].map((heading, index) => (
                  <th key={heading || 'actions'} scope="col" className={`type-label sticky top-0 z-[1] h-10 whitespace-nowrap border-b border-line bg-surface/95 backdrop-blur-xs px-3 text-muted ${index >= 2 && index <= 5 ? 'text-right' : 'text-left'}`}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {schedule.map(payment => (
                <tr key={payment.paymentNumber} className="type-body text-ink hover:bg-inset">
                  <td className="border-b border-line px-3 py-1.5 tabular-nums text-muted">{payment.paymentNumber}</td>
                  <td className="whitespace-nowrap border-b border-line px-3 py-1.5">{paymentDate(payment)}</td>
                  <td className="whitespace-nowrap border-b border-line px-3 py-1.5 text-right font-semibold"><Amount value={payment.totalPayment} currency={account.currency} /></td>
                  <td className="whitespace-nowrap border-b border-line px-3 py-1.5 text-right text-muted"><Amount value={payment.principal} currency={account.currency} /></td>
                  <td className="whitespace-nowrap border-b border-line px-3 py-1.5 text-right text-muted"><Amount value={payment.interest} currency={account.currency} /></td>
                  <td className="whitespace-nowrap border-b border-line px-3 py-1.5 text-right text-muted"><Amount value={payment.outstandingBalance} currency={account.currency} /></td>
                  <td className="border-b border-line px-3 py-1.5"><StatusBadge status={payment.status} /></td>
                  <td className="border-b border-line px-3 py-1.5">{rowActions(payment)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DetailList items={[
        { label: 'Total principal', value: <Amount value={totals.principal} currency={account.currency} /> },
        { label: 'Total interest', value: <Amount value={totals.interest} currency={account.currency} /> },
        { label: 'Total cost', value: <Amount value={totals.totalPayment} currency={account.currency} /> },
      ]} />

      {editingPayment && (
        <EditPaymentDialog
          payment={editingPayment}
          currency={account.currency}
          onClose={() => setEditingPayment(null)}
          onSave={amounts => { onOverridesChange({ ...overrides, [editingPayment.paymentNumber]: amounts }); setEditingPayment(null); }}
        />
      )}
      {isBulkEditOpen && <LoanPaymentBulkEditModal scheduleLength={schedule.length} onClose={() => setIsBulkEditOpen(false)} onApply={handleBulkApply} />}
      {deferring && (
        <LoanDeferPaymentModal
          onClose={() => setDeferring(null)}
          account={account}
          schedule={schedule}
          defaultStartPaymentNumber={deferring.paymentNumber}
          onApplyDeferral={handleApplyDeferral}
          onClearDeferrals={handleClearDeferrals}
        />
      )}
      {payingEarly && (
        <LoanEarlyPaymentModal
          onClose={() => setPayingEarly(null)}
          account={account}
          schedule={schedule}
          defaultPaymentNumber={payingEarly.paymentNumber}
          onRecordTransferPayment={onMakePayment}
          onApplyScheduleOverride={handleApplyEarlyPaymentOverride}
        />
      )}
    </div>
  );
};

export default PaymentPlanTable;
