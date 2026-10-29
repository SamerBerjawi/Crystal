import React, { useMemo, useState } from 'react';
import type { BillPayment } from '../../../types';
import { formatShortDate } from '../../../utils/dateFormat';
import {
  cadenceLabel, iso, monthlyCostByCategory, owningAccountId, seriesGroups, type BillTab, type SeriesGroup, type SeriesRow,
} from '../../../utils/scheduleModel';
import type { ScheduleData } from '../../../hooks/useScheduleData';
import { AllocationRing } from '../budget/parts';
import { ChoiceChips } from '../PageToolbar';
import { NvIcon } from '../NvIcon';
import { Badge, Card, EmptyState, Money, MoreButton } from '../ui';
import { RowMenu, SOURCE_BADGE, relativeDay, type MenuEntry } from './parts';

/* Series and Bills tabs (docs/SCHEDULE_NEW_PLAN.md §4.4, §4.5). */

const CAP = 8;

const SeriesItem: React.FC<{ row: SeriesRow; data: ScheduleData; onOpen: (row: SeriesRow) => void; menu: MenuEntry[] }> = ({ row, data, onOpen, menu }) => {
  const rt = row.series;
  const name = row.source === 'recurring' ? (rt.merchant || rt.description) : data.accountName(owningAccountId(rt)) || rt.description;
  const sub = row.source === 'recurring'
    ? `${cadenceLabel(rt)} · ${rt.type === 'transfer' ? `${data.accountName(rt.accountId)} → ${data.accountName(rt.toAccountId) || 'Outside'}` : data.accountName(rt.accountId)}`
    : row.source === 'loan' ? 'Monthly installment' : row.source === 'card' ? 'Card statement' : cadenceLabel(rt);
  return (
    <li className="flex items-center gap-2 rounded-nv-sub pr-1 hover:bg-nv-surface/70">
      <button type="button" onClick={() => onOpen(row)} className="flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-nv-sub py-2 pl-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-nv-ink">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-nv-surface text-nv-muted" aria-hidden>
          <NvIcon name={row.source !== 'recurring' ? SOURCE_BADGE[row.source].icon : row.flow === 'in' ? 'money' : row.flow === 'move' ? 'transfer' : 'repeat'} size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-nv-ink">{name}</span>
          <span className="block truncate text-[13px] text-nv-muted">{sub}</span>
          {row.next && !row.ended && <span className="block text-[13px] text-nv-muted">Next {formatShortDate(row.next, data.today)}, {relativeDay(row.next, data.today)}</span>}
          {row.ended && rt.endDate && <span className="block text-[13px] text-nv-muted">Ended {formatShortDate(rt.endDate, data.today)}</span>}
        </span>
        <span className="shrink-0 text-right">
          <Money amount={Math.abs(rt.amount)} currency={rt.currency} tone={row.flow === 'in' ? 'income' : 'ink'} className={row.flow === 'move' ? 'text-nv-sky-text' : undefined} />
          {rt.frequency !== 'monthly' && !row.ended && row.source === 'recurring' && (
            <span className="block text-xs text-nv-muted"><Money amount={row.monthly} currency={rt.currency} className="text-xs" /> / month</span>
          )}
        </span>
      </button>
      {menu.length > 0 && <RowMenu entries={menu} label={`Actions for ${name}`} />}
    </li>
  );
};

const SeriesGroupBlock: React.FC<{ group: SeriesGroup; data: ScheduleData; onOpen: (row: SeriesRow) => void; menuFor: (row: SeriesRow) => MenuEntry[]; expandAll: boolean }> = ({ group, data, onOpen, menuFor, expandAll }) => {
  const [open, setOpen] = useState(false);
  const shown = open || expandAll ? group.rows : group.rows.slice(0, CAP);
  const monthly = group.monthlyOut || group.monthlyIn;
  return (
    <section>
      <div className="flex items-center justify-between gap-3 px-2 pb-1 pt-4">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-nv-muted">{group.label} <span className="font-medium normal-case tracking-normal">· {group.rows.length}</span></h3>
        {group.id !== 'ended' && monthly > 0 && (
          <span className="text-[13px] text-nv-muted"><Money amount={monthly} currency={data.displayCurrency} className="text-[13px]" /> a month</span>
        )}
      </div>
      <ul id={`series-${group.id}`}>{shown.map(row => <SeriesItem key={row.series.id} row={row} data={data} onOpen={onOpen} menu={menuFor(row)} />)}</ul>
      {group.rows.length > CAP && !expandAll && <MoreButton expanded={open} total={group.rows.length} onToggle={() => setOpen(v => !v)} controls={`series-${group.id}`} />}
    </section>
  );
};

