import { evaluateAlerts, occurrencesBetween, DEFAULT_RULES } from './alertRules';
import { buildDelivery, channelProblem } from './alertChannels';
import { parsePublicHttpUrl } from './urlGuard';

function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(`Test Failed: ${message}`);
}
const run = (name: string, fn: () => void) => {
    try { fn(); console.log(`✓ ${name}`); } catch (e: any) { process.exitCode = 1; console.error(`✕ ${name}:`, e.message); }
};

const NOW = new Date(2026, 10, 7, 9, 0, 0); // 7 Nov 2026
const tx = (id: string, date: string, amount: number, extra: Record<string, any> = {}) =>
    ({ id, accountId: 'a1', date, description: id, merchant: 'Cafe', amount, category: 'Dining', type: 'expense', currency: 'EUR', ...extra });

console.log('--- Running alert rules and channel tests ---');

run('consent warns at 14, 7 and 1 days and after expiry, once per stage', () => {
    const at = (days: number) => new Date(NOW.getTime() + days * 86400000).toISOString();
    const keys = (days: number) => evaluateAlerts({ enableBankingConnections: [{ id: 'c1', selectedBank: 'KBC', status: 'ready', sessionExpiresAt: at(days) }] }, DEFAULT_RULES, NOW).map(a => a.key);
    assert(keys(30).length === 0, 'nothing 30 days out');
    assert(keys(14)[0] === 'consent:c1:fortnight', 'fortnight');
    assert(keys(6)[0] === 'consent:c1:week', 'week');
    assert(keys(0.5)[0] === 'consent:c1:last-day', 'last day');
    assert(keys(-2)[0] === 'consent:c1:expired', 'expired');
    assert(evaluateAlerts({ enableBankingConnections: [{ id: 'c1', status: 'disconnected', sessionExpiresAt: at(3) }] }, DEFAULT_RULES, NOW).length === 0, 'disconnected is quiet');
});

run('budget warns at the threshold, then again when used up, ignoring transfers and other months', () => {
    const data = (spent: number) => ({
        budgets: [{ id: 'b1', categoryName: 'Food', amount: 100, currency: 'EUR' }],
        expenseCategories: [{ id: 'f', name: 'Food', subCategories: [{ id: 'g', name: 'Groceries', subCategories: [] }] }],
        transactions: [
            tx('t1', '2026-11-02', -spent, { category: 'Groceries' }),
            tx('t2', '2026-11-03', -500, { category: 'Groceries', transferId: 'x' }),
            tx('t3', '2026-10-30', -500, { category: 'Food' }),
            tx('t4', '2026-11-03', -500, { category: 'Fuel' }),
        ],
    });
    assert(evaluateAlerts(data(50), DEFAULT_RULES, NOW).length === 0, 'under the threshold');
    const near = evaluateAlerts(data(85), DEFAULT_RULES, NOW);
    assert(near.length === 1 && near[0].key === 'budget:b1:2026-11:80', 'at 85%');
    const over = evaluateAlerts(data(120), DEFAULT_RULES, NOW);
    assert(over.length === 1 && over[0].key === 'budget:b1:2026-11:100' && over[0].priority === 'high', 'over the limit');
});

run('duplicate charges: same account, payee and amount within two days; recurring ones are ignored', () => {
    const twice = evaluateAlerts({ transactions: [tx('d1', '2026-11-06', -9.99), tx('d2', '2026-11-07', -9.99)] }, DEFAULT_RULES, NOW);
    assert(twice.length === 1 && twice[0].key === 'dup:d1:d2', 'a pair is found once');
    assert(evaluateAlerts({ transactions: [tx('d1', '2026-11-06', -9.99), tx('d2', '2026-11-07', -9.99, { recurringSourceId: 'r' })] }, DEFAULT_RULES, NOW).length === 0, 'recurring is ignored');
    assert(evaluateAlerts({ transactions: [tx('d1', '2026-11-06', -9.99), tx('d2', '2026-11-07', -9.99, { merchant: 'Other' })] }, DEFAULT_RULES, NOW).length === 0, 'other payee');
    assert(evaluateAlerts({ transactions: [tx('d1', '2026-10-01', -9.99), tx('d2', '2026-10-01', -9.99)] }, DEFAULT_RULES, NOW).length === 0, 'old pair');
});

