import crypto from 'crypto';

/**
 * Helpers for the optional /auth fields of Enable Banking: `auth_method`, `credentials` and `psu_id`.
 * Pure so they can be unit tested without a bank.
 */

const NAME_PATTERN = /^[\w.\- ]{1,100}$/;
const CREDENTIAL_KEY_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;

/** A bank's authentication method name as returned by /aspsps `auth_methods[].name`. */
export const sanitizeAuthMethod = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return NAME_PATTERN.test(trimmed) ? trimmed : undefined;
};

/**
 * Login credentials (for example a user id) forwarded to the bank's sign-in form. Enable Banking only accepts them
 * together with an `auth_method`, so without one they are dropped. They are never stored.
 */
export const sanitizeCredentials = (value: unknown, authMethod: string | undefined): Record<string, string> | undefined => {
  if (!authMethod || !value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>).slice(0, 10)) {
    if (!CREDENTIAL_KEY_PATTERN.test(key) || typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (trimmed && trimmed.length <= 256) out[key] = trimmed;
  }
  return Object.keys(out).length > 0 ? out : undefined;
};

/**
 * Stable, anonymised identifier for the Crystal user. Enable Banking uses `psu_id` to match sessions of the same
 * user and stores only a hash of it; sending an opaque digest keeps the e-mail or numeric id out of the request.
 */
export const derivePsuId = (userId: number | string): string =>
  crypto.createHash('sha256').update(`crystal-psu:${userId}`).digest('hex').slice(0, 32);
