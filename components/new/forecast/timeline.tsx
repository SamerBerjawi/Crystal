import React, { useMemo, useState } from 'react';
import { cn } from '../../../lib/utils';
import { parseLocalDate } from '../../../utils';
import { formatShortDate } from '../../../utils/dateFormat';
import type { ForecastDay, ForecastEvent } from '../../../utils/forecastModel';
import type { ForecastData } from '../../../hooks/useForecastData';
import { NvIcon, type NvIconName } from '../NvIcon';
import { Badge, Card, EmptyState, Money, MoreButton } from '../ui';

/* Timeline tab (docs/FORECASTING_NEW_PLAN.md §4.2): every projected event by month and day, the balance after each,
 * the lowest day of each month marked. */

const CAP = 12;

const KIND_BADGE: Partial<Record<ForecastEvent['kind'], { label: string; icon: NvIconName; tone: 'sky' | 'violet' | 'neutral' }>> = {
  goal: { label: 'Goal', icon: 'award', tone: 'violet' },
  bill: { label: 'Bill', icon: 'invoice', tone: 'neutral' },
  loan: { label: 'Loan', icon: 'bank', tone: 'sky' },
  card: { label: 'Card', icon: 'card', tone: 'sky' },
  property: { label: 'Property', icon: 'home', tone: 'sky' },
};

interface MonthGroup { key: string; label: string; days: ForecastDay[]; net: number; low: ForecastDay }

export const EventRow: React.FC<{ e: ForecastEvent; data: ForecastData; onOpen: (e: ForecastEvent) => void }> = ({ e, data, onOpen }) => {
  const badge = KIND_BADGE[e.kind];
  const account = e.toAccountId && e.accountId ? `${data.accountName(e.accountId) || 'Outside'} → ${data.accountName(e.toAccountId) || 'Outside'}` : data.accountName(e.accountId) || 'Any account';
  return (
    <li>
      <button type="button" onClick={() => onOpen(e)} className="flex min-h-14 w-full items-center gap-3 rounded-nv-sub px-2 py-1.5 text-left hover:bg-nv-surface/70">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium text-nv-ink">{e.description}</span>
          <span className="block truncate text-[13px] text-nv-muted">{account}</span>
          {(badge || e.overdue || e.occurrence?.isOverride) && (
            <span className="mt-1 flex flex-wrap gap-1.5">
              {e.overdue && <Badge tone="red" icon="warning">Overdue since {formatShortDate(e.dueDate, data.today)}</Badge>}
              {badge && <Badge tone={badge.tone} icon={badge.icon}>{badge.label}</Badge>}
              {e.occurrence?.isOverride && <Badge icon="edit">Changed</Badge>}
            </span>
          )}
        </span>
        <span className="shrink-0 text-right">
          <Money amount={e.amount} currency={data.displayCurrency} signed tone={e.amount > 0 ? 'income' : 'ink'} />
          <span className="block text-xs text-nv-muted"><Money amount={e.balanceAfter} currency={data.displayCurrency} className={cn('text-xs', e.balanceAfter < 0 && 'text-nv-red-text')} /></span>
        </span>
      </button>
    </li>
  );
};

export const TimelineView: React.FC<{
  data: ForecastData;
  query: string;
  seriesKey: string | null;
  onOpenEvent: (e: ForecastEvent) => void;
  onOpenDay: (date: string) => void;
}> = ({ data, query, seriesKey, onOpenEvent, onOpenDay }) => {
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const q = query.trim().toLowerCase();
  const months = useMemo(() => {
    const map = new Map<string, MonthGroup>();
    for (const day of data.projection.days) {
      const events = day.events.filter(e => Math.abs(e.amount) >= 0.005
        && (!seriesKey || e.seriesKey === seriesKey)
        && (!q || e.description.toLowerCase().includes(q) || data.accountName(e.accountId).toLowerCase().includes(q)));
      const key = day.date.slice(0, 7);
      const g = map.get(key) ?? { key, label: parseLocalDate(`${key}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), days: [], net: 0, low: day };
      if (day.total < g.low.total) g.low = day;
      if (events.length) { g.days.push({ ...day, events }); g.net += events.reduce((s, e) => s + e.amount, 0); }
      map.set(key, g);
    }
    return [...map.values()].filter(g => g.days.length > 0);
  }, [data.projection.days, data.accountName, q, seriesKey]);

  if (months.length === 0) {
    return <Card><EmptyState icon="calendar" title={q || seriesKey ? 'Nothing matches' : 'Nothing planned in this period'} /></Card>;
  }

  return (
    <Card className="px-3 sm:px-4">
      {months.map(m => {
        const expanded = open.has(m.key) || !!q || !!seriesKey;
        let shown = 0;
        const total = m.days.reduce((s, d) => s + d.events.length, 0);
        return (
          <section key={m.key} data-nv-index={m.label} className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-2 pb-1 pt-4">
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-nv-muted">{m.label}</h3>
              <span className="flex items-center gap-3 text-[13px] text-nv-muted">
                <Money amount={m.net} currency={data.displayCurrency} signed className="text-[13px]" />
                <span className="flex items-center gap-1">
                  <NvIcon name="arrowDown" size={14} className="text-nv-orange-text" /> lowest <Money amount={m.low.total} currency={data.displayCurrency} className={cn('text-[13px]', m.low.total < 0 && 'text-nv-red-text')} /> on {formatShortDate(m.low.date, data.today)}
                </span>
              </span>
            </div>
            {m.days.map(day => {
              if (!expanded && shown >= CAP) return null;
              const events = expanded ? day.events : day.events.slice(0, CAP - shown);
              shown += events.length;
              const isLow = day.date === m.low.date;
              return (
                <div key={day.date} className="mt-1">
                  <button type="button" onClick={() => onOpenDay(day.date)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-nv-sub px-2 text-left hover:bg-nv-surface/70">
                    <span className="text-sm font-medium text-nv-ink">{parseLocalDate(day.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                    <span className="flex items-center gap-1.5 text-[13px] text-nv-muted">
                      {isLow && <Badge tone="orange" icon="arrowDown">Lowest</Badge>}
                      ends at <Money amount={day.total} currency={data.displayCurrency} className={cn('text-[13px]', day.total < 0 && 'text-nv-red-text')} />
                    </span>
                  </button>
                  <ul>{events.map(e => <EventRow key={e.key} e={e} data={data} onOpen={onOpenEvent} />)}</ul>
                </div>
              );
            })}
            {total > CAP && !q && !seriesKey && (
              <MoreButton expanded={open.has(m.key)} total={total} onToggle={() => setOpen(prev => { const next = new Set(prev); if (next.has(m.key)) next.delete(m.key); else next.add(m.key); return next; })} />
            )}
          </section>
        );
      })}
    </Card>
  );
};