run('price hike compares the last charge with the series amount', () => {
    const series = { id: 'r1', type: 'expense', merchant: 'Netflix', amount: 12.99, currency: 'EUR' };
    const hit = evaluateAlerts({ recurringTransactions: [series], transactions: [tx('p1', '2026-10-01', -12.99, { recurringSourceId: 'r1' }), tx('p2', '2026-11-01', -15.99, { recurringSourceId: 'r1' })] }, DEFAULT_RULES, NOW);
    assert(hit.length === 1 && hit[0].key === 'price:r1:p2', 'hike found against the latest charge');
    assert(evaluateAlerts({ recurringTransactions: [series], transactions: [tx('p1', '2026-11-01', -13.0, { recurringSourceId: 'r1' })] }, DEFAULT_RULES, NOW).length === 0, 'a few cents is not a hike');
    assert(evaluateAlerts({ recurringTransactions: [{ ...series, pausedAt: '2026-10-01' }], transactions: [tx('p2', '2026-11-01', -15.99, { recurringSourceId: 'r1' })] }, DEFAULT_RULES, NOW).length === 0, 'paused series');
});

run('occurrencesBetween steps by frequency and stops at the end date', () => {
    const weekly = occurrencesBetween({ frequency: 'weekly', nextDueDate: '2026-11-08' }, new Date(2026, 10, 7), new Date(2026, 10, 30));
    assert(weekly.length === 4, 'four Sundays');
    const monthly = occurrencesBetween({ frequency: 'monthly', nextDueDate: '2026-11-10', endDate: '2026-12-31' }, new Date(2026, 10, 7), new Date(2027, 2, 1));
    assert(monthly.length === 2, 'ends in December');
    assert(occurrencesBetween({ frequency: 'nonsense', nextDueDate: '2026-11-10' }, new Date(2026, 10, 7), new Date(2027, 0, 1)).length === 0, 'unknown frequency');
});

run('low balance finds the first scheduled payment that crosses the floor', () => {
    const data = {
        accounts: [{ id: 'a1', name: 'Main', type: 'Checking', balance: 300, currency: 'EUR' }, { id: 's1', name: 'Pot', type: 'Savings', balance: 0, currency: 'EUR' }],
        recurringTransactions: [
            { id: 'r1', accountId: 'a1', type: 'expense', amount: 250, currency: 'EUR', frequency: 'monthly', nextDueDate: '2026-11-09' },
            { id: 'r2', accountId: 'a1', type: 'expense', amount: 100, currency: 'EUR', frequency: 'monthly', nextDueDate: '2026-11-10' },
            { id: 'r3', accountId: 'a1', type: 'income', amount: 900, currency: 'EUR', frequency: 'monthly', nextDueDate: '2026-11-25' },
        ],
    };
    const alerts = evaluateAlerts(data, DEFAULT_RULES, NOW);
    assert(alerts.length === 1 && alerts[0].key === 'low:a1:2026-11-10', 'second bill crosses zero; savings accounts are ignored');
    assert(evaluateAlerts(data, { ...DEFAULT_RULES, lowBalanceDays: 2 }, NOW).length === 0, 'outside the horizon');
    assert(evaluateAlerts(data, { ...DEFAULT_RULES, lowBalance: false }, NOW).length === 0, 'rule off');
});

run('malformed data is skipped, never thrown', () => {
    const junk: any = { transactions: [null, 5, { date: 3 }], budgets: [{ id: 'b', amount: 'x' }], accounts: [{ type: 'Checking', balance: 'abc' }], recurringTransactions: [{}], enableBankingConnections: [{ sessionExpiresAt: 'nope' }] };
    assert(evaluateAlerts(junk, DEFAULT_RULES, NOW).length === 0, 'no alerts from junk');
    assert(evaluateAlerts({}, DEFAULT_RULES, NOW).length === 0, 'empty blob');
});

