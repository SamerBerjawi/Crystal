export const PIN_PATTERN = /^\d{4}$/;
export const MAX_PIN_FAILURES = 5;

const OPEN_WHILE_LOCKED = ['/api/lock', '/api/auth/me', '/api/auth/logout'];

/** While a session is locked, only the lock itself, the name on the lock screen and signing out still work. */
export const isOpenWhileLocked = (url: string) => {
    const path = url.split('?')[0];
    return OPEN_WHILE_LOCKED.some(open => path === open || path.startsWith(`${open}/`));
};

/** Tries left after this many wrong PINs. At zero the session ends. */
export const pinTriesLeft = (failures: number) => Math.max(0, MAX_PIN_FAILURES - failures);
