/**
 * Normalizes numbers (Unix seconds vs ms), ISO strings, space-separated date
 * strings, and Date objects into a single valid Date — or null on failure.
 *
 * JavaScript's Date constructor requires milliseconds, but many APIs return
 * Unix timestamps in seconds (10-digit numbers). Passing seconds directly
 * produces a date in 1970, so we detect and convert automatically.
 */
export function parseFlexibleDate(
  input?: string | number | Date | null,
): Date | null {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;

  if (typeof input === 'number') {
    // 10-digit timestamps are in seconds — convert to milliseconds
    const ms = input < 1e11 ? input * 1000 : input;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed || trimmed.toLowerCase() === 'unavailable') return null;

    // Numeric string (seconds or milliseconds)
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      const num = parseFloat(trimmed);
      const ms = num < 1e11 ? num * 1000 : num;
      const d = new Date(ms);
      if (!isNaN(d.getTime())) return d;
    }

    // Standard ISO 8601
    let d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;

    // Fallback: "YYYY-MM-DD HH:mm:ss" (space-separated)
    if (trimmed.includes(' ')) {
      d = new Date(trimmed.replace(' ', 'T'));
      if (!isNaN(d.getTime())) return d;
    }
  }

  return null;
}

/**
 * Returns a human-readable, context-aware date/time string such as:
 *   "Today at 10:28 AM"
 *   "Yesterday at 3:45 PM"
 *   "Sep 9 at 10:28 AM"
 *   "Sep 9, 2024 at 10:28 AM"
 *
 * Pass `{ includeRelative: true }` to append a short relative note for
 * recent timestamps: "Today at 10:28 AM (4m ago)".
 */
export function formatLastUpdated(
  dateInput?: string | number | Date | null,
  options: { includeRelative?: boolean } = { includeRelative: false },
): string {
  if (!dateInput) return 'Unavailable';
  if (dateInput === 'Just now') return 'Just now';

  const date = parseFlexibleDate(dateInput);
  if (!date) return String(dateInput);

  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  const diffMin = Math.floor(diffSec / 60);

  const timeOnly = date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  let formatted = '';
  if (isToday) {
    formatted = `Today at ${timeOnly}`;
  } else if (isYesterday) {
    formatted = `Yesterday at ${timeOnly}`;
  } else if (date.getFullYear() === now.getFullYear()) {
    const monthDay = date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
    });
    formatted = `${monthDay} at ${timeOnly}`;
  } else {
    const fullDate = date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    formatted = `${fullDate} at ${timeOnly}`;
  }

  if (options.includeRelative && diffMin < 60 && diffSec >= 0) {
    const rel = diffSec < 60 ? 'Just now' : `${diffMin}m ago`;
    return `${formatted} (${rel})`;
  }

  return formatted;
}

/**
 * A `YYYY-MM-DD` day for display: "12 Mar", or "12 Mar 2025" outside the current year.
 * Anything that is not an ISO day comes back unchanged.
 */
export function formatShortDate(iso?: string | null, today: Date = new Date()): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  });
}
