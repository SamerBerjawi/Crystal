import React, { useEffect, useMemo, useState } from 'react';
import { useAddressSearch, AddressData } from '../hooks/useAddressSearch';
import SuggestInput from './SuggestInput';

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string, addressData?: AddressData) => void;
  placeholder?: string;
  disabled?: boolean;
}

const KINDS: Record<string, { kind: string; icon: string }> = {
  business: { kind: 'Business', icon: 'store-01' },
  building: { kind: 'Building', icon: 'building-03' },
  street: { kind: 'Street', icon: 'road' },
  city: { kind: 'City', icon: 'city-01' },
};

const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value,
  onChange,
  placeholder = 'Search an address, shop or area',
  disabled = false
}) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [isActive, setIsActive] = useState(false);
  const { normalized, isFetching } = useAddressSearch(inputValue, { enabled: isActive });
  const results = useMemo(() => normalized.ids.map(id => normalized.entities[id]), [normalized]);

  useEffect(() => { setInputValue(value || ''); }, [value]);

  const suggestions = useMemo(() => results.map(item => {
    const kind = KINDS[item.category] ?? { kind: 'Area', icon: 'maps' };
    return { id: item.id, title: item.title, subtitle: [item.subtitle, item.country].filter(Boolean).join(', '), kind: kind.kind, icon: kind.icon };
  }), [results]);

  return (
    <SuggestInput
      label="Address"
      icon="location-01"
      placeholder={placeholder}
      disabled={disabled}
      value={inputValue}
      onType={text => { setInputValue(text); onChange(text, undefined); }}
      onPick={id => {
        const item = results.find(result => result.id === id);
        if (!item) return;
        setInputValue(item.formattedAddress);
        onChange(item.formattedAddress, item);
      }}
      onActiveChange={setIsActive}
      suggestions={suggestions}
      isFetching={isFetching}
    />
  );
};

export default AddressAutocomplete;
