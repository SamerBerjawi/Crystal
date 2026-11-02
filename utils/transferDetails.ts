import type { Account, Transaction, DisplayTransaction } from '../types';

export interface TransferInfo {
  kind: 'credit_card_settlement' | 'mortgage_payment' | 'loan_payment' | 'spare_change';
  label: string;
  icon: string;
  color: string;
}

/**
 * Identifies whether a transfer transaction represents a specific financial flow,
 * such as a credit card settlement, mortgage payment, loan repayment, or spare change round-up.
 */
export function resolveTransferInfo(
  tx: Partial<Transaction & DisplayTransaction>,
  accounts: Account[],
  counterpart?: Partial<Transaction> | null
): TransferInfo | null {
  // 1. Check for Spare Change Round-up
  const isSpare =
    Boolean(tx.transferId?.startsWith('spare-')) ||
    Boolean(counterpart?.transferId?.startsWith('spare-')) ||
    Boolean(tx.description?.toLowerCase().startsWith('spare change')) ||
    Boolean(tx.description?.toLowerCase().includes('round up')) ||
    Boolean(tx.merchant?.toLowerCase().includes('round up'));

  if (isSpare) {
    const label =
      tx.description?.toLowerCase().startsWith('spare change')
        ? tx.description
        : 'Spare Change Round-up';
    return {
      kind: 'spare_change',
      label,
      icon: 'piggy',
      color: '#10B981', // emerald
    };
  }

  // Find the accounts involved
  const fromAccId = (tx as DisplayTransaction).fromAccountId || (tx.type === 'expense' ? tx.accountId : counterpart?.accountId);
  const toAccId = (tx as DisplayTransaction).toAccountId || (tx.type === 'income' ? tx.accountId : counterpart?.accountId);

  let fromAcc = accounts.find(a => a.id === fromAccId);
  let toAcc = accounts.find(a => a.id === toAccId);

  // Fallback to name match if IDs were not directly on the transaction
  if (!fromAcc && (tx as DisplayTransaction).fromAccountName) {
    fromAcc = accounts.find(a => a.name === (tx as DisplayTransaction).fromAccountName);
  }
  if (!toAcc && (tx as DisplayTransaction).toAccountName) {
    toAcc = accounts.find(a => a.name === (tx as DisplayTransaction).toAccountName);
  }

  // Check texts across all available transaction fields
  const combinedText = [
    tx.description,
    tx.merchant,
    tx.category,
    counterpart?.description,
    counterpart?.merchant,
    counterpart?.category,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // 2. Check for Credit Card Settlement
  const hasCard = toAcc?.type === 'Credit Card' || fromAcc?.type === 'Credit Card';
  const isLinkedSettlement =
    Boolean(toAcc && accounts.some(a => a.type === 'Credit Card' && a.settlementAccountId === fromAcc?.id && a.id === toAcc.id)) ||
    Boolean(fromAcc && accounts.some(a => a.type === 'Credit Card' && a.settlementAccountId === toAcc?.id && a.id === fromAcc.id));
  const hasCardText =
    combinedText.includes('credit card settlement') ||
    combinedText.includes('card settlement') ||
    combinedText.includes('credit card payment') ||
    combinedText.includes('card payment') ||
    (combinedText.includes('settlement') && (hasCard || combinedText.includes('credit')));

  const isCreditCard = hasCard || isLinkedSettlement || hasCardText;

  if (isCreditCard) {
    return {
      kind: 'credit_card_settlement',
      label: 'Credit Card Settlement',
      icon: 'credit_card',
      color: '#0284C7', // sky-600 / sky-400
    };
  }

  // 3. Check for Mortgage Payment
  const isMortgageAccount = (acc?: Account) => {
    if (!acc) return false;
    if (acc.type !== 'Loan') return false;
    const name = acc.name.toLowerCase();
    const sub = (acc.subType || '').toLowerCase();
    const isLinkedProperty = accounts.some(
      p => p.type === 'Property' && (p.linkedLoanId === acc.id || acc.linkedAssetId === p.id)
    );
    return (
      name.includes('mortgage') ||
      name.includes('home loan') ||
      name.includes('housing') ||
      sub.includes('mortgage') ||
      isLinkedProperty ||
      acc.icon === 'home'
    );
  };

  const isMortgage =
    isMortgageAccount(toAcc) ||
    isMortgageAccount(fromAcc) ||
    combinedText.includes('mortgage') ||
    combinedText.includes('home loan');

  if (isMortgage) {
    return {
      kind: 'mortgage_payment',
      label: 'Mortgage Payment',
      icon: 'home',
      color: '#8B5CF6', // purple-500
    };
  }

  // 4. Check for General Loan Payment / Lending Repayment
  const isLoanAccount = (acc?: Account) => {
    if (!acc) return false;
    return acc.type === 'Loan' || acc.type === 'Lending';
  };

  const isLoan =
    isLoanAccount(toAcc) ||
    isLoanAccount(fromAcc) ||
    combinedText.includes('loan payment') ||
    combinedText.includes('loan repayment') ||
    combinedText.includes('lending repayment') ||
    Boolean(toAcc?.monthlyPayment && toAcc.monthlyPayment > 0) ||
    Boolean(fromAcc?.monthlyPayment && fromAcc.monthlyPayment > 0);

  if (isLoan) {
    const isLending = toAcc?.type === 'Lending' || fromAcc?.type === 'Lending' || combinedText.includes('lending');
    return {
      kind: 'loan_payment',
      label: isLending ? 'Lending Repayment' : 'Loan Payment',
      icon: 'request_quote',
      color: '#F59E0B', // amber-500
    };
  }

  return null;
}
