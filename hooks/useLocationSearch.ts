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

// In-memory query cache for instant 0ms responses on repeated or backspaced searches
const SEARCH_CACHE = new Map<string, LocationData[]>();
const MAX_CACHE_SIZE = 100;

/**
 * Deduplicates and formats raw location records into unique City/Country pairs.
 */
function deduplicateLocations(items: LocationData[]): LocationData[] {
  const seenKeys = new Set<string>();
  const uniqueItems: LocationData[] = [];

  for (const item of items) {
    if (!item.city || !item.country) continue;

    const normalizedKey = `${item.city.trim().toLowerCase()}|${item.country.trim().toLowerCase()}`;
    if (!seenKeys.has(normalizedKey)) {
      seenKeys.add(normalizedKey);
      uniqueItems.push({
        ...item,
        id: normalizedKey,
        lat: Number(item.lat.toFixed(4)),
        lon: Number(item.lon.toFixed(4)),
      });
    }
  }

  return uniqueItems;
}

/**
 * Primary Geocoding Fetcher using Photon API (Komoot) with Nominatim fallback.
 * Photon is specifically optimized for instant, sub-50ms autocomplete search.
 */
const fetchLocationSuggestions = async (query: string): Promise<LocationData[]> => {
  const cacheKey = query.trim().toLowerCase();
  if (SEARCH_CACHE.has(cacheKey)) {
    return SEARCH_CACHE.get(cacheKey)!;
  }

  let results: LocationData[] = [];

  // 1. Try Photon API (Ultra-fast autocomplete)
  try {
    const photonRes = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=10&lang=en`
    );
    if (photonRes.ok) {
      const data = await photonRes.json();
      if (data?.features?.length > 0) {
        results = data.features
          .map((f: any) => {
            const props = f.properties || {};
            const coords = f.geometry?.coordinates || [0, 0];
            const city = props.city || props.town || props.name || props.county || '';
            const country = props.country || '';
            const state = props.state && props.state !== city ? props.state : '';
            const displayName = [city, state, country].filter(Boolean).join(', ');

            return {
              id: `${coords[1]}:${coords[0]}`,
              city,
              country,
              lat: coords[1],
              lon: coords[0],
              display_name: displayName,
            };
          })
          .filter((item: LocationData) => item.city && item.country);
      }
    }
  } catch (err) {
    // Silently fall back to Nominatim on network/CORS error
  }

  // 2. Fallback to Nominatim if Photon yields no results
  if (results.length === 0) {
    try {
      const nomRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=10`,
        { headers: { 'User-Agent': 'CrystalApp/2.0' } }
      );
      if (nomRes.ok) {
        const raw = await nomRes.json();
        results = raw
          .map((item: any) => {
            const city = item.address?.city || item.address?.town || item.address?.village || item.address?.hamlet || '';
            const country = item.address?.country || '';
            const state = item.address?.state && item.address?.state !== city ? item.address?.state : '';
            const displayName = [city, state, country].filter(Boolean).join(', ');

            return {
              id: `${item.lat}:${item.lon}`,
              city,
              country,
              lat: parseFloat(item.lat),
              lon: parseFloat(item.lon),
              display_name: displayName || item.display_name,
            };
          })
          .filter((item: LocationData) => item.city && item.country);
      }
    } catch (err) {
      console.warn('Geocoding fallback failed:', err);
    }
  }

  const deduplicated = deduplicateLocations(results);

  // Store in cache
  if (SEARCH_CACHE.size >= MAX_CACHE_SIZE) {
    const firstKey = SEARCH_CACHE.keys().next().value;
    if (firstKey) SEARCH_CACHE.delete(firstKey);
  }
  SEARCH_CACHE.set(cacheKey, deduplicated);

  return deduplicated;
};

export const useLocationSearch = (value: string) => {
  const debouncedValue = useDebounce(value, 250);
  const query = debouncedValue.trim();

  const queryResult = useQuery({
    queryKey: ['location-search', query],
    queryFn: () => fetchLocationSuggestions(query),
    enabled: query.length >= 2,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
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

