import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from './useDebounce';

export interface AddressData {
  id: string;
  title: string;             // Primary title (e.g. "IKEA" or "Weiveldlaan 19")
  subtitle: string;          // Secondary address detail (e.g. "Weiveldlaan 19, 1930 Zaventem, Belgium")
  formattedAddress: string;  // Complete full address (e.g. "IKEA, Weiveldlaan 19, 1930 Zaventem, Belgium")
  placeName?: string;        // Business / Venue name (e.g. "IKEA")
  street?: string;           // Street name + number (e.g. "Weiveldlaan 19")
  streetName?: string;       // Street name without number (e.g. "Weiveldlaan")
  houseNumber?: string;      // House / Building number (e.g. "19")
  postalCode?: string;       // Postal code / ZIP (e.g. "1930")
  city: string;              // City / Municipality (e.g. "Zaventem")
  state?: string;            // State / Province / Region
  country: string;           // Country (e.g. "Belgium")
  countryCode?: string;      // 2-letter ISO code
  category: 'business' | 'building' | 'street' | 'area' | 'city';
  lat: number;
  lon: number;
}

// In-memory query cache for instant responses on repeated searches
const ADDRESS_CACHE = new Map<string, AddressData[]>();
const MAX_CACHE_SIZE = 120;

/**
 * Categorizes the result type from OSM properties
 */
function determineCategory(props: any): 'business' | 'building' | 'street' | 'area' | 'city' {
  const osmKey = (props.osm_key || '').toLowerCase();
  const osmValue = (props.osm_value || '').toLowerCase();
  const type = (props.type || '').toLowerCase();

  if (['shop', 'amenity', 'commercial', 'tourism', 'leisure', 'craft', 'office', 'healthcare'].includes(osmKey)) {
    return 'business';
  }
  if (['building', 'house', 'apartments', 'residential', 'industrial'].includes(osmValue) || props.housenumber) {
    return 'building';
  }
  if (['highway', 'street', 'road', 'track'].includes(osmKey) || type === 'street') {
    return 'street';
  }
  if (['city', 'town', 'village', 'hamlet', 'municipality'].includes(osmValue) || type === 'city' || type === 'town') {
    return 'city';
  }
  return 'area';
}

/**
 * Formats a clean street line with house number
 */
function buildStreetLine(street?: string, houseNumber?: string): string {
  if (!street && !houseNumber) return '';
  if (street && houseNumber) return `${street} ${houseNumber}`;
  return street || houseNumber || '';
}

/**
 * Builds structured AddressData from Photon GeoJSON feature
 */
function parsePhotonFeature(feature: any): AddressData | null {
  const props = feature.properties || {};
  const coords = feature.geometry?.coordinates || [0, 0];
  const lon = Number(coords[0]);
  const lat = Number(coords[1]);

  if (!lat || !lon) return null;

  const rawName = (props.name || '').trim();
  const streetName = (props.street || '').trim();
  const houseNumber = (props.housenumber || '').trim();
  const postalCode = (props.postcode || '').trim();
  const city = (props.city || props.town || props.village || props.municipality || props.county || '').trim();
  const state = (props.state || '').trim();
  const country = (props.country || '').trim();
  const countryCode = (props.countrycode || '').toUpperCase();

  const streetLine = buildStreetLine(streetName, houseNumber);
  const cityLine = [postalCode, city].filter(Boolean).join(' ');
  const category = determineCategory(props);

  // Distinguish business / POI from plain street address
  const isNamedPlace = rawName && rawName.toLowerCase() !== streetName.toLowerCase() && rawName.toLowerCase() !== city.toLowerCase();
  const placeName = isNamedPlace ? rawName : undefined;

  let title = '';
  let subtitle = '';

  if (placeName) {
    title = placeName;
    subtitle = [streetLine, cityLine, country].filter(Boolean).join(', ');
  } else if (streetLine) {
    title = streetLine;
    subtitle = [cityLine, state, country].filter(Boolean).join(', ');
  } else if (city) {
    title = cityLine || city;
    subtitle = [state, country].filter(Boolean).join(', ');
  } else {
    title = rawName || country || 'Unknown Location';
    subtitle = [state, country].filter(Boolean).join(', ');
  }

  const formattedAddress = [
    placeName,
    streetLine,
    cityLine,
    country
  ].filter(Boolean).join(', ') || title;

  const id = `${lat.toFixed(5)}:${lon.toFixed(5)}:${title.toLowerCase()}`;

  return {
    id,
    title,
    subtitle: subtitle || country,
    formattedAddress,
    placeName,
    street: streetLine || undefined,
    streetName: streetName || undefined,
    houseNumber: houseNumber || undefined,
    postalCode: postalCode || undefined,
    city: city || rawName || 'Unknown City',
    state: state || undefined,
    country: country || 'Unknown Country',
    countryCode: countryCode || undefined,
    category,
    lat,
    lon,
  };
}

/**
 * Builds structured AddressData from Nominatim JSON result
 */
