
export type LogoType = 'icon' | 'logo' | 'symbol';
export type LogoFallback = 'brandfetch' | 'transparent' | 'lettermark' | '404';

const ALLOWED_TLDS = ['.com', '.net', '.org', '.co.uk', '.be', '.de', '.fr'];

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
    // If they set "amazon.com", we use it.
    if (trimmed.includes('.') && trimmed.length > 3) {
        return trimmed;
    }
    return null;
  }

  const base = normalizedKey;
  if (!base) return null;

  // 2. Sanitize: Remove special chars but keep dots and hyphens for domains
  const sanitized = base.replace(/[^a-z0-9.-]/g, '');
  if (!sanitized) return null;

  // 3. Strict Check: Only return if it ends with a known TLD.
  // This prevents "Joe's" from becoming a domain, but allows "amazon.de" or "slack.com".
  const hasAllowedTLD = ALLOWED_TLDS.some(tld => sanitized.endsWith(tld));

  if (hasAllowedTLD) {
     return sanitized;
  }

  return null;
};

export const getMerchantLogoUrl = (
  merchant: string | undefined,
  clientId: string | undefined,
  overrides?: Record<string, string>,
  options?: { width?: number; height?: number; type?: LogoType; fallback?: LogoFallback },
): string | null => {
  if (!clientId) return null;
  const identifier = buildMerchantIdentifier(merchant, overrides);
  if (!identifier) return null;

  const width = options?.width ?? 80;
  const height = options?.height ?? 80;
  const type = options?.type ?? 'icon';
  const fallback = options?.fallback ?? 'lettermark';

  const params = new URLSearchParams({
    c: clientId,
    type,
    fallback,
    h: String(height),
    w: String(width),
  });

  return `https://cdn.brandfetch.io/${encodeURIComponent(identifier)}?${params.toString()}`;
};
