import React from 'react';
import { parseLocalDate } from '../utils';
import type { ForecastEvent } from '../utils/forecastModel';
import { Button } from './ui/Actions';
import { Badge } from './ui/Display';
import { DateInput } from './ui/Fields';
import Icon from './ui/Icon';
import { Amount } from './ui/Money';
import { SidePanel } from './ui/Overlays';

const KIND_LABEL = { recurring: 'Recurring', bill: 'One-time', loan: 'Loan', card: 'Card', property: 'Property', goal: 'Goal' };

interface ForecastDayPanelProps {
  date: string;
  events: ForecastEvent[];
  balance?: number;
  /** Set when the panel opened on a group of bubbles, which can span a week. */
  title?: string;
  onClose: () => void;
  onEdit: (event: ForecastEvent) => void;
  onMove: (event: ForecastEvent, toDate: string) => void;
  onAdd: () => void;
}

const fullDate = (date: string) => parseLocalDate(date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const movable = (event: ForecastEvent) => (event.kind === 'recurring' || event.kind === 'bill') && !event.occurrence?.isReadOnly;

/** A day or a bubble: what happens, what it leaves you with, and a date field to move it (FCT-05). */
const ForecastDayPanel: React.FC<ForecastDayPanelProps> = ({ date, events, balance, title, onClose, onEdit, onMove, onAdd }) => {
  const net = events.reduce((sum, event) => sum + event.amount, 0);
  return (
    <SidePanel
      isOpen
      onClose={onClose}
      title={title ?? fullDate(date)}
      footer={<Button variant="secondary" icon="add" onPress={onAdd}>Add to this day</Button>}
    >
      <dl className="mb-4 flex gap-8">
        <div><dt className="type-label text-muted">Net change</dt><dd className="type-figure-lg text-ink"><Amount value={net} currency="EUR" tone="flow" /></dd></div>
        {balance !== undefined && <div><dt className="type-label text-muted">Balance</dt><dd className="type-figure-lg text-ink"><Amount value={balance} currency="EUR" /></dd></div>}
      </dl>
      {events.length === 0 ? (
        <p className="type-body text-muted">Nothing is planned for this day.</p>
      ) : (
        <ul className="space-y-4">
          {events.map(event => (
            <li key={event.key} className="rounded-[var(--radius-lg)] bg-inset p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="type-body-strong truncate text-ink">{event.description}</p>
                  <p className="type-caption mt-0.5 flex flex-wrap items-center gap-1.5 text-muted">
                    {KIND_LABEL[event.kind]}
                    {event.overdue && <Badge tone="attention">Overdue</Badge>}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="type-figure-row text-ink"><Amount value={event.amount} currency="EUR" tone="flow" /></p>
                  <p className="type-caption text-muted">Leaves <Amount value={event.balanceAfter} currency="EUR" /></p>
                </div>
              </div>
              {movable(event) ? (
                <div className="mt-3 flex items-end gap-2">
                  <DateInput className="min-w-0 flex-1" label="Date" value={event.date} onChange={value => { if (value && value !== event.date) onMove(event, value); }} />
                  <Button variant="secondary" onPress={() => onEdit(event)}>Edit</Button>
                </div>
              ) : event.kind === 'goal' ? (
                <Button className="mt-3" variant="secondary" onPress={() => onEdit(event)}>Edit goal</Button>
              ) : (
                <p className="type-caption mt-2 flex items-center gap-1.5 text-muted"><Icon name="info" size={16} /> This comes from the account, so change it there.</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </SidePanel>
  );
};

export default ForecastDayPanel;
