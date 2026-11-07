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

/** What to tell the user when Enable Banking answers REDIRECT_URI_NOT_ALLOWED for the URL we sent. */
export const redirectNotAllowedMessage = (redirectUrl: string, isConfigured: boolean): string => {
  const local = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/i.test(redirectUrl);
  const httpsNote = !local && redirectUrl.toLowerCase().startsWith('http://')
    ? ' This address is plain http; Enable Banking may only accept https URLs (or localhost), in which case use an https address.'
    : '';
  const fix = isConfigured
    ? 'Add exactly this URL to your application\'s redirect URLs in the Enable Banking control panel.'
    : 'Add exactly this URL to your application\'s redirect URLs in the Enable Banking control panel, or set ENABLE_BANKING_REDIRECT_URL on the server to a URL you already registered.';
  return `Enable Banking does not allow the callback URL ${redirectUrl}. ${fix}${httpsNote}`;
};
