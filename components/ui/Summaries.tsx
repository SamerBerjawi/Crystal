import React from 'react';
import { Button as AriaButton } from 'react-aria-components';
import type { Account, Currency } from '../../types';
import type { SafeToSpend } from '../../utils/safeToSpend';
import type { SummaryFact, SummaryTarget } from '../../utils/overviewSummary';
import { parseLocalDate } from '../../utils';
import Icon from './Icon';
import { Button, TextLink } from './Actions';
import { CountPill, Row } from './Display';
import { AmountInput } from './Fields';
import { Amount, Change } from './Money';
import { Popover } from './Overlays';
import { EmptyState } from './States';
import { cn } from '../../lib/utils';

/** The signature sentence: three facts at most, each linked to where you can act. */
export const WrittenSummary: React.FC<{ facts: SummaryFact[]; onFact: (id: SummaryTarget) => void; isPrivate?: boolean }> = ({ facts, onFact, isPrivate }) => (
  <p className="type-sentence max-w-[64ch] text-ink">
    {facts.length === 0 && 'Nothing needs you today. Nice.'}
    {facts.map((fact, index) => (
      <React.Fragment key={fact.id}>
        {index > 0 && (index === facts.length - 1 ? ' and ' : ', ')}
        <TextLink variant="summary" onPress={() => onFact(fact.id)}>
          {fact.id === 'income' && isPrivate ? 'Money' : fact.link}
        </TextLink>
        {fact.rest}
      </React.Fragment>
    ))}
    {facts.length > 0 && '.'}
  </p>
);

export interface HeroPart {
  label: string;
  value: number;
}

/** The green hero: the figure, the change in words and a sign, and a three-part split. Used once on a page. */
export const NetWorthHero: React.FC<{
  value: number;
  change: number | null;
  period: string;
  parts: HeroPart[];
  debts: number;
  currency: Currency;
  countUp: boolean;
  onOpen: () => void;
}> = ({ value, change, period, parts, debts, currency, countUp, onOpen }) => {
  const total = parts.reduce((sum, part) => sum + Math.max(0, part.value), 0);
  const shades = ['opacity-100', 'opacity-60', 'opacity-30'];

  return (
    <section aria-label="Net worth" className="flex h-full flex-col justify-between gap-6 rounded-[var(--radius-xl)] bg-primary p-6 text-on-primary max-md:p-5 [--focus:var(--on-primary)]">
      <div>
        <button type="button" onClick={onOpen} className="type-label inline-flex cursor-pointer items-center gap-1">
          Net worth
          <Icon name="ChevronRight" size={16} />
        </button>
        <p className="type-figure-hero mt-1"><Amount value={value} currency={currency} countUp={countUp} /></p>
        {change !== null && <Change value={change} currency={currency} period={period} className="type-label mt-1" />}
      </div>
      <div>
        {total > 0 && (
          <div aria-hidden="true" className="mb-3 flex h-2 gap-0.5 overflow-hidden rounded-full">
            {parts.map((part, index) => part.value > 0 && (
              <span key={part.label} className={cn('h-full bg-on-primary', shades[index])} style={{ width: `${(part.value / total) * 100}%` }} />
            ))}
          </div>
        )}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 md:flex md:flex-wrap">
          {parts.map((part, index) => (
            <div key={part.label} className="min-w-0">
              <dt className="type-caption flex items-center gap-1.5">
                <span aria-hidden="true" className={cn('size-2 rounded-full bg-on-primary', shades[index])} />
                {part.label}
              </dt>
              <dd className="type-figure-row"><Amount value={part.value} currency={currency} /></dd>
            </div>
          ))}
          <div className="min-w-0">
            <dt className="type-caption">Debts</dt>
            <dd className="type-figure-row"><Amount value={debts > 0 ? -debts : 0} currency={currency} /></dd>
          </div>
        </dl>
      </div>
    </section>
  );
};

export interface NeedsYouItem {
  id: string;
  label: string;
  count: number;
  onOpen: () => void;
}

