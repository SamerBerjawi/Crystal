/*
 * Turns what a failed API call threw into something safe to show. `fetchWithAuth` throws `Error(responseBody)`, so the
 * message is a JSON body from our server, plain text, or, when a proxy in front of the server (nginx, Cloudflare)
 * swaps in its own error page, a whole HTML document.
 */

export interface ParsedApiError {
  message: string;
  errorCode?: string;
  requiresReauth?: boolean;
  retryAfterSeconds?: number;
}

const HTML_BODY = /^\s*(?:<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>]|<!--)/i;

/** True for an HTML error page rather than an API response. */
export const looksLikeHtml = (text: string): boolean => HTML_BODY.test(text);

export const HTML_ERROR_MESSAGE = 'The server, or a proxy in front of it, answered with an error page instead of the API response. Check the server logs for the real error.';

export function parseApiError(error: unknown, fallback = 'Request failed'): ParsedApiError {
  const raw = typeof (error as any)?.message === 'string' ? ((error as any).message as string).trim() : '';
  if (!raw) return { message: fallback };
  if (looksLikeHtml(raw)) return { message: HTML_ERROR_MESSAGE };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return {
        message: typeof parsed.message === 'string' && parsed.message.trim() ? parsed.message.trim() : fallback,
        errorCode: typeof parsed.errorCode === 'string' ? parsed.errorCode : undefined,
        requiresReauth: typeof parsed.requiresReauth === 'boolean' ? parsed.requiresReauth : undefined,
        retryAfterSeconds: Number(parsed.retryAfterSeconds) > 0 ? Number(parsed.retryAfterSeconds) : undefined,
      };
    }
  } catch { /* plain text */ }
  return { message: raw.length > 300 ? `${raw.slice(0, 297)}…` : raw };
}
