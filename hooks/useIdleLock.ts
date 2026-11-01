import { useEffect, useRef } from 'react';
import { hasIdledOut } from '../utils/lockModel';

const ACTIVITY_KEY = 'crystal_last_activity';
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
const CHECK_MS = 30_000;
const WRITE_MS = 5_000;

/** Shared through storage, so working in one tab keeps the others from locking the session. */
const readActivity = (fallback: number) => {
  try {
    return Number(localStorage.getItem(ACTIVITY_KEY)) || fallback;
  } catch {
    return fallback;
  }
};

/** Calls onIdle after the set time with no clicks, keys or scrolling. It also checks when a sleeping laptop wakes. */
export const useIdleLock = (minutes: number, isEnabled: boolean, onIdle: () => void) => {
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    if (!isEnabled || minutes <= 0) return;
    let lastActivity = Date.now();
    let lastWrite = 0;

    const note = () => {
      lastActivity = Date.now();
      if (lastActivity - lastWrite < WRITE_MS) return;
      lastWrite = lastActivity;
      try {
        localStorage.setItem(ACTIVITY_KEY, String(lastActivity));
      } catch { /* this tab's own timer still works */ }
    };
    const check = () => {
      const latest = Math.max(lastActivity, readActivity(lastActivity));
      if (hasIdledOut(latest, Date.now(), minutes)) onIdleRef.current();
    };

    note();
    ACTIVITY_EVENTS.forEach(name => window.addEventListener(name, note, { passive: true, capture: true }));
    document.addEventListener('visibilitychange', check);
    const timer = window.setInterval(check, CHECK_MS);
    return () => {
      ACTIVITY_EVENTS.forEach(name => window.removeEventListener(name, note, { capture: true }));
      document.removeEventListener('visibilitychange', check);
      window.clearInterval(timer);
    };
  }, [isEnabled, minutes]);
};
