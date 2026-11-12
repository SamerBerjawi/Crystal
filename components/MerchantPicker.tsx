import React, { useMemo, useRef, useState } from 'react';
import type { MerchantRule, Transaction } from '../types';
import { controlStyles } from './ui/Fields';
import Icon from './ui/Icon';
import { LogoTile } from './EntityIcon';
import { getMerchantLogoUrl } from '../utils/brandfetch';
import { matchMerchants, merchantSuggestions } from '../utils/transactionForm';
import { cn } from '../lib/utils';

export interface MerchantPickerProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  onPickCategory?: (category?: string) => void;
  placeholder?: string;
  transactions?: Transaction[];
  rules?: Record<string, MerchantRule>;
  brandfetchClientId?: string;
  logoOverrides?: Record<string, string>;
  className?: string;
  error?: string;
  help?: string;
  autoFocus?: boolean;
}

export const MerchantPicker: React.FC<MerchantPickerProps> = ({
  label = 'Merchant',
  value,
  onChange,
  onPickCategory,
  placeholder = 'Shop, company or person',
  transactions = [],
  rules = {},
  brandfetchClientId,
  logoOverrides,
  className,
  error,
  help,
  autoFocus,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeTimerRef = useRef<number | null>(null);

  const merchantLogo = useMemo(() => (
    value.trim()
      ? getMerchantLogoUrl(value, brandfetchClientId, logoOverrides, { fallback: 'lettermark', type: 'icon', width: 64, height: 64 })
      : null
  ), [value, brandfetchClientId, logoOverrides]);

  const allMerchants = useMemo(() => merchantSuggestions(transactions, rules), [transactions, rules]);
  const merchantMatches = useMemo(() => (isOpen ? matchMerchants(allMerchants, value) : []), [isOpen, allMerchants, value]);

  const pick = (name: string, category?: string) => {
    onChange(name);
    if (onPickCategory && category) {
      onPickCategory(category);
    }
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || merchantMatches.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(index => (index < merchantMatches.length - 1 ? index + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(index => (index > 0 ? index - 1 : merchantMatches.length - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      pick(merchantMatches[activeIndex].name, merchantMatches[activeIndex].category);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      setIsOpen(false);
    }
  };

  return (
    <div className={cn('relative', className)}>
      {label && <label className="type-label mb-1.5 block text-ink">{label}</label>}
      <div className="relative flex items-center">
        <span className="pointer-events-none absolute left-3 z-1 flex size-6 shrink-0 items-center justify-center">
          {merchantLogo ? (
            <LogoTile
              url={merchantLogo}
              label={value}
              size={24}
              rounded="md"
              fallbackIcon="store-01"
            />
          ) : (
            <Icon name="store-01" size={18} className="text-muted" />
          )}
        </span>
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={isOpen && merchantMatches.length > 0}
          aria-autocomplete="list"
          autoComplete="off"
          autoFocus={autoFocus}
          value={value}
          placeholder={placeholder}
          onChange={e => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (closeTimerRef.current) {
              window.clearTimeout(closeTimerRef.current);
            }
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onBlur={() => {
            closeTimerRef.current = window.setTimeout(() => setIsOpen(false), 200);
          }}
          onKeyDown={onKeyDown}
          className={cn(
            controlStyles,
            'h-11 pl-11 pr-9 text-[.9375rem] font-medium max-md:h-12 max-md:text-base',
            error && 'border-negative ring-1 ring-negative'
          )}
        />
        {value.trim() && (
          <button
            type="button"
            aria-label="Clear merchant"
            onMouseDown={e => {
              e.preventDefault();
              onChange('');
              inputRef.current?.focus();
            }}
            className="absolute right-3 z-1 flex size-5 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:text-ink"
          >
            <Icon name="close" size={14} />
          </button>
        )}
      </div>

      {help && !error && <p className="type-caption mt-1 text-muted">{help}</p>}
      {error && <p className="type-caption mt-1 text-negative">{error}</p>}

      {isOpen && merchantMatches.length > 0 && (
        <ul
          role="listbox"
          aria-label="Merchants"
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-[var(--radius-lg)] border border-line bg-solid p-1.5 shadow-lg"
        >
          {merchantMatches.map((item, index) => {
            const logo = getMerchantLogoUrl(item.name, brandfetchClientId, logoOverrides, {
              fallback: 'lettermark',
              type: 'icon',
              width: 64,
              height: 64,
            });
            return (
              <li key={item.name} role="option" aria-selected={index === activeIndex}>
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => pick(item.name, item.category)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    'flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 text-left pointer-coarse:min-h-12',
                    index === activeIndex && 'bg-inset'
                  )}
                >
                  <LogoTile url={logo} label={item.name} size={24} fallbackIcon="store-01" />
                  <span className="type-body min-w-0 flex-1 truncate text-ink">{item.name}</span>
                  {item.category && <span className="type-caption shrink-0 text-muted">{item.category}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default MerchantPicker;
