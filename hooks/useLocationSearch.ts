import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from './useDebounce';

export interface LocationData {
  id: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  display_name: string;
}

const fetchLocationSuggestions = async (query: string): Promise<LocationData[]> => {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch location suggestions');
  }

  const raw = await response.json();
  return raw
    .map((item: any) => ({
      id: `${item.lat}:${item.lon}`,
      city: item.address.city || item.address.town || item.address.village || item.address.hamlet || '',
      country: item.address.country || '',
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      display_name: item.display_name,
    }))
    .filter((item: LocationData) => item.city && item.country);
};

export const useLocationSearch = (value: string) => {
  const debouncedValue = useDebounce(value, 500);
  const query = debouncedValue.trim();

  const queryResult = useQuery({
    queryKey: ['location-search', query],
    queryFn: () => fetchLocationSuggestions(query),
    enabled: query.length >= 3,
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    retry: 1,
  });

  const normalized = useMemo(() => {
    const entities: Record<string, LocationData> = {};
    const ids: string[] = [];

    (queryResult.data || []).forEach((item) => {
      if (!entities[item.id]) {
        entities[item.id] = item;
        ids.push(item.id);
      }
    });

    return { ids, entities };
  }, [queryResult.data]);

  return { ...queryResult, normalized };
};
