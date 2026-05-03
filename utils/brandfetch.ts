
export type LogoType = 'icon' | 'logo' | 'symbol';
export type LogoFallback = 'brandfetch' | 'transparent' | 'lettermark' | '404';

export const normalizeMerchantKey = (merchant?: string | null) => merchant?.trim().toLowerCase() || null;

export const buildMerchantIdentifier = (
  merchant?: string,
  overrides?: Record<string, string>,
): string | null => {
  const normalizedKey = normalizeMerchantKey(merchant);
  
  // 1. Check for manual override first (User defined mapping in Settings > Merchants)
  const override = normalizedKey ? overrides?.[normalizedKey] : undefined;

  if (override !== undefined) {
    const trimmed = override.trim().toLowerCase();
    // If the user explicitly clears it or sets a name without a dot (e.g. "Amazon"), 
    // we return null to force the Lettermark/Icon fallback.
    if (trimmed.includes('.') && trimmed.length > 3) {
        // Strip protocols and www if present in override
        return trimmed.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');
    }
    return null;
  }

  const base = normalizedKey;
  if (!base) return null;

  // 2. Support searching for domains within the merchant name
  // Split by common separators to find something that looks like a domain
  const chunks = base.split(/[\s*|/]/);
  for (const chunk of chunks) {
      // Basic sanitization for the chunk
      const sanitized = chunk.replace(/[^a-z0-9.-]/g, '');
      if (sanitized.length < 4) continue;

      const parts = sanitized.split('.');
      if (parts.length > 1) {
          const lastPart = parts[parts.length - 1];
          // Check if it looks like a valid TLD (2-12 characters)
          if (/^[a-z]{2,12}$/.test(lastPart)) {
              return sanitized;
          }
      }
  }

  // 3. Fallback: Entire sanitized name if it looks like it could be a domain 
  // (though the loop above usually catches it)
  const sanitizedAll = base.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0].replace(/[^a-z0-9.-]/g, '');
  const partsAll = sanitizedAll.split('.');
  if (partsAll.length > 1 && /^[a-z]{2,12}$/.test(partsAll[partsAll.length - 1])) {
      return sanitizedAll;
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

  const today = new Date().toISOString().split('T')[0];
  const params = new URLSearchParams({
    c: clientId,
    type,
    fallback,
    h: String(height),
    w: String(width),
    v: today,
  });

  return `https://cdn.brandfetch.io/${encodeURIComponent(identifier)}?${params.toString()}`;
};
