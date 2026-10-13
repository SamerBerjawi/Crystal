import { db } from './database';
import { decryptSecret, encryptSecret } from './crypto';

export interface EnableBankingCredentials { applicationId: string; clientCertificate: string }

export const loadCredentials = async (userId: number | string): Promise<EnableBankingCredentials | null> => {
    const result = await db.query(
        `SELECT application_id, encrypted_key FROM enable_banking_credentials WHERE user_id = $1`,
        [userId]
    );
    const row = result.rows?.[0];
    if (!row) return null;
    return { applicationId: row.application_id, clientCertificate: decryptSecret(row.encrypted_key) };
};

export const saveCredentials = async (userId: number | string, applicationId: string, clientCertificate: string) => {
    await db.query(
        `INSERT INTO enable_banking_credentials (user_id, application_id, encrypted_key)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE
         SET application_id = EXCLUDED.application_id, encrypted_key = EXCLUDED.encrypted_key, updated_at = NOW()`,
        [userId, applicationId, encryptSecret(clientCertificate)]
    );
};

export const deleteCredentials = async (userId: number | string) => {
    await db.query(`DELETE FROM enable_banking_credentials WHERE user_id = $1`, [userId]);
};

/**
 * Removes `clientCertificate` from every stored connection and pending connection of the user's blob, in one
 * atomic statement that touches only those two keys. Returns true when something was removed.
 */
export const scrubStoredKeys = async (userId: number | string): Promise<void> => {
    await db.query(
        `UPDATE financial_data SET data =
            CASE WHEN jsonb_typeof(data->'enableBankingConnections') = 'array' THEN
                jsonb_set(data, '{enableBankingConnections}',
                    COALESCE((SELECT jsonb_agg(elem - 'clientCertificate' - 'encryptedClientCertificate')
                              FROM jsonb_array_elements(data->'enableBankingConnections') elem), '[]'::jsonb))
            ELSE data END
         WHERE user_id = $1`,
        [userId]
    );
    await db.query(
        `UPDATE financial_data SET data =
            jsonb_set(data, '{enableBankingPendingConnections}',
                COALESCE((SELECT jsonb_object_agg(t.k, t.v - 'clientCertificate' - 'encryptedClientCertificate')
                          FROM jsonb_each(data->'enableBankingPendingConnections') AS t(k, v)), '{}'::jsonb))
         WHERE user_id = $1 AND jsonb_typeof(data->'enableBankingPendingConnections') = 'object'`,
        [userId]
    );
};

export const stripKeyFromConnection = <T extends Record<string, any>>(connection: T): T => {
    if (!connection || typeof connection !== 'object') return connection;
    const { clientCertificate, encryptedClientCertificate, ...rest } = connection as any;
    return rest as T;
};

export const stripKeysFromBlob = (data: Record<string, any>): { data: Record<string, any>; found: EnableBankingCredentials | null } => {
    let found: EnableBankingCredentials | null = null;
    const noteKey = (c: any) => {
        if (!found && c && typeof c.clientCertificate === 'string' && c.clientCertificate.trim() && c.applicationId) {
            found = { applicationId: String(c.applicationId), clientCertificate: c.clientCertificate.trim() };
        }
    };
    const out = { ...data };
    if (Array.isArray(out.enableBankingConnections)) {
        out.enableBankingConnections = out.enableBankingConnections.map((c: any) => { noteKey(c); return stripKeyFromConnection(c); });
    }
    if (out.enableBankingPendingConnections && typeof out.enableBankingPendingConnections === 'object') {
        out.enableBankingPendingConnections = Object.fromEntries(
            Object.entries(out.enableBankingPendingConnections).map(([k, c]: [string, any]) => { noteKey(c); return [k, stripKeyFromConnection(c)]; })
        );
    }
    return { data: out, found };
};
