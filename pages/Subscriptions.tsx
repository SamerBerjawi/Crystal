import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Membership, RecurringTransaction } from '../types';
import { convertToEur, parseLocalDate } from '../utils';
import MembershipModal from '../components/MembershipModal';
import LoyaltyCard from '../components/LoyaltyCard';
import PageHeader, { type PageStat } from '../components/PageHeader';
import RecurringTransactionModal from '../components/RecurringTransactionModal';
import RenewalTimeline from '../components/RenewalTimeline';
import ServiceCard, { BrandMark } from '../components/ServiceCard';
import { Button } from '../components/ui/Actions';
import { Badge } from '../components/ui/Display';
import { Amount } from '../components/ui/Money';
import { ConfirmDialog } from '../components/ui/Overlays';
import SegmentedControl from '../components/ui/SegmentedControl';
import { EmptyState } from '../components/ui/States';
import { useAccountsContext, useTransactionsContext } from '../contexts/DomainProviders';
import { useCategoryContext, useScheduleContext } from '../contexts/FinancialDataContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { nextDates } from '../utils/scheduleModel';
import {
  cancelService, detectSubscriptions, expiringCards, pauseService, renewals, resumeService, savedByPausing, seriesFromDetected, serviceStatus, serviceTotals, services,
  type DetectedSubscription,
} from '../utils/subscriptionsModel';

type Tab = 'active' | 'stopped' | 'wallet';
type SeriesDraft = Omit<RecurringTransaction, 'id'> & { id?: string };

