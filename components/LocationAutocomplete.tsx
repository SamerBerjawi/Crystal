
import React, { useState, useEffect, useRef } from 'react';
import { INPUT_BASE_STYLE } from '../constants';
import { useDebounce } from '../hooks/useDebounce';

interface LocationData {
  city: string;
  country: string;
  lat: number;
  lon: number;
  display_name: string;
}

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string, locationData?: LocationData) => void;
  placeholder?: string;
}

const LocationAutocomplete: React.FC<LocationAutocompleteProps> = ({ value, onChange, placeholder = "City, Country" }) => {
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<LocationData[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const debouncedInputValue = useDebounce(inputValue, 500);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      const query = debouncedInputValue.trim();
      if (query.length < 3) {
        setSuggestions([]);
        setIsOpen(false);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5`
        );
        if (response.ok) {
          const data = await response.json();
          const mapped: LocationData[] = data.map((item: any) => ({
            city: item.address.city || item.address.town || item.address.village || item.address.hamlet || '',
            country: item.address.country || '',
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
            display_name: item.display_name,
          })).filter((item: LocationData) => item.city && item.country); // Ensure valid data
          setSuggestions(mapped);
          setIsOpen(true);
        }
      } catch (error) {
        console.error("Failed to fetch locations", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuggestions();
  }, [debouncedInputValue]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    // Pass raw value immediately, clear location data until selected
    onChange(e.target.value, undefined); 
  };

  const handleSelect = (item: LocationData) => {
    const display = `${item.city}, ${item.country}`;
    setInputValue(display);
    onChange(display, item);
    setIsOpen(false);
    setSuggestions([]);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
         <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            className={`${INPUT_BASE_STYLE} pl-9`}
            placeholder={placeholder}
         />
         <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none">
            location_on
         </span>
         {isLoading && (
             <div className="absolute right-3 top-1/2 -translate-y-1/2">
                 <svg className="animate-spin h-4 w-4 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
             </div>
         )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute top-full left-0 mt-1 w-full bg-light-card dark:bg-dark-card rounded-lg shadow-lg border border-black/10 dark:border-white/10 z-50 max-h-48 overflow-y-auto">
            {suggestions.map((item, index) => (
                <button
                    key={index}
                    type="button"
                    onClick={() => handleSelect(item)}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5 text-light-text dark:text-dark-text border-b border-black/5 dark:border-white/5 last:border-0"
                >
                    {item.display_name}
                </button>
            ))}
        </div>
      )}
    </div>
  );
};

export default LocationAutocomplete;
