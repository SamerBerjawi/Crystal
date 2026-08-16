import { countries, type TCountryCode } from 'countries-list';
import { Transaction, User } from '../types';

export interface LocationMeta {
  flag: string;
  city: string;
  country: string;
  address?: string;
  placeName?: string;
  locationLabel?: string;
  latitude?: number;
  longitude?: number;
  formatted: string; // e.g. "🇧🇪 Brussels"
  fullDisplay: string; // e.g. "Brussels, Belgium"
  hasLocation: boolean;
}

// Convert 2-letter ISO country code to flag emoji
export function getFlagEmoji(countryCode?: string): string {
  if (!countryCode || countryCode.length !== 2) return '🌐';
  const uppercase = countryCode.toUpperCase();
  try {
    return String.fromCodePoint(127397 + uppercase.charCodeAt(0)) + String.fromCodePoint(127397 + uppercase.charCodeAt(1));
  } catch {
    return '🌐';
  }
}

const countryNameToCodeMap: Record<string, string> = {};
Object.entries(countries).forEach(([code, data]) => {
  const lowerCode = code.toLowerCase();
  countryNameToCodeMap[lowerCode] = lowerCode;
  countryNameToCodeMap[data.name.toLowerCase()] = lowerCode;
});

// Common country aliases
countryNameToCodeMap['usa'] = 'us';
countryNameToCodeMap['united states'] = 'us';
countryNameToCodeMap['united states of america'] = 'us';
countryNameToCodeMap['uk'] = 'gb';
countryNameToCodeMap['united kingdom'] = 'gb';
countryNameToCodeMap['great britain'] = 'gb';
countryNameToCodeMap['england'] = 'gb';
countryNameToCodeMap['uae'] = 'ae';
countryNameToCodeMap['united arab emirates'] = 'ae';
countryNameToCodeMap['south korea'] = 'kr';
countryNameToCodeMap['korea'] = 'kr';
countryNameToCodeMap['republic of korea'] = 'kr';
countryNameToCodeMap['germany'] = 'de';
countryNameToCodeMap['deutschland'] = 'de';
countryNameToCodeMap['france'] = 'fr';
countryNameToCodeMap['belgium'] = 'be';
countryNameToCodeMap['belgique'] = 'be';
countryNameToCodeMap['belgie'] = 'be';
countryNameToCodeMap['netherlands'] = 'nl';
countryNameToCodeMap['holland'] = 'nl';
countryNameToCodeMap['spain'] = 'es';
countryNameToCodeMap['espana'] = 'es';
countryNameToCodeMap['italy'] = 'it';
countryNameToCodeMap['italia'] = 'it';
countryNameToCodeMap['switzerland'] = 'ch';
countryNameToCodeMap['sweden'] = 'se';
countryNameToCodeMap['norway'] = 'no';
countryNameToCodeMap['denmark'] = 'dk';
countryNameToCodeMap['finland'] = 'fi';
countryNameToCodeMap['ireland'] = 'ie';
countryNameToCodeMap['portugal'] = 'pt';
countryNameToCodeMap['austria'] = 'at';
countryNameToCodeMap['poland'] = 'pl';
countryNameToCodeMap['romania'] = 'ro';
countryNameToCodeMap['canada'] = 'ca';
countryNameToCodeMap['japan'] = 'jp';
countryNameToCodeMap['australia'] = 'au';
countryNameToCodeMap['singapore'] = 'sg';
countryNameToCodeMap['china'] = 'cn';
countryNameToCodeMap['brazil'] = 'br';
countryNameToCodeMap['india'] = 'in';

export function getCountryCodeAndFlag(countryInput?: string): { code: string; flag: string; countryName: string } {
  if (!countryInput) {
    return { code: '', flag: '🌐', countryName: '' };
  }
  const normalized = countryInput.trim().toLowerCase();
  const code = countryNameToCodeMap[normalized];
  if (code && countries[code.toUpperCase() as TCountryCode]) {
    const data = countries[code.toUpperCase() as TCountryCode];
    return {
      code,
      flag: getFlagEmoji(code),
      countryName: data.name,
    };
  }
  if (normalized.length === 2) {
    const uppercase = normalized.toUpperCase() as TCountryCode;
    const data = countries[uppercase];
    return {
      code: normalized,
      flag: getFlagEmoji(normalized),
      countryName: data ? data.name : countryInput,
    };
  }
  return { code: '', flag: '🌐', countryName: countryInput };
}

export function formatTransactionLocation(tx?: Partial<Transaction> | null, _user?: User | null): LocationMeta {
  if (!tx) {
    return { flag: '', city: '', country: '', formatted: '', fullDisplay: '', hasLocation: false };
  }

  let city = (tx.city || '').trim();
  let country = (tx.country || '').trim();

  // If location string is present (e.g. "Brussels, Belgium")
  if ((!city || !country) && (tx as any).location) {
    const locStr = String((tx as any).location).trim();
    if (locStr.includes(',')) {
      const parts = locStr.split(',').map(s => s.trim());
      if (!city) city = parts[0] || '';
      if (!country) country = parts[1] || '';
    } else if (!city) {
      city = locStr;
    }
  }

  // If transaction has no explicit location set, do not invent one
  if (!city && !country && !tx.address && tx.latitude === undefined) {
    return {
      flag: '',
      city: '',
      country: '',
      formatted: '',
      fullDisplay: '',
      hasLocation: false,
    };
  }

  if (!country && city) {
    // If only city is given, infer common country
    const cityLower = city.toLowerCase();
    if (['brussels', 'antwerp', 'ghent', 'bruges', 'liege', 'namur', 'leuven'].includes(cityLower)) {
      country = 'Belgium';
    } else if (['paris', 'lyon', 'marseille', 'nice', 'bordeaux'].includes(cityLower)) {
      country = 'France';
    } else if (['london', 'manchester', 'birmingham', 'edinburgh'].includes(cityLower)) {
      country = 'United Kingdom';
    } else if (['new york', 'san francisco', 'los angeles', 'chicago', 'seattle', 'austin', 'boston'].includes(cityLower)) {
      country = 'United States';
    } else if (['berlin', 'munich', 'frankfurt', 'hamburg'].includes(cityLower)) {
      country = 'Germany';
    } else if (['amsterdam', 'rotterdam', 'utrecht', 'the hague'].includes(cityLower)) {
      country = 'Netherlands';
    }
  }

  const { flag, countryName } = getCountryCodeAndFlag(country);
  const finalCountry = countryName || country;
  const mainLabel = tx.locationLabel || tx.placeName || city;
  const formatted = flag ? `${flag} ${mainLabel}` : mainLabel;
  const fullDisplay = tx.address || (finalCountry ? (city ? `${city}, ${finalCountry}` : finalCountry) : city);

  return {
    flag: flag || '📍',
    city,
    country: finalCountry,
    address: tx.address,
    placeName: tx.placeName,
    locationLabel: tx.locationLabel,
    latitude: tx.latitude,
    longitude: tx.longitude,
    formatted,
    fullDisplay,
    hasLocation: true,
  };
}
