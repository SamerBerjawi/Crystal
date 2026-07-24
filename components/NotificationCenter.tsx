import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BillNotificationItem } from '../hooks/useBillNotifications';
import { formatCurrency } from '../utils';
import { Page, RecurringTransaction, BillPayment } from '../types';

interface NotificationCenterProps {
  notifications: BillNotificationItem[];
  notificationCount: number;
  onDismiss: (id: string) => void;
  onClearAll: () => void;
  onProcessItem?: (item: RecurringTransaction | BillPayment) => void;
  setCurrentPage?: (page: Page) => void;
  className?: string;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  notificationCount,
  onDismiss,
  onClearAll,
  onProcessItem,
  setCurrentPage,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close panel on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const overdueOrToday = notifications.filter((n) => n.daysUntilDue <= 0);
  const dueSoon = notifications.filter((n) => n.daysUntilDue > 0 && n.daysUntilDue <= 3);

  return (
    <div ref={panelRef} className={`relative inline-block ${className}`}>
      {/* Trigger Notification Bell Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`relative p-2.5 rounded-2xl transition-all duration-300 flex items-center justify-center ${
          isOpen
            ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
            : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-light-text dark:text-dark-text'
        }`}
        title="Recurring Bill Notifications"
        aria-label="View bill notifications"
      >
        <span className={`material-symbols-outlined text-xl ${notificationCount > 0 ? 'animate-bounce' : ''}`}>
          notifications
        </span>

        {/* Animated Counter Badge */}
        {notificationCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-black shadow-lg shadow-rose-500/50 animate-pulse border-2 border-white dark:border-dark-card">
            {notificationCount}
          </span>
        )}
      </button>

      {/* Popover Notification Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute right-0 mt-3 w-80 sm:w-96 bg-white/95 dark:bg-[#18181c]/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-black/10 dark:border-white/10 z-50 overflow-hidden ring-1 ring-black/5"
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-black/5 dark:border-white/10 flex items-center justify-between bg-black/5 dark:bg-white/5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">event_upcoming</span>
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-tight text-light-text dark:text-dark-text leading-none">
                    Bill Alerts
                  </h3>
                  <p className="text-[10px] font-semibold text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                    Due in 3 days or less
                  </p>
                </div>
              </div>

              {notificationCount > 0 && (
                <button
                  onClick={onClearAll}
                  className="text-[10px] font-bold tracking-wider text-light-text-secondary dark:text-dark-text-secondary hover:text-primary-500 transition-colors uppercase"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Notification List Container */}
            <div className="max-h-[380px] overflow-y-auto p-3 space-y-3 custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                    <span className="material-symbols-outlined text-2xl">verified</span>
                  </div>
                  <p className="text-xs font-bold text-light-text dark:text-dark-text">No Upcoming Bill Alerts</p>
                  <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary max-w-[220px] mx-auto opacity-70">
                    All recurring bills for the next 3 days are settled or clear.
                  </p>
                </div>
              ) : (
                <>
                  {/* Urgent / Overdue & Today Section */}
                  {overdueOrToday.length > 0 && (
                    <div className="space-y-2">
                      <div className="px-2 text-[10px] font-bold text-rose-500 uppercase tracking-widest flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                        Action Required ({overdueOrToday.length})
                      </div>
                      {overdueOrToday.map((item) => (
                        <NotificationCard
                          key={item.id}
                          item={item}
                          onDismiss={onDismiss}
                          onProcessItem={onProcessItem}
                        />
                      ))}
                    </div>
                  )}

                  {/* Due in 1 to 3 Days Section */}
                  {dueSoon.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <div className="px-2 text-[10px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        Due in 1-3 Days ({dueSoon.length})
                      </div>
                      {dueSoon.map((item) => (
                        <NotificationCard
                          key={item.id}
                          item={item}
                          onDismiss={onDismiss}
                          onProcessItem={onProcessItem}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer Quick Link */}
            {setCurrentPage && (
              <div className="p-3 bg-black/5 dark:bg-white/5 border-t border-black/5 dark:border-white/10 text-center">
                <button
                  onClick={() => {
                    setCurrentPage('Schedule & Bills');
                    setIsOpen(false);
                  }}
                  className="text-xs font-bold text-primary-500 hover:text-primary-600 transition-colors inline-flex items-center gap-1"
                >
                  Manage Schedule & Bills
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
    <div
      className={`p-3 rounded-2xl border transition-all duration-200 relative group flex flex-col gap-2 ${
        isUrgent
          ? 'bg-rose-500/5 border-rose-500/20 hover:border-rose-500/40'
          : 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40'
      }`}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              isUrgent ? 'bg-rose-500/15 text-rose-500' : 'bg-amber-500/15 text-amber-500'
            }`}
          >
            <span className="material-symbols-outlined text-lg">
              {isUrgent ? 'priority_high' : 'schedule'}
            </span>
          </div>

          <div className="min-w-0">
            <h4 className="font-bold text-xs text-light-text dark:text-dark-text truncate leading-tight">
              {item.description}
            </h4>
            <span
              className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[9px] font-extrabold ${
                isUrgent ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
              }`}
            >
              {item.statusText}
            </span>
          </div>
        </div>

        <button
          onClick={() => onDismiss(item.id)}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors rounded-lg"
          title="Dismiss alert"
        >
          <span className="material-symbols-outlined text-sm leading-none">close</span>
        </button>
      </div>

      <div className="flex justify-between items-center pt-1 border-t border-black/5 dark:border-white/5 text-xs">
        <span className="font-black tracking-tight text-light-text dark:text-dark-text privacy-blur">
          {formatCurrency(item.amount, item.currency)}
        </span>

        {onProcessItem && (
          <button
            onClick={() => onProcessItem(item.originalItem)}
            className={`px-3 py-1 rounded-xl text-[10px] font-bold transition-all active:scale-95 ${
              isUrgent
                ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-md shadow-rose-500/20'
                : 'bg-primary-500 text-white hover:bg-primary-600 shadow-md shadow-primary-500/20'
            }`}
          >
            Pay / Record
          </button>
        )}
      </div>
    </div>
  );
};

export default NotificationCenter;