const convert = (amount: number, currency: Parameters<typeof convertToEur>[1]) => convertToEur(amount, currency);
const FREQUENCY_LABEL: Record<string, string> = { daily: 'Daily', weekly: 'Weekly', biweekly: 'Every 2 weeks', monthly: 'Monthly', yearly: 'Yearly' };
const shortDay = (date: string) => parseLocalDate(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** Services and cards in one place (D-028). Pausing changes what Crystal counts, and cancels nothing with the provider (D-093). */
const Subscriptions: React.FC = () => {
  const { transactions } = useTransactionsContext();
  const { accounts } = useAccountsContext();
  const { recurringTransactions, saveRecurringTransaction, deleteRecurringTransaction, memberships, saveMembership, deleteMembership } = useScheduleContext();
  const { incomeCategories, expenseCategories } = useCategoryContext();
  const isPhone = useIsMobile();

  const today = useMemo(() => new Date(), []);
  const [tab, setTab] = useState<Tab>('active');
  const [ignored, setIgnored] = useLocalStorage<string[]>('ignored-subscriptions', []);
  const [editing, setEditing] = useState<SeriesDraft | null>(null);
  const [isFormOpen, setFormOpen] = useState(false);
  const [isCardFormOpen, setCardFormOpen] = useState(false);
  const [cardToEdit, setCardToEdit] = useState<Membership | null>(null);
  const [stopping, setStopping] = useState<RecurringTransaction | null>(null);
  const [deletingCard, setDeletingCard] = useState<Membership | null>(null);

  const detected = useMemo(() => detectSubscriptions(transactions, recurringTransactions, ignored, today), [transactions, recurringTransactions, ignored, today]);

  const allServices = useMemo(() => services(recurringTransactions), [recurringTransactions]);
  const active = useMemo(() => allServices.filter(item => serviceStatus(item, today) === 'active'), [allServices, today]);
  const paused = useMemo(() => allServices.filter(item => serviceStatus(item, today) === 'paused'), [allServices, today]);
  const cancelled = useMemo(() => allServices.filter(item => serviceStatus(item, today) === 'cancelled'), [allServices, today]);
  const stopped = [...paused, ...cancelled];

  const totals = useMemo(() => serviceTotals(active, today, convert), [active, today]);
  const coming = useMemo(() => renewals(active, today, convert), [active, today]);
  const saved = useMemo(() => savedByPausing(paused, convert), [paused]);
  const expiring = useMemo(() => expiringCards(memberships, today), [memberships, today]);

  const cardGroups = useMemo(() => {
    const groups = new Map<string, Membership[]>();
    memberships.forEach(card => {
      const category = card.category || 'Other';
      groups.set(category, [...(groups.get(category) ?? []), card]);
    });
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [memberships]);

  const accountName = (id: string) => accounts.find(account => account.id === id)?.name;
  const openForm = (service: SeriesDraft | null) => {
    setEditing(service);
    setFormOpen(true);
  };

  const pause = (service: RecurringTransaction) => {
    saveRecurringTransaction(pauseService(service, today));
    toast.success(`${service.merchant || service.description} paused`, { action: { label: 'Undo', onClick: () => saveRecurringTransaction({ ...service, pausedAt: undefined }) } });
  };
  const resume = (service: RecurringTransaction) => {
    saveRecurringTransaction(resumeService(service, today));
    toast.success(`${service.merchant || service.description} is back on`);
  };
  const cancel = (service: RecurringTransaction) => {
    saveRecurringTransaction(cancelService(service, today));
    toast.success(`${service.merchant || service.description} marked as cancelled`, { action: { label: 'Undo', onClick: () => saveRecurringTransaction({ ...service, endDate: service.endDate }) } });
  };

  const track = (candidate: DetectedSubscription) => openForm(seriesFromDetected(candidate, today));

  const tabs = [
    { id: 'active', label: `Active (${active.length})` },
    { id: 'stopped', label: `Paused & cancelled (${stopped.length})` },
    { id: 'wallet', label: `Wallet (${memberships.length})` },
  ];

  const pageStats: PageStat[] = [
    { label: 'Every month', icon: 'payments', value: totals.monthly, format: 'money' },
    { label: 'Over a year', icon: 'calendar_today', value: totals.yearly, format: 'money' },
    { label: 'Renewing in 30 days', icon: 'refresh', value: totals.renewing, format: 'money', ...(totals.dueSoon ? { badge: `${totals.dueSoon} due soon`, badgeTone: 'butter' as const } : {}) },
  ];

  return (
    <div className="space-y-6 pb-8 max-md:space-y-4">
      <PageHeader
        title="Subscriptions"
        stats={pageStats}
        className="!mb-0"
        actions={tab === 'wallet'
          ? <Button icon="add" onPress={() => { setCardToEdit(null); setCardFormOpen(true); }}>Add a card</Button>
          : <Button icon="add" onPress={() => openForm(null)}>Add a service</Button>}
      />

      <SegmentedControl items={tabs} activeId={tab} onChange={id => setTab(id as Tab)} scrollable />

      {tab === 'active' && (
        <>
          {detected.length > 0 && (
            <section aria-label="Found in your transactions" className="surface-card rounded-[var(--radius-xl)] p-5">
              <h2 className="type-card-title text-ink">Found in your transactions</h2>
              <p className="type-caption text-muted">These look like subscriptions you aren't tracking yet.</p>
              <ul className="mt-2 divide-y divide-line">
                {detected.map(candidate => (
                  <li key={candidate.key} className="flex flex-wrap items-center gap-3 py-2">
                    <BrandMark name={candidate.merchant} />
                    <div className="min-w-0 flex-1">
                      <p className="flex min-w-0 items-center gap-2">
                        <span className="type-body-strong truncate text-ink">{candidate.merchant}</span>
                        <Badge tone={candidate.confidence === 'high' ? 'positive' : 'attention'}>{candidate.confidence === 'high' ? 'Likely' : 'Possible'}</Badge>
                      </p>
                      <p className="type-caption truncate text-muted">{FREQUENCY_LABEL[candidate.frequency]}, {candidate.occurrences} payments, last {shortDay(candidate.lastDate)}</p>
                    </div>
                    <span className="type-figure-row shrink-0 text-ink"><Amount value={candidate.amount} currency={candidate.currency} /></span>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" size="sm" onPress={() => setIgnored(prev => [...prev, candidate.key])}>Ignore</Button>
                      <Button variant="secondary" size="sm" onPress={() => track(candidate)}>Track</Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <RenewalTimeline items={coming} today={today} isPhone={isPhone} onOpen={item => openForm(item.service)} />

          {active.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {active.map(service => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  status="active"
                  accountName={accountName(service.accountId)}
                  nextDate={nextDates(service, today, 1)[0]}
                  onEdit={() => openForm(service)}
                  actions={[
                    { id: 'edit', label: 'Edit', icon: 'edit', onAction: () => openForm(service) },
                    { id: 'pause', label: 'Pause', icon: 'pause', onAction: () => pause(service) },
                    { id: 'cancel', label: 'Mark as cancelled', icon: 'event_busy', onAction: () => cancel(service) },
                    { id: 'stop', label: 'Stop tracking', icon: 'delete', isDestructive: true, startsGroup: true, onAction: () => setStopping(service) },
                  ]}
                />
              ))}
            </div>
          ) : (
            <EmptyState icon="refresh" title="No services yet" description="Add one, or track what Crystal finds in your transactions." actionLabel="Add a service" onAction={() => openForm(null)} />
          )}
        </>
      )}

      {tab === 'stopped' && (
        <>
          {paused.length > 0 && (
            <section aria-label="Saved by pausing" className="surface-card flex flex-wrap items-baseline justify-between gap-2 rounded-[var(--radius-xl)] p-5">
              <div>
                <h2 className="type-label text-muted">Saved by pausing</h2>
                <p className="type-figure-lg text-ink"><Amount value={saved} currency="EUR" /> <span className="type-caption text-muted">a month</span></p>
              </div>
              <p className="type-caption max-w-sm text-muted">Paused services leave your totals and forecast. Crystal doesn't cancel anything with the provider.</p>
            </section>
          )}
          {stopped.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {stopped.map(service => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  status={serviceStatus(service, today)}
                  accountName={accountName(service.accountId)}
                  onEdit={() => openForm(service)}
                  actions={[
                    { id: 'resume', label: service.pausedAt ? 'Resume' : 'Start again', icon: 'play_arrow', onAction: () => resume(service) },
                    { id: 'edit', label: 'Edit', icon: 'edit', onAction: () => openForm(service) },
                    { id: 'stop', label: 'Stop tracking', icon: 'delete', isDestructive: true, startsGroup: true, onAction: () => setStopping(service) },
                  ]}
                />
              ))}
            </div>
          ) : (
            <EmptyState icon="pause" title="Nothing paused" description="Pause a service from its menu, and it moves here." />
          )}
        </>
      )}

      {tab === 'wallet' && (
        memberships.length > 0 ? (
          <div className="space-y-5">
            {expiring.length > 0 && <p className="type-body text-ink"><Badge tone="attention">{expiring.length} expiring soon</Badge></p>}
            {cardGroups.map(([category, cards]) => (
              <section key={category} aria-label={category}>
                <h2 className="type-card-title mb-2 text-ink">{category}</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {cards.map(card => <LoyaltyCard key={card.id} membership={card} onEdit={item => { setCardToEdit(item); setCardFormOpen(true); }} onDelete={id => setDeletingCard(memberships.find(item => item.id === id) ?? null)} />)}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <EmptyState icon="wallet" title="No cards yet" description="Keep your loyalty and membership numbers here." actionLabel="Add a card" onAction={() => { setCardToEdit(null); setCardFormOpen(true); }} />
        )
      )}

      {isFormOpen && (
        <RecurringTransactionModal
          onClose={() => setFormOpen(false)}
          onSave={saveRecurringTransaction}
          accounts={accounts}
          incomeCategories={incomeCategories}
          expenseCategories={expenseCategories}
          recurringTransactionToEdit={editing}
        />
      )}

      {isCardFormOpen && <MembershipModal onClose={() => setCardFormOpen(false)} onSave={saveMembership} membershipToEdit={cardToEdit} />}

      <ConfirmDialog
        isOpen={!!stopping}
        onClose={() => setStopping(null)}
        onConfirm={() => { if (stopping) deleteRecurringTransaction(stopping.id); setStopping(null); }}
        title={`Stop tracking ${stopping?.merchant || stopping?.description || 'this service'}?`}
        message="This removes it from your services and calendar. You can add it again later."
        confirmLabel="Stop tracking"
        isDestructive
      />

      <ConfirmDialog
        isOpen={!!deletingCard}
        onClose={() => setDeletingCard(null)}
        onConfirm={() => { if (deletingCard) deleteMembership(deletingCard.id); setDeletingCard(null); }}
        title={`Delete the ${deletingCard?.provider ?? ''} card?`}
        message="It's permanently removed from your Wallet."
        confirmLabel="Delete card"
        isDestructive
      />
    </div>
  );
};

export default Subscriptions;
