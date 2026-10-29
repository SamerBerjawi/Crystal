import React, { useId, useState } from 'react';
import { cn } from '../../../lib/utils';
import { useAddressSearch, type AddressData } from '../../../hooks/useAddressSearch';
import { hasLocation, locationLine, type LocationDraft } from '../../../utils/transactionsModel';
import { NvIcon } from '../NvIcon';

/*
 * Location for a transaction (UI_UX_DESIGN_REFERENCE.md §16): search an address or place (the app's own address
 * search), pick a result, and the place, street, city, country and coordinates are stored. A set location shows
 * as a chip with a clear button.
 */

const fromAddress = (a: AddressData): LocationDraft => ({
  address: a.formattedAddress, placeName: a.placeName ?? '', street: a.street ?? '', city: a.city, postalCode: a.postalCode ?? '',
  state: a.state ?? '', country: a.country, latitude: a.lat, longitude: a.lon, label: a.placeName || a.title,
});

export const LocationField: React.FC<{ value: LocationDraft; onChange: (value: LocationDraft) => void; className?: string }> = ({ value, onChange, className }) => {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const search = useAddressSearch(query, { enabled: focused });
  const results = search.normalized.ids.map(id => search.normalized.entities[id]).slice(0, 6);
  const open = focused && query.trim().length >= 2;

  const pick = (a: AddressData) => { onChange(fromAddress(a)); setQuery(''); setActive(0); };

  if (hasLocation(value)) {
    return (
      <div className={className}>
        <p className="mb-1.5 text-[13px] text-nv-muted">Location</p>
        <div className="flex min-h-12 items-center gap-3 rounded-full bg-nv-inset py-1.5 pl-4 pr-1.5">
          <NvIcon name="pin" size={18} className="shrink-0 text-nv-muted" />
          <span className="min-w-0 flex-1 truncate text-[15px] text-nv-ink">{locationLine({ place: value.placeName || value.label, city: value.city, country: value.country }) || value.address}</span>
          <button type="button" aria-label="Remove location" onClick={() => onChange({ address: '', placeName: '', street: '', city: '', postalCode: '', state: '', country: '', label: '' })} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-nv-muted hover:bg-nv-line hover:text-nv-ink">
            <NvIcon name="close" size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
      <label className="block">
        <span className="mb-1.5 block text-[13px] text-nv-muted">Location</span>
        <span className="relative block">
          <NvIcon name="pin" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-nv-muted" />
          <input
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            value={query}
            onChange={e => { setQuery(e.target.value); setActive(0); setFocused(true); }}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, results.length - 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
              else if (e.key === 'Enter' && open && results[active]) { e.preventDefault(); pick(results[active]); }
              else if (e.key === 'Escape') setQuery('');
            }}
            placeholder="Search a place or address"
            className="h-12 w-full rounded-full bg-nv-inset pl-11 pr-4 text-[15px] text-nv-ink outline-none placeholder:text-nv-muted focus-visible:ring-2 focus-visible:ring-nv-violet"
          />
        </span>
      </label>
      {open && (
        <ul id={listId} role="listbox" aria-label="Places" className="crystal-new absolute inset-x-0 top-full z-popover mt-2 rounded-nv-tile bg-nv-surface p-1.5 shadow-nv-float">
          {search.isFetching && results.length === 0 && <li className="px-3 py-3 text-sm text-nv-muted">Searching…</li>}
          {!search.isFetching && results.length === 0 && <li className="px-3 py-3 text-sm text-nv-muted">No places found.</li>}
          {results.map((a, i) => (
            <li
              key={a.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={e => { e.preventDefault(); pick(a); }}
              onMouseEnter={() => setActive(i)}
              className={cn('flex min-h-11 cursor-default flex-col justify-center rounded-xl px-3 py-1.5', i === active && 'bg-nv-inset')}
            >
              <span className="truncate text-[15px] text-nv-ink">{a.title}</span>
              <span className="truncate text-[13px] text-nv-muted">{a.subtitle}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
