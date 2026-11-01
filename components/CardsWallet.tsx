import React, { useEffect, useMemo } from 'react';
import { Radio, RadioGroup } from 'react-aria-components';
import { Account, Transaction } from '../types';
import { convertToEur, formatCurrency, parseLocalDate } from '../utils';
import { accountCardKind, latestTransactions, topMerchantsThisMonth } from '../utils/accountsModel';
import { DetailList, Panel, ProgressBar } from './AccountFrame';
import { shortDate } from './AccountPot';
import Icon from './ui/Icon';
import { Button, IconButton } from './ui/Actions';
import { Badge, DayGroup, Row } from './ui/Display';
import { Menu, type MenuAction } from './ui/Menu';
import { Amount } from './ui/Money';
import { EmptyState } from './ui/States';
import { cn } from '../lib/utils';

const cardMoney = (account: Account) => (
  account.creditLimit ? `${formatCurrency(Math.abs(account.balance), account.currency)} of ${formatCurrency(account.creditLimit, account.currency)}` : formatCurrency(account.balance, account.currency)
);

/** A card drawn from what the account stores. Only ever the last four digits. */
const BankCard: React.FC<{ account: Account; size?: 'small' | 'large' }> = ({ account, size = 'small' }) => (
  <div className={cn('flex aspect-[1.586] w-full flex-col justify-between rounded-[var(--radius-lg)] bg-primary text-on-primary', size === 'large' ? 'p-5' : 'p-3', account.status === 'closed' && 'opacity-60')}>
    <div className="flex items-start justify-between gap-2">
      <span className="type-label truncate">{account.financialInstitution || account.name}</span>
      <span className="type-caption shrink-0">{accountCardKind(account)}</span>
    </div>
    <div>
      <p className={cn('tabular-nums tracking-wider', size === 'large' ? 'type-section-title' : 'type-label')} aria-label={account.last4 ? `Ending ${account.last4}` : undefined}>
        •••• {account.last4 || '••••'}
      </p>
      <div className="type-caption mt-1 flex justify-between gap-2">
        <span className="truncate">{account.cardholderName || account.name}</span>
        {account.expirationDate && <span className="shrink-0 tabular-nums">{account.expirationDate}</span>}
      </div>
    </div>
  </div>
);

interface CardsWalletProps {
  cards: Account[];
  accounts: Account[];
  transactionsByAccount: Record<string, Transaction[]>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  menuFor: (account: Account) => MenuAction[];
  onOpen: (id: string) => void;
  onSeeTransactions: (account: Account) => void;
  onAddCard: () => void;
}

