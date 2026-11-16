import React, { useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import TripMap from '../components/TripMap';
import { EntityGlyph, MerchantLogo } from '../components/EntityIcon';
import { Button, IconButton } from '../components/ui/Actions';
import { Badge, DayGroup, Row } from '../components/ui/Display';
import { TextInput } from '../components/ui/Fields';
import Icon from '../components/ui/Icon';
import { Amount } from '../components/ui/Money';
import { Dialog } from '../components/ui/Overlays';
import { Select } from '../components/ui/Pickers';
import { EmptyState } from '../components/ui/States';
import { useAccountSelector, usePreferencesContext, useTransactionSelector } from '../contexts/DomainProviders';
import { useCategoryContext } from '../contexts/FinancialDataContext';
import { convertToMain, formatCurrency, getMainCurrency } from '../utils';
import { getCategoryDetails } from '../utils/categories';
import type { Transaction, TripSettings } from '../types';
import { detectHomeCountry, detectTrips, tileUrlProblem, type Trip } from '../utils/trips';
import { cn } from '../lib/utils';

const CARD = 'surface-card min-w-0 rounded-[var(--radius-xl)] p-5 border border-line';
const shortDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const range = (trip: Trip) => `${shortDay(trip.start)}${trip.start === trip.end ? '' : ` to ${shortDay(trip.end)}`} ${trip.end.slice(0, 4)}`;

const MAP_OPTIONS = [
  { id: 'default', label: 'Crystal map', description: 'OpenStreetMap tiles from public servers' },
  { id: 'custom', label: 'My own tile server', description: 'Raster tiles from an address you choose' },
  { id: 'off', label: 'No map', description: 'Dots only. Nothing is loaded from the internet' },
];

interface TripDetailProps {
  trip: Trip;
  transactions: Transaction[];
  settings: TripSettings;
  currency: string;
  onRename: (name: string) => void;
  onExcludeTx: (txId: string) => void;
  onPinTx: (txId: string) => void;
  onUnpinTx: (txId: string) => void;
}

const TripDetail: React.FC<TripDetailProps> = ({
  trip,
  transactions,
  settings,
  currency,
  onRename,
  onExcludeTx,
  onPinTx,
  onUnpinTx,
}) => {
  const { expenseCategories, incomeCategories } = useCategoryContext();
  const accounts = useAccountSelector(a => a);
  const allCategories = useMemo(
    () => [...(expenseCategories || []), ...(incomeCategories || [])],
    [expenseCategories, incomeCategories],
  );
  const accountNames = useMemo(() => new Map(accounts.map(a => [a.id, a.name])), [accounts]);
  const [isRenaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(trip.name);
  const [isLinkingOpen, setLinkingOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const versus = trip.homePerDay && trip.homePerDay > 0 ? Math.round((trip.perDay / trip.homePerDay - 1) * 100) : null;
  const pinnedSet = useMemo(() => new Set(settings.pinnedTransactionIds?.[trip.id] ?? []), [settings.pinnedTransactionIds, trip.id]);
  const tripIdSet = useMemo(() => new Set(trip.transactionIds), [trip.transactionIds]);

  const tripTransactions = useMemo(
    () =>
      transactions
        .filter(tx => tripIdSet.has(tx.id))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [transactions, tripIdSet],
  );

  const groupedByDay = useMemo(() => {
    const groups = new Map<string, Transaction[]>();
    tripTransactions.forEach(tx => {
      const day = tx.date.slice(0, 10);
      groups.set(day, [...(groups.get(day) ?? []), tx]);
    });
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [tripTransactions]);

  // Candidate expenses that can be pinned (e.g. flights/hotels booked up to 120 days before the trip).
  const candidateExpenses = useMemo(() => {
    if (!isLinkingOpen) return [];
    const startMs = new Date(`${trip.start}T00:00:00`).getTime();
    const endMs = new Date(`${trip.end}T00:00:00`).getTime();
    const minWindow = startMs - 120 * 86_400_000;
    const maxWindow = endMs + 14 * 86_400_000;
    const q = searchQuery.trim().toLowerCase();
    return transactions
      .filter(tx => {
        if (tx.type !== 'expense' || tx.transferId || tx.isSplitParent || tx.isCombinedParent || tripIdSet.has(tx.id)) return false;
        const tMs = new Date(`${tx.date.slice(0, 10)}T00:00:00`).getTime();
        if (tMs < minWindow || tMs > maxWindow) return false;
        if (!q) return true;
        return `${tx.merchant ?? ''} ${tx.description} ${tx.category}`.toLowerCase().includes(q);
      })
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 25);
  }, [isLinkingOpen, transactions, trip.start, trip.end, tripIdSet, searchQuery]);

  const catMax = trip.topCategories[0]?.amount || 1;

  return (
    <div className="space-y-4">
      {/* Hero Card */}
      <div className={CARD}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {isRenaming ? (
              <div className="flex flex-wrap items-end gap-2">
                <TextInput
                  label="Trip name"
                  value={nameDraft}
                  onChange={setNameDraft}
                  placeholder={trip.defaultName}
                  className="min-w-52 flex-1"
                  autoFocus
                />
                <Button size="sm" onPress={() => { onRename(nameDraft.trim()); setRenaming(false); }}>Save</Button>
                <Button size="sm" variant="ghost" onPress={() => { setNameDraft(trip.name); setRenaming(false); }}>Cancel</Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="type-title truncate text-ink">{trip.name}</h2>
                <IconButton
                  icon="edit-02"
                  label="Rename trip"
                  onPress={() => { setNameDraft(trip.name); setRenaming(true); }}
                />
              </div>
            )}
            <p className="type-caption text-muted">
              {range(trip)} · {trip.days} {trip.days === 1 ? 'day' : 'days'} · {trip.transactionIds.length} payments
            </p>
          </div>
          {versus !== null && (
            <Badge tone={versus > 15 ? 'attention' : 'positive'}>
              {Math.abs(versus)}% {versus >= 0 ? 'above' : 'below'} home daily avg
            </Badge>
          )}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <dt className="type-label text-muted">Total spent</dt>
            <dd className="type-figure-lg text-ink"><Amount value={trip.spend} currency={currency} /></dd>
          </div>
          <div>
            <dt className="type-label text-muted">Per day</dt>
            <dd className="type-figure-lg text-ink"><Amount value={trip.perDay} currency={currency} /></dd>
          </div>
          {trip.homePerDay !== null && (
            <div>
              <dt className="type-label text-muted">Normal day at home</dt>
              <dd className="type-figure-lg text-muted"><Amount value={trip.homePerDay} currency={currency} /></dd>
            </div>
          )}
        </dl>

        <div className="mt-4 flex flex-wrap gap-2">
          {trip.countries.map(country => <Badge key={country} tone="neutral">{country}</Badge>)}
          {trip.cities.slice(0, 3).map(city => <Badge key={city} tone="teal">{city}</Badge>)}
          {trip.currencies.map(code => <Badge key={code} tone="blue">{code}</Badge>)}
        </div>
      </div>

      {/* Category & Currency Breakdowns */}
      {(trip.topCategories.length > 0 || trip.currenciesBreakdown.length > 0) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {trip.topCategories.length > 0 && (
            <div className={CARD}>
              <h3 className="type-body-strong mb-3 text-ink">Where it went</h3>
              <ul className="space-y-3">
                {trip.topCategories.map(row => {
                  const cat = getCategoryDetails(row.category, allCategories);
                  return (
                    <li key={row.category}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2">
                          <EntityGlyph icon={cat?.icon} label={row.category} color={cat?.color} size={15} />
                          <span className="type-body truncate text-ink">{row.category}</span>
                        </span>
                        <Amount value={row.amount} currency={currency} className="type-body shrink-0 font-semibold text-ink" />
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-inset">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (row.amount / catMax) * 100)}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {trip.currenciesBreakdown.length > 0 && (
            <div className={CARD}>
              <h3 className="type-body-strong mb-3 text-ink">Currencies &amp; top spots</h3>
              <ul className="space-y-2">
                {trip.currenciesBreakdown.map(c => (
                  <li key={c.currency} className="flex items-baseline justify-between gap-3 rounded-[var(--radius-md)] bg-inset/50 px-3 py-2">
                    <span className="type-body-strong text-ink">{c.currency} <span className="type-caption font-normal text-muted">({c.count} tx)</span></span>
                    <span className="text-right">
                      <span className="type-body-strong block text-ink"><Amount value={c.mainAmount} currency={currency} /></span>
                      {c.currency !== currency && (
                        <span className="type-caption text-muted">{formatCurrency(c.originalAmount, c.currency)}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              {trip.topMerchants.length > 0 && (
                <div className="mt-4 border-t border-line pt-3">
                  <p className="type-label mb-2 text-muted">Top spots</p>
                  <ul className="space-y-1.5">
                    {trip.topMerchants.slice(0, 3).map(m => (
                      <li key={m.merchant} className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <MerchantLogo merchant={m.merchant} size={18} />
                          <span className="type-caption truncate text-ink">{m.merchant}</span>
                        </span>
                        <Amount value={m.amount} currency={currency} className="type-caption shrink-0 font-semibold text-ink" />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Stops Map */}
      {trip.places.length > 0 ? (
        <div className={CARD}>
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h3 className="type-body-strong text-ink">Stops on the map</h3>
            <span className="type-caption text-muted">{trip.places.length} {trip.places.length === 1 ? 'location' : 'locations'}</span>
          </div>
          <TripMap places={trip.places} label={`Stops on ${trip.name}`} settings={settings} currency={currency} />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {trip.places.slice(0, 10).map(place => (
              <span
                key={`${place.latitude},${place.longitude}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-inset/50 px-2.5 py-1 text-xs text-ink"
              >
                <span className="max-w-[160px] truncate">{place.label}</span>
                {place.count > 1 && <span className="text-muted">×{place.count}</span>}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className={CARD}>
          <p className="type-caption text-muted">None of these transactions has coordinates saved, so there is no map for this trip.</p>
        </div>
      )}

      {/* Trip Transactions Itinerary */}
      <div className={CARD}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="type-body-strong text-ink">Trip itinerary</h3>
            <p className="type-caption text-muted">Link pre-booked flights or hotels, or remove stray online charges.</p>
          </div>
          <Button size="sm" variant="secondary" icon="add-01" onPress={() => { setSearchQuery(''); setLinkingOpen(true); }}>
            Link pre-booked expense
          </Button>
        </div>

        <div className="space-y-4">
          {groupedByDay.map(([dayStr, dayRows]) => {
            const dayTotal = dayRows.reduce((s, tx) => s + Math.abs(convertToMain(tx.amount, tx.currency)), 0);
            return (
              <DayGroup
                key={dayStr}
                label={shortDay(dayStr)}
                total={<Amount value={dayTotal} currency={currency} className="type-caption font-semibold" />}
              >
                <ul className="divide-y divide-line">
                  {dayRows.map(tx => {
                    const cat = getCategoryDetails(tx.category, allCategories);
                    const isPinned = pinnedSet.has(tx.id);
                    const label = tx.merchant?.trim() || tx.description;
                    return (
                      <li key={tx.id} className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <Row
                            leading={<MerchantLogo merchant={label} size={30} />}
                            title={
                              <span className="flex items-center gap-2">
                                <span className="truncate">{label}</span>
                                {isPinned && <Badge tone="blue">Linked</Badge>}
                              </span>
                            }
                            context={
                              <span className="flex items-center gap-1.5">
                                <EntityGlyph icon={cat?.icon} label={tx.category} color={cat?.color} size={12} />
                                <span className="truncate">
                                  {tx.category}
                                  {tx.city ? ` · ${tx.city}` : ''}
                                  {accountNames.get(tx.accountId) ? ` · ${accountNames.get(tx.accountId)}` : ''}
                                </span>
                              </span>
                            }
                            trailing={<Amount value={Math.abs(convertToMain(tx.amount, tx.currency))} currency={currency} />}
                          />
                        </div>
                        <IconButton
                          icon="cancel-01"
                          label={isPinned ? `Unlink ${label}` : `Remove ${label} from trip`}
                          onPress={() => (isPinned ? onUnpinTx(tx.id) : onExcludeTx(tx.id))}
                        />
                      </li>
                    );
                  })}
                </ul>
              </DayGroup>
            );
          })}
        </div>
      </div>

      {/* Link Pre-Booked Expense Dialog */}
      <Dialog
        isOpen={isLinkingOpen}
        onClose={() => setLinkingOpen(false)}
        title="Link pre-booked expense"
        description={`Pin a flight, hotel, or rail ticket into ${trip.name} so it counts toward your trip total.`}
        width={540}
      >
        <div className="space-y-4">
          <TextInput
            label="Search recent expenses"
            placeholder="Airline, hotel, Airbnb, train…"
            value={searchQuery}
            onChange={setSearchQuery}
            autoFocus
          />
          {candidateExpenses.length === 0 ? (
            <p className="type-body py-4 text-center text-muted">No matching expenses found around these trip dates.</p>
          ) : (
            <ul className="max-h-72 divide-y divide-line overflow-y-auto">
              {candidateExpenses.map(tx => {
                const label = tx.merchant?.trim() || tx.description;
                return (
                  <li key={tx.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <MerchantLogo merchant={label} size={28} />
                      <div className="min-w-0">
                        <p className="type-body-strong truncate text-ink">{label}</p>
                        <p className="type-caption truncate text-muted">{shortDay(tx.date)} · {tx.category}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Amount value={Math.abs(convertToMain(tx.amount, tx.currency))} currency={currency} className="type-body font-semibold" />
                      <Button size="sm" variant="secondary" onPress={() => { onPinTx(tx.id); setLinkingOpen(false); }}>
                        Link
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Dialog>
    </div>
  );
};

/** Trips worked out from the country on your transactions, with editable names, itinerary, and pinned bookings. */
const Trips: React.FC = () => {
  const transactions = useTransactionSelector(tx => tx);
  const accounts = useAccountSelector(a => a);
  const { preferences, setPreferences } = usePreferencesContext();
  const settings: TripSettings = preferences.trips ?? {};
  const currency = getMainCurrency();

  const scopedTransactions = useMemo(() => {
    const ids = new Set(accounts.filter(a => a.includeInAnalytics ?? true).map(a => a.id));
    return ids.size === 0 ? transactions : transactions.filter(tx => ids.has(tx.accountId));
  }, [transactions, accounts]);

  const detected = useMemo(() => detectHomeCountry(scopedTransactions), [scopedTransactions]);
  const trips = useMemo(() => detectTrips(scopedTransactions, settings.homeCountry, settings), [scopedTransactions, settings]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [homeDraft, setHomeDraft] = useState(settings.homeCountry ?? '');
  const [tileDraft, setTileDraft] = useState(settings.tileUrl ?? '');
  const selected = trips.find(trip => trip.id === selectedId) ?? trips[0];

  const update = (next: Partial<TripSettings>) => setPreferences({ ...preferences, trips: { ...settings, ...next } });
  const tileProblem = settings.map === 'custom' || tileDraft ? tileUrlProblem(tileDraft) : null;

  const totalDays = trips.reduce((sum, trip) => sum + trip.days, 0);
  const totalSpend = trips.reduce((sum, trip) => sum + trip.spend, 0);

  const renameTrip = (tripId: string, nextName: string) => {
    const customNames = { ...(settings.customNames ?? {}) };
    if (nextName) customNames[tripId] = nextName;
    else delete customNames[tripId];
    update({ customNames: Object.keys(customNames).length ? customNames : undefined });
  };

  const excludeTx = (txId: string) => {
    const set = new Set(settings.excludedTransactionIds ?? []);
    set.add(txId);
    update({ excludedTransactionIds: [...set] });
  };

  const pinTx = (tripId: string, txId: string) => {
    const current = new Set(settings.pinnedTransactionIds?.[tripId] ?? []);
    current.add(txId);
    update({ pinnedTransactionIds: { ...(settings.pinnedTransactionIds ?? {}), [tripId]: [...current] } });
  };

  const unpinTx = (tripId: string, txId: string) => {
    const next = (settings.pinnedTransactionIds?.[tripId] ?? []).filter(id => id !== txId);
    const map = { ...(settings.pinnedTransactionIds ?? {}) };
    if (next.length) map[tripId] = next;
    else delete map[tripId];
    update({ pinnedTransactionIds: Object.keys(map).length ? map : undefined });
  };

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Trips"
        subtitle={
          trips.length === 0
            ? 'No trips found yet.'
            : `${trips.length} ${trips.length === 1 ? 'trip' : 'trips'} detected${detected || settings.homeCountry ? ` from outside ${settings.homeCountry || detected}` : ''}.`
        }
        stats={[
          { label: 'Trips', icon: 'airplane-01', value: trips.length, iconTone: 'blue' },
          { label: 'Days away', icon: 'calendar-03', value: totalDays },
          { label: 'Spent abroad', icon: 'wallet-02', value: totalSpend, format: 'money', currency, iconTone: 'teal' },
        ]}
        actions={
          <Button variant="secondary" icon="sliders-horizontal" onPress={() => setSettingsOpen(true)}>
            Trip settings
          </Button>
        }
      />

      {trips.length === 0 ? (
        <EmptyState
          icon="airplane-01"
          title="No trips yet"
          description="Trips appear automatically once transactions outside your home country are saved with a country."
          actionLabel="Check trip settings"
          onAction={() => setSettingsOpen(true)}
        />
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,4.5fr)_minmax(0,7.5fr)]">
          <ul className="space-y-2.5" aria-label="Trips">
            {trips.map(trip => {
              const active = selected?.id === trip.id;
              return (
                <li key={trip.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedId(trip.id)}
                    className={cn(
                      CARD,
                      'w-full cursor-pointer text-left transition-all',
                      active ? 'border-primary ring-1 ring-primary' : 'hover:border-line-strong',
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="type-body-strong truncate text-ink">{trip.name}</span>
                      <Amount value={trip.spend} currency={currency} className="type-figure-row shrink-0 text-ink" />
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 type-caption text-muted">
                      <span>{range(trip)}</span>
                      <span>{trip.days} {trip.days === 1 ? 'day' : 'days'} · <Amount value={trip.perDay} currency={currency} className="type-caption" />/d</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="min-w-0">
            {selected && (
              <TripDetail
                trip={selected}
                transactions={scopedTransactions}
                settings={settings}
                currency={currency}
                onRename={name => renameTrip(selected.id, name)}
                onExcludeTx={excludeTx}
                onPinTx={txId => pinTx(selected.id, txId)}
                onUnpinTx={txId => unpinTx(selected.id, txId)}
              />
            )}
          </div>
        </div>
      )}

      <Dialog
        isOpen={isSettingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Trip detection & map settings"
        description="Crystal groups days you spend outside your home country (up to 2 empty days apart)."
        footer={<div className="flex justify-end"><Button onPress={() => setSettingsOpen(false)}>Done</Button></div>}
      >
        <div className="space-y-4">
          <p className="type-caption text-muted">
            {detected ? `Auto-detected home country: ${detected}.` : 'Not enough location-tagged transactions yet to detect home country.'}
          </p>
          <TextInput
            label="Home country override"
            value={homeDraft}
            placeholder={detected ?? 'For example Belgium'}
            onChange={setHomeDraft}
            onBlur={() => { if (homeDraft.trim() !== (settings.homeCountry ?? '')) update({ homeCountry: homeDraft.trim() || undefined }); }}
            help="Leave empty to use the detected country. Write it as it appears on your transactions."
          />
          <Select label="Map" value={settings.map ?? 'default'} onChange={id => update({ map: id as TripSettings['map'] })} options={MAP_OPTIONS} />
          {settings.map === 'custom' && (
            <TextInput
              label="Tile address"
              value={tileDraft}
              placeholder="https://tiles.example.com/{z}/{x}/{y}.png"
              onChange={setTileDraft}
              onBlur={() => { if (!tileUrlProblem(tileDraft) && tileDraft.trim() !== settings.tileUrl) update({ tileUrl: tileDraft.trim() }); }}
              error={tileProblem ?? undefined}
              help="Your own server sees which areas you look at. Until valid, stops show as dots."
            />
          )}
          {(settings.excludedTransactionIds?.length ?? 0) > 0 && (
            <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-line bg-inset/50 px-3 py-2">
              <span className="type-caption text-muted">
                {settings.excludedTransactionIds!.length} excluded {settings.excludedTransactionIds!.length === 1 ? 'transaction' : 'transactions'}
              </span>
              <Button size="sm" variant="ghost" onPress={() => update({ excludedTransactionIds: undefined })}>
                Restore all
              </Button>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
};

export default Trips;
