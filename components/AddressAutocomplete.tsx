import React, { useEffect, useMemo, useRef, useState } from 'react';
import { INPUT_BASE_STYLE } from '../constants';
import { useAddressSearch, AddressData } from '../hooks/useAddressSearch';
import Icon from './ui/Icon';

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string, addressData?: AddressData) => void;
  placeholder?: string;
  disabled?: boolean;
}

const CategoryBadge: React.FC<{ category: AddressData['category'] }> = ({ category }) => {
  switch (category) {
    case 'business':
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shrink-0">
          <Icon name="shopping_bag" className="text-[10px]" />
          <span>Business</span>
        </span>
      );
    case 'building':
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
          <Icon name="home" className="text-[10px]" />
          <span>Building</span>
        </span>
      );
    case 'street':
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
          <Icon name="marker_pin" className="text-[10px]" />
          <span>Street</span>
        </span>
      );
    case 'city':
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shrink-0">
          <Icon name="globe" className="text-[10px]" />
          <span>City</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
          <Icon name="map" className="text-[10px]" />
          <span>Area</span>
        </span>
      );
  }
};

const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value,
  onChange,
  placeholder = 'e.g. IKEA Zaventem or Weiveldlaan 19, 1930 Zaventem',
  disabled = false
}) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { normalized, isFetching } = useAddressSearch(inputValue, { enabled: isFocused });

  const suggestions = useMemo(() => {
    return normalized.ids.map((id) => normalized.entities[id]);
  }, [normalized]);

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  useEffect(() => {
    const query = inputValue.trim();
    if (!isFocused || query.length < 2) {
      setIsOpen(false);
      setHighlightedIndex(-1);
      return;
    }

    if (suggestions.length > 0) {
      setIsOpen(true);
    }
  }, [inputValue, suggestions.length, isFocused]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsFocused(false);
        setHighlightedIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    setIsFocused(true);
    setHighlightedIndex(-1);
    onChange(val, undefined);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setInputValue('');
    onChange('', undefined);
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  const handleSelect = (item: AddressData) => {
    setInputValue(item.formattedAddress);
    onChange(item.formattedAddress, item);
    setIsOpen(false);
    setIsFocused(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        e.preventDefault();
        handleSelect(suggestions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          onFocus={() => {
            setIsFocused(true);
            if (inputValue.trim().length >= 2 && suggestions.length > 0) setIsOpen(true);
          }}
          className={`${INPUT_BASE_STYLE} pl-9 pr-14 h-10 font-medium text-xs`}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
        />
        <Icon
          name="marker_pin"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-500 text-sm pointer-events-none"
        />

        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {isFetching && (
            <svg
              className="animate-spin h-3.5 w-3.5 text-primary-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          )}
          {inputValue && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              title="Clear address"
              aria-label="Clear address"
            >
              <Icon name="close" className="text-xs" />
            </button>
          )}
        </div>
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute top-full left-0 mt-1.5 w-full bg-white dark:bg-[#18181b] rounded-2xl shadow-2xl border border-black/10 dark:border-white/10 z-[80] max-h-60 overflow-y-auto py-1.5 custom-scrollbar divide-y divide-black/5 dark:divide-white/5">
          {suggestions.map((item, index) => {
            const isSelected = highlightedIndex === index;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`w-full text-left px-3.5 py-2.5 text-xs transition-colors flex items-start gap-2.5 cursor-pointer ${
                  isSelected
                    ? 'bg-primary-500/10 dark:bg-primary-500/15 text-primary-600 dark:text-primary-400'
                    : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04] text-light-text dark:text-dark-text'
                }`}
              >
                <div className="pt-0.5 shrink-0">
                  <CategoryBadge category={item.category} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-xs truncate leading-tight">
                      {item.title}
                    </p>
                    {item.country && (
                      <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary opacity-60 shrink-0">
                        • {item.country}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary truncate mt-0.5 opacity-80 leading-normal">
                    {item.subtitle}
                  </p>
                  <p className="text-[9px] font-mono text-light-text-secondary dark:text-dark-text-secondary opacity-50 mt-0.5">
                    {item.lat.toFixed(4)}°, {item.lon.toFixed(4)}°
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
