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

export interface Unavailable { title: string; detail: string }

/**
 * Why a feature that needs the Crystal server cannot be set up right now, in words a person can act on. The commonest
 * causes are the demo (which has no server), an older server that does not have the feature's routes yet, and a server
 * that is not running. Reads the HTTP status from any error that carries a numeric `status`.
 */
export const explainUnavailable = (error: unknown, feature: string): Unavailable => {
  const raw = (error as { status?: unknown } | null)?.status;
  const status = typeof raw === 'number' ? raw : undefined;
  if (status === 404) return { title: `This Crystal server does not have ${feature} yet`, detail: 'The app is newer than the server it is talking to. Update the Crystal backend to the same release as the app, then reload.' };
  if (status === 401 || status === 403) return { title: `Sign in to use ${feature}`, detail: 'This needs your own Crystal server and account, so it is not available in the demo. If you were signed in, your session has ended: sign in again, then reload.' };
  if (status === 423) return { title: 'Crystal is locked', detail: 'Unlock Crystal with your PIN, then try again.' };
  if (status === 429) return { title: 'Too many requests', detail: 'Wait a moment, then try again.' };
  if (status === undefined || status === 502 || status === 503 || status === 504) {
    return { title: 'Crystal\'s server is not answering', detail: `${feature} needs your Crystal server, so it is not available in the demo or when the app runs without one. Otherwise check that the backend is running, then try again.` };
  }
  const reason = error instanceof Error && error.message ? ` ${error.message}` : '';
  return { title: `The server answered with an error (${status})`, detail: `Check the backend logs, then try again.${reason}` };
};
