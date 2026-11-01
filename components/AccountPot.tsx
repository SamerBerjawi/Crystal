import React, { useMemo } from 'react';
import { Account, Transaction } from '../types';
import { convertToEur, normalizeCurrency, parseLocalDate } from '../utils';
import { computeAccount90dSparkline, computeAccountDisplayBalance, latestTransactions } from '../utils/accountsModel';
import { useScheduleContext } from '../contexts/FinancialDataContext';
import { usePreferencesSelector } from '../contexts/DomainProviders';
import { AccountLogo } from './AccountCard';
import { IconButton } from './ui/Actions';
import { Row, Sparkline } from './ui/Display';
import { Menu, type MenuAction } from './ui/Menu';
import { Amount } from './ui/Money';

export const shortDate = (date: string) => parseLocalDate(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export const LatestList: React.FC<{ transactions: Transaction[]; onOpen: () => void }> = ({ transactions, onOpen }) => (
  <ul className="divide-y divide-line">
    {transactions.map(tx => (
      <li key={tx.id}>
        <Row
          title={tx.merchant || tx.description}
          context={`${tx.category || 'Uncategorised'}, ${shortDate(tx.date)}`}
          trailing={<Amount value={tx.amount} currency={tx.currency} tone="flow" />}
          onPress={onOpen}
        />
      </li>
    ))}
  </ul>
);

interface AccountPotProps {
  account: Account;
  transactions: Transaction[];
  /** A line on what's linked here, such as the cards that spend from it. */
  note?: string;
  context: string;
  menuItems: MenuAction[];
  onOpen: () => void;
}

/** An account as a pot: its figure, 90-day trend, what's linked to it, and the latest activity. */
const AccountPot: React.FC<AccountPotProps> = ({ account, transactions, note, context, menuItems, onOpen }) => {
  const { loanPaymentOverrides } = useScheduleContext();
  const conversionRates = usePreferencesSelector(p => p.conversionRates);
  const balance = useMemo(() => computeAccountDisplayBalance(account, transactions, loanPaymentOverrides), [account, transactions, loanPaymentOverrides]);
  const { sparklineData, isPositiveTrend } = useMemo(
    () => computeAccount90dSparkline(account, transactions, balance, { conversionRates }),
    [account, transactions, balance, conversionRates]
  );
  const latest = useMemo(() => latestTransactions(transactions, 3), [transactions]);
  const isForeign = normalizeCurrency(account.currency) !== 'EUR';

  return (
    <section aria-label={account.name} className="flex min-w-0 flex-col gap-4 rounded-[var(--radius-xl)] border border-line bg-surface p-6 max-md:p-5">
      <header className="flex items-start gap-3">
        <AccountLogo account={account} />
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 cursor-pointer text-left">
          <span className="type-body-strong block truncate text-ink">{account.name}</span>
          <span className="type-caption block truncate text-muted">{context}</span>
        </button>
        <Menu title={account.name} trigger={<IconButton icon="more_horiz" label={`Actions for ${account.name}`} tooltipPlacement="left" />} items={menuItems} />
      </header>
      <div>
        <p className="type-figure-lg truncate text-ink"><Amount value={convertToEur(balance, account.currency)} currency="EUR" /></p>
        {isForeign && <p className="type-caption text-muted"><Amount value={balance} currency={account.currency} /></p>}
      </div>
      {sparklineData.length > 1 && <Sparkline data={sparklineData} isPositive={isPositiveTrend} width={480} height={72} className="h-[72px] w-full" preserveAspect={false} />}
      {note && <p className="type-body text-muted">{note}</p>}
      {account.accountNumber && <p className="type-caption text-muted">Account •• {account.accountNumber.slice(-4)}</p>}
      {latest.length > 0 && (
        <div className="border-t border-line pt-3">
          <h3 className="type-label text-muted">Latest</h3>
          <LatestList transactions={latest} onOpen={onOpen} />
        </div>
      )}
    </section>
  );
};

export default AccountPot;
