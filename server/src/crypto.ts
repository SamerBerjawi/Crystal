import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard for AES-GCM

const getEncryptionKey = (): Buffer => {
    const secret = (process.env.ENCRYPTION_SECRET || process.env.JWT_SECRET || 'crystal-default-encryption-secret-key-32b').trim();
    return crypto.createHash('sha256').update(secret).digest();
};

export const encryptSecret = (text: string): string => {
    if (!text || typeof text !== 'string') return '';
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = getEncryptionKey();
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};

export const decryptSecret = (cipherText: string): string => {
    if (!cipherText || typeof cipherText !== 'string') return '';
    if (!cipherText.includes(':')) {
        // Unencrypted legacy string
        return cipherText;
    }

    try {
        const parts = cipherText.split(':');
        if (parts.length !== 3) return cipherText;

        const [ivHex, authTagHex, encryptedHex] = parts;
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const key = getEncryptionKey();

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (err) {
        console.error('Failed to decrypt secret:', err);
        return cipherText;
    }
};

export const sanitizeConnection = (connection: any): any => {
    if (!connection || typeof connection !== 'object') return connection;
    const sanitized = { ...connection };
    if (sanitized.clientCertificate) {
        // Store encrypted version in DB if needed, but do not expose raw PEM key to client
        if (!sanitized.clientCertificate.includes(':')) {
            sanitized.encryptedClientCertificate = encryptSecret(sanitized.clientCertificate);
        } else {
            sanitized.encryptedClientCertificate = sanitized.clientCertificate;
        }
        sanitized.clientCertificate = '[SERVER_CONFIGURED_ENCRYPTED]';
    }
    return sanitized;
};
