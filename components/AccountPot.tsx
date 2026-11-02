import React, { useMemo } from 'react';
import { Account, Transaction } from '../types';
import { convertToMain, normalizeCurrency, parseLocalDate, getMainCurrency, formatCurrency } from '../utils';
import { computeAccount90dSparkline, computeAccountDisplayBalance, latestTransactions } from '../utils/accountsModel';
import { useScheduleContext } from '../contexts/FinancialDataContext';
import { usePreferencesSelector } from '../contexts/DomainProviders';
import { AccountLogo } from './AccountCard';
import { MerchantLogo } from './EntityIcon';
import { IconButton } from './ui/Actions';
import { Row } from './ui/Display';
import { Menu, type MenuAction } from './ui/Menu';
import { Amount } from './ui/Money';
import { AreaSparkline, useSparklineHover } from '../src/components/charts';
import { cn } from '../lib/utils';

export const shortDate = (date: string) => parseLocalDate(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export const LatestList: React.FC<{ transactions: Transaction[]; onOpen: () => void }> = ({ transactions, onOpen }) => (
  <ul className="divide-y divide-line">
    {transactions.map(tx => (
      <li key={tx.id}>
        <Row
          leading={<MerchantLogo merchant={tx.merchant} description={tx.description} isTransfer={Boolean(tx.transferId || tx.category === 'Transfer')} size={36} />}
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

interface SparkPoint {
  day: string;
  value: number;
  pnl?: number;
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

  const sparklinePoints = useMemo<SparkPoint[]>(() => {
    if (sparklineData.length >= 2) {
      return sparklineData.map((pt, i) => {
        const prev = i > 0 ? sparklineData[i - 1].value : pt.value;
        const pnl = Math.round((pt.value - prev) * 100) / 100;
        const day = pt.date instanceof Date
          ? pt.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
          : `Day ${i + 1}`;
        return {
          day,
          value: pt.value,
          pnl,
        };
      });
    }
    return [
      { day: 'Day 1', value: balance, pnl: 0 },
      { day: 'Today', value: balance, pnl: 0 },
    ];
  }, [sparklineData, balance]);

  const hover = useSparklineHover<SparkPoint>();
  const shown = hover.datum ?? sparklinePoints.at(-1);

  const latest = useMemo(() => latestTransactions(transactions, 3), [transactions]);
  const isForeign = normalizeCurrency(account.currency) !== getMainCurrency();

  return (
    <section aria-label={account.name} className="flex min-w-0 flex-col gap-4 rounded-[var(--radius-xl)] surface-card p-6 max-md:p-5">
      <header className="flex items-start gap-3">
        <AccountLogo account={account} />
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 cursor-pointer text-left">
          <span className="type-body-strong block truncate text-ink">{account.name}</span>
          <span className="type-caption block truncate text-muted">{context}</span>
        </button>
        <Menu title={account.name} trigger={<IconButton icon="more_horiz" label={`Actions for ${account.name}`} tooltipPlacement="left" />} items={menuItems} />
      </header>
      <div className="space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="type-figure-lg truncate text-ink">
            <Amount value={convertToMain(balance, account.currency)} currency={getMainCurrency()} />
          </p>
          {shown && (
            <span className="type-caption text-muted truncate flex items-center gap-1.5">
              <span>{shown.day} · {formatCurrency(shown.value, account.currency)}</span>
              {shown.pnl !== undefined && shown.pnl !== 0 && (
                <span className={cn('text-2xs font-semibold px-1 py-0.5 rounded', shown.pnl > 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500')}>
                  {shown.pnl > 0 ? '+' : ''}{formatCurrency(shown.pnl, account.currency)}
                </span>
              )}
            </span>
          )}
        </div>
        {isForeign && <p className="type-caption text-muted"><Amount value={balance} currency={account.currency} /></p>}
      </div>
      {sparklinePoints.length > 1 && (
        <div className="w-full">
          <AreaSparkline
            data={sparklinePoints}
            dataKey="value"
            height={56}
            curve="natural"
            endDot
            crosshair="gradient"
            springConfig={{ damping: 60 }}
            animationDuration={1500}
            color={isPositiveTrend ? '#10b981' : '#f43f5e'}
            {...hover.sparklineProps}
          />
        </div>
      )}
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
