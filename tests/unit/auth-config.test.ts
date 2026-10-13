import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const load = (env: Record<string, string | undefined>) => spawnSync(
    process.execPath, ['--import', 'tsx', '-e', "require('./server/src/authConfig')"],
    { cwd: process.cwd(), env: { PATH: process.env.PATH, ...env } as any, encoding: 'utf8' },
);

test('production refuses to start without JWT_SECRET', () => {
    const r = load({ NODE_ENV: 'production' });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /JWT_SECRET must be set/);
});
test('production refuses the published placeholder secrets', () => {
    for (const secret of ['your_jwt_secret_key_here', 'a-very-secret-and-secure-key-that-you-should-change', 'short']) {
        assert.notEqual(load({ NODE_ENV: 'production', JWT_SECRET: secret }).status, 0, secret);
    }
});
test('production accepts a long random secret', () => {
    assert.equal(load({ NODE_ENV: 'production', JWT_SECRET: 'f'.repeat(48) }).status, 0);
});
