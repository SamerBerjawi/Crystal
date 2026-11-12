import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Membership, RecurringTransaction } from '../types';
import { convertToMain, parseLocalDate, getMainCurrency, round2 } from '../utils';
import MembershipModal from '../components/MembershipModal';
import LoyaltyCard from '../components/LoyaltyCard';
import PageHeader, { type PageStat } from '../components/PageHeader';
import RecurringTransactionModal from '../components/RecurringTransactionModal';
import RenewalTimeline from '../components/RenewalTimeline';
import ServiceCard from '../components/ServiceCard';
import SubscriptionInsightsHub from '../components/SubscriptionInsightsHub';
import { Button } from '../components/ui/Actions';
import { Badge } from '../components/ui/Display';
import { Amount } from '../components/ui/Money';
import { ConfirmDialog } from '../components/ui/Overlays';
import SegmentedControl from '../components/ui/SegmentedControl';
import { EmptyState } from '../components/ui/States';
import Icon from '../components/ui/Icon';
import { controlStyles } from '../components/ui/Fields';
import { useAccountsContext, usePreferencesContext, useTransactionsContext } from '../contexts/DomainProviders';
import { useCategoryContext, useScheduleContext } from '../contexts/FinancialDataContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { nextDates, monthlyEquivalent } from '../utils/scheduleModel';
import { subscriptionAudit } from '../utils/subscriptionAudit';
import {
  cancelService,
  detectSubscriptions,
  expiringCards,
  pauseService,
  priceChanges,
  renewals,
  resumeService,
  savedByPausing,
  seriesFromDetected,
  serviceStatus,
  serviceTotals,
  services,
  type DetectedSubscription,
  type SubscriptionPriceChange,
} from '../utils/subscriptionsModel';
import { cn } from '../lib/utils';

type Tab = 'active' | 'stopped' | 'wallet';
type Scope = 'all' | 'services';
type SortOption = 'amount_desc' | 'amount_asc' | 'next_date' | 'name_asc';
type SeriesDraft = Omit<RecurringTransaction, 'id'> & { id?: string };

