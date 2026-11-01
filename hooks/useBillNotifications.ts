import { useMemo, useState, useEffect } from 'react';
import { RecurringTransaction, BillPayment, Currency } from '../types';
import { parseLocalDate, toLocalISOString, formatCurrency } from '../utils';

export interface BillNotificationItem {
  id: string;
  sourceType: 'recurring' | 'bill';
  description: string;
  amount: number;
  currency: Currency;
  dueDateStr: string;
  dueDate: Date;
  daysUntilDue: number; // <= 3
  statusText: string;
  urgency: 'overdue' | 'today' | 'soon';
  originalItem: RecurringTransaction | BillPayment;
}

export interface UseBillNotificationsProps {
  recurringTransactions: RecurringTransaction[];
  billsAndPayments: BillPayment[];
  dismissedIds: string[];
  onDismiss?: (ids: string[]) => void;
}

export function useBillNotifications({
  recurringTransactions = [],
  billsAndPayments = [],
  dismissedIds,
  onDismiss,
}: UseBillNotificationsProps) {
  const upcomingBillNotifications = useMemo(() => {
    const todayStr = toLocalISOString(new Date());
    const today = parseLocalDate(todayStr);

    const notifications: BillNotificationItem[] = [];

    // Process Unpaid Bills
    billsAndPayments.forEach((bill) => {
      if (bill.status !== 'unpaid') return;
      const dueDate = parseLocalDate(bill.dueDate);
      const diffTime = dueDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Alert if due in <= 3 days and >= -7 days (within last 7 days overdue)
      if (diffDays <= 3 && diffDays >= -7) {
        let urgency: 'overdue' | 'today' | 'soon' = 'soon';
        let statusText = `Due in ${diffDays} day${diffDays > 1 ? 's' : ''}`;

        if (diffDays < 0) {
          urgency = 'overdue';
          statusText = `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) > 1 ? 's' : ''}`;
        } else if (diffDays === 0) {
          urgency = 'today';
          statusText = 'Due Today!';
        } else if (diffDays === 1) {
          urgency = 'soon';
          statusText = 'Due Tomorrow!';
        }

        notifications.push({
          id: `bill-${bill.id}-${bill.dueDate}`,
          sourceType: 'bill',
          description: bill.description,
          amount: Math.abs(bill.amount),
          currency: bill.currency || 'EUR',
          dueDateStr: bill.dueDate,
          dueDate,
          daysUntilDue: diffDays,
          statusText,
          urgency,
          originalItem: bill,
        });
      }
    });

    // Process Recurring Transactions (Expenses / Transfers)
    recurringTransactions.forEach((rt) => {
      if (rt.type === 'income') return; // Only process bills/expenses/transfers
      if (!rt.nextDueDate) return;

      const dueDate = parseLocalDate(rt.nextDueDate);
      const diffTime = dueDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 3 && diffDays >= -7) {
        let urgency: 'overdue' | 'today' | 'soon' = 'soon';
        let statusText = `Due in ${diffDays} day${diffDays > 1 ? 's' : ''}`;

        if (diffDays < 0) {
          urgency = 'overdue';
          statusText = `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) > 1 ? 's' : ''}`;
        } else if (diffDays === 0) {
          urgency = 'today';
          statusText = 'Due Today!';
        } else if (diffDays === 1) {
          urgency = 'soon';
          statusText = 'Due Tomorrow!';
        }

        notifications.push({
          id: `recurring-${rt.id}-${rt.nextDueDate}`,
          sourceType: 'recurring',
          description: rt.description,
          amount: Math.abs(rt.amount),
          currency: rt.currency || 'EUR',
          dueDateStr: rt.nextDueDate,
          dueDate,
          daysUntilDue: diffDays,
          statusText,
          urgency,
          originalItem: rt,
        });
      }
    });

    // Sort by urgency and date (overdue first, then today, then upcoming)
    return notifications
      .filter((item) => !dismissedIds.includes(item.id))
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  }, [recurringTransactions, billsAndPayments, dismissedIds]);

  const dismissNotification = (id: string) => {
    onDismiss?.([id]);
  };

  const clearAllNotifications = () => {
    const allIds = upcomingBillNotifications.map((item) => item.id);
    onDismiss?.(allIds);
  };

  return {
    upcomingBillNotifications,
    notificationCount: upcomingBillNotifications.length,
    dismissNotification,
    clearAllNotifications,
  };
}
