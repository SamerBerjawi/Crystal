export {};
import { parseTimeSeries } from './benchmarks';

const check = (ok: boolean, name: string) => { console.log(`${ok ? '✓' : '✕'} ${name}`); if (!ok) process.exitCode = 1; };
const throws = (fn: () => unknown) => { try { fn(); return false; } catch { return true; } };

const reply = { meta: { symbol: 'spy', currency: 'usd', exchange: 'NYSE' }, values: [
    { datetime: '2024-01-03', close: '470.5' }, { datetime: '2024-01-02', close: '472.1' }, { datetime: '2024-01-04', close: '0' }, { datetime: 'bad', close: '1' },
] };
const parsed = parseTimeSeries(reply, 'SPY');
check(parsed.points.length === 2, 'drops zero prices and bad dates');
check(parsed.points[0].date === '2024-01-02', 'sorts oldest first');
check(parsed.currency === 'USD' && parsed.symbol === 'SPY', 'upper-cases symbol and currency');
check(throws(() => parseTimeSeries({ status: 'error', message: 'bad key' }, 'SPY')), 'throws on a Twelve Data error');
check(throws(() => parseTimeSeries({ meta: { currency: 'USD' }, values: [] }, 'SPY')), 'throws when there are no prices');
check(throws(() => parseTimeSeries({ meta: {}, values: [{ datetime: '2024-01-02', close: '1' }] }, 'SPY')), 'throws when there is no currency');
try { parseTimeSeries({ status: 'error', message: 'You have run out of API credits' }, 'SPY'); } catch (e) { check(/rate limit/i.test((e as Error).message), 'names a rate limit'); }
