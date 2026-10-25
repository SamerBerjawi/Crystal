import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isNewPath, newNavPageFor, newPathFor, parseNewRoute, NEW_PAGE_PATHS } from '../../utils/newRoutes';

test('classic paths are not New routes', () => {
    for (const p of ['/', '/accounts', '/accounts/abc', '/investments/AAPL', '/settings', '/newsletter', '/renew']) {
        assert.equal(parseNewRoute(p), null, p);
        assert.equal(isNewPath(p), false, p);
    }
});

test('every top-level New path round-trips', () => {
    for (const [page, path] of Object.entries(NEW_PAGE_PATHS)) {
        assert.deepEqual(parseNewRoute(path), { kind: 'page', page }, path);
        assert.deepEqual(parseNewRoute(path + '/'), { kind: 'page', page }, path + '/');
        assert.equal(newPathFor(page as never), path);
    }
});

test('detail pages carry their id, encoded both ways', () => {
    assert.deepEqual(parseNewRoute('/accounts-new/acc%201'), { kind: 'page', page: 'AccountDetail', id: 'acc 1' });
    assert.deepEqual(parseNewRoute('/investments-new/BRK.B?tab=lots'), { kind: 'page', page: 'HoldingDetail', id: 'BRK.B' });
    assert.equal(newPathFor('AccountDetail', 'acc 1'), '/accounts-new/acc%201');
    assert.equal(newPathFor('HoldingDetail', null), '/investments-new');
    assert.deepEqual(parseNewRoute('/accounts-new/%E0%A4%A'), { kind: 'notFound', path: '/accounts-new/%E0%A4%A' });
});

test('unknown -new paths are New-UI not-found, and the gallery has its own route', () => {
    assert.deepEqual(parseNewRoute('/warrants-new'), { kind: 'notFound', path: '/warrants-new' });
    assert.deepEqual(parseNewRoute('/design-new'), { kind: 'gallery' });
});

test('merged classic pages resolve to the New page that holds them', () => {
    assert.equal(newPathFor('Warrants' as never), '/investments-new');
    for (const p of ['Categories', 'Tags', 'Rules', 'Merchants', 'Preferences', 'Personal Info', 'Data Management', 'Integrations', 'Documentation']) {
        assert.equal(newPathFor(p as never), '/settings-new', p);
    }
    assert.equal(newPathFor('EnableBankingCallback'), '/dashboard-new');
});

test('detail pages highlight their list page', () => {
    assert.equal(newNavPageFor('AccountDetail'), 'Accounts');
    assert.equal(newNavPageFor('HoldingDetail'), 'Investments');
    assert.equal(newNavPageFor('Budget'), 'Budget');
});