function parseNominatimItem(item: any): AddressData | null {
  const addr = item.address || {};
  const lat = parseFloat(item.lat);
  const lon = parseFloat(item.lon);

  if (isNaN(lat) || isNaN(lon)) return null;

  const rawName = (item.name || addr.shop || addr.amenity || addr.building || '').trim();
  const streetName = (addr.road || addr.street || addr.pedestrian || '').trim();
  const houseNumber = (addr.house_number || '').trim();
  const postalCode = (addr.postcode || '').trim();
  const city = (addr.city || addr.town || addr.village || addr.municipality || addr.suburb || '').trim();
  const state = (addr.state || '').trim();
  const country = (addr.country || '').trim();
  const countryCode = (addr.country_code || '').toUpperCase();

  const streetLine = buildStreetLine(streetName, houseNumber);
  const cityLine = [postalCode, city].filter(Boolean).join(' ');

  const isNamedPlace = rawName && rawName.toLowerCase() !== streetName.toLowerCase() && rawName.toLowerCase() !== city.toLowerCase();
  const placeName = isNamedPlace ? rawName : undefined;

  let title = '';
  let subtitle = '';

  if (placeName) {
    title = placeName;
    subtitle = [streetLine, cityLine, country].filter(Boolean).join(', ');
  } else if (streetLine) {
    title = streetLine;
    subtitle = [cityLine, state, country].filter(Boolean).join(', ');
  } else if (city) {
    title = cityLine || city;
    subtitle = [state, country].filter(Boolean).join(', ');
  } else {
    title = rawName || item.display_name?.split(',')[0] || 'Unknown Location';
    subtitle = item.display_name || country;
  }

  const formattedAddress = [
    placeName,
    streetLine,
    cityLine,
    country
  ].filter(Boolean).join(', ') || item.display_name || title;

  const id = `${lat.toFixed(5)}:${lon.toFixed(5)}:${title.toLowerCase()}`;

  let category: 'business' | 'building' | 'street' | 'area' | 'city' = 'area';
  if (item.class === 'shop' || item.class === 'amenity' || item.class === 'tourism' || item.class === 'leisure' || addr.shop || addr.amenity) {
    category = 'business';
  } else if (item.class === 'building' || addr.house_number) {
    category = 'building';
  } else if (item.class === 'highway' || addr.road) {
    category = 'street';
  } else if (item.class === 'place' && (item.type === 'city' || item.type === 'town' || item.type === 'village')) {
    category = 'city';
  }

  return {
    id,
    title,
    subtitle: subtitle || country,
    formattedAddress,
    placeName,
    street: streetLine || undefined,
    streetName: streetName || undefined,
    houseNumber: houseNumber || undefined,
    postalCode: postalCode || undefined,
    city: city || rawName || 'Unknown City',
    state: state || undefined,
    country: country || 'Unknown Country',
    countryCode: countryCode || undefined,
    category,
    lat,
    lon,
  };
}

/**
 * Deduplicates results by coordinate closeness and formatted address
 */
function deduplicateAddressResults(items: AddressData[]): AddressData[] {
  const seenKeys = new Set<string>();
  const uniqueList: AddressData[] = [];

  for (const item of items) {
    if (!item) continue;
    // Proximity key rounded to ~15 meters
    const coordKey = `${item.lat.toFixed(4)}:${item.lon.toFixed(4)}:${item.title.toLowerCase()}`;
    const nameKey = `${item.formattedAddress.toLowerCase()}`;

    if (!seenKeys.has(coordKey) && !seenKeys.has(nameKey)) {
      seenKeys.add(coordKey);
      seenKeys.add(nameKey);
      uniqueList.push(item);
    }
  }

  return uniqueList;
}

/**
 * Primary Geocoding Fetcher: Queries Photon API with Nominatim fallback
 */
export const fetchAddressSuggestions = async (query: string): Promise<AddressData[]> => {
  const cacheKey = query.trim().toLowerCase();
  if (ADDRESS_CACHE.has(cacheKey)) {
    return ADDRESS_CACHE.get(cacheKey)!;
  }

  let results: AddressData[] = [];

  // 1. Try Photon API (Ultra-fast search for POIs, streets, house numbers, and cities)
  try {
    const photonRes = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=10&lang=en`
    );
    if (photonRes.ok) {
      const data = await photonRes.json();
      if (data?.features?.length > 0) {
        results = data.features
          .map(parsePhotonFeature)
          .filter((item: AddressData | null): item is AddressData => Boolean(item));
      }
    }
  } catch (err) {
    // Silently proceed to fallback on network error
  }

  // 2. Fallback to Nominatim if Photon yields no results or fails
  if (results.length === 0) {
    try {
      const nomRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=10`,
        { headers: { 'User-Agent': 'CrystalApp/2.0' } }
      );
      if (nomRes.ok) {
        const raw = await nomRes.json();
        if (Array.isArray(raw)) {
          results = raw
            .map(parseNominatimItem)
            .filter((item: AddressData | null): item is AddressData => Boolean(item));
        }
      }
    } catch (err) {
      console.warn('Address geocoding fallback failed:', err);
    }
  }

  const deduplicated = deduplicateAddressResults(results);

  // Store in cache
  if (ADDRESS_CACHE.size >= MAX_CACHE_SIZE) {
    const firstKey = ADDRESS_CACHE.keys().next().value;
    if (firstKey) ADDRESS_CACHE.delete(firstKey);
  }
  ADDRESS_CACHE.set(cacheKey, deduplicated);

  return deduplicated;
};

export const useAddressSearch = (value: string, options?: { enabled?: boolean }) => {
  const debouncedValue = useDebounce(value, 250);
  const query = debouncedValue.trim();
  const isEnabled = (options?.enabled ?? true) && query.length >= 2;

  const queryResult = useQuery({
    queryKey: ['address-search', query],
    queryFn: () => fetchAddressSuggestions(query),
    enabled: isEnabled,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });

  const normalized = useMemo(() => {
    const entities: Record<string, AddressData> = {};
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
