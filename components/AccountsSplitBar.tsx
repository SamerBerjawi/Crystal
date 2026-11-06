import React, { useMemo } from 'react';
import type { Account, Currency } from '../types';
import { Amount } from './ui/Money';
import { cn } from '../lib/utils';

const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];
const MAX_SEGMENTS = 5;

interface AccountsSplitBarProps {
  accounts: Account[];
  /** An account's balance, in the display currency. */
  balanceOf: (account: Account) => number;
  currency: Currency;
  title: string;
  onOpen: (id: string) => void;
}

/** Where the money sits: one bar split by account, with each share named underneath. Small accounts fold into "Others". */
const AccountsSplitBar: React.FC<AccountsSplitBarProps> = ({ accounts, balanceOf, currency, title, onOpen }) => {
  const { parts, total } = useMemo(() => {
    const rows = accounts.map(account => ({ id: account.id, name: account.name, value: Math.abs(balanceOf(account)) })).filter(row => row.value > 0).sort((a, b) => b.value - a.value);
    const sum = rows.reduce((acc, row) => acc + row.value, 0);
    const shown = rows.slice(0, MAX_SEGMENTS - (rows.length > MAX_SEGMENTS ? 1 : 0));
    const rest = rows.slice(shown.length).reduce((acc, row) => acc + row.value, 0);
    const list = shown.map((row, index) => ({ ...row, color: COLORS[index] }));
    if (rest > 0) list.push({ id: 'others', name: `${rows.length - shown.length} others`, value: rest, color: 'var(--muted)' });
    return { parts: list, total: sum };
  }, [accounts, balanceOf]);

  if (total <= 0 || parts.length < 2) return null;

  return (
    <section aria-label={title} className="surface-card rounded-[var(--radius-xl)] p-5 max-md:p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="type-card-title text-ink">{title}</h2>
        <span className="type-figure-row text-ink"><Amount value={total} currency={currency} /></span>
      </div>
      <div className="mt-3 flex h-2.5 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={parts.map(part => `${part.name} ${Math.round((part.value / total) * 100)}%`).join(', ')}>
        {parts.map(part => <span key={part.id} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(part.value / total) * 100}%`, background: part.color }} />)}
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-2 lg:grid-cols-3">
        {parts.map(part => {
          const body = (
            <>
              <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: part.color }} />
              <span className="type-body min-w-0 flex-1 truncate text-ink">{part.name}</span>
              <span className="type-figure-row shrink-0 text-ink"><Amount value={part.value} currency={currency} /></span>
              <span className="type-caption w-9 shrink-0 text-right text-muted">{Math.round((part.value / total) * 100)}%</span>
            </>
          );
          return (
            <li key={part.id}>
              {part.id === 'others'
                ? <span className="flex min-h-9 items-center gap-2">{body}</span>
                : <button type="button" onClick={() => onOpen(part.id)} className={cn('flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-[var(--radius-md)] text-left hover:bg-inset')}>{body}</button>}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default AccountsSplitBar;
