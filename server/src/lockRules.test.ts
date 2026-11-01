import { isOpenWhileLocked, MAX_PIN_FAILURES, PIN_PATTERN, pinTriesLeft } from './lockRules';

let failures = 0;
const check = (name: string, passed: boolean) => {
    console.log(`${passed ? '✓' : '✕'} ${name}`);
    if (!passed) failures += 1;
};

check('the lock routes stay open', isOpenWhileLocked('/api/lock/unlock') && isOpenWhileLocked('/api/lock'));
check('the name on the lock screen stays open', isOpenWhileLocked('/api/auth/me'));
check('signing out stays open', isOpenWhileLocked('/api/auth/logout'));
check('query strings are ignored', isOpenWhileLocked('/api/lock/status?x=1'));
check('financial data is closed', !isOpenWhileLocked('/api/data'));
check('profile changes are closed', !isOpenWhileLocked('/api/users/me'));
check('bank routes are closed', !isOpenWhileLocked('/api/enable-banking/banks'));
check('a look-alike path is closed', !isOpenWhileLocked('/api/lockout') && !isOpenWhileLocked('/api/auth/me2'));
check('a PIN is exactly four digits', PIN_PATTERN.test('0123') && !PIN_PATTERN.test('123') && !PIN_PATTERN.test('12345') && !PIN_PATTERN.test('12a4'));
check('tries count down to zero', pinTriesLeft(0) === MAX_PIN_FAILURES && pinTriesLeft(MAX_PIN_FAILURES) === 0 && pinTriesLeft(MAX_PIN_FAILURES + 2) === 0);

if (failures > 0) process.exit(1);
