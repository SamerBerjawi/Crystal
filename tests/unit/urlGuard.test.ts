import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import * as guardNs from '../../server/src/urlGuard';

// server/ is a CommonJS package; under tsx its exports arrive on `default`.
const guard: typeof guardNs = (guardNs as any).default ?? guardNs;
const { isPrivateIp, parsePublicHttpUrl, safeFetchText, UrlBlockedError } = guard;

test('private / reserved IPv4 and IPv6 are blocked, public ones are not', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '0.0.0.0',
    '100.64.0.1', '224.0.0.1', '255.255.255.255', '::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1', '::ffff:127.0.0.1', '::ffff:7f00:1']) {
    assert.equal(isPrivateIp(ip), true, `${ip} should be blocked`);
  }
  for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '172.32.0.1', '2606:4700:4700::1111']) {
    assert.equal(isPrivateIp(ip), false, `${ip} should be allowed`);
  }
});

test('URL parsing rejects bad schemes, credentials and internal hostnames', () => {
  for (const u of ['file:///etc/passwd', 'ftp://example.com', 'gopher://x', 'http://user:pw@example.com', 'http://localhost/', 'http://printer.local/',
    'http://127.0.0.1:3001/api', 'http://[::1]/', 'http://2130706433/', 'http://0x7f.1/', 'not a url']) {
    assert.throws(() => parsePublicHttpUrl(u), UrlBlockedError, u);
  }
  assert.equal(parsePublicHttpUrl('https://example.com/a?b=1').hostname, 'example.com');
});

test('safeFetchText refuses to reach a loopback server, even through a redirect', async () => {
  const secret = http.createServer((_req, res) => res.end('top secret'));
  await new Promise<void>(r => secret.listen(0, '127.0.0.1', r));
  const port = (secret.address() as AddressInfo).port;
  try {
    await assert.rejects(() => safeFetchText(`http://127.0.0.1:${port}/`), UrlBlockedError);
    await assert.rejects(() => safeFetchText(`http://localhost:${port}/`), UrlBlockedError);
  } finally {
    secret.close();
  }
});
