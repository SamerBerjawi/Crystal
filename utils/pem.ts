/** What a pasted or chosen `.pem` file holds, so a certificate is not mistaken for the signing key. */
export type PemKind = 'private-key' | 'encrypted-private-key' | 'certificate' | 'unknown' | 'empty';

export function classifyPem(text: string): PemKind {
  const value = text.trim();
  if (!value) return 'empty';
  // A file with both (key and certificate in one .pem) is fine: the key is what signs requests.
  if (/-----BEGIN ENCRYPTED PRIVATE KEY-----/.test(value)) return 'encrypted-private-key';
  if (/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/.test(value)) return 'private-key';
  if (/-----BEGIN CERTIFICATE-----/.test(value)) return 'certificate';
  return 'unknown';
}

/** A user-facing problem with the text, or null when it can be used as the Enable Banking signing key. */
export function pemProblem(text: string): string | null {
  switch (classifyPem(text)) {
    case 'private-key': return null;
    case 'empty': return 'Paste or choose your private key (.pem).';
    case 'certificate': return 'That is the certificate. Crystal needs the private key, the file that starts with -----BEGIN PRIVATE KEY-----. The certificate is only for the Enable Banking control panel.';
    case 'encrypted-private-key': return 'That key is password protected. Export an unencrypted private key (-----BEGIN PRIVATE KEY-----).';
    default: return 'This does not look like a PEM private key. It should start with -----BEGIN PRIVATE KEY-----.';
  }
}
