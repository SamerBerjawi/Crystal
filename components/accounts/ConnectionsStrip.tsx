import React from 'react';
import type { Account } from '../../types';
import type { AccountLink, LinkKind } from '../../utils/accountLinks';
import { AccountLogo } from '../AccountCard';
import Icon from '../ui/Icon';
import { Amount } from '../ui/Money';
import { useTransactionsContext } from '../../contexts/DomainProviders';
import { useScheduleContext } from '../../contexts/FinancialDataContext';
import { computeAccountDisplayBalance } from '../../utils/accountsModel';

const KIND_ICON: Partial<Record<LinkKind, string>> = {
  'funds-goal': 'target-01',
  'holds-goal': 'target-01',
  'transfers-with': 'arrow-data-transfer-horizontal',
};

/** One account's live balance, as its own page shows it. */
export const useLiveBalance = () => {
  const { transactions } = useTransactionsContext();
  const { loanPaymentOverrides } = useScheduleContext();
  return (account: Account) => computeAccountDisplayBalance(account, transactions.filter(tx => tx.accountId === account.id), loanPaymentOverrides);
};

/**
 * Every account and goal this one is linked to, as chips under the hero. Each opens the other page and shows its
 * live figure, so a card shows how much is in the account that pays it.
 */
const ConnectionsStrip: React.FC<{ account?: Account; links: AccountLink[]; onOpenAccount: (id: string) => void; onOpenGoals?: () => void }> = ({ links, onOpenAccount, onOpenGoals }) => {
  const balanceOf = useLiveBalance();
  if (links.length === 0) return null;
  return (
    <nav aria-label="Connected accounts and goals" className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {links.map(link => {
        const target = link.target;
        const key = `${link.kind}-${target.type === 'account' ? target.account.id : target.goal.id}`;
        const onPress = target.type === 'account' ? () => onOpenAccount(target.account.id) : onOpenGoals;
        return (
          <button
            key={key}
            type="button"
            onClick={onPress}
            disabled={!onPress}
            className="surface-card flex min-h-14 shrink-0 cursor-pointer items-center gap-3 rounded-[var(--radius-lg)] px-3 py-2 text-left transition-colors hover:bg-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] disabled:cursor-default"
          >
            {target.type === 'account'
              ? <AccountLogo account={target.account} size={32} />
              : <span className="flex size-8 items-center justify-center rounded-full bg-primary-soft"><Icon name={KIND_ICON[link.kind] ?? 'link-01'} size={16} className="text-primary" /></span>}
            <span className="min-w-0">
              <span className="type-caption block text-muted">{link.label}{link.count ? ` · ${link.count} transfers` : ''}</span>
              <span className="type-body-strong block max-w-[220px] truncate text-ink">{target.type === 'account' ? target.account.name : target.goal.name}</span>
            </span>
            <span className="type-figure-row shrink-0 text-ink">
              {target.type === 'account'
                ? <Amount value={balanceOf(target.account)} currency={target.account.currency} />
                : <Amount value={target.goal.currentAmount} currency={target.goal.currency} />}
            </span>
            {target.type === 'account' && <Icon name="arrow-right-01" size={16} className="text-muted" />}
          </button>
        );
      })}
    </nav>
  );
};

export default ConnectionsStrip;
