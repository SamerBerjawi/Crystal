import React, { useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import TripMap from '../components/TripMap';
import { Badge } from '../components/ui/Display';
import { TextInput } from '../components/ui/Fields';
import { Select } from '../components/ui/Pickers';
import { Amount } from '../components/ui/Money';
import { EmptyState } from '../components/ui/States';
import { usePreferencesContext, useTransactionSelector } from '../contexts/DomainProviders';
import { getMainCurrency } from '../utils';
import type { TripSettings } from '../types';
import { detectHomeCountry, detectTrips, tileUrlProblem, type Trip } from '../utils/trips';

const CARD = 'surface-card min-w-0 rounded-[var(--radius-xl)] p-5 border border-line';
const shortDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const range = (trip: Trip) => `${shortDay(trip.start)}${trip.start === trip.end ? '' : ` to ${shortDay(trip.end)}`} ${trip.end.slice(0, 4)}`;

const MAP_OPTIONS = [
  { id: 'default', label: 'Crystal map', description: 'OpenStreetMap tiles from public servers' },
  { id: 'custom', label: 'My own tile server', description: 'Raster tiles from an address you choose' },
  { id: 'off', label: 'No map', description: 'Dots only. Nothing is loaded from the internet' },
];

const TripDetail: React.FC<{ trip: Trip; settings: TripSettings; currency: string }> = ({ trip, settings, currency }) => {
  const versus = trip.homePerDay && trip.homePerDay > 0 ? Math.round((trip.perDay / trip.homePerDay - 1) * 100) : null;
  return (
    <div className="space-y-4">
      <div className={CARD}>
        <h2 className="type-title text-ink">{trip.name}</h2>
        <p className="type-caption text-muted">{range(trip)} · {trip.days} {trip.days === 1 ? 'day' : 'days'}</p>
        <dl className="mt-4 grid grid-cols-2 gap-4">
          <div><dt className="type-label text-muted">Spent there</dt><dd className="type-title text-ink"><Amount value={trip.spend} currency={currency} className="type-title" /></dd></div>
          <div><dt className="type-label text-muted">Per day</dt><dd className="type-title text-ink"><Amount value={trip.perDay} currency={currency} className="type-title" /></dd></div>
        </dl>
        {versus !== null && (
          <p className="type-caption mt-3 text-muted">
            A day at home costs you about <Amount value={trip.homePerDay!} currency={currency} className="type-caption" />, so a day here ran {Math.abs(versus)}% {versus >= 0 ? 'higher' : 'lower'}.
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {trip.countries.map(country => <Badge key={country} tone="neutral">{country}</Badge>)}
          {trip.currencies.map(code => <Badge key={code} tone="blue">{code}</Badge>)}
        </div>
      </div>

      {trip.topCategories.length > 0 && (
        <div className={CARD}>
          <h3 className="type-body-strong mb-3 text-ink">Where it went</h3>
          <ul className="space-y-2">
            {trip.topCategories.map(row => (
              <li key={row.category} className="flex items-baseline justify-between gap-3">
                <span className="type-body truncate text-ink">{row.category}</span>
                <Amount value={row.amount} currency={currency} className="type-body" />
              </li>
            ))}
          </ul>
        </div>
      )}

      {trip.places.length > 0 ? (
        <div className={CARD}>
          <h3 className="type-body-strong mb-3 text-ink">Stops</h3>
          <TripMap places={trip.places} label={`Stops on ${trip.name}`} settings={settings} />
          <ul className="type-caption mt-3 space-y-1 text-muted">
            {trip.places.slice(0, 8).map(place => <li key={`${place.latitude},${place.longitude}`} className="truncate">{place.label}{place.count > 1 ? ` · ${place.count} payments` : ''}</li>)}
            {trip.places.length > 8 && <li>and {trip.places.length - 8} more</li>}
          </ul>
        </div>
      ) : (
        <p className="type-caption text-muted">None of these transactions has a location saved, so there is no map for this trip.</p>
      )}
    </div>
  );
};

/** Trips worked out from the country on your transactions. Nothing is stored; fix a country and the trips follow. */
const Trips: React.FC = () => {
  const transactions = useTransactionSelector(tx => tx);
  const { preferences, setPreferences } = usePreferencesContext();
  const settings: TripSettings = preferences.trips ?? {};
  const currency = getMainCurrency();
  const detected = useMemo(() => detectHomeCountry(transactions), [transactions]);
  const trips = useMemo(() => detectTrips(transactions, settings.homeCountry), [transactions, settings.homeCountry]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [homeDraft, setHomeDraft] = useState(settings.homeCountry ?? '');
  const [tileDraft, setTileDraft] = useState(settings.tileUrl ?? '');
  const selected = trips.find(trip => trip.id === selectedId) ?? trips[0];

  const update = (next: Partial<TripSettings>) => setPreferences({ ...preferences, trips: { ...settings, ...next } });
  const tileProblem = settings.map === 'custom' || tileDraft ? tileUrlProblem(tileDraft) : null;

  const totalDays = trips.reduce((sum, trip) => sum + trip.days, 0);
  const totalSpend = trips.reduce((sum, trip) => sum + trip.spend, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Trips"
        subtitle={trips.length === 0 ? 'No trips found yet.' : `${trips.length} ${trips.length === 1 ? 'trip' : 'trips'} found from where you paid.`}
        stats={[
          { label: 'Trips', icon: 'airplane-01', value: trips.length, iconTone: 'blue' },
          { label: 'Days away', icon: 'calendar-03', value: totalDays },
          { label: 'Spent abroad', icon: 'wallet-02', value: Math.round(totalSpend), iconTone: 'teal' },
        ]}
      />

      <div className={CARD}>
        <h2 className="type-body-strong text-ink">How trips are found</h2>
        <p className="type-caption mt-1 text-muted">
          Days you spend outside your home country, within a couple of days of each other, make a trip. It uses the country saved on each transaction, and never guesses when there is none.
          {detected ? ` Your home looks like ${detected}.` : ' There are not enough transactions with a country to tell where home is.'}
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextInput
            label="Home country"
            value={homeDraft}
            placeholder={detected ?? 'For example Belgium'}
            onChange={setHomeDraft}
            onBlur={() => { if (homeDraft.trim() !== (settings.homeCountry ?? '')) update({ homeCountry: homeDraft.trim() || undefined }); }}
            help="Leave empty to use the detected one. Write it as it appears on your transactions."
          />
          <Select label="Map" value={settings.map ?? 'default'} onChange={id => update({ map: id as TripSettings['map'] })} options={MAP_OPTIONS} />
          {settings.map === 'custom' && (
            <TextInput
              className="md:col-span-2"
              label="Tile address"
              value={tileDraft}
              placeholder="https://tiles.example.com/{z}/{x}/{y}.png"
              onChange={setTileDraft}
              onBlur={() => { if (!tileUrlProblem(tileDraft) && tileDraft.trim() !== settings.tileUrl) update({ tileUrl: tileDraft.trim() }); }}
              error={tileProblem ?? undefined}
              help="Your own server sees which areas you look at. Until the address is valid, trips show as dots."
            />
          )}
        </div>
      </div>

      {trips.length === 0 ? (
        <EmptyState icon="airplane-01" title="No trips yet" description="Trips appear once transactions outside your home country are saved with a country. Card payments from banks usually carry one." />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <ul className="space-y-2" aria-label="Trips">
            {trips.map(trip => (
              <li key={trip.id}>
                <button
                  type="button"
                  aria-pressed={selected?.id === trip.id}
                  onClick={() => setSelectedId(trip.id)}
                  className={`${CARD} w-full text-left transition-colors ${selected?.id === trip.id ? 'border-primary' : ''}`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="type-body-strong truncate text-ink">{trip.name}</span>
                    <Amount value={trip.spend} currency={currency} className="type-body shrink-0" />
                  </div>
                  <p className="type-caption text-muted">{range(trip)} · {trip.days} {trip.days === 1 ? 'day' : 'days'}</p>
                </button>
              </li>
            ))}
          </ul>
          <div className="min-w-0">{selected && <TripDetail trip={selected} settings={settings} currency={currency} />}</div>
        </div>
      )}
    </div>
  );
};

export default Trips;
