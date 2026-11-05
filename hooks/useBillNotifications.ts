import { useMemo, useState, useEffect } from 'react';
import { RecurringTransaction, BillPayment, Currency, Task } from '../types';
import { parseLocalDate, toLocalISOString } from '../utils';

export interface BillNotificationItem {
  id: string;
  sourceType: 'recurring' | 'bill' | 'task';
  description: string;
  amount: number;
  currency: Currency;
  dueDateStr: string;
  dueDate: Date;
  daysUntilDue: number; // <= 3
  statusText: string;
  urgency: 'overdue' | 'today' | 'soon';
  originalItem: RecurringTransaction | BillPayment | Task;
}

export interface UseBillNotificationsProps {
  recurringTransactions: RecurringTransaction[];
  billsAndPayments: BillPayment[];
  tasks?: Task[];
  dismissedIds: string[];
  onDismiss?: (ids: string[]) => void;
}

export function useBillNotifications({
  recurringTransactions = [],
  billsAndPayments = [],
  tasks = [],
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

    // Process Tasks (reminderDate or dueDate)
    tasks.forEach((task) => {
      if (task.status === 'Done') return;
      const targetStr = task.reminderDate || task.dueDate;
      if (!targetStr) return;

      const targetDate = parseLocalDate(targetStr);
      const diffTime = targetDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const isReminder = Boolean(task.reminderDate);

      if ((isReminder && diffDays <= 0 && diffDays >= -7) || (!isReminder && diffDays <= 3 && diffDays >= -7)) {
        let urgency: 'overdue' | 'today' | 'soon' = 'soon';
        let statusText = isReminder ? 'Task reminder' : `Task due in ${diffDays} day${diffDays > 1 ? 's' : ''}`;

        if (diffDays < 0) {
          urgency = 'overdue';
          statusText = isReminder
            ? `Reminder from ${Math.abs(diffDays)} day${Math.abs(diffDays) > 1 ? 's' : ''} ago`
            : `Task overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) > 1 ? 's' : ''}`;
        } else if (diffDays === 0) {
          urgency = 'today';
          statusText = isReminder ? 'Task reminder today!' : 'Task due today!';
        } else if (diffDays === 1) {
          urgency = 'soon';
          statusText = 'Task due tomorrow!';
        }

        notifications.push({
          id: `task-${task.id}-${targetStr}`,
          sourceType: 'task',
          description: task.title,
          amount: 0,
          currency: 'EUR',
          dueDateStr: targetStr,
          dueDate: targetDate,
          daysUntilDue: diffDays,
          statusText,
          urgency,
          originalItem: task,
        });
      }
    });

    // Sort by urgency and date (overdue first, then today, then upcoming)
    return notifications
      .filter((item) => !dismissedIds.includes(item.id))
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  }, [recurringTransactions, billsAndPayments, tasks, dismissedIds]);

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
