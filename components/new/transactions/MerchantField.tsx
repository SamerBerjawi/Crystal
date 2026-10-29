import React, { useId, useMemo, useState } from 'react';
import { cn } from '../../../lib/utils';
import { matchMerchants, type MerchantSuggestion } from '../../../utils/transactionsModel';
import { LogoTile } from '../EntityIcon';

/*
 * The form's merchant field: the merchant's logo and a combobox that suggests merchants saved on the Merchants page
 * and those on past transactions while typing. Picking one (or typing a saved name exactly) lets the form fill what
 * is saved for it.
 */

export const MerchantField: React.FC<{
  value: string;
  label: string;
  placeholder: string;
  logoUrl: string | null;
  pool: MerchantSuggestion[];
  logoFor: (name: string) => string | null;
  onType: (value: string) => void;
  onPick: (name: string) => void;
}> = ({ value, label, placeholder, logoUrl, pool, logoFor, onType, onPick }) => {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const matches = useMemo(() => matchMerchants(pool, value), [pool, value]);
  // Nothing to suggest when the one match is what is already typed.
  const shown = open && matches.length > 0 && !(matches.length === 1 && matches[0].name.toLowerCase() === value.trim().toLowerCase());

  const pick = (s: MerchantSuggestion) => { onPick(s.name); setOpen(false); setActive(-1); };

  return (
    <div className="relative">
      <label className="flex items-center gap-3 rounded-full bg-nv-inset py-2 pl-2 pr-5 focus-within:ring-2 focus-within:ring-nv-violet">
        <LogoTile url={logoUrl} label={value || '?'} size={40} rounded="full" fallbackIcon={value.trim() ? undefined : 'bank'} />
        <span className="sr-only">{label}</span>
        <input
          role="combobox"
          aria-expanded={shown}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={shown && active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          value={value}
          onChange={e => { onType(e.target.value); setOpen(true); setActive(-1); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={e => {
            if (!shown) { if (e.key === 'ArrowDown') { setOpen(true); e.preventDefault(); } return; }
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => (i + 1) % matches.length); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => (i <= 0 ? matches.length - 1 : i - 1)); }
            else if (e.key === 'Enter' && active >= 0 && matches[active]) { e.preventDefault(); pick(matches[active]); }
            else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); setActive(-1); }
          }}
          placeholder={placeholder}
          className="h-8 min-w-0 flex-1 bg-transparent text-[17px] font-medium text-nv-ink outline-none placeholder:font-normal placeholder:text-nv-muted"
        />
      </label>
      {shown && (
        <ul id={listId} role="listbox" aria-label="Suggested merchants" className="crystal-new absolute inset-x-0 top-full z-popover mt-2 rounded-nv-tile bg-nv-surface p-1.5 shadow-nv-float">
          {matches.map((s, i) => (
            <li
              key={s.name}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={e => { e.preventDefault(); pick(s); }}
              onMouseEnter={() => setActive(i)}
              className={cn('flex min-h-11 cursor-default items-center gap-3 rounded-xl px-2 py-1.5', i === active && 'bg-nv-inset')}
            >
              <LogoTile url={logoFor(s.name)} label={s.name} size={32} rounded="full" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium text-nv-ink">{s.name}</span>
                <span className="block truncate text-[13px] text-nv-muted">
                  {[s.category, s.count ? `${s.count} transaction${s.count === 1 ? '' : 's'}` : 'Saved merchant'].filter(Boolean).join(' · ')}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