/** Series tab: the ring of monthly costs by category (C2), then every series by kind. */
export const SeriesView: React.FC<{
  data: ScheduleData;
  query: string;
  onOpen: (row: SeriesRow) => void;
  menuFor: (row: SeriesRow) => MenuEntry[];
  onAdd: () => void;
}> = ({ data, query, onOpen, menuFor, onAdd }) => {
  const groups = useMemo(() => {
    const all = seriesGroups(data.recurring, data.synthetic, data.accounts, data.today, data.convert);
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all
      .map(g => ({ ...g, rows: g.rows.filter(r => [r.series.description, r.series.merchant, r.series.category, data.accountName(r.series.accountId)].some(v => v?.toLowerCase().includes(q))) }))
      .filter(g => g.rows.length > 0);
  }, [data, query]);
  const costs = useMemo(() => monthlyCostByCategory(groups.flatMap(g => g.rows), data.convert), [groups, data.convert]);
  const total = costs.reduce((s, c) => s + c.value, 0);
  const colorOf = (name: string) => data.categoryByName.get(name)?.color ?? 'var(--nv-faint)';

  if (!groups.length) {
    return (
      <Card>
        <EmptyState icon="repeat" title={query ? 'No series match' : 'No recurring payments yet'} action={!query ? <button type="button" className="inline-flex h-11 items-center rounded-full bg-nv-ink px-5 text-[15px] font-medium text-nv-on-ink" onClick={onAdd}>Add schedule</button> : undefined} />
      </Card>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <Card className="order-2 xl:order-1">
        {groups.map(g => <SeriesGroupBlock key={g.id} group={g} data={data} onOpen={onOpen} menuFor={menuFor} expandAll={!!query} />)}
      </Card>
      {costs.length > 0 && (
        <Card className="order-1 xl:order-2 xl:self-start">
          <h2 className="mb-1 text-lg font-medium text-nv-ink">Fixed costs</h2>
          <p className="mb-4 text-sm text-nv-muted"><Money amount={total} currency={data.displayCurrency} className="text-sm" /> a month</p>
          <div className="flex flex-col items-center gap-5 sm:flex-row xl:flex-col">
            <AllocationRing slices={costs.map(c => ({ ...c, pct: total > 0 ? (c.value / total) * 100 : 0 }))} colorOf={colorOf} total={total} currency={data.displayCurrency} size={200} />
            <ul className="w-full space-y-1">
              {costs.map(c => (
                <li key={c.name} className="flex min-h-9 items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2 text-nv-ink"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorOf(c.name) }} aria-hidden /><span className="truncate">{c.name}</span></span>
                  <span className="flex items-center gap-2">
                    <span className="nv-tabular text-nv-muted">{total > 0 ? Math.round((c.value / total) * 100) : 0}%</span>
                    <Money amount={c.value} currency={data.displayCurrency} className="text-sm" />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}
    </div>
  );
};

/** Bills tab: unpaid, paid and expired one-time bills. */
export const BillsView: React.FC<{
  data: ScheduleData;
  tab: BillTab;
  onTab: (tab: BillTab) => void;
  bills: BillPayment[];
  counts: Record<BillTab, number>;
  onOpen: (bill: BillPayment) => void;
  menuFor: (bill: BillPayment) => MenuEntry[];
}> = ({ data, tab, onTab, bills, counts, onOpen, menuFor }) => {
  const [open, setOpen] = useState(false);
  const shown = open ? bills : bills.slice(0, 12);
  return (
    <Card>
      <ChoiceChips
        label="Bill status"
        selected={[tab]}
        onChange={ids => onTab((ids[0] as BillTab) ?? 'unpaid')}
        options={[
          { id: 'unpaid', label: `Unpaid · ${counts.unpaid}`, icon: 'invoice' },
          { id: 'paid', label: `Paid · ${counts.paid}`, icon: 'checkCircle' },
          { id: 'expired', label: `Expired · ${counts.expired}`, icon: 'archive' },
        ]}
      />
      {bills.length === 0 ? (
        <EmptyState icon="invoice" title={tab === 'unpaid' ? 'No unpaid bills' : tab === 'paid' ? 'No paid bills' : 'No expired bills'} />
      ) : (
        <ul id="bill-list" className="mt-3">
          {shown.map(b => {
            const late = b.status === 'unpaid' && b.dueDate < iso(data.today);
            const name = b.description;
            return (
              <li key={b.id} className="flex items-center gap-2 rounded-nv-sub pr-1 hover:bg-nv-surface/70">
                <button type="button" onClick={() => onOpen(b)} className="flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-nv-sub py-2 pl-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-nv-ink">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-nv-surface text-nv-muted" aria-hidden><NvIcon name="invoice" size={20} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-nv-ink">{name}</span>
                    <span className="block truncate text-[13px] text-nv-muted">
                      {data.accountName(b.accountId) || 'Any account'} · due {formatShortDate(b.dueDate, data.today)}
                      {b.status === 'unpaid' && <> · <span className={late ? 'font-medium text-nv-red-text' : undefined}>{relativeDay(b.dueDate, data.today)}</span></>}
                      {b.paidDate && <> · paid {formatShortDate(b.paidDate, data.today)}</>}
                    </span>
                    {b.warrantId && <Badge tone="violet" icon="investments" className="mt-1.5">Warrant tax</Badge>}
                  </span>
                  <Money amount={b.amount} currency={b.currency} signed tone={b.amount > 0 ? 'income' : 'ink'} />
                </button>
                <RowMenu entries={menuFor(b)} label={`Actions for ${name}`} />
              </li>
            );
          })}
        </ul>
      )}
      {bills.length > 12 && <MoreButton expanded={open} total={bills.length} onToggle={() => setOpen(v => !v)} controls="bill-list" />}
    </Card>
  );
};
