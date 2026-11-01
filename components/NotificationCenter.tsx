import React, { useState } from 'react';
import { BillNotificationItem } from '../hooks/useBillNotifications';
import { formatCurrency } from '../utils';
import { Page, RecurringTransaction, BillPayment } from '../types';
import { Button, IconButton } from './ui/Actions';
import { Badge } from './ui/Display';
import { EmptyState } from './ui/States';
import { SidePanel } from './ui/Overlays';

interface NotificationCenterProps {
  notifications: BillNotificationItem[];
  notificationCount: number;
  onDismiss: (id: string) => void;
  onClearAll: () => void;
  onProcessItem?: (item: RecurringTransaction | BillPayment) => void;
  setCurrentPage?: (page: Page) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  notificationCount,
  onDismiss,
  onClearAll,
  onProcessItem,
  setCurrentPage,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const overdueOrToday = notifications.filter((n) => n.daysUntilDue <= 0);
  const dueSoon = notifications.filter((n) => n.daysUntilDue > 0 && n.daysUntilDue <= 3);

  const group = (title: string, items: BillNotificationItem[]) =>
    items.length > 0 && (
      <section className="space-y-2">
        <h3 className="type-label text-muted">{title} ({items.length})</h3>
        {items.map((item) => (
          <NotificationCard key={item.id} item={item} onDismiss={onDismiss} onProcessItem={onProcessItem} />
        ))}
      </section>
    );

  return (
    <>
      <IconButton icon="notifications" label="Bill alerts" iconSize={24} badge={notificationCount} tooltipPlacement="bottom" onPress={() => setIsOpen(true)} />
      <SidePanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Bill alerts"
        description="Due in 3 days or less"
        footer={setCurrentPage && (
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" onPress={() => { setCurrentPage('Schedule & Bills'); setIsOpen(false); }}>Open Calendar</Button>
            {notificationCount > 0 && <Button variant="secondary" onPress={onClearAll}>Clear all</Button>}
          </div>
        )}
      >
        {notifications.length === 0 ? (
          <EmptyState icon="verified" title="No bill alerts" description="Recurring bills for the next 3 days are settled." />
        ) : (
          <div className="space-y-5">
            {group('Needs action', overdueOrToday)}
            {group('Due in 1 to 3 days', dueSoon)}
          </div>
        )}
      </SidePanel>
    </>
  );
};

interface NotificationCardProps {
  item: BillNotificationItem;
  onDismiss: (id: string) => void;
  onProcessItem?: (item: RecurringTransaction | BillPayment) => void;
}

const NotificationCard: React.FC<NotificationCardProps> = ({ item, onDismiss, onProcessItem }) => {
  const isUrgent = item.daysUntilDue <= 0;

  return (
    <article className="rounded-[var(--radius-lg)] border border-line p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="type-body-strong truncate text-ink">{item.description}</h4>
          <Badge tone={isUrgent ? 'negative' : 'attention'} className="mt-1">{item.statusText}</Badge>
        </div>
        <IconButton icon="close" label={`Dismiss ${item.description}`} onPress={() => onDismiss(item.id)} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2">
        <span className="type-figure-row privacy-blur text-ink">{formatCurrency(item.amount, item.currency)}</span>
        {onProcessItem && (
          <Button size="sm" variant={isUrgent ? 'primary' : 'soft'} onPress={() => onProcessItem(item.originalItem)}>Pay or record</Button>
        )}
      </div>
    </article>
  );
};

export default NotificationCenter;
