const seen = new Set<string>();

/**
 * For best-effort operations (localStorage, caches, optional parsing) whose failure must not interrupt the user
 * but should still be diagnosable. Each context is logged once per page load to avoid flooding the console.
 */
export const warnIgnored = (context: string, error: unknown): void => {
    if (seen.has(context)) return;
    seen.add(context);
    console.warn(`[crystal] ${context} — ignored:`, error);
};
