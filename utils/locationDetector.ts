/**
 * Fast offline location detection algorithm for transactions and merchants.
 * Parses transaction text/descriptions and returns normalized city and country if detected.
 */

export interface DetectedLocation {
  city: string;
  country: string;
  confidence: number;
}

// Common country mappings (ISO2, ISO3, full names, common abbreviations)
const COUNTRY_MAP: Record<string, string> = {
  US: 'United States',
  USA: 'United States',
  UK: 'United Kingdom',
  GB: 'United Kingdom',
  GBR: 'United Kingdom',
  CA: 'Canada',
  CAN: 'Canada',
  FR: 'France',
  FRA: 'France',
  DE: 'Germany',
  DEU: 'Germany',
  NL: 'Netherlands',
  NLD: 'Netherlands',
  IT: 'Italy',
  ITA: 'Italy',
  ES: 'Spain',
  ESP: 'Spain',
  AU: 'Australia',
  AUS: 'Australia',
  JP: 'Japan',
  JPN: 'Japan',
  CH: 'Switzerland',
  CHE: 'Switzerland',
  AE: 'United Arab Emirates',
  UAE: 'United Arab Emirates',
  SG: 'Singapore',
  SGP: 'Singapore',
  HK: 'Hong Kong',
  HKG: 'Hong Kong',
  LU: 'Luxembourg',
  LUX: 'Luxembourg',
  RO: 'Romania',
  ROU: 'Romania',
};

// Common global cities mapped to city & country
const POPULAR_CITIES: Array<{ city: string; country: string; aliases: string[] }> = [
  { city: 'London', country: 'United Kingdom', aliases: ['london', 'lndn'] },
  { city: 'Paris', country: 'France', aliases: ['paris', 'prs'] },
  { city: 'New York', country: 'United States', aliases: ['new york', 'nyc', 'ny'] },
  { city: 'San Francisco', country: 'United States', aliases: ['san francisco', 'sf'] },
  { city: 'Los Angeles', country: 'United States', aliases: ['los angeles', 'la'] },
  { city: 'Berlin', country: 'Germany', aliases: ['berlin'] },
  { city: 'Munich', country: 'Germany', aliases: ['munich', 'muenchen', 'münchen'] },
  { city: 'Tokyo', country: 'Japan', aliases: ['tokyo', 'tky'] },
  { city: 'Sydney', country: 'Australia', aliases: ['sydney', 'syd'] },
  { city: 'Amsterdam', country: 'Netherlands', aliases: ['amsterdam', 'ams'] },
  { city: 'Toronto', country: 'Canada', aliases: ['toronto', 'to'] },
  { city: 'Singapore', country: 'Singapore', aliases: ['singapore', 'sg'] },
  { city: 'Dubai', country: 'United Arab Emirates', aliases: ['dubai', 'dxb'] },
  { city: 'Zurich', country: 'Switzerland', aliases: ['zurich', 'zürich'] },
  { city: 'Hong Kong', country: 'Hong Kong', aliases: ['hong kong', 'hk'] },
  { city: 'Bucharest', country: 'Romania', aliases: ['bucharest', 'bucuresti'] },
  { city: 'Rome', country: 'Italy', aliases: ['rome', 'roma'] },
  { city: 'Madrid', country: 'Spain', aliases: ['madrid'] },
  { city: 'Barcelona', country: 'Spain', aliases: ['barcelona', 'bcn'] },
  { city: 'Vienna', country: 'Austria', aliases: ['vienna', 'wien'] },
];

/**
 * Detects location (city and country) from transaction description or merchant name.
 * Uses regex patterns and predefined city/country indexes for instant, zero-latency detection.
 */
export function detectLocationFromText(text: string): DetectedLocation | null {
  if (!text || text.trim().length < 3) return null;

  const normalized = text.trim();

  // Pattern 1: City, Country Code (e.g. "Paris, FR" or "London GB" or "Uber * Trip San Francisco US")
  const cityCountryRegex = /(?:in|at|@)?\s*([A-Za-z\s]{3,20})[\s,]+([A-Z]{2,3})\b/i;
  const match = normalized.match(cityCountryRegex);
  if (match) {
    const rawCity = match[1].trim();
    const rawCountryCode = match[2].toUpperCase();
    const country = COUNTRY_MAP[rawCountryCode];

    if (country && rawCity.length >= 3) {
      // Check if rawCity matches a known city name
      const matchedCityObj = POPULAR_CITIES.find(
        c => c.city.toLowerCase() === rawCity.toLowerCase() || c.aliases.includes(rawCity.toLowerCase())
      );

      return {
        city: matchedCityObj ? matchedCityObj.city : capitalizeWords(rawCity),
        country: country,
        confidence: 0.9,
      };
    }
  }

  // Pattern 2: Search for known popular city aliases inside the text
  const lowerText = normalized.toLowerCase();
  for (const entry of POPULAR_CITIES) {
    for (const alias of entry.aliases) {
      const wordBoundaryRegex = new RegExp(`\\b${alias}\\b`, 'i');
      if (wordBoundaryRegex.test(lowerText)) {
        return {
          city: entry.city,
          country: entry.country,
          confidence: 0.8,
        };
      }
    }
  }

  return null;
}

/**
 * Parses any location string (e.g., "Paris, France" or "Brussels") into structured city and country fields.
 */
export function parseLocationString(rawLocation?: string): { city?: string; country?: string } {
  if (!rawLocation || !rawLocation.trim()) return {};

  const trimmed = rawLocation.trim();

  // Handle comma-separated formats like "Paris, France" or "San Francisco, CA, United States"
  if (trimmed.includes(',')) {
    const parts = trimmed.split(',').map(p => p.trim()).filter(Boolean);
    const city = parts[0];
    const rawCountry = parts.slice(1).join(', ');
    const mappedCountry = COUNTRY_MAP[rawCountry.toUpperCase()] || rawCountry;
    return {
      city: capitalizeWords(city),
      country: capitalizeWords(mappedCountry)
    };
  }

  // Check known popular cities index
  const lower = trimmed.toLowerCase();
  const matchedCity = POPULAR_CITIES.find(
    c => c.city.toLowerCase() === lower || c.aliases.includes(lower)
  );

  if (matchedCity) {
    return {
      city: matchedCity.city,
      country: matchedCity.country
    };
  }

  return {
    city: capitalizeWords(trimmed)
  };
}

function capitalizeWords(str: string): string {
  return str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
}
