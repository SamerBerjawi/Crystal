/*
 * Runs the real /api/tax-docs router against a temporary folder, with the database stubbed. It checks what the unit
 * tests cannot: that a file is encrypted on disk, comes back whole, belongs to one owner, refuses a disguised
 * executable and an oversize file, and that the zip export holds the summary and the documents.
 */
import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import jwt from 'jsonwebtoken';
import { execFileSync } from 'child_process';
import type { AddressInfo } from 'net';

const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'taxdocs-'));
process.env.TAX_DOCS_DIR = folder;
process.env.TAX_DOC_MAX_MB = '1';

import { db } from './database';
import { JWT_SECRET } from './authConfig';
import { authenticateToken } from './middleware';
// Loaded after the environment is set: the caps are read when the module loads.
const taxDocsRouter = require('./taxDocs').default;

function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(`Test Failed: ${message}`);
}

let rows: any[] = [];
(db as any).query = async (sql: string, params: any[] = []) => {
    if (/FROM user_sessions/.test(sql)) return { rows: [{ id: params[0], locked_at: null }] };
    if (/UPDATE user_sessions/.test(sql)) return { rows: [] };
    if (/SUM\(size_bytes\)/.test(sql)) {
        const mine = rows.filter(r => r.user_id === params[0]);
        return { rows: [{ used: String(mine.reduce((n, r) => n + r.size_bytes, 0)), count: String(mine.length) }] };
    }
    if (/INSERT INTO tax_documents/.test(sql)) {
        const row = { id: params[0], user_id: params[1], tax_year: params[2], label: params[3], filename: params[4], mime: params[5], size_bytes: params[6], checklist_key: params[7], transaction_id: params[8], created_at: new Date().toISOString() };
        rows.push(row);
        return { rows: [row] };
    }
    if (/DELETE FROM tax_documents/.test(sql)) { const hit = rows.filter(r => r.id === params[0] && r.user_id === params[1]); rows = rows.filter(r => !hit.includes(r)); return { rows: hit }; }
    if (/UPDATE tax_documents/.test(sql)) { const row = rows.find(r => r.id === params[0] && r.user_id === params[1]); if (row) { row.label = params[2]; row.tax_year = params[3]; row.checklist_key = params[4]; } return { rows: row ? [row] : [] }; }
    if (/FROM tax_documents WHERE id/.test(sql)) return { rows: rows.filter(r => r.id === params[0] && r.user_id === params[1]) };
    if (/FROM tax_documents WHERE user_id = \$1 AND tax_year/.test(sql)) return { rows: rows.filter(r => r.user_id === params[0] && r.tax_year === params[1]) };
    if (/FROM tax_documents/.test(sql)) return { rows: rows.filter(r => r.user_id === params[0] && (params[1] === undefined || r.tax_year === params[1])) };
    return { rows: [] };
};