run('each channel builds the right request', () => {
    const alert = { title: 'Low balance ahead', message: 'Main drops to €-50', priority: 'high' as const, key: 'k', kind: 'lowBalance' };
    const ntfy = buildDelivery({ kind: 'ntfy', url: 'https://ntfy.sh/', topic: 'my topic', token: 'tk' }, alert);
    assert(ntfy.url === 'https://ntfy.sh/my%20topic' && ntfy.headers.Priority === 'high' && ntfy.headers.Authorization === 'Bearer tk' && ntfy.body === alert.message, 'ntfy');
    const gotify = buildDelivery({ kind: 'gotify', url: 'http://gotify.local', token: 'gt' }, alert);
    assert(gotify.url === 'http://gotify.local/message' && gotify.headers['X-Gotify-Key'] === 'gt' && !gotify.url.includes('gt') && JSON.parse(gotify.body).priority === 8, 'gotify keeps the token out of the URL');
    const hook = buildDelivery({ kind: 'webhook', url: 'https://hooks.example/x' }, alert);
    assert(JSON.parse(hook.body).key === 'k' && !('Authorization' in hook.headers), 'webhook');
    assert(/^[\x20-\x7e]*$/.test(buildDelivery({ kind: 'ntfy', url: 'https://n.sh', topic: 't' }, { ...alert, title: 'Café €' }).headers.Title), 'ntfy title stays ASCII');
});

run('channelProblem names what is missing', () => {
    assert(channelProblem({ kind: 'ntfy', url: 'https://ntfy.sh' }) === 'Enter the ntfy topic.', 'topic');
    assert(channelProblem({ kind: 'gotify', url: 'http://g' }) === 'Enter the Gotify application token.', 'token');
    assert(channelProblem({ kind: 'webhook', url: '' }) === 'Enter the server address.', 'url');
    assert(channelProblem({ kind: 'webhook', url: 'https://x' }) === null, 'valid');
});

run('private addresses are refused unless the operator allows them', () => {
    let blocked = false;
    try { parsePublicHttpUrl('http://192.168.1.20:8080'); } catch { blocked = true; }
    assert(blocked, 'LAN address blocked by default');
    assert(parsePublicHttpUrl('http://192.168.1.20:8080', true).hostname === '192.168.1.20', 'allowed with the opt-in');
    let stillBlocked = false;
    try { parsePublicHttpUrl('ftp://192.168.1.20', true); } catch { stillBlocked = true; }
    assert(stillBlocked, 'scheme is still checked with the opt-in');
});

run('weekly recap: Monday to Wednesday, once, last full week', () => {
    const MON = new Date(2026, 10, 9, 8, 0, 0); // 9 Nov 2026, a Monday
    const on = { ...DEFAULT_RULES, weekly: true };
    const data = { preferences: { currency: 'EUR' }, transactions: [
        tx('w1', '2026-11-03', -120, { category: 'Groceries' }),
        tx('w2', '2026-11-05', -30, { category: 'Dining' }),
        tx('w3', '2026-11-04', 1000, { type: 'income', category: 'Salary' }),
        tx('w4', '2026-10-27', -100, { category: 'Groceries' }),
        tx('w5', '2026-11-04', -500, { transferId: 't1' }),
    ] };
    const out = evaluateAlerts(data, on, MON).filter(a => a.kind === 'weekly');
    assert(out.length === 1 && out[0].key === 'weekly:2026-11-02', 'keyed by the Monday of the recap week');
    assert(out[0].message.includes('+50%'), 'spent 150 against 100');
    assert(out[0].message.includes('Groceries'), 'names the top category');
    assert(evaluateAlerts(data, DEFAULT_RULES, MON).every(a => a.kind !== 'weekly'), 'off by default');
    assert(evaluateAlerts(data, on, new Date(2026, 10, 12)).every(a => a.kind !== 'weekly'), 'quiet on Thursday');
    assert(evaluateAlerts({ transactions: [] }, on, MON).every(a => a.kind !== 'weekly'), 'quiet for an empty week');
    const wed = evaluateAlerts(data, on, new Date(2026, 10, 11)).find(a => a.kind === 'weekly');
    assert(wed?.key === 'weekly:2026-11-02', 'same key on Wednesday, so it is not sent twice');
});
