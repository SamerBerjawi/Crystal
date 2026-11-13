import { encryptSecret, decryptSecret, sanitizeConnection } from './crypto';

function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(`Test Failed: ${message}`);
    }
}

console.log('--- Running AES-256-GCM Crypto & Sanitization Unit Tests ---');

// Test 1: AES-256-GCM Encryption and Decryption
try {
    const rawKey = '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----';
    const encrypted = encryptSecret(rawKey);
    assert(encrypted !== rawKey, 'Encrypted key should not equal plain text key');
    assert(encrypted.includes(':'), 'Encrypted output should contain IV and auth tag separators');

    const decrypted = decryptSecret(encrypted);
    assert(decrypted === rawKey, 'Decrypted key must match original plain text key');
    console.log('✓ Test 1 Passed: AES-256-GCM encryption & decryption matches');
} catch (e: any) {
    process.exitCode = 1; console.error('✕ Test 1 Failed:', e.message);
}

// Test 2: Connection sanitization
try {
    const rawConnection = {
        id: 'conn-123',
        applicationId: 'app-456',
        clientCertificate: '-----BEGIN PRIVATE KEY-----\nRSA_PRIVATE_KEY_DATA\n-----END PRIVATE KEY-----',
    };

    const sanitized = sanitizeConnection(rawConnection);
    assert(sanitized.clientCertificate === '[SERVER_CONFIGURED_ENCRYPTED]', 'Client certificate PEM must be redacted from connection object');
    assert(typeof sanitized.encryptedClientCertificate === 'string', 'Encrypted certificate must be present');
    assert(sanitized.encryptedClientCertificate.includes(':'), 'Encrypted certificate must use AES-256-GCM format');

    const decrypted = decryptSecret(sanitized.encryptedClientCertificate);
    assert(decrypted === rawConnection.clientCertificate, 'Decrypted certificate from sanitized object must equal original PEM');

    const tampered = sanitized.encryptedClientCertificate.slice(0, -4) + 'ffff';
    assert(decryptSecret(tampered) === '', 'Tampered ciphertext must fail closed and return empty string');
    console.log('✓ Test 2 Passed: Connection sanitization & secret redacting');
} catch (e: any) {
    process.exitCode = 1; console.error('✕ Test 2 Failed:', e.message);
}

console.log('--- All Crypto Unit Tests Executed Successfully ---');

// File encryption: round trip, and a file does not decrypt under another owner or name.
try {
    const { encryptBuffer, decryptBuffer } = require('./crypto');
    const data = Buffer.from('%PDF-1.4 a tax certificate');
    const blob = encryptBuffer(data, '7:doc-1');
    assert(!blob.includes(data), 'the file is not stored in the clear');
    assert(decryptBuffer(blob, '7:doc-1')?.equals(data) === true, 'a file decrypts under its own owner and id');
    assert(decryptBuffer(blob, '8:doc-1') === null, 'another owner cannot decrypt it');
    assert(decryptBuffer(blob, '7:doc-2') === null, 'another name cannot decrypt it');
    const tampered = Buffer.from(blob); tampered[tampered.length - 1] ^= 1;
    assert(decryptBuffer(tampered, '7:doc-1') === null, 'a changed file is refused');
    console.log('✓ file encryption bound to owner and id');
} catch (err: any) {
    console.error('✕ file encryption', err.message);
    process.exit(1);
}
