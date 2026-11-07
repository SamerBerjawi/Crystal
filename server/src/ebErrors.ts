import type express from 'express';

/** Error whose message is safe to show to the user; upstream details stay in the server log. */
export class EnableBankingError extends Error {
  constructor(public status: number, message: string, public code?: string, public retryAfterSeconds?: number) { super(message); }
}

/** Error codes (ErrorCode in the Enable Banking OpenAPI spec) meaning the session/consent is no longer usable. */
export const SESSION_ERROR_CODES = new Set(['EXPIRED_SESSION', 'CLOSED_SESSION', 'REVOKED_SESSION', 'SESSION_DOES_NOT_EXIST', 'WRONG_SESSION_STATUS']);
/** The bank allows roughly 4 unattended fetches a day; Enable Banking advises retrying after about 6 hours. */
export const RATE_LIMIT_RETRY_SECONDS = 6 * 60 * 60;

export const publicMessageFor = (status: number, code?: string, retryAfterSeconds?: number): string => {
  switch (code) {
    case 'EXPIRED_SESSION':
    case 'CLOSED_SESSION':
    case 'REVOKED_SESSION':
    case 'SESSION_DOES_NOT_EXIST':
    case 'WRONG_SESSION_STATUS':
      return 'The bank connection has expired or was revoked. Reconnect the bank to continue.';
    case 'ASPSP_RATE_LIMIT_EXCEEDED': {
      const hours = Math.max(1, Math.round((retryAfterSeconds || RATE_LIMIT_RETRY_SECONDS) / 3600));
      return `The bank limits automatic data requests (usually about 4 per day). Try again in about ${hours} hour${hours === 1 ? '' : 's'}.`;
    }
    case 'PSU_HEADER_NOT_PROVIDED':
    case 'PSU_HEADER_INVALID':
      return 'The bank requires details about your device that could not be sent. Try again from the app, not a script or proxy.';
    case 'UNAUTHORIZED_ACCESS':
    case 'UNAUTHORIZED_IP':
      return `Enable Banking rejected the application (${code}). Check the application ID, private key and allowed IP addresses.`;
    case 'WRONG_TRANSACTIONS_PERIOD':
    case 'DATE_FROM_IN_FUTURE':
    case 'WRONG_DATE_INTERVAL':
      return 'The bank does not provide transactions for the requested period. Choose a later sync start date.';
    case 'ASPSP_ACCOUNT_NOT_ACCESSIBLE':
    case 'ACCOUNT_DOES_NOT_EXIST':
      return 'The bank does not allow access to this account right now.';
    case 'ASPSP_TIMEOUT':
      return 'The bank did not respond in time. Try again later.';
    case 'ASPSP_PSU_ACTION_REQUIRED':
      return 'The bank needs you to take an action in its own app or website before data can be fetched.';
    default:
  }
  if (status === 401 || status === 403) return `Enable Banking rejected the request (HTTP ${status}). Check the application ID and private key.`;
  if (status === 404) return 'Enable Banking could not find the requested resource (HTTP 404).';
  if (status === 422) return 'Enable Banking could not process the bank request (HTTP 422). The bank may require reauthorization or updated consent parameters.';
  if (status === 429) return 'Enable Banking is rate limiting requests (HTTP 429). Try again in a few hours.';
  if (status >= 500) return `Enable Banking is currently unavailable (HTTP ${status}). Try again later.`;
  return `Enable Banking request failed (HTTP ${status}).`;
};

/** True only when the consent/session itself is gone, so the user has to authorize the bank again. */
export const requiresReauthorization = (error: EnableBankingError): boolean => Boolean(error.code && SESSION_ERROR_CODES.has(error.code));

export const parseErrorCode = (text: string): string | undefined => {
  try {
    const parsed = JSON.parse(text);
    const code = parsed?.error ?? parsed?.code;
    return typeof code === 'string' && /^[A-Z_]{3,64}$/.test(code) ? code : undefined;
  } catch {
    return undefined;
  }
};

export const parseRetryAfter = (value: string | null): number | undefined => {
  if (!value) return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 24 * 60 * 60) : undefined;
};

/**
 * Extracts client IP and User-Agent so banks requiring PSU context headers succeed.
 * Enable Banking requires all PSU headers a bank asks for, or none: a partial set fails with
 * PSU_HEADER_NOT_PROVIDED. So both are sent together, or neither (e.g. on loopback, where no real client IP exists).
 */
export const extractPsuHeaders = (req: express.Request): Record<string, string> => {
  const ua = req.headers['user-agent'];
  const userAgent = typeof ua === 'string' ? ua.trim().slice(0, 512) : '';
  const rawIp = (req.ip || '').replace(/^::ffff:/, '').trim();
  if (!userAgent || !rawIp || rawIp === '127.0.0.1' || rawIp === '::1') return {};
  return { 'Psu-User-Agent': userAgent, 'Psu-Ip-Address': rawIp };
};

const KNOWN_PSU_HEADERS = ['Psu-Ip-Address', 'Psu-User-Agent', 'Psu-Accept', 'Psu-Accept-Charset', 'Psu-Accept-Encoding', 'Psu-Accept-Language', 'Psu-Referer', 'Psu-Geo-Location'];
const canonicalPsuHeader = (name: string): string | undefined => KNOWN_PSU_HEADERS.find(known => known.toLowerCase() === name.trim().toLowerCase());

/**
 * The bank's `required_psu_headers` (from /aspsps) as sent back by the client, reduced to known header names.
 * Undefined when the client did not send a list (older connections), an empty array when the bank requires none.
 */
export const sanitizeRequiredPsuHeaders = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const out: string[] = [];
  for (const item of value.slice(0, 20)) {
    const name = typeof item === 'string' ? canonicalPsuHeader(item) : undefined;
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
};

const headerText = (value: string | string[] | undefined): string => (Array.isArray(value) ? value[0] : value ?? '').trim().slice(0, 512);

/**
 * PSU headers for a data request. Enable Banking wants every header the bank requires, or none: a partial set
 * fails with PSU_HEADER_NOT_PROVIDED. Headers marked as required that this server cannot supply (for example
 * `Psu-Geo-Location`) therefore mean sending none. Without a list, the IP address and user agent go together.
 */
export const buildPsuHeaders = (req: express.Request, required?: string[]): Record<string, string> => {
  const base = extractPsuHeaders(req);
  if (!required || required.length === 0) return base;

  const rawIp = (req.ip || '').replace(/^::ffff:/, '').trim();
  const available: Record<string, string> = {
    'Psu-User-Agent': headerText(req.headers['user-agent']),
    'Psu-Ip-Address': rawIp === '127.0.0.1' || rawIp === '::1' ? '' : rawIp,
    'Psu-Accept': headerText(req.headers['accept']),
    'Psu-Accept-Charset': headerText(req.headers['accept-charset']),
    'Psu-Accept-Encoding': headerText(req.headers['accept-encoding']),
    'Psu-Accept-Language': headerText(req.headers['accept-language']),
    'Psu-Referer': headerText(req.headers['referer']),
  };
  const out: Record<string, string> = {};
  for (const name of required) {
    const value = available[name];
    if (!value) return {};
    out[name] = value;
  }
  return { ...base, ...out };
};
