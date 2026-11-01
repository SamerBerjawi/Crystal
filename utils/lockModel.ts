export const PIN_LENGTH = 4;
export const DEFAULT_AUTO_LOCK_MINUTES = 15;
export const AUTO_LOCK_OPTIONS = [
  { id: '0', label: 'Never' },
  { id: '5', label: 'After 5 minutes' },
  { id: '15', label: 'After 15 minutes' },
  { id: '30', label: 'After 30 minutes' },
  { id: '60', label: 'After 60 minutes' },
];

export const isValidPin = (pin: string) => new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);

const MINUTE_MS = 60_000;

/** Zero minutes means never. */
export const hasIdledOut = (lastActivity: number, now: number, minutes: number) => minutes > 0 && now - lastActivity >= minutes * MINUTE_MS;

/** Adds a key press to a PIN being typed. Digits fill it, and Backspace takes one off. */
export const pinAfterKey = (pin: string, key: string) => {
  if (key === 'Backspace') return pin.slice(0, -1);
  return /^\d$/.test(key) && pin.length < PIN_LENGTH ? pin + key : pin;
};

export const triesLeftMessage = (triesLeft: number) => `Wrong PIN. ${triesLeft} ${triesLeft === 1 ? 'try' : 'tries'} left, then you’ll be signed out.`;
