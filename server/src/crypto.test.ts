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
    console.error('✕ Test 1 Failed:', e.message);
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
    console.log('✓ Test 2 Passed: Connection sanitization & secret redacting');
} catch (e: any) {
    console.error('✕ Test 2 Failed:', e.message);
}

console.log('--- All Crypto Unit Tests Executed Successfully ---');
