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

/**
 * A callback URL typed into the settings. It must be the exact URL registered in Enable Banking, so it is not rewritten:
 * only checked to be a plain https URL (http only for localhost), with no credentials, query or fragment.
 * Returns the URL unchanged, or null when it is not acceptable.
 */
export const sanitizeCallbackUrl = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || text.length > 300) return null;
  let url: URL;
  try { url = new URL(text); } catch { return null; }
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.hostname === '::1';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocal)) return null;
  if (url.username || url.password || url.search || url.hash) return null;
  return text;
};

/** What to tell the user when Enable Banking answers REDIRECT_URI_NOT_ALLOWED for the URL we sent. */
export const redirectNotAllowedMessage = (redirectUrl: string, isConfigured: boolean): string => {
  const local = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/i.test(redirectUrl);
  const httpsNote = !local && redirectUrl.toLowerCase().startsWith('http://')
    ? ' This address is plain http; Enable Banking may only accept https URLs (or localhost), in which case use an https address.'
    : '';
  const fix = isConfigured
    ? 'Add exactly this URL to your application\'s redirect URLs in the Enable Banking control panel.'
    : 'Add exactly this URL to your application\'s redirect URLs in the Enable Banking control panel, or enter a URL you already registered under Connections, Enable Banking (or set ENABLE_BANKING_REDIRECT_URL on the server).';
  return `Enable Banking does not allow the callback URL ${redirectUrl}. ${fix}${httpsNote}`;
};
