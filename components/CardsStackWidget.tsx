import React, { useMemo, useState } from 'react';
import type { Account, Currency, Transaction } from '../types';
import { accountCardKind, accountHasCard, computeAccount90dSparkline, latestTransactions } from '../utils/accountsModel';
import { usePreferencesSelector } from '../contexts/DomainProviders';
import { parseLocalDate } from '../utils';
import { Amount } from './ui/Money';
import { Badge, Sparkline } from './ui/Display';
import { AccountMark } from './ui/Summaries';
import { MerchantLogo } from './EntityIcon';
import { Button, IconButton } from './ui/Actions';
import { EmptyState } from './ui/States';
import { useWidgetBox } from './ui/WidgetGrid';
import { ProgressBar } from './AccountFrame';
import CardFace from './CardFace';
import { cn } from '../lib/utils';

interface CardsStackWidgetProps {
  accounts: Account[];
  transactions: Transaction[];
  currency: Currency;
  /** Converts an amount in its own currency to the display currency. */
  toDisplay: (amount: number, from: Currency) => number;
  onOpen: (id: string) => void;
  onAll: () => void;
}

const ASPECT = 1.586;
const PILE = 3; // cards shown in the pile: the one in front and two peeking out above it
const RISE = 10; // pixels each card behind sits higher

/**
 * Your cards as a pile you flip through, with the front card's detail beside it: what it has spent this month, or for a
 * credit card how much of its limit is used.
 */
