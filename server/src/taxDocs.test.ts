import { MAX_FILE_BYTES, MAX_USER_BYTES, sniffType, uploadProblem } from './taxDocs';

const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(`Test Failed: ${message}`); };

assert(sniffType(Buffer.from('%PDF-1.7\n...')) === 'application/pdf', 'a PDF is recognised by its first bytes');
assert(sniffType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])) === 'image/png', 'a PNG is recognised');
assert(sniffType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0])) === 'image/jpeg', 'a JPEG is recognised');
assert(sniffType(Buffer.from('RIFF\u0000\u0000\u0000\u0000WEBPVP8 ', 'latin1')) === 'image/webp', 'a WebP is recognised');
assert(sniffType(Buffer.from('date,amount\n2025-01-01,10\n')) === 'text/plain', 'a CSV is plain text');
assert(sniffType(Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03])) === null, 'an executable is refused');
assert(sniffType(Buffer.from('<html><script>alert(1)</script></html>')) === 'text/plain', 'HTML is only ever served as text, as a download');
assert(sniffType(Buffer.alloc(0)) === null, 'nothing is not a file');
console.log('✓ file types come from the bytes');

assert(uploadProblem(1000, 'application/pdf', 0, 0) === null, 'a normal file is accepted');
assert(/empty/.test(uploadProblem(0, 'application/pdf', 0, 0) ?? ''), 'an empty file is refused');
assert(/larger/.test(uploadProblem(MAX_FILE_BYTES + 1, 'application/pdf', 0, 0) ?? ''), 'a file over the cap is refused');
assert(/Only PDF/.test(uploadProblem(10, null, 0, 0) ?? ''), 'an unknown type is refused');
assert(/space/.test(uploadProblem(1000, 'application/pdf', MAX_USER_BYTES - 500, 3) ?? ''), 'going over the space is refused');
assert(/1000 documents/.test(uploadProblem(10, 'application/pdf', 0, 1000) ?? ''), 'too many documents is refused');
console.log('✓ caps');
console.log('All tax document tests passed.');
