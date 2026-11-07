/**
 * Builds the OAuth redirect URL sent to Enable Banking.
 * `ENABLE_BANKING_REDIRECT_URL` always wins. Otherwise the URL is derived from the request host, which may come
 * from `X-Forwarded-Host`; that value is client-controlled behind a careless proxy, so it must look like a plain
 * `hostname[:port]` and the scheme must be http or https. Enable Banking also only accepts redirect URLs
 * registered for the application, which is the second line of defence.
 */
const HOST_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*(?::\d{1,5})?$|^\[[0-9a-f:]+\](?::\d{1,5})?$/i;

const firstValue = (value: string | string[] | undefined): string | undefined => {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.split(',')[0]?.trim() || undefined;
};

export interface RedirectInputs {
  configuredUrl?: string;
  forwardedProto?: string | string[];
  forwardedHost?: string | string[];
  protocol: string;
  host?: string;
}

export const resolveRedirectUrl = (input: RedirectInputs): string | null => {
  if (input.configuredUrl) return input.configuredUrl;

  const proto = (firstValue(input.forwardedProto) || input.protocol || '').toLowerCase();
  if (proto !== 'http' && proto !== 'https') return null;

  const host = (firstValue(input.forwardedHost) || input.host || '').trim();
  if (!host || !HOST_PATTERN.test(host)) return null;

  return `${proto}://${host}/enable-banking/callback`;
};
