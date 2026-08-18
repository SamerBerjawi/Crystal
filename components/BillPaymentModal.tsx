
import React from 'react';
import { Account, BillPayment } from '../types';
import RecurringTransactionModal from './RecurringTransactionModal';

export interface BillPaymentModalProps {
  bill: (Omit<BillPayment, 'id'> & { id?: string }) | null;
  onSave: (data: Omit<BillPayment, 'id'> & { id?: string }) => void;
  onClose: () => void;
  accounts: Account[];
  initialDate?: string;
}

const BillPaymentModal: React.FC<BillPaymentModalProps> = ({
  bill,
  onSave,
  onClose,
  accounts,
  initialDate,
}) => {
  return (
    <RecurringTransactionModal
      isOpen={true}
      onClose={onClose}
      onSaveBill={onSave}
      billToEdit={bill}
      accounts={accounts}
      initialMode="one-time"
      initialDate={initialDate}
    />
  );
};

export default BillPaymentModal;