/** What's waiting, as a short list of counts. Each row is a link. */
export const NeedsYou: React.FC<{ items: NeedsYouItem[]; footer?: React.ReactNode }> = ({ items, footer }) => {
  const waiting = items.filter(item => item.count > 0);
  return (
    <section aria-labelledby="needs-you" className="flex h-full flex-col rounded-[var(--radius-xl)] border border-line bg-surface p-6 max-md:p-5">
      <h2 id="needs-you" className="type-card-title mb-2 text-ink">Needs you</h2>
      {waiting.length === 0 ? (
        <p className="type-body flex flex-1 items-center text-muted">All clear. Nothing is waiting.</p>
      ) : (
        <ul className="-mx-2 flex-1">
          {waiting.map(item => (
            <li key={item.id}>
              <button type="button" onClick={item.onOpen} className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-[var(--radius-md)] px-2 text-left hover:bg-inset">
                <span className="type-body min-w-0 truncate text-ink">{item.label}</span>
                <span className="flex shrink-0 items-center gap-1 text-muted">
                  <CountPill count={item.count} />
                  <Icon name="ChevronRight" size={16} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {footer && <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">{footer}</div>}
    </section>
  );
};

const formatDay = (date: string) => parseLocalDate(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/** What's left after bills and your cushion, until your next income. Can be hidden (D-053). */
export const SafeToSpendWidget: React.FC<{
  data: SafeToSpend;
  currency: Currency;
  toDisplay: (eur: number) => number;
  countUp?: boolean;
  onCushionChange: (amount: number) => void;
  size?: 's' | 'm' | 'l';
}> = ({ data, currency, toDisplay, countUp, onCushionChange, size = 's' }) => {
  if (!data.accounts.length) {
    return <EmptyState className="py-4" icon="wallet" title="No spending account yet" description="Add a checking account to see what you can spend." />;
  }

  const isOver = data.amount < 0;
  const untilText = data.untilReason === 'income' ? `your next income on ${formatDay(data.until)}` : `the end of the month`;
  const rows: { label: string; value: number }[] = [
    { label: 'Cash', value: data.cash },
    { label: 'Bills before then', value: -data.upcoming },
    { label: 'Cushion', value: -data.cushion },
  ];

  return (
    <div className={cn('flex h-full gap-6', size === 's' ? 'flex-col justify-between gap-3' : 'items-stretch justify-between')}>
      <div className="min-w-0">
        <p className={cn('type-figure-lg', isOver ? 'text-money-out' : 'text-ink')}>
          <Amount value={toDisplay(data.amount)} currency={currency} countUp={countUp} />
        </p>
        <p className="type-caption mt-1 text-muted">
          {isOver ? <>Over by this much until {untilText}</> : <><Amount value={toDisplay(data.perDay)} currency={currency} /> a day until {untilText}</>}
        </p>
      </div>
      <div className="min-w-0">
        <dl className="space-y-1">
          {rows.map(row => (
            <div key={row.label} className="type-caption flex items-center justify-between gap-3">
              <dt className="text-muted">
                {row.label === 'Cushion' ? (
                  <Popover
                    title="Cushion"
                    placement="bottom start"
                    trigger={<AriaButton className="cursor-pointer underline underline-offset-2">Cushion</AriaButton>}
                  >
                    <AmountInput
                      className="w-56 max-md:w-full"
                      label="Keep back"
                      help="Taken off before showing what's safe to spend."
                      currency={currency}
                      defaultValue={data.cushion ? String(data.cushion) : ''}
                      onChange={text => onCushionChange(Math.max(0, Number(text.replace(',', '.')) || 0))}
                    />
                  </Popover>
                ) : row.label}
              </dt>
              <dd className="text-ink"><Amount value={toDisplay(row.value)} currency={currency} /></dd>
            </div>
          ))}
        </dl>
        <p className="type-caption mt-1 truncate text-muted">From {data.accounts.map(account => account.name).join(', ')}</p>
      </div>
    </div>
  );
};

/** The biggest open accounts, with a route to the rest. */
export const AccountsSummary: React.FC<{
  accounts: Account[];
  toDisplay: (amount: number, from: Currency) => number;
  currency: Currency;
  onOpen: (id: string) => void;
  onAll: () => void;
}> = ({ accounts, toDisplay, currency, onOpen, onAll }) => {
  const top = [...accounts]
    .filter(account => account.status !== 'closed')
    .sort((a, b) => Math.abs(toDisplay(b.balance, b.currency)) - Math.abs(toDisplay(a.balance, a.currency)));
  return (
    <div className="flex h-full flex-col">
      <ul className="min-h-0 flex-1 divide-y divide-line overflow-hidden">
        {top.slice(0, 4).map(account => (
          <li key={account.id}>
            <Row
              title={account.name}
              context={account.type}
              trailing={<Amount value={toDisplay(account.balance, account.currency)} currency={currency} tone="loss" />}
              onPress={() => onOpen(account.id)}
            />
          </li>
        ))}
      </ul>
      {top.length > 4 && <Button variant="ghost" size="sm" className="mt-1 self-start" onPress={onAll}>All {top.length} accounts</Button>}
    </div>
  );
};

/** Liquidity, savings rate, debt ratio and net flow. */
export const KeyRatios: React.FC<{ items: { label: string; value: React.ReactNode; context: string }[] }> = ({ items }) => (
  <dl className="grid h-full grid-cols-2 gap-x-6 gap-y-3 lg:grid-cols-4">
    {items.map(item => (
      <div key={item.label} className="min-w-0">
        <dt className="type-caption text-muted">{item.label}</dt>
        <dd className="type-figure-lg truncate text-ink">{item.value}</dd>
        <dd className="type-caption truncate text-muted">{item.context}</dd>
      </div>
    ))}
  </dl>
);