/** Every account with a card: a row to pick from, then the chosen card's details and activity. */
const CardsWallet: React.FC<CardsWalletProps> = ({ cards, accounts, transactionsByAccount, selectedId, onSelect, menuFor, onOpen, onSeeTransactions, onAddCard }) => {
  const selected = cards.find(card => card.id === selectedId) ?? cards[0];

  useEffect(() => {
    if (selected && selected.id !== selectedId) onSelect(selected.id);
  }, [selected, selectedId, onSelect]);

  const transactions = selected ? transactionsByAccount[selected.id] ?? [] : [];
  const days = useMemo(() => {
    const groups = new Map<string, Transaction[]>();
    latestTransactions(transactions, 12).forEach(tx => groups.set(tx.date, [...(groups.get(tx.date) ?? []), tx]));
    return [...groups.entries()];
  }, [transactions]);
  const merchants = useMemo(() => topMerchantsThisMonth(transactions), [transactions]);

  if (!selected) {
    return <EmptyState icon="credit_card" title="No cards yet" description="Add a card to a checking account, or a credit card or meal voucher." actionLabel="Add account" onAction={onAddCard} />;
  }

  const settlement = accounts.find(item => item.id === selected.settlementAccountId);
  const used = Math.abs(selected.balance);
  const limit = selected.creditLimit;

  return (
    <div className="space-y-4">
      <RadioGroup
        aria-label="Your cards"
        orientation="horizontal"
        value={selected.id}
        onChange={onSelect}
        className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 lg:grid-cols-5"
      >
        {cards.map(card => (
          <Radio
            key={card.id}
            value={card.id}
            className="w-[200px] shrink-0 cursor-pointer snap-start rounded-[var(--radius-lg)] border-2 border-transparent p-1.5 outline-none data-[selected]:border-primary data-[hovered]:bg-inset data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-focus md:w-auto"
          >
            <BankCard account={card} />
            <span className="type-body-strong mt-2 block truncate px-1 text-ink">{card.name}</span>
            <span className="type-caption block truncate px-1 text-muted privacy-blur">{cardMoney(card)}</span>
          </Radio>
        ))}
        <button
          type="button"
          onClick={onAddCard}
          className="flex w-[200px] shrink-0 snap-start cursor-pointer flex-col justify-center gap-1 rounded-[var(--radius-lg)] border border-dashed border-line-strong p-4 text-left text-ink hover:bg-inset md:w-auto"
        >
          <Icon name="add" size={24} className="text-muted" />
          <span className="type-body-strong">Add a card</span>
          <span className="type-caption text-muted">Add an account with a card.</span>
        </button>
      </RadioGroup>

      <div className="grid items-start gap-4 lg:grid-cols-12">
        <section aria-label={selected.name} className="min-w-0 space-y-4 rounded-[var(--radius-xl)] border border-line bg-surface p-6 max-md:p-5 lg:col-span-5">
          <header className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <h2 className="type-section-title truncate text-ink">{selected.name}</h2>
              <p className="type-caption text-muted">{accountCardKind(selected)}{selected.last4 ? ` card, •• ${selected.last4}` : ' card'}</p>
            </div>
            <Badge tone={selected.status === 'closed' ? 'neutral' : 'positive'}>{selected.status === 'closed' ? 'Closed' : 'Active'}</Badge>
            <Menu title={selected.name} trigger={<IconButton icon="more_horiz" label={`Actions for ${selected.name}`} tooltipPlacement="left" />} items={menuFor(selected)} />
          </header>
          <BankCard account={selected} size="large" />
          <DetailList items={[
            { label: 'Spends from', value: settlement?.name ?? (selected.type === 'Credit Card' ? undefined : selected.name) },
            { label: 'Network', value: selected.cardNetwork },
            { label: 'Expires', value: selected.expirationDate },
            { label: 'Name on card', value: selected.cardholderName },
            { label: 'Statement opens', value: selected.statementStartDate ? `Day ${selected.statementStartDate}` : undefined },
            { label: 'Payment due', value: selected.paymentDate ? `Day ${selected.paymentDate}` : undefined },
          ]} />
          <Button variant="secondary" block onPress={() => onOpen(selected.id)}>Open account</Button>
        </section>

        <div className="min-w-0 space-y-4 lg:col-span-7">
          <Panel title={limit ? 'Credit limit' : 'Balance'}>
            <p className="type-figure-lg text-ink">
              <Amount value={limit ? used : selected.balance} currency={selected.currency} />
              {limit && <span className="type-body text-muted"> of {formatCurrency(limit, selected.currency)}</span>}
            </p>
            {limit && (
              <>
                <ProgressBar value={(used / limit) * 100} label="Credit used" className="mt-2" />
                <p className="type-caption mt-1.5 text-muted"><Amount value={Math.max(0, limit - used)} currency={selected.currency} /> left</p>
              </>
            )}
            {merchants.length > 0 && (
              <div className="mt-4 border-t border-line pt-3">
                <h3 className="type-label mb-1 text-muted">Where it went this month</h3>
                <ul>
                  {merchants.map(item => (
                    <li key={item.name} className="type-body flex min-h-9 items-center justify-between gap-3 text-ink">
                      <span className="min-w-0 truncate">{item.name}</span>
                      <span className="type-figure-row shrink-0"><Amount value={convertToEur(item.amount, selected.currency)} currency="EUR" /></span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>

          <Panel title="On this card">
            {days.length === 0 && <p className="type-body text-muted">No activity yet.</p>}
            {days.map(([date, items]) => (
              <DayGroup key={date} label={parseLocalDate(date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}>
                <ul className="divide-y divide-line">
                  {items.map(tx => (
                    <li key={tx.id}>
                      <Row title={tx.merchant || tx.description} context={`${tx.category || 'Uncategorised'}, ${shortDate(tx.date)}`} trailing={<Amount value={tx.amount} currency={tx.currency} tone="flow" />} onPress={() => onOpen(selected.id)} />
                    </li>
                  ))}
                </ul>
              </DayGroup>
            ))}
            {transactions.length > 0 && <Button variant="ghost" size="sm" className="mt-2" onPress={() => onSeeTransactions(selected)}>See all transactions</Button>}
          </Panel>
        </div>
      </div>
    </div>
  );
};

export default CardsWallet;
