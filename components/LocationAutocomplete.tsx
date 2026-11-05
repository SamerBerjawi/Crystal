import React, { useEffect, useMemo, useState } from 'react';
import { useLocationSearch, LocationData } from '../hooks/useLocationSearch';
import SuggestInput from './SuggestInput';

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string, locationData?: LocationData) => void;
  placeholder?: string;
  label?: string;
}

/** A city, picked from suggestions as you type. */
const LocationAutocomplete: React.FC<LocationAutocompleteProps> = ({ value, onChange, placeholder = 'City, country', label = 'City' }) => {
  const [inputValue, setInputValue] = useState(value);
  const [isActive, setIsActive] = useState(false);
  const { normalized, isFetching } = useLocationSearch(inputValue, { enabled: isActive });
  const results = useMemo(() => normalized.ids.map(id => normalized.entities[id]), [normalized]);

  useEffect(() => { setInputValue(value); }, [value]);

  const suggestions = useMemo(
    () => results.map(item => ({ id: item.id, title: [item.city, item.country].filter(Boolean).join(', '), subtitle: item.display_name })),
    [results]
  );

  return (
    <SuggestInput
      label={label}
      icon="city-01"
      placeholder={placeholder}
      value={inputValue}
      onType={text => { setInputValue(text); onChange(text, undefined); }}
      onPick={id => {
        const item = results.find(result => result.id === id);
        if (!item) return;
        const display = `${item.city}, ${item.country}`;
        setInputValue(display);
        onChange(display, item);
      }}
      onActiveChange={setIsActive}
      suggestions={suggestions}
      isFetching={isFetching}
    />
  );
};

export default LocationAutocomplete;