const convert = (amount: number, currency: Parameters<typeof convertToMain>[1]) => convertToMain(amount, currency);
const shortDay = (date: string) => parseLocalDate(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const NON_SERVICE_CATEGORIES = new Set(['housing', 'rent', 'mortgage', 'loan', 'loans', 'taxes', 'tax', 'alimony']);
const isDigitalOrService = (item: RecurringTransaction) => {
  const cat = (item.category || '').trim().toLowerCase();
  if (!cat) return true;
  if (cat.includes('subscription') || cat.includes('streaming') || cat.includes('software') || cat.includes('membership')) return true;
  return !NON_SERVICE_CATEGORIES.has(cat);
};

/** Services and cards in one place (D-028). Pausing changes what Crystal counts, and cancels nothing with the provider (D-093). */
const Subscriptions: React.FC = () => {
  const { transactions } = useTransactionsContext();
  const { accounts } = useAccountsContext();
  const { recurringTransactions, saveRecurringTransaction, deleteRecurringTransaction, memberships, saveMembership, deleteMembership } = useScheduleContext();
  const { incomeCategories, expenseCategories } = useCategoryContext();
  const isPhone = useIsMobile();

  const today = useMemo(() => new Date(), []);
  const [tab, setTab] = useState<Tab>('active');
  const [scope, setScope] = useState<Scope>('services');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('amount_desc');

  const { preferences, setPreferences } = usePreferencesContext();
  const ignored = useMemo(() => preferences.ignoredSubscriptions ?? [], [preferences.ignoredSubscriptions]);
  const [editing, setEditing] = useState<SeriesDraft | null>(null);
  const [isFormOpen, setFormOpen] = useState(false);
  const [isCardFormOpen, setCardFormOpen] = useState(false);
  const [cardToEdit, setCardToEdit] = useState<Membership | null>(null);
  const [stopping, setStopping] = useState<RecurringTransaction | null>(null);
  const [deletingCard, setDeletingCard] = useState<Membership | null>(null);

  const detected = useMemo(
    () => detectSubscriptions(transactions, recurringTransactions, ignored, today),
    [transactions, recurringTransactions, ignored, today]
  );

  const allServices = useMemo(() => {
    const base = services(recurringTransactions);
    return scope === 'services' ? base.filter(isDigitalOrService) : base;
  }, [recurringTransactions, scope]);

  const active = useMemo(
    () => allServices.filter(item => serviceStatus(item, today) === 'active'),
    [allServices, today]
  );
  const paused = useMemo(
    () => allServices.filter(item => serviceStatus(item, today) === 'paused'),
    [allServices, today]
  );
  const cancelled = useMemo(
    () => allServices.filter(item => serviceStatus(item, today) === 'cancelled'),
    [allServices, today]
  );
  const stopped = useMemo(() => [...paused, ...cancelled], [paused, cancelled]);

  const totals = useMemo(() => serviceTotals(active, today, convert), [active, today]);
  const coming = useMemo(() => renewals(active, today, convert), [active, today]);
  const saved = useMemo(() => savedByPausing(paused, convert), [paused]);
  const expiring = useMemo(() => expiringCards(memberships, today), [memberships, today]);
  const changes = useMemo(() => priceChanges(active, transactions, ignored), [active, transactions, ignored]);
  const audit = useMemo(() => subscriptionAudit(active, transactions, today, convert, ignored), [active, transactions, today, ignored]);

  // Category breakdown for active subscriptions
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; monthly: number }>();
    let totalMonthly = 0;
    active.forEach(item => {
      const cat = item.category || 'Other';
      const monthlyCost = convert(monthlyEquivalent(item), item.currency);
      totalMonthly += monthlyCost;
      const cur = map.get(cat) || { count: 0, monthly: 0 };
      map.set(cat, { count: cur.count + 1, monthly: cur.monthly + monthlyCost });
    });

    const categories = [...map.entries()]
      .map(([cat, data]) => ({ category: cat, ...data }))
      .sort((a, b) => b.monthly - a.monthly);

    return { totalMonthly: round2(totalMonthly), categories };
  }, [active]);

  // Filtered and sorted active services
  const filteredActive = useMemo(() => {
    let list = active;
    if (selectedCategory !== 'all') {
      list = list.filter(item => (item.category || 'Other') === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(item =>
        (item.merchant || '').toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q) ||
        (item.category || '').toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      const nameA = a.merchant || a.description || '';
      const nameB = b.merchant || b.description || '';
      const costA = convert(monthlyEquivalent(a), a.currency);
      const costB = convert(monthlyEquivalent(b), b.currency);
      const nextA = nextDates(a, today, 1)[0] || '9999-99-99';
      const nextB = nextDates(b, today, 1)[0] || '9999-99-99';

      switch (sortBy) {
        case 'amount_desc':
          return costB - costA;
        case 'amount_asc':
          return costA - costB;
        case 'next_date':
          return nextA.localeCompare(nextB);
        case 'name_asc':
          return nameA.localeCompare(nameB);
        default:
          return 0;
      }
    });
  }, [active, selectedCategory, searchQuery, sortBy, today]);

  // Filtered stopped services
  const filteredStopped = useMemo(() => {
    let list = stopped;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(item =>
        (item.merchant || '').toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q) ||
        (item.category || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [stopped, searchQuery]);

  // Wallet cards grouped with search
  const cardGroups = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const filteredCards = q
      ? memberships.filter(card =>
          (card.provider || '').toLowerCase().includes(q) ||
          (card.memberId || '').toLowerCase().includes(q) ||
          (card.holderName || '').toLowerCase().includes(q) ||
          (card.category || '').toLowerCase().includes(q)
        )
      : memberships;

    const groups = new Map<string, Membership[]>();
    filteredCards.forEach(card => {
      const category = card.category || 'Other';
      groups.set(category, [...(groups.get(category) ?? []), card]);
    });
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [memberships, searchQuery]);

  const accountName = (id: string) => accounts.find(account => account.id === id)?.name;
  const openForm = (service: SeriesDraft | null) => {
    setEditing(service);
    setFormOpen(true);
  };

  const pause = (service: RecurringTransaction) => {
    saveRecurringTransaction(pauseService(service, today));
    toast.success(`${service.merchant || service.description} paused`, {
      action: {
        label: 'Undo',
        onClick: () => saveRecurringTransaction({ ...service, pausedAt: undefined }),
      },
    });
  };

  const resume = (service: RecurringTransaction) => {
    saveRecurringTransaction(resumeService(service, today));
    toast.success(`${service.merchant || service.description} resumed`);
  };

  const cancel = (service: RecurringTransaction) => {
    saveRecurringTransaction(cancelService(service, today));
    toast.success(`${service.merchant || service.description} marked as cancelled`, {
      action: {
        label: 'Undo',
        onClick: () => saveRecurringTransaction({ ...service, endDate: undefined }),
      },
    });
  };

  const handleUpdatePrice = (change: SubscriptionPriceChange) => {
    saveRecurringTransaction({ ...change.service, amount: change.newAmount });
    setPreferences(prev => ({
      ...prev,
      ignoredSubscriptions: [...(prev.ignoredSubscriptions ?? []), change.key],
    }));
    const name = change.service.merchant || change.service.description;
    toast.success(`Updated ${name} to ${change.newAmount}`);
  };

  const handleDismissAlert = (key: string) => {
    setPreferences(prev => ({
      ...prev,
      ignoredSubscriptions: [...(prev.ignoredSubscriptions ?? []), key],
    }));
  };

  const track = (candidate: DetectedSubscription) => openForm(seriesFromDetected(candidate, today));

  const tabs = [
    { id: 'active', label: `Active (${active.length})` },
    { id: 'stopped', label: `Paused & cancelled (${stopped.length})` },
    { id: 'wallet', label: `Wallet (${memberships.length})` },
  ];

  const pageStats: PageStat[] = [
    { label: 'Every month', icon: 'money-send-01', value: totals.monthly, format: 'money' },
    { label: 'Over a year', icon: 'calendar-03', value: totals.yearly, format: 'money' },
    {
      label: 'Renewing in 30 days',
      icon: 'repeat-one-01',
      value: totals.renewing,
      format: 'money',
      ...(totals.dueSoon ? { badge: `${totals.dueSoon} due soon`, badgeTone: 'butter' as const } : {}),
    },
  ];

  return (
    <div className="space-y-6 pb-8 max-md:space-y-4">
      <PageHeader
        title="Subscriptions"
        stats={pageStats}
        actions={
          tab === 'wallet' ? (
            <Button icon="add-01" onPress={() => { setCardToEdit(null); setCardFormOpen(true); }}>
              Add a card
            </Button>
          ) : (
            <Button icon="add-01" onPress={() => openForm(null)}>
              Add a service
            </Button>
          )
        }
      />

      {/* Primary Tab Navigation & Scope Control */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl items={tabs} activeId={tab} onChange={id => { setTab(id as Tab); setSelectedCategory('all'); setSearchQuery(''); }} scrollable />
        {tab !== 'wallet' && (
          <SegmentedControl
            items={[
              { id: 'services', label: 'Services only' },
              { id: 'all', label: 'All recurring' },
            ]}
            activeId={scope}
            onChange={id => setScope(id as Scope)}
          />
        )}
      </div>

      {/* TAB 1: ACTIVE SUBSCRIPTIONS */}
      {tab === 'active' && (
        <div className="space-y-5">
          {/* 1. Unified Insights & Attention Center (Eliminates vertical banner stacking) */}
          <SubscriptionInsightsHub
            audit={audit}
            priceChanges={changes}
            detected={detected}
            onOpen={openForm}
            onUpdatePrice={handleUpdatePrice}
            onPause={pause}
            onCancel={cancel}
            onDismiss={handleDismissAlert}
            onTrack={track}
          />

          {/* 2. Renewal Timeline (Horizon view) */}
          <RenewalTimeline items={coming} today={today} isPhone={isPhone} onOpen={item => openForm(item.service)} />

          {/* 3. Category Spend Breakdown Strip */}
          {active.length > 0 && categoryBreakdown.categories.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-sm scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors border',
                  selectedCategory === 'all'
                    ? 'bg-ink text-solid border-ink'
                    : 'bg-surface text-muted border-line hover:text-ink hover:bg-inset'
                )}
              >
                <span>All</span>
                <span className="opacity-80">({categoryBreakdown.totalMonthly ? `${getMainCurrency()} ${categoryBreakdown.totalMonthly}/mo` : ''} · {active.length})</span>
              </button>
              {categoryBreakdown.categories.map(cat => (
                <button
                  key={cat.category}
                  type="button"
                  onClick={() => setSelectedCategory(cat.category === selectedCategory ? 'all' : cat.category)}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors border',
                    selectedCategory === cat.category
                      ? 'bg-ink text-solid border-ink font-semibold'
                      : 'bg-surface text-muted border-line hover:text-ink hover:bg-inset'
                  )}
                >
                  <span>{cat.category}</span>
                  <span className="opacity-75 font-mono text-[11px]">
                    (<Amount value={cat.monthly} currency={getMainCurrency()} />/mo · {cat.count})
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* 4. Search & Sort Bar */}
          {active.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="relative min-w-[200px] flex-1 max-w-xs">
                <Icon
                  name="search-01"
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  type="search"
                  aria-label="Search active services"
                  placeholder="Search active subscriptions..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className={cn(controlStyles, 'h-9 pl-9 pr-3 text-xs w-full')}
                />
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <span className="type-caption text-muted hidden sm:inline">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as SortOption)}
                  className={cn(controlStyles, 'h-9 text-xs px-2.5 font-medium cursor-pointer')}
                  aria-label="Sort subscriptions"
                >
                  <option value="amount_desc">Cost (highest first)</option>
                  <option value="amount_asc">Cost (lowest first)</option>
                  <option value="next_date">Next renewal date</option>
                  <option value="name_asc">Name (A–Z)</option>
                </select>

                <span className="type-caption text-muted pl-1">
                  {filteredActive.length} of {active.length}
                </span>
              </div>
            </div>
          )}

          {/* 5. Services Grid */}
          {active.length > 0 ? (
            filteredActive.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {filteredActive.map(service => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    status="active"
                    accountName={accountName(service.accountId)}
                    nextDate={nextDates(service, today, 1)[0]}
                    onEdit={() => openForm(service)}
                    quickAction={{
                      label: 'Pause',
                      icon: 'pause',
                      onPress: () => pause(service),
                    }}
                    actions={[
                      { id: 'edit', label: 'Edit', icon: 'pencil-edit-02', onAction: () => openForm(service) },
                      { id: 'pause', label: 'Pause', icon: 'pause', onAction: () => pause(service) },
                      { id: 'cancel', label: 'Mark as cancelled', icon: 'cancel-circle', onAction: () => cancel(service) },
                      { id: 'stop', label: 'Stop tracking', icon: 'delete-02', isDestructive: true, startsGroup: true, onAction: () => setStopping(service) },
                    ]}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon="search-01"
                title="No matching subscriptions"
                description={`No active subscriptions match "${searchQuery}" in ${selectedCategory === 'all' ? 'any category' : selectedCategory}.`}
                actionLabel="Clear filters"
                onAction={() => { setSearchQuery(''); setSelectedCategory('all'); }}
              />
            )
          ) : (
            <EmptyState
              icon="repeat-one-01"
              title="No services yet"
              description="Add one, or track what Crystal finds in your transactions."
              actionLabel="Add a service"
              onAction={() => openForm(null)}
            />
          )}
        </div>
      )}

      {/* TAB 2: STOPPED SUBSCRIPTIONS (PAUSED & CANCELLED) */}
      {tab === 'stopped' && (
        <div className="space-y-5">
          {paused.length > 0 && (
            <section
              aria-label="Saved by pausing"
              className="surface-card flex flex-wrap items-baseline justify-between gap-4 rounded-[var(--radius-xl)] border border-line p-5 shadow-2xs"
            >
              <div>
                <h2 className="type-label text-muted text-xs font-semibold uppercase tracking-wider">
                  Saved by pausing
                </h2>
                <p className="type-figure-lg font-bold text-ink mt-1 flex items-baseline gap-1.5">
                  <Amount value={saved} currency={getMainCurrency()} />
                  <span className="type-caption font-normal text-muted">saved every month</span>
                </p>
              </div>
              <p className="type-caption max-w-sm text-muted">
                Paused services leave your totals and calendar projections. Crystal keeps records safe without cancelling provider contracts.
              </p>
            </section>
          )}

          {stopped.length > 0 && (
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="relative min-w-[200px] flex-1 max-w-xs">
                <Icon
                  name="search-01"
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  type="search"
                  aria-label="Search stopped services"
                  placeholder="Search paused and cancelled..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className={cn(controlStyles, 'h-9 pl-9 pr-3 text-xs w-full')}
                />
              </div>
              <span className="type-caption text-muted">{filteredStopped.length} items</span>
            </div>
          )}

          {stopped.length > 0 ? (
            filteredStopped.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {filteredStopped.map(service => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    status={serviceStatus(service, today)}
                    accountName={accountName(service.accountId)}
                    onEdit={() => openForm(service)}
                    quickAction={{
                      label: service.pausedAt ? 'Resume' : 'Reactivate',
                      icon: 'play',
                      onPress: () => resume(service),
                    }}
                    actions={[
                      { id: 'resume', label: service.pausedAt ? 'Resume' : 'Start again', icon: 'play', onAction: () => resume(service) },
                      { id: 'edit', label: 'Edit', icon: 'pencil-edit-02', onAction: () => openForm(service) },
                      { id: 'stop', label: 'Stop tracking', icon: 'delete-02', isDestructive: true, startsGroup: true, onAction: () => setStopping(service) },
                    ]}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon="search-01"
                title="No matching services"
                description={`No stopped services match "${searchQuery}".`}
                actionLabel="Clear search"
                onAction={() => setSearchQuery('')}
              />
            )
          ) : (
            <EmptyState
              icon="pause"
              title="Nothing paused"
              description="Pause a service from its card or menu, and it will be stored safely here."
            />
          )}
        </div>
      )}

      {/* TAB 3: WALLET & MEMBERSHIP CARDS */}
      {tab === 'wallet' && (
        <div className="space-y-5">
          {memberships.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative min-w-[200px] flex-1 max-w-xs">
                <Icon
                  name="search-01"
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  type="search"
                  aria-label="Search cards in wallet"
                  placeholder="Search cards, numbers, holders..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className={cn(controlStyles, 'h-9 pl-9 pr-3 text-xs w-full')}
                />
              </div>

              {expiring.length > 0 && (
                <Badge tone="attention" className="font-semibold text-xs px-2.5 py-1">
                  {expiring.length} {expiring.length === 1 ? 'card expires' : 'cards expire'} soon
                </Badge>
              )}
            </div>
          )}

          {memberships.length > 0 ? (
            cardGroups.length > 0 ? (
              <div className="space-y-6">
                {cardGroups.map(([category, cards]) => (
                  <section key={category} aria-label={category}>
                    <div className="flex items-center gap-2 mb-3">
                      <h2 className="type-card-title text-ink font-semibold">{category}</h2>
                      <span className="type-caption text-muted">({cards.length})</span>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {cards.map(card => (
                        <LoyaltyCard
                          key={card.id}
                          membership={card}
                          onEdit={item => {
                            setCardToEdit(item);
                            setCardFormOpen(true);
                          }}
                          onDelete={id => setDeletingCard(memberships.find(item => item.id === id) ?? null)}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <EmptyState
                icon="search-01"
                title="No matching cards"
                description={`No membership cards match "${searchQuery}".`}
                actionLabel="Clear search"
                onAction={() => setSearchQuery('')}
              />
            )
          ) : (
            <EmptyState
              icon="wallet-02"
              title="No cards yet"
              description="Store your loyalty memberships, frequent flyer numbers, and discount cards here with scannable barcodes."
              actionLabel="Add a card"
              onAction={() => {
                setCardToEdit(null);
                setCardFormOpen(true);
              }}
            />
          )}
        </div>
      )}

      {/* MODALS */}
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

      {isCardFormOpen && (
        <MembershipModal
          onClose={() => setCardFormOpen(false)}
          onSave={saveMembership}
          membershipToEdit={cardToEdit}
        />
      )}

      <ConfirmDialog
        isOpen={!!stopping}
        onClose={() => setStopping(null)}
        onConfirm={() => {
          if (stopping) deleteRecurringTransaction(stopping.id);
          setStopping(null);
        }}
        title={`Stop tracking ${stopping?.merchant || stopping?.description || 'this service'}?`}
        message="This removes it from your services and calendar. You can add it again later."
        confirmLabel="Stop tracking"
        isDestructive
      />

      <ConfirmDialog
        isOpen={!!deletingCard}
        onClose={() => setDeletingCard(null)}
        onConfirm={() => {
          if (deletingCard) deleteMembership(deletingCard.id);
          setDeletingCard(null);
        }}
        title={`Delete the ${deletingCard?.provider ?? ''} card?`}
        message="It's permanently removed from your Wallet."
        confirmLabel="Delete card"
        isDestructive
      />
    </div>
  );
};

export default Subscriptions;
