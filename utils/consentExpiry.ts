/*
 * Bank consent (Enable Banking session) expiry. A session ends at `valid_until`; reconnecting afterwards means a new
 * session and new account ids, so users are warned ahead of time at 14, 7 and 1 days.
 */

export type ConsentExpiryLevel = 'expired' | 'last-day' | 'week' | 'fortnight';

export interface ConsentExpiry {
  /** Whole days left, rounded up; 0 or negative once expired. */
  daysLeft: number;
  level: ConsentExpiryLevel;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Returns null when there is no expiry date or the consent has more than 14 days left. */
export function getConsentExpiry(expiresAt: string | undefined, now: number = Date.now()): ConsentExpiry | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime();
  if (!Number.isFinite(ms)) return null;
  const daysLeft = Math.ceil((ms - now) / DAY_MS);
  if (daysLeft <= 0) return { daysLeft, level: 'expired' };
  if (daysLeft <= 1) return { daysLeft, level: 'last-day' };
  if (daysLeft <= 7) return { daysLeft, level: 'week' };
  if (daysLeft <= 14) return { daysLeft, level: 'fortnight' };
  return null;
}

export function describeConsentExpiry(bankName: string, expiry: ConsentExpiry): string {
  if (expiry.level === 'expired') return `${bankName} access has ended. Reconnect to keep syncing.`;
  if (expiry.level === 'last-day') return `${bankName} access ends within a day. Renew it now to avoid a gap.`;
  return `${bankName} access ends in ${expiry.daysLeft} days. Renew it to keep syncing.`;
}
