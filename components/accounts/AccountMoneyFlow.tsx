import React, { useMemo, useState } from 'react';
import type { Account, Category, Transaction } from '../../types';
import { flowPeriods, flowRowsOf, type FlowUnit } from '../../utils/activityModel';
import MoneyFlowChart, { categoryStyles } from './MoneyFlowChart';

/**
 * The money-flow chart for one account's transactions: weeks, months or quarters, with the balance line and where each
 * period's money went. Pages whose figures are already monthly totals use `MoneyFlowChart` with their own periods.
 */
const AccountMoneyFlow: React.FC<{
  account: Pick<Account, 'currency'>;
  transactions: Transaction[];
  convert: (tx: Transaction) => number;
  todayBalance: number;
  categories: Category[];
  labels?: { in: string; out: string; balance: string };
  onCategory?: (name: string) => void;
}> = ({ account, transactions, convert, todayBalance, categories, labels, onCategory }) => {
  const [unit, setUnit] = useState<FlowUnit>('months');
  const rows = useMemo(() => flowRowsOf(transactions, convert), [transactions, convert]);
  const periods = useMemo(() => flowPeriods(rows, unit, todayBalance), [rows, unit, todayBalance]);
  const style = useMemo(() => categoryStyles(categories), [categories]);
  return <MoneyFlowChart periods={periods} currency={account.currency} labels={labels} units={{ active: unit, onChange: setUnit }} categoryStyle={style} onCategory={onCategory} />;
};

export default AccountMoneyFlow;
