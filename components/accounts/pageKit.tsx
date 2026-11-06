import React from 'react';
import type { Account, Category, DisplayTransaction, LoanPaymentOverrides, MileageLog, ScheduledPayment, Transaction } from '../../types';
import { parseLocalDate } from '../../utils';
import { AccountTransactions, DetailList, Panel } from '../AccountFrame';
import { Amount } from '../ui/Money';
import { Banner } from '../ui/States';
import type { ShellAction, ShellTab } from './AccountShell';

export interface AccountPanelProps {
  account: Account;
  transactions: Transaction[];
  accountTransactions: { tx: Transaction; parsedDate: Date; convertedAmount: number }[];
  displayTransactions: DisplayTransaction[];
  categories: Category[];
  accounts: Account[];
  loanOverrides: LoanPaymentOverrides;
  showBalanceAdjustments: boolean;
  onTransactionClick: (tx: DisplayTransaction) => void;
  onAddTransaction: () => void;
  onAdjustBalance: () => void;
  onBack: () => void;
  onOpenAccount: (id: string) => void;
  onOpenGoals?: () => void;
  onOpenHolding?: (symbol: string) => void;
  onSaveAccount?: (account: Account) => void;
  onSync?: () => void;
  onUpdateValuation: () => void;
  onCloseAsset: () => void;
  onRevertClosure?: () => void;
  onOverridesChange: (overrides: Record<number, Partial<ScheduledPayment>>) => void;
  onMakePayment: (payment: ScheduledPayment, description: string) => void;
  onAddLog: () => void;
  onEditLog: (log?: MileageLog) => void;
  onDeleteLog: (id: string) => void;
  onEditAccount?: () => void;
}

export const day = (value?: string) => (value ? parseLocalDate(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : undefined);
export const shortDay = (value?: string | Date) => {
  if (!value) return '';
  const date = typeof value === 'string' ? parseLocalDate(value) : value;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};
export const money = (value: number, account: Pick<Account, 'currency'>, tone?: 'plain' | 'flow' | 'loss') => <Amount value={value} currency={account.currency} tone={tone} />;
export const pct = (value: number, digits = 0) => `${Number.isFinite(value) ? value.toFixed(digits) : '0'}%`;
export const daysUntil = (date: Date, today = new Date()) => Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86_400_000);

export const commonActions = (props: AccountPanelProps, withAdjust = true): ShellAction[] => [
  ...(props.onSync ? [{ id: 'sync', label: 'Sync', icon: 'refresh', onPress: props.onSync }] : []),
  ...(props.onEditAccount ? [{ id: 'edit', label: 'Edit', icon: 'pencil-edit-02', onPress: props.onEditAccount }] : []),
  ...(withAdjust ? [{ id: 'adjust', label: 'Adjust balance', icon: 'sliders-horizontal', onPress: props.onAdjustBalance }] : []),
];

export const valuationActions = (props: AccountPanelProps, closeLabel: string): ShellAction[] => {
  const isClosed = props.account.status === 'closed';
  return [
    ...(props.onSync ? [{ id: 'sync', label: 'Sync', icon: 'refresh', onPress: props.onSync }] : []),
    ...(props.onEditAccount ? [{ id: 'edit', label: 'Edit', icon: 'pencil-edit-02', onPress: props.onEditAccount }] : []),
    ...(!isClosed ? [{ id: 'close', label: closeLabel, icon: 'tag-01', onPress: props.onCloseAsset }] : []),
    ...(isClosed && props.onRevertClosure ? [{ id: 'reopen', label: 'Reopen', icon: 'clock-01', onPress: props.onRevertClosure }] : []),
  ];
};

export const addAction = (props: AccountPanelProps, label = 'Add transaction'): ShellAction => ({ id: 'add', label, icon: 'add-01', onPress: props.onAddTransaction });

export const activityTab = (props: AccountPanelProps, label = 'Activity'): ShellTab => ({
  id: 'activity',
  label,
  content: <AccountTransactions transactions={props.displayTransactions} categories={props.categories} onOpen={props.onTransactionClick} emptyAction={props.onAddTransaction} />,
});

export const detailsTab = (items: { label: string; value?: React.ReactNode; copy?: string }[], extra?: React.ReactNode): ShellTab => ({
  id: 'details',
  label: 'Details',
  content: (
    <>
      <Panel title="Details"><DetailList items={items} /></Panel>
      {extra}
    </>
  ),
});

export const bankDetails = (account: Account) => [
  { label: 'Bank', value: account.financialInstitution },
  { label: 'Type', value: account.type },
  { label: 'Currency', value: account.currency },
  { label: 'Opened', value: day(account.openingDate) },
  { label: 'Account number', value: account.accountNumber, copy: account.accountNumber },
  { label: 'Routing number', value: account.routingNumber, copy: account.routingNumber },
  { label: 'Website', value: account.website },
  { label: 'Last synced', value: account.balanceLastSyncedAt ? day(account.balanceLastSyncedAt.slice(0, 10)) : undefined },
];

export const closureBanner = (account: Account, title: string, accounts: Account[], onOpenAccount: (id: string) => void) => {
  if (account.status !== 'closed' || !account.closureDetails) return undefined;
  const into = account.closureDetails.incomeAccountId ? accounts.find(item => item.id === account.closureDetails!.incomeAccountId) : undefined;
  return (
    <Banner tone="info">
      <strong>{title}</strong> {account.closureDetails.closureType} on {day(account.closureDetails.date)}, at <Amount value={account.closureDetails.value || 0} currency={account.currency} />.
      {into && <> Paid into <button type="button" className="cursor-pointer font-bold underline" onClick={() => onOpenAccount(into.id)}>{into.name}</button>.</>}
      {account.closureDetails.notes && ` ${account.closureDetails.notes}`}
    </Banner>
  );
};

/** Two columns on wide screens, one on phones. */
export const Grid2: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={`grid gap-4 lg:grid-cols-2 ${className ?? ''}`}>{children}</div>
);
