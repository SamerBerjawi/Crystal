import React, { useMemo, useState } from 'react';
import type { Account, Category, DisplayTransaction, Transaction } from '../../types';
import { cn } from '../../lib/utils';
import {
  byCategory,
  byWeekday,
  changePercent,
  filterRows,
  groupByDay,
  inRange,
  previousRange,
  RANGE_NAMES,
  summarize,
  type ActivityKind,
  type ActivityRange,
  type ActivityRow,
} from '../../utils/activityModel';
import { isoDay, parseDay } from '../../utils/accountPagesModel';
import { EntityGlyph, MerchantLogo } from '../EntityIcon';
import DayCalendar from './DayCalendar';
import { Button } from '../ui/Actions';
import { ShowMore } from '../ui/Display';
import { TextInput } from '../ui/Fields';
import Icon from '../ui/Icon';
import { Amount } from '../ui/Money';
import SegmentedControl from '../ui/SegmentedControl';
import { EmptyState } from '../ui/States';
import { Bars, Board, Donut, Figures, Section } from './charts';
import type { ShellTab } from './AccountShell';
import { shortDay, type AccountPanelProps } from './pageKit';

interface ActivityViewProps {
  account: Account;
  accountTransactions: { tx: Transaction; parsedDate: Date; convertedAmount: number }[];
  categories: Category[];
  onOpen: (tx: DisplayTransaction) => void;
  onAdd: () => void;
}

const RANGES = [{ id: '30d', label: '30 days' }, { id: '90d', label: '90 days' }, { id: '1y', label: 'Year' }, { id: 'all', label: 'All' }];
const KINDS = [{ id: 'all', label: 'All' }, { id: 'in', label: 'In' }, { id: 'out', label: 'Out' }];
const PAGE = 40;

const categoryDetails = (categories: Category[]) => {
  const details = new Map<string, { icon?: string; color?: string }>();
  const walk = (nodes: Category[], icon?: string, color?: string) => nodes.forEach(node => {
    details.set(node.name, { icon: node.icon || icon, color: node.color || color });
    walk(node.subCategories ?? [], node.icon || icon, node.color || color);
  });
  walk(categories);
  return details;
};

const Delta: React.FC<{ now: number; before?: number; goodWhen: 'up' | 'down' | 'none'; range: ActivityRange }> = ({ now, before, goodWhen, range }) => {
  if (before === undefined) return <>{range === 'all' ? 'All time' : ''}</>;
  const change = changePercent(now, before);
  if (change === undefined) return <>Nothing before</>;
  if (change === 0) return <>Same as before</>;
  const up = change > 0;
  const good = goodWhen === 'none' ? undefined : (goodWhen === 'up') === up;
  return <span className={cn(good === true && 'text-[var(--money-in)]', good === false && 'text-[var(--money-out)]')}>{up ? '▲' : '▼'} {Math.abs(change)}% vs the {RANGE_NAMES[range]} before</span>;
};

