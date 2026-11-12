import React from 'react';
import PageHeader from '../components/PageHeader';
import DebtPayoffPlanner from '../components/accounts/DebtPayoffPlanner';
import { useAccountsContext, useTransactionsContext } from '../contexts/DomainProviders';

/** Pay your debts off with one budget. The planner itself is in components/accounts. */
const DebtPayoff: React.FC = () => {
  const { accounts } = useAccountsContext();
  const { transactions } = useTransactionsContext();
  return (
    <div className="space-y-6">
      <PageHeader title="Debt payoff" />
      <DebtPayoffPlanner accounts={accounts} transactions={transactions} />
    </div>
  );
};

export default DebtPayoff;
