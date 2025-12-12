export type LogoType = 'icon' | 'logo' | 'symbol';
export type LogoFallback = 'brandfetch' | 'transparent' | 'lettermark' | '404';

export const normalizeMerchantKey = (merchant?: string | null) => merchant?.trim().toLowerCase() || null;

export const buildMerchantIdentifier = (
  merchant?: string,
  overrides?: Record<string, string>,
): string | null => {
  const normalizedKey = normalizeMerchantKey(merchant);
  const override = normalizedKey ? overrides?.[normalizedKey] : undefined;

  if (override?.trim()) {
    return override.trim();
  }

  const base = normalizedKey;
  if (!base) return null;

  const sanitized = base.replace(/[^a-z0-9.-]/g, '');
  if (!sanitized) return null;
  return sanitized.includes('.') ? sanitized : `${sanitized}.com`;
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