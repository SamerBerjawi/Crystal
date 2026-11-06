import React, { useMemo, useState } from 'react';
import type { Account, Currency } from '../types';
import { ladderRungs } from '../utils/fixedTerm';
import { useAccountsContext } from '../contexts/DomainProviders';
import { AccountMark } from './ui/Summaries';
import { Switch } from './ui/Fields';
import { Amount } from './ui/Money';
import SegmentedControl from './ui/SegmentedControl';
import { EmptyState } from './ui/States';
import { fitRows, useWidgetBox } from './ui/WidgetGrid';
import { cn } from '../lib/utils';

interface FixedTermLadderWidgetProps {
  accounts: Account[];
  currency: Currency;
  /** Converts an amount in its own currency to the display currency. */
  toDisplay: (amount: number, from: Currency) => number;
  onOpen: (id: string) => void;
}

const FILTERS = [{ id: 'all', label: 'All' }, { id: 'roll', label: 'Rolls over' }, { id: 'out', label: 'Pays out' }];
const DAY = 86400000;
const monthShort = (date: Date) => date.toLocaleDateString(undefined, { month: 'short' });
const fullDate = (date: Date) => date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const dayMonth = (date: Date) => date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/**
 * Every fixed term you hold, laid on one timeline: a bar from when it started to when it matures, a line for today, and
 * what happens at the end, whether it rolls into a new term or pays out. Switch that for any term right here.
 */
const FixedTermLadderWidget: React.FC<FixedTermLadderWidgetProps> = ({ accounts, currency, toDisplay, onOpen }) => {
  const box = useWidgetBox();
  const { saveAccount } = useAccountsContext();
  const [filter, setFilter] = useState('all');
  const today = useMemo(() => new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()), []);

  const rungs = useMemo(() => ladderRungs(accounts, today), [accounts, today]);
  const shown = useMemo(() => rungs.filter(rung => filter === 'all' || (filter === 'roll' ? rung.rollsOver : !rung.rollsOver)), [rungs, filter]);

  if (rungs.length === 0) {
    return <EmptyState icon="calendar-03" title="No fixed terms" description="Give a savings account a maturity date and it joins the ladder." className="h-full py-6" />;
  }

  const total = rungs.reduce((sum, rung) => sum + toDisplay(rung.account.balance, rung.account.currency), 0);
  const last = rungs[rungs.length - 1];
  const axisStart = Math.min(today.getTime(), ...rungs.map(rung => rung.start.getTime()));
  const axisEnd = Math.max(...rungs.map(rung => rung.maturity.getTime()), today.getTime() + 30 * DAY);
  const span = axisEnd - axisStart;
  const at = (time: number) => ((time - axisStart) / span) * 100;

  // Month ticks along the bottom, thinned to what fits.
  const ticks: { time: number; label: string }[] = [];
  for (let cursor = new Date(new Date(axisStart).getFullYear(), new Date(axisStart).getMonth() + 1, 1); cursor.getTime() < axisEnd; cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)) {
    ticks.push({ time: cursor.getTime(), label: monthShort(cursor) });
  }
  const every = Math.max(1, Math.ceil(ticks.length / Math.max(2, Math.floor((box.width || 600) / 90))));

  const wide = box.width === 0 || box.width >= 760;
  const rowH = wide ? 56 : 84;
  const fit = fitRows(box, rowH, shown.length, 96);
  const count = box.height === 0 ? shown.length : Math.max(1, Math.min(shown.length, fit));

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="type-caption text-muted">{rungs.length} {rungs.length === 1 ? 'term' : 'terms'} · <Amount value={total} currency={currency} className="text-ink" /> · the last one matures {fullDate(last.maturity)}</p>
        <SegmentedControl items={FILTERS} activeId={filter} onChange={setFilter} />
      </div>

      <div className="relative min-h-0 flex-1">
        <ul className="divide-y divide-line">
          {shown.slice(0, count).map(rung => {
            const left = at(rung.start.getTime());
            const width = Math.max(4, at(rung.maturity.getTime()) - left);
            const gone = Math.min(100, (rung.elapsed * 100));
            return (
              <li key={rung.account.id} className={cn('grid items-center gap-x-4 gap-y-2 py-2', wide ? 'grid-cols-[200px_minmax(0,1fr)_200px]' : 'grid-cols-1')} style={{ minHeight: rowH }}>
                <button type="button" onClick={() => onOpen(rung.account.id)} className="flex min-w-0 cursor-pointer items-center gap-2.5 text-left">
                  <AccountMark account={rung.account} />
                  <span className="min-w-0">
                    <span className="type-body-strong block truncate text-ink">{rung.account.name}</span>
                    <span className="type-caption block truncate text-muted"><Amount value={toDisplay(rung.account.balance, rung.account.currency)} currency={currency} />{rung.rate !== undefined ? ` · ${rung.rate}%` : ''}</span>
                  </span>
                </button>

                <div className="relative h-7" aria-label={`${rung.account.name}: ${rung.daysLeft} days left`}>
                  <span className="absolute inset-y-0 flex items-center overflow-hidden rounded-[var(--radius-md)] bg-[var(--money-in-soft)]" style={{ left: `${left}%`, width: `${width}%` }}>
                    <span className="absolute inset-y-0 left-0 bg-[repeating-linear-gradient(135deg,var(--money-in)_0_2px,transparent_2px_6px)] opacity-35" style={{ width: `${gone}%` }} />
                    <span className="absolute inset-y-0 right-0 rounded-[var(--radius-md)] bg-[var(--money-in)] opacity-85" style={{ width: `${100 - gone}%` }} />
                    <span className="type-caption relative ml-auto mr-2 font-semibold text-on-pine">{rung.daysLeft} d</span>
                  </span>
                  <span aria-hidden className="pointer-events-none absolute -inset-y-1 w-0.5 rounded-full bg-ink" style={{ left: `${at(today.getTime())}%` }} />
                </div>

                <div className="flex min-w-0 items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="type-body-strong block text-ink">{dayMonth(rung.maturity)}</span>
                    <span className="type-caption block truncate text-muted">{rung.rollsOver ? 'Rolls into a new term' : 'Pays out'}</span>
                  </span>
                  <Switch
                    aria-label={`${rung.account.name} rolls into a new term`}
                    isSelected={rung.rollsOver}
                    onChange={value => saveAccount({ ...rung.account, rollsOver: value || undefined })}
                    className="!min-h-0 !w-auto !gap-0 !p-0"
                  >
                    <span className="sr-only">Rolls over</span>
                  </Switch>
                </div>
              </li>
            );
          })}
        </ul>
        {shown.length === 0 && <p className="type-body py-6 text-center text-muted">No terms in this view.</p>}
        {shown.length > count && <p className="type-caption mt-1 text-muted">+{shown.length - count} more</p>}
      </div>

      {wide && (
        <div className="relative h-5 shrink-0 text-muted" aria-hidden>
          <div className="absolute inset-y-0" style={{ left: 216, right: 216 }}>
            {ticks.filter((_, i) => i % every === 0).map(tick => <span key={tick.time} className="type-caption absolute -translate-x-1/2" style={{ left: `${at(tick.time)}%` }}>{tick.label}</span>)}
            <span className="type-caption absolute -translate-x-1/2 rounded-full bg-ink px-2 text-on-pill" style={{ left: `${at(today.getTime())}%` }}>Today</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default FixedTermLadderWidget;
