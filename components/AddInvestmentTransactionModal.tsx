import React from 'react';
import InvestmentModal, { InvestmentModalProps } from './InvestmentModal';
import { Account, InvestmentTransaction, Transaction, HoldingSummary, Warrant } from '../types';

interface AddInvestmentTransactionModalProps {
  onClose: () => void;
  onSave: (
    invTx: Omit<InvestmentTransaction, 'id'> & { id?: string }, 
    cashTx?: Omit<Transaction, 'id'>, 
    newAccount?: Omit<Account, 'id'>
  ) => void;
  onSaveGrant?: (warrant: Omit<Warrant, 'id'> & { id?: string }) => void;
  accounts: Account[];
  cashAccounts: Account[];
  transactionToEdit?: InvestmentTransaction | null;
  holdings?: HoldingSummary[];
}

const AddInvestmentTransactionModal: React.FC<AddInvestmentTransactionModalProps> = ({
  onClose,
  onSave,
  onSaveGrant,
  accounts,
  cashAccounts,
  transactionToEdit,
  holdings,
}) => {
  return (
    <InvestmentModal
      onClose={onClose}
      onSaveTrade={onSave}
      onSaveGrant={onSaveGrant}
      accounts={accounts}
      cashAccounts={cashAccounts}
      transactionToEdit={transactionToEdit}
      holdings={holdings}
      initialMode="trade"
    />
  );
};

export default AddInvestmentTransactionModal;
