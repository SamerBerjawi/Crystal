import { summaryView, transactionsView, investmentsView, planningView, spendingByCategoryView, merchantsView } from './apiViews';
import { generateToken, hashToken, expiryFor, tokenProblem, TOKEN_PREFIX } from './apiTokens';

function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(`Test Failed: ${message}`);
}
const run = (name: string, fn: () => void) => {
    try { fn(); console.log(`✓ ${name}`); } catch (e: any) { process.exitCode = 1; console.error(`✕ ${name}:`, e.message); }
};

const NOW = new Date(2026, 10, 12);
const data = {
    preferences: { currency: 'EUR', conversionRates: { USD: 0.5 } },
    accounts: [
        { id: 'a1', name: 'Main', type: 'Checking', balance: 1000, currency: 'EUR' },
        { id: 'a2', name: 'Card', type: 'Credit Card', balance: -200, currency: 'EUR' },
        { id: 'a3', name: 'US', type: 'Savings', balance: 100, currency: 'USD' },
        { id: 'a4', name: 'Yen', type: 'Savings', balance: 5000, currency: 'JPY' },
        { id: 'a5', name: 'Old', type: 'Savings', balance: 999, currency: 'EUR', status: 'closed' },
    ],
    expenseCategories: [{ name: 'Food', subCategories: [{ name: 'Groceries' }] }],
    budgets: [{ id: 'b1', categoryName: 'Food', amount: 400, currency: 'EUR' }],
    transactions: [
        { id: 't1', date: '2026-11-03', amount: -100, currency: 'EUR', type: 'expense', category: 'Groceries', accountId: 'a1', description: 'x' },
        { id: 't2', date: '2026-11-04', amount: -50, currency: 'EUR', type: 'expense', category: 'Food', accountId: 'a1', description: 'y' },
        { id: 't3', date: '2026-11-05', amount: -999, currency: 'EUR', type: 'expense', category: 'Food', accountId: 'a1', transferId: 'z', description: 'transfer' },
        { id: 't4', date: '2026-10-05', amount: -10, currency: 'EUR', type: 'expense', category: 'Food', accountId: 'a2', description: 'old' },
    ],
    investmentTransactions: [
        { id: 'i1', symbol: 'VWCE', name: 'World', quantity: 10, price: 100, date: '2026-01-01', type: 'buy', currency: 'EUR' },
        { id: 'i2', symbol: 'VWCE', name: 'World', quantity: 4, price: 120, date: '2026-02-01', type: 'sell', currency: 'EUR' },
        { id: 'i3', symbol: 'GONE', name: 'Gone', quantity: 1, price: 5, date: '2026-01-01', type: 'buy' },
        { id: 'i4', symbol: 'GONE', name: 'Gone', quantity: 1, price: 6, date: '2026-02-01', type: 'sell' },
    ],
};

console.log('--- Running API token and view tests ---');

run('tokens are prefixed, unique and only their hash is stored', () => {
    const a = generateToken(), b = generateToken();
    assert(a.startsWith(TOKEN_PREFIX) && a !== b && a.length > 40, 'shape');
    assert(hashToken(a) === hashToken(a) && hashToken(a) !== hashToken(b) && !hashToken(a).includes(a), 'hash');
});

run('expiry and token problems', () => {
    const now = new Date('2026-11-12T00:00:00Z');
    assert(expiryFor(null, now) === null && expiryFor(30, now)!.toISOString() === '2026-12-12T00:00:00.000Z', 'expiry');
    const row = { revoked_at: null, expires_at: null, scopes: ['summary'] };
    assert(tokenProblem(row, 'summary', now) === null, 'valid');
    assert(tokenProblem(row, 'transactions', now) !== null, 'wrong scope');
    assert(tokenProblem({ ...row, revoked_at: now }, 'summary', now) !== null, 'revoked');
    assert(tokenProblem({ ...row, expires_at: '2026-11-11T00:00:00Z' }, 'summary', now) !== null, 'expired');
    assert(tokenProblem({ ...row, expires_at: '2026-11-13T00:00:00Z' }, 'summary', now) === null, 'not yet expired');
});

run('summary: net worth converts, skips closed accounts and flags missing rates', () => {
    const s = summaryView(data, NOW);
    assert(s.assets === 1050 && s.debts === 200 && s.netWorth === 850, `totals ${s.assets}/${s.debts}/${s.netWorth}`);
    assert(s.unconvertedCurrencies.join() === 'JPY', 'JPY flagged');
    assert(s.accounts.length === 4, 'closed account left out');
    const food = s.budgets.items[0];
    assert(food.spent === 150 && food.used === 0.38, `food ${food.spent}/${food.used}`);
});

run('transactions: filters, newest first, paging, limits', () => {
    const all = transactionsView(data, {});
    assert(all.total === 4 && all.items[0].id === 't3' && all.items[0].isTransfer, 'order and transfer flag');
    assert(transactionsView(data, { from: '2026-11-01', to: '2026-11-04' }).items.map(i => i.id).join() === 't2,t1', 'date range');
    assert(transactionsView(data, { accountId: 'a2' }).total === 1, 'account filter');
    const page = transactionsView(data, { limit: 1, offset: 1 });
    assert(page.items.length === 1 && page.items[0].id === 't2', 'paging');
    assert(transactionsView(data, { limit: 99999 }).limit === 500, 'limit is capped');
    assert(transactionsView(data, { from: 'bad' }).total === 4, 'bad date ignored');
});

run('investments: holdings from trades at cost, sold-out positions dropped', () => {
    const v = investmentsView(data);
    assert(v.holdings.length === 1 && v.holdings[0].symbol === 'VWCE', 'one holding');
    assert(v.holdings[0].quantity === 6 && v.holdings[0].costBasis === 600, 'average cost');
});

run('malformed data never throws', () => {
    const junk = { accounts: [null, 5, { balance: 'x' }], transactions: [{}, null], budgets: 'no', investmentTransactions: [{ symbol: 1 }] };
    summaryView(junk, NOW); transactionsView(junk, {}); investmentsView(junk); planningView(junk); summaryView({}, NOW);
});

run('spending by category rolls up to the parent and skips transfers', () => {
    const v = spendingByCategoryView(data, { from: '2026-11-01', to: '2026-11-30' });
    assert(v.categories.length === 1 && v.categories[0].category === 'Food' && v.categories[0].total === 150 && v.categories[0].count === 2, 'Food 150');
    assert(spendingByCategoryView(data, {}).total === 160, 'all time includes October');
});

run('merchant search matches, sums and caps', () => {
    const d = { transactions: [
        { id: '1', date: '2026-11-01', amount: -10, currency: 'EUR', type: 'expense', merchant: 'Cafe Nero' },
        { id: '2', date: '2026-11-03', amount: -5, currency: 'EUR', type: 'expense', merchant: 'Cafe Nero' },
        { id: '3', date: '2026-11-02', amount: -50, currency: 'EUR', type: 'expense', description: 'Rent' },
    ] };
    const hit = merchantsView(d, { query: 'cafe' });
    assert(hit.matches === 1 && hit.merchants[0].total === 15 && hit.merchants[0].count === 2 && hit.merchants[0].lastDate === '2026-11-03', 'cafe');
    assert(merchantsView(d, {}).merchants[0].merchant === 'Rent', 'biggest first');
    assert(merchantsView(d, { limit: 1 }).merchants.length === 1, 'limit');
});