const CardsStackWidget: React.FC<CardsStackWidgetProps> = ({ accounts, transactions, currency, toDisplay, onOpen, onAll }) => {
  const box = useWidgetBox();
  const cards = useMemo(() => accounts.filter(accountHasCard).sort((a, b) => Number(a.status === 'closed') - Number(b.status === 'closed')), [accounts]);
  const [frontId, setFrontId] = useState<string | null>(null);
  const conversionRates = usePreferencesSelector(p => p.conversionRates);

  const monthSpend = useMemo(() => {
    const now = new Date();
    const spent: Record<string, number> = {};
    for (const t of transactions) {
      if (t.amount >= 0 || t.transferId) continue;
      const date = parseLocalDate(t.date);
      if (date.getFullYear() !== now.getFullYear() || date.getMonth() !== now.getMonth() || date > now) continue;
      spent[t.accountId] = (spent[t.accountId] ?? 0) + Math.abs(toDisplay(t.amount, t.currency));
    }
    return spent;
  }, [transactions, toDisplay]);

  const count = cards.length;
  const frontIndex = Math.max(0, cards.findIndex(card => card.id === frontId));
  const front: Account | undefined = cards[frontIndex];

  // On a wide widget the card's own account shows too: its balance and 90-day trend, and its latest payments.
  const frontTransactions = useMemo(() => (front ? transactions.filter(tx => tx.accountId === front.id) : []), [transactions, front]);
  const trend = useMemo(() => {
    if (!front) return null;
    const spark = computeAccount90dSparkline(front, frontTransactions, undefined, { conversionRates });
    return spark.sparklineData.length > 1 ? { data: spark.sparklineData.map(point => ({ value: point.value })), isPositive: spark.isPositiveTrend } : null;
  }, [front, frontTransactions, conversionRates]);
  const latest = useMemo(() => latestTransactions(frontTransactions.filter(tx => !tx.isSplitParent), 3), [frontTransactions]);

  if (cards.length === 0 || !front) {
    return <EmptyState icon="credit-card" title="No cards yet" description="Add a card detail to an account and it joins the pile." actionLabel="Open Accounts" onAction={onAll} className="h-full py-6" />;
  }

  const step = (by: number) => setFrontId(cards[(frontIndex + by + count) % count].id);
  const spent = monthSpend[front.id] ?? 0;
  const limit = front.creditLimit ? toDisplay(front.creditLimit, front.currency) : 0;
  const used = front.type === 'Credit Card' ? Math.abs(toDisplay(Math.min(front.balance, 0), front.currency)) : spent;
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  // Beside each other when there is room, one above the other when there is not.
  const side = box.width === 0 || box.width >= 560;
  const controlsH = count > 1 ? 20 : 0; // the dots under the pile
  const pileRise = (Math.min(count, PILE) - 1) * RISE;
  const arrowsW = count > 1 ? 2 * 40 : 0; // an arrow on each side of the pile
  // Side by side, the pile takes one half of the widget and the detail the other.
  const halfW = box.width ? Math.floor((box.width - 24) / 2) : 360;
  const areaW = (side ? halfW : (box.width || 320)) - arrowsW;
  const areaH = box.height > 0 ? (side ? box.height : box.height - 176) - controlsH - pileRise - 4 : 170;
  const cardW = Math.max(150, Math.min(areaW, areaH * ASPECT, 560));
  const cardH = cardW / ASPECT;
  // When the card is limited by width and the widget is taller than it needs, thumbnails of every card fill the gap and pick a card in one tap.
  const spare = box.height > 0 ? (side ? box.height : box.height - 176) - (cardH + pileRise) - controlsH - 8 : 0;
  const thumbs = count > 1 && spare >= 40;

  // The account overview needs the room: its row, then as many of its latest payments as fit under the card's own figures.
  const overviewLatest = box.height === 0 ? 3 : Math.max(0, Math.min(5, Math.floor((box.height - 215) / 42)));
  const showOverview = side && (box.height === 0 || box.height >= 200);

  const position = (index: number) => (index - frontIndex + count) % count;

  return (
    <div className={cn('h-full min-h-0 gap-6', side ? 'grid grid-cols-2 items-center' : 'flex flex-col items-center')}>
      <div className={cn('flex min-w-0 shrink-0 flex-col items-center justify-center gap-2', side && 'h-full')}>
        <div className="-mx-1 flex items-center">
          {count > 1 ? <IconButton icon="arrow-left-01" label="Previous card" onPress={() => step(-1)} /> : null}
          <div className="relative" style={{ width: cardW, height: cardH + pileRise }} role="group" aria-label="Your cards">
            {cards.map((card, index) => {
              const pos = position(index);
              const shown = pos < PILE;
              const depth = Math.min(pos, PILE);
              return (
                <button
                  key={card.id}
                  type="button"
                  tabIndex={pos === 0 ? 0 : -1}
                  disabled={!shown}
                  onClick={() => (pos === 0 ? onOpen(card.id) : setFrontId(card.id))}
                  aria-label={pos === 0 ? `Open ${card.name}` : `Bring ${card.name} forward`}
                  className="absolute left-0 cursor-pointer origin-bottom transition-[transform,opacity] duration-500 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pill disabled:pointer-events-none"
                  style={{
                    bottom: 0,
                    width: cardW,
                    height: cardH,
                    transform: `translateY(${-depth * RISE}px) scale(${1 - depth * 0.05})`,
                    opacity: shown ? 1 - pos * 0.12 : 0,
                    zIndex: 20 - pos,
                    filter: pos > 0 ? 'brightness(.92)' : undefined,
                  }}
                >
                  <CardFace account={card} className="!shadow-none" />
                </button>
              );
            })}
          </div>
          {count > 1 ? <IconButton icon="arrow-right-01" label="Next card" onPress={() => step(1)} /> : null}
        </div>

        {count > 1 && (thumbs ? (
          <ul className="flex max-w-full items-center justify-center gap-2.5 overflow-x-auto px-2.5 py-2 no-scrollbar" aria-label="Choose a card">
            {cards.map((card, index) => (
              <li key={card.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setFrontId(card.id)}
                  aria-label={`Show ${card.name}`}
                  aria-current={index === frontIndex ? 'true' : undefined}
                  className={cn('block h-9 w-14 cursor-pointer overflow-hidden rounded-[7px] transition-[opacity,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pill', index === frontIndex ? 'opacity-100 ring-2 ring-ink ring-offset-2 ring-offset-[var(--solid)]' : 'opacity-60 hover:opacity-100')}
                >
                  <CardFace account={card} mini className="!rounded-none !p-1.5 !shadow-none" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <span className="flex items-center gap-1.5" aria-hidden>
            {cards.slice(0, 8).map((card, index) => <span key={card.id} className={cn('size-1.5 rounded-full transition-all', index === frontIndex ? 'w-4 bg-ink' : 'bg-ink/25')} />)}
          </span>
        ))}
      </div>

      <div className={cn('w-full min-w-0', side && 'flex h-full flex-col justify-center')}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="type-card-title truncate text-ink">{front.name}</p>
            <p className="type-caption truncate text-muted">{accountCardKind(front)}{front.last4 ? ` · •• ${front.last4}` : ''}{front.cardholderName ? ` · ${front.cardholderName}` : ''}</p>
          </div>
          <Badge tone={front.status === 'closed' ? 'neutral' : 'positive'}>{front.status === 'closed' ? 'Closed' : 'Active'}</Badge>
        </div>

        {limit > 0 ? (
          <>
            <p className="type-body mt-3 text-ink"><span className="type-figure-row"><Amount value={used} currency={currency} /></span> <span className="text-muted">of <Amount value={limit} currency={currency} /> limit</span></p>
            <ProgressBar value={pct} label="Credit limit used" className="mt-2 !h-1.5" />
            <p className="type-caption mt-1 text-muted"><Amount value={Math.max(0, limit - used)} currency={currency} /> left</p>
          </>
        ) : (
          <p className="type-body mt-3 text-ink"><span className="type-figure-row"><Amount value={spent} currency={currency} /></span> <span className="text-muted">spent this month</span></p>
        )}

        {showOverview && (
          <div className="mt-4 border-t border-line pt-3">
            <div className="flex items-center gap-3">
              <AccountMark account={front} />
              <span className="min-w-0 flex-1">
                <span className="type-body-strong block truncate text-ink">Account balance</span>
                <span className="type-caption block truncate text-muted">{front.financialInstitution || front.type}</span>
              </span>
              {trend && <Sparkline data={trend.data} isPositive={trend.isPositive} width={96} height={26} />}
              <span className="type-figure-row shrink-0 text-ink"><Amount value={toDisplay(front.balance, front.currency)} currency={currency} /></span>
            </div>
            {overviewLatest > 0 && latest.length > 0 && (
              <ul className="mt-2 divide-y divide-line">
                {latest.slice(0, overviewLatest).map(tx => (
                  <li key={tx.id} className="flex min-h-10 items-center gap-2.5 py-1">
                    <MerchantLogo merchant={tx.merchant} description={tx.description} size={24} account={front} />
                    <span className="min-w-0 flex-1">
                      <span className="type-body block truncate text-ink">{tx.merchant || tx.description}</span>
                      <span className="type-caption block truncate text-muted">{tx.category} · {parseLocalDate(tx.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                    </span>
                    <span className="type-figure-row shrink-0 text-ink"><Amount value={toDisplay(tx.amount, tx.currency)} currency={currency} tone="flow" /></span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="secondary" size="sm" icon="eye" onPress={() => onOpen(front.id)}>Details</Button>
          <Button variant="secondary" size="sm" icon="credit-card" onPress={onAll}>All {count}</Button>
        </div>
      </div>
    </div>
  );
};

export default CardsStackWidget;
