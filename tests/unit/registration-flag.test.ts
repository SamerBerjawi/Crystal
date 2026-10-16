import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as avatarNs from '../../server/src/avatar';

// server/ is CommonJS; under tsx its exports arrive on `default`.
const { buildInitialsAvatar } = ((avatarNs as any).default ?? avatarNs) as typeof avatarNs;

const load = async (value?: string) => {
    if (value === undefined) delete process.env.ALLOW_REGISTRATION; else process.env.ALLOW_REGISTRATION = value;
    const ns: any = await import('../../server/src/authConfig');
    return (ns.default ?? ns).isRegistrationEnabled();
};

test('registration is enabled by default and for any value except "false"', async () => {
    assert.equal(await load(undefined), true);
    assert.equal(await load('true'), true);
    assert.equal(await load('1'), true);
});
test('ALLOW_REGISTRATION=false (any case) disables registration', async () => {
    assert.equal(await load('false'), false);
    assert.equal(await load('FALSE'), false);
    assert.equal(await load(' false '), false);
});
test('initials avatar is a local data URI and contains no email', () => {
    const uri = buildInitialsAvatar('Ada', 'Lovelace', 'ada@example.com');
    assert.match(uri, /^data:image\/svg\+xml;base64,/);
    const svg = Buffer.from(uri.split(',')[1], 'base64').toString();
    assert.ok(svg.includes('>AL<'));
    assert.ok(!svg.includes('ada@example.com'));
});
test('initials avatar escapes markup in names', () => {
    const svg = Buffer.from(buildInitialsAvatar('<', '&', 'x').split(',')[1], 'base64').toString();
    assert.ok(!svg.includes('><<'));
    assert.ok(svg.includes('&lt;&amp;'));
});
