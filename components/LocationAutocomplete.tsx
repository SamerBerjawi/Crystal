
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { INPUT_BASE_STYLE } from '../constants';
import { useLocationSearch, LocationData } from '../hooks/useLocationSearch';
import Icon from './ui/Icon';

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string, locationData?: LocationData) => void;
  placeholder?: string;
}

const LocationAutocomplete: React.FC<LocationAutocompleteProps> = ({ value, onChange, placeholder = "City, Country" }) => {
  const [inputValue, setInputValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const { normalized, isFetching } = useLocationSearch(inputValue, { enabled: isFocused });

  const suggestions = useMemo(() => {
    return normalized.ids.map((id) => normalized.entities[id]);
  }, [normalized]);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const query = inputValue.trim();
    if (!isFocused || query.length < 2) {
      setIsOpen(false);
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
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setIsFocused(true);
    // Pass raw value immediately, clear location data until selected
    onChange(e.target.value, undefined); 
  };

  const handleSelect = (item: LocationData) => {
    const display = `${item.city}, ${item.country}`;
    setInputValue(display);
    onChange(display, item);
    setIsOpen(false);
    setIsFocused(false);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
         <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={() => {
              setIsFocused(true);
              if (inputValue.trim().length >= 2 && suggestions.length > 0) setIsOpen(true);
            }}
            className={`${INPUT_BASE_STYLE} pl-9 h-10 font-bold text-sm`}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
         />
         <Icon name="location_on" className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-500 text-base pointer-events-none" />
         {isFetching && (
             <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                 <svg className="animate-spin h-4 w-4 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
             </div>
         )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute top-full left-0 mt-1.5 w-full bg-white/95 dark:bg-dark-card/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-black/10 dark:border-white/10 z-[70] max-h-48 overflow-y-auto py-1 custom-scrollbar">
            {suggestions.map((item, index) => (
                <button
                    key={index}
                    type="button"
                    onClick={() => handleSelect(item)}
                    className="w-full text-left px-3.5 py-2 text-xs hover:bg-black/5 dark:hover:bg-white/5 text-light-text dark:text-dark-text border-b border-black/5 dark:border-white/5 last:border-0 font-medium flex items-center gap-2 transition-colors"
                >
                    <Icon name="location_on" className="text-gray-400 text-xs shrink-0" />
                    <span className="truncate">{item.display_name}</span>
                </button>
            ))}
        </div>
      )}
    </div>
  );
};

export default LocationAutocomplete;