const ActivityView: React.FC<ActivityViewProps> = ({ account, accountTransactions, categories, onOpen, onAdd }) => {
  const [range, setRange] = useState<ActivityRange>('90d');
  const [kind, setKind] = useState<ActivityKind>('all');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | undefined>();
  const [pickedDay, setPickedDay] = useState<string | undefined>();
  const [shown, setShown] = useState(PAGE);

  const details = useMemo(() => categoryDetails(categories), [categories]);

  const rows = useMemo<ActivityRow<Transaction>[]>(() => accountTransactions
    .filter(({ tx }) => !tx.isSplitParent && !tx.isCombinedParent)
    .map(({ tx, convertedAmount }) => ({
      id: tx.id,
      date: tx.date.slice(0, 10),
      amount: convertedAmount,
      category: tx.category || '',
      text: [tx.merchant, tx.description, tx.category, tx.notes].filter(Boolean).join(' ').toLowerCase(),
      item: tx,
    })), [accountTransactions]);

  const today = new Date();
  const todayKey = isoDay(today);
  const inPeriod = useMemo(() => inRange(rows, range, today), [rows, range, todayKey]);
  const before = useMemo(() => previousRange(rows, range, today), [rows, range, todayKey]);
  const summary = useMemo(() => summarize(inPeriod), [inPeriod]);
  const previous = useMemo(() => (before ? summarize(before) : undefined), [before]);
  const spendDirection = summary.out >= summary.in && summary.out > 0 ? 'out' : summary.in > 0 ? 'in' : 'out';
  const categorySplit = useMemo(() => byCategory(inPeriod, spendDirection), [inPeriod, spendDirection]);
  const weekdays = useMemo(() => byWeekday(inPeriod), [inPeriod]);
  const busiest = weekdays.reduce((best, day) => (day.out > best.out ? day : best), weekdays[0]);

  const visible = useMemo(() => {
    const filtered = filterRows(inPeriod, { kind, query, category });
    return pickedDay ? filtered.filter(row => row.date === pickedDay) : filtered;
  }, [inPeriod, kind, query, category, pickedDay]);
  const groups = useMemo(() => groupByDay(visible, today), [visible, todayKey]);

  const pageRows = groups.reduce<{ groups: typeof groups; used: number }>((acc, group) => {
    if (acc.used >= shown) return acc;
    const take = group.rows.slice(0, shown - acc.used);
    return { groups: [...acc.groups, { ...group, rows: take }], used: acc.used + take.length };
  }, { groups: [], used: 0 });

  const isFiltered = kind !== 'all' || !!query.trim() || !!category || !!pickedDay;
  const clear = () => { setKind('all'); setQuery(''); setCategory(undefined); setPickedDay(undefined); };
  const resetPaging = () => setShown(PAGE);

  if (rows.length === 0) {
    return <EmptyState icon="receipt" title="No transactions yet" description="They appear here as you add them or sync your bank." actionLabel="Add a transaction" onAction={onAdd} />;
  }

  const daysInRange = range === 'all' ? Math.max(1, new Set(inPeriod.map(row => row.date)).size) : { '30d': 30, '90d': 90, '1y': 365 }[range];

  const compactCalendar = range === '30d' || range === '90d';
  const biggest = [
    { row: summary.largestOut, label: 'Biggest payment' },
    { row: summary.largestIn, label: 'Biggest deposit' },
  ].filter(entry => entry.row);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl items={RANGES} activeId={range} onChange={id => { setRange(id as ActivityRange); setPickedDay(undefined); resetPaging(); }} />
        <Button variant="secondary" size="sm" icon="add-01" onPress={onAdd}>Add transaction</Button>
      </div>

      <Board>
        <Section span="side" title="At a glance" subtitle={range === 'all' ? 'Everything on this account' : `Last ${RANGE_NAMES[range]}`}>
          <Figures
            className="grid-cols-2 gap-y-5"
            items={[
              { label: 'Money in', value: <span className="text-[var(--money-in)]"><Amount value={summary.in} currency={account.currency} /></span>, note: <Delta now={summary.in} before={previous?.in} goodWhen="up" range={range} /> },
              { label: 'Money out', value: <Amount value={summary.out} currency={account.currency} />, note: <Delta now={summary.out} before={previous?.out} goodWhen="none" range={range} /> },
              { label: 'Net', value: <Amount value={summary.net} currency={account.currency} tone="flow" />, note: summary.net >= 0 ? 'Balance grew' : 'Balance shrank' },
              { label: 'Transactions', value: summary.count.toLocaleString(), note: summary.count ? `About ${(summary.count / daysInRange >= 1 ? summary.count / daysInRange : summary.count / (daysInRange / 7)).toFixed(1)} a ${summary.count / daysInRange >= 1 ? 'day' : 'week'}` : undefined },
            ]}
          />
          {biggest.length > 0 && (
            <ul className="mt-5 space-y-2">
              {biggest.map(({ row, label }) => {
                const tx = (row as ActivityRow<Transaction>).item;
                return (
                  <li key={label}>
                    <button type="button" onClick={() => onOpen({ ...tx, accountName: account.name })} className="flex w-full cursor-pointer items-center gap-3 rounded-[var(--radius-md)] bg-inset p-3 text-left transition-colors hover:bg-line focus-visible:outline-2 focus-visible:outline-[var(--focus)]">
                      <MerchantLogo merchant={tx.merchant} description={tx.description} isTransfer={!!tx.transferId} account={account} size={36} />
                      <span className="min-w-0 flex-1">
                        <span className="type-label block text-muted">{label}</span>
                        <span className="type-body-strong block truncate text-ink">{tx.description || tx.merchant || 'Transaction'}</span>
                        <span className="type-caption block text-muted">{shortDay(parseDay(tx.date))}</span>
                      </span>
                      <span className="type-figure-row shrink-0 text-ink"><Amount value={(row as ActivityRow).amount} currency={account.currency} tone="flow" /></span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section span="wide" title="Busy days" subtitle="Each square is a day, by quarter. Pick one to see what happened.">
          <div className={cn(compactCalendar ? 'flex flex-col gap-6 @2xl:flex-row' : 'space-y-4')}>
            <div className="min-w-0 shrink-0">
              <DayCalendar compact={compactCalendar} rows={rows} account={account} range={range} onPick={day => { setPickedDay(current => (current === day ? undefined : day)); resetPaging(); }} />
            </div>
            <div className={cn('min-w-0 flex-1', compactCalendar ? '@2xl:border-l @2xl:border-line @2xl:pl-6' : 'border-t border-line pt-4')}>
              <p className="type-label text-muted">By weekday</p>
              <p className="type-caption mb-2 text-muted">{busiest.out > 0 ? `${busiest.name} is when the most goes out` : 'Money out on each day of the week'}</p>
              <Bars data={weekdays as unknown as Record<string, unknown>[]} bars={[{ key: 'out', label: 'Out', color: 'var(--chart-4)' }]} currency={account.currency} height="h-[150px]" />
            </div>
          </div>
        </Section>

        <Section
          span="wide"
          title="Every transaction"
          subtitle={`${visible.length.toLocaleString()} ${visible.length === 1 ? 'transaction' : 'transactions'}${isFiltered ? ' match' : ''}`}
        >
          {visible.length === 0 ? (
            <EmptyState icon="search-01" title="Nothing matches" description="Try a wider range or fewer filters." actionLabel="Clear filters" onAction={clear} className="py-10" />
          ) : (
            <div className="space-y-5">
            {pageRows.groups.map(group => (
                <section key={group.date} aria-label={group.label}>
                  <header className="mb-1 flex items-baseline justify-between gap-3 px-1">
                    <h4 className="type-label text-muted">{group.label}</h4>
                    <span className="type-caption text-muted">{group.net >= 0 ? '+' : ''}<Amount value={group.net} currency={account.currency} /></span>
                  </header>
                  <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-lg)] border border-line">
                    {group.rows.map(row => {
                      const tx = row.item;
                      const detail = details.get(tx.category);
                      const isTransfer = !!tx.transferId;
                      const title = tx.description || tx.merchant || 'Transaction';
                      return (
                        <li key={row.id}>
                          <button type="button" onClick={() => onOpen({ ...tx, accountName: account.name })} className="flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-inset focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--focus)]">
                            <MerchantLogo merchant={tx.merchant} description={tx.description} isTransfer={isTransfer} account={account} size={36} />
                            <span className="min-w-0 flex-1">
                              <span className="flex min-w-0 items-center gap-1.5">
                                <span className="type-body-strong truncate text-ink">{title}</span>
                                {tx.parentTransactionId && <span className="type-caption shrink-0 rounded-full bg-inset px-1.5 text-muted">Split</span>}
                                {tx.recurringSourceId && <Icon name="repeat" size={14} className="shrink-0 text-muted" aria-label="Repeats" />}
                                {tx.notes && <Icon name="note" size={14} className="shrink-0 text-muted" aria-label="Has a note" />}
                              </span>
                              <span className="type-caption flex min-w-0 items-center gap-1.5 text-muted">
                                {!isTransfer && <EntityGlyph icon={detail?.icon} label={tx.category || 'Uncategorised'} color={detail?.color} size={14} />}
                                <span className="truncate">{isTransfer ? 'Transfer' : tx.category || 'Uncategorised'}</span>
                                {tx.merchant && tx.description && tx.merchant !== tx.description && !isTransfer && <span className="hidden truncate sm:inline">· {tx.merchant}</span>}
                              </span>
                            </span>
                            <span className="type-figure-row shrink-0 text-ink"><Amount value={row.amount} currency={account.currency} tone="flow" /></span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
              <ShowMore remaining={visible.length - pageRows.used} onPress={() => setShown(count => count + PAGE)} />
            </div>
          )}
        </Section>

        <Section
          span="side"
          title="Filter"
          subtitle="Pick a category in the ring to see just those"
          className="order-first @4xl:sticky @4xl:top-4 @4xl:order-none @4xl:h-auto @4xl:self-start"
          action={isFiltered ? <Button variant="ghost" size="sm" onPress={clear}>Clear</Button> : undefined}
        >
          <div className="space-y-4">
            <TextInput label="Search" placeholder="Merchant, description, category or note" value={query} onChange={text => { setQuery(text); resetPaging(); }} />
            <SegmentedControl items={KINDS} activeId={kind} onChange={id => { setKind(id as ActivityKind); resetPaging(); }} />
            <div>
              <p className="type-label mb-2 text-muted">{spendDirection === 'out' ? 'Where it went' : 'Where it came from'}</p>
              <Donut
                stacked
                size={150}
                items={categorySplit}
                currency={account.currency}
                centerLabel={spendDirection === 'out' ? 'Out' : 'In'}
                onPick={label => { if (label !== 'Other') { setCategory(current => { const next = label === 'Uncategorised' ? '' : label; return current === next ? undefined : next; }); setKind(spendDirection); resetPaging(); } }}
              />
            </div>
            {(category !== undefined || pickedDay) && (
              <div className="flex flex-wrap gap-2">
                {category !== undefined && <Chip label={category || 'Uncategorised'} onClear={() => setCategory(undefined)} />}
                {pickedDay && <Chip label={shortDay(parseDay(pickedDay))} onClear={() => setPickedDay(undefined)} />}
              </div>
            )}
          </div>
        </Section>
      </Board>
    </div>
  );
};

const Chip: React.FC<{ label: string; onClear: () => void }> = ({ label, onClear }) => (
  <span className="type-caption inline-flex items-center gap-1 rounded-full bg-inset py-1 pl-3 pr-1 text-ink">
    {label}
    <button type="button" aria-label={`Remove ${label}`} onClick={onClear} className="flex size-5 cursor-pointer items-center justify-center rounded-full hover:bg-line"><Icon name="cancel-01" size={12} /></button>
  </span>
);

export const activityTab = (props: AccountPanelProps, label = 'Activity'): ShellTab => ({
  id: 'activity',
  label,
  content: <ActivityView account={props.account} accountTransactions={props.accountTransactions} categories={props.categories} onOpen={props.onTransactionClick} onAdd={props.onAddTransaction} />,
});

export default ActivityView;
