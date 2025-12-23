
export type LogoType = 'icon' | 'logo' | 'symbol';
export type LogoFallback = 'brandfetch' | 'transparent' | 'lettermark' | '404';

const logoCache = new Map<string, string | null>();
const logoInFlight = new Map<string, Promise<string | null>>();

export const normalizeMerchantKey = (merchant?: string | null) => merchant?.trim().toLowerCase() || null;

export const buildMerchantIdentifier = (
  merchant?: string,
  overrides?: Record<string, string>,
): string | null => {
  const normalizedKey = normalizeMerchantKey(merchant);

  // 1. Check for manual override first (User defined mapping in Settings > Merchants)
  const override = normalizedKey ? overrides?.[normalizedKey] : undefined;

  if (override !== undefined) {
    const trimmed = override.trim();
    // If the user explicitly clears it or sets a name without a dot (e.g. "Amazon"),
    // we return null to force the Lettermark/Icon fallback.
    // If they set "amazon.com", we use it as the search query.
    if (trimmed.includes('.') && trimmed.length > 3) {
      return trimmed;
    }
    return null;
  }

  const base = merchant?.trim();
  if (!base) return null;

  return base;
};

const getSearchResults = (data: unknown): unknown[] => {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    const candidates = [record.results, record.brands, record.items, record.data];
    const arrayCandidate = candidates.find(Array.isArray);
    if (arrayCandidate && Array.isArray(arrayCandidate)) {
      return arrayCandidate;
    }
  }
  return [];
};

const pickLogoFromFormats = (formats: Array<Record<string, unknown>> | undefined) => {
  if (!formats || formats.length === 0) return null;
  const preferred = formats.find(format => (format.format as string | undefined)?.toLowerCase() === 'png')
    ?? formats.find(format => (format.format as string | undefined)?.toLowerCase() === 'svg')
    ?? formats[0];
  return typeof preferred?.src === 'string' ? preferred.src : null;
};

const pickLogoFromEntry = (entry: Record<string, unknown>, type: LogoType) => {
  const direct = entry[type] ?? entry[type.toLowerCase()];
  if (typeof direct === 'string') return direct;

  const logoCollections = [entry.logos, entry.images];
  for (const collection of logoCollections) {
    if (!Array.isArray(collection)) continue;
    const typed = collection.find(item => {
      if (!item || typeof item !== 'object') return false;
      return (item as Record<string, unknown>).type === type;
    }) as Record<string, unknown> | undefined;

    const fallback = (collection[0] as Record<string, unknown> | undefined) ?? undefined;
    const target = typed ?? fallback;
    if (target?.formats && Array.isArray(target.formats)) {
      const picked = pickLogoFromFormats(target.formats as Array<Record<string, unknown>>);
      if (picked) return picked;
    }
  }

  return null;
};

export const fetchMerchantLogoUrl = async (
  merchant: string | undefined,
  clientId: string | undefined,
  overrides?: Record<string, string>,
  options?: { width?: number; height?: number; type?: LogoType; fallback?: LogoFallback },
): Promise<string | null> => {
  if (!clientId) return null;
  const query = buildMerchantIdentifier(merchant, overrides);
  if (!query) return null;

  const type = options?.type ?? 'icon';
  const cacheKey = `${clientId}:${type}:${query.toLowerCase()}`;
  if (logoCache.has(cacheKey)) {
    return logoCache.get(cacheKey) ?? null;
  }
  if (logoInFlight.has(cacheKey)) {
    return logoInFlight.get(cacheKey)!;
  }

  const requestPromise = (async () => {
    try {
      const url = new URL(`https://api.brandfetch.io/v2/search/${encodeURIComponent(query)}`);
      url.searchParams.set('c', clientId);
      const response = await fetch(url.toString());
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      const results = getSearchResults(data);
      for (const result of results) {
        if (!result || typeof result !== 'object') continue;
        const picked = pickLogoFromEntry(result as Record<string, unknown>, type)
          ?? pickLogoFromEntry(result as Record<string, unknown>, 'logo')
          ?? pickLogoFromEntry(result as Record<string, unknown>, 'symbol');
        if (picked) return picked;
      }
      return null;
    } catch {
      return null;
    }
  })();

  logoInFlight.set(cacheKey, requestPromise);
  const resolved = await requestPromise;
  logoCache.set(cacheKey, resolved);
  logoInFlight.delete(cacheKey);
  return resolved;
};