const run = async () => {
    const app = express();
    app.use('/api/tax-docs', authenticateToken, express.json({ limit: '3mb' }), taxDocsRouter);
    const server = await new Promise<import('http').Server>(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const tokenFor = (id: number) => jwt.sign({ id, email: `u${id}@example.test`, sid: `s${id}` }, JWT_SECRET);
    const call = (userId: number, p: string, init: RequestInit = {}) => fetch(`${base}${p}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFor(userId)}`, ...init.headers } });
    const upload = (userId: number, bytes: Buffer, extra: Record<string, unknown> = {}) => call(userId, '/api/tax-docs', { method: 'POST', body: JSON.stringify({ year: 2025, label: 'Salary slip', filename: 'slip.pdf', content: bytes.toString('base64'), ...extra }) });

    try {
        const pdf = Buffer.from('%PDF-1.4\nthis is a secret certificate');
        const created = await upload(1, pdf);
        assert(created.status === 201, `an upload is accepted (got ${created.status})`);
        const doc: any = await created.json();
        assert(doc.mime === 'application/pdf' && doc.size === pdf.length, 'the type comes from the bytes');
        const onDisk = fs.readFileSync(path.join(folder, '1', `${doc.id}.bin`));
        assert(!onDisk.includes('secret certificate'), 'the file is encrypted on disk');
        console.log('✓ upload is encrypted at rest');

        const back = await call(1, `/api/tax-docs/${doc.id}/file`);
        assert(back.status === 200 && Buffer.from(await back.arrayBuffer()).equals(pdf), 'the file comes back whole');
        assert(/attachment/.test(back.headers.get('content-disposition') ?? '') && back.headers.get('x-content-type-options') === 'nosniff', 'it is a download, never shown inline');
        assert((await call(2, `/api/tax-docs/${doc.id}/file`)).status === 404, 'another user cannot read it');
        assert((await call(2, `/api/tax-docs/${doc.id}`, { method: 'DELETE' })).status === 404, 'another user cannot delete it');
        console.log('✓ download and ownership');

        const list: any = await (await call(1, '/api/tax-docs?year=2025')).json();
        assert(list.documents.length === 1 && list.usage.usedBytes === pdf.length, 'the list and the space used are right');
        assert((await (await call(2, '/api/tax-docs')).json() as any).documents.length === 0, 'another user sees none');

        const exe = await upload(1, Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]), { filename: 'invoice.pdf' });
        assert(exe.status === 400, 'a program renamed to .pdf is refused');
        const big = await upload(1, Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(1024 * 1024)]));
        assert(big.status === 400, `a file over the cap is refused (got ${big.status} ${await big.clone().text()})`);
        assert((await call(1, '/api/tax-docs', { method: 'POST', body: JSON.stringify({ year: 1800, label: 'x', filename: 'x.pdf', content: 'AAAA' }) })).status === 400, 'a bad year is refused');
        assert((await call(1, '/api/tax-docs', { method: 'POST', body: JSON.stringify({ year: 2025, label: 'x', filename: 'x.pdf', content: 'not base64!!' }) })).status === 400, 'bad base64 is refused');
        assert(fs.readdirSync(path.join(folder, '1')).filter(f => f.endsWith('.part')).length === 0, 'no partial files are left behind');
        console.log('✓ refusals');

        const renamed: any = await (await call(1, `/api/tax-docs/${doc.id}`, { method: 'PATCH', body: JSON.stringify({ label: 'P60', checklistKey: 'income-statement' }) })).json();
        assert(renamed.label === 'P60' && renamed.checklistKey === 'income-statement', 'a document can be relabelled and linked to a checklist item');

        const zipped = await call(1, '/api/tax-docs/export', { method: 'POST', body: JSON.stringify({ year: 2025, files: [{ name: 'income.csv', content: 'a,b\n1,2\n' }] }) });
        assert(zipped.status === 200 && zipped.headers.get('content-type') === 'application/zip', 'the export is a zip');
        const zipFile = path.join(folder, 'pack.zip');
        fs.writeFileSync(zipFile, Buffer.from(await zipped.arrayBuffer()));
        try {
            const listing = execFileSync('unzip', ['-l', zipFile]).toString();
            assert(/income\.csv/.test(listing) && /documents\/P60 - slip\.pdf/.test(listing), 'the zip holds the summary and the document');
            assert(execFileSync('unzip', ['-p', zipFile, 'documents/P60 - slip.pdf']).equals(pdf), 'the document in the zip is decrypted and whole');
            console.log('✓ export zip');
        } catch (err: any) {
            if (err?.code !== 'ENOENT') throw err;
            console.log('- unzip not installed; export not verified');
        }

        fs.rmSync(path.join(folder, '1', `${doc.id}.bin`));
        assert((await call(1, `/api/tax-docs/${doc.id}/file`)).status === 410, 'a file missing from disk says so');
        assert((await call(1, `/api/tax-docs/${doc.id}`, { method: 'DELETE' })).status === 204, 'a document can be deleted');
        assert(rows.length === 0, 'its record is gone');
        console.log('✓ missing file and delete');
    } finally {
        server.close();
        fs.rmSync(folder, { recursive: true, force: true });
    }
};

run().then(() => { console.log('All tax document integration tests passed.'); process.exit(0); }).catch(err => { console.error('✕', err.message); process.exit(1); });
