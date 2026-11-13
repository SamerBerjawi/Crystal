import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import express, { Response } from 'express';
import { z } from 'zod';
import { db } from './database';
import { AuthRequest } from './middleware';
import { decryptBuffer, encryptBuffer } from './crypto';
import { createRateLimiter } from './rateLimit';
import { ZipWriter, zipName } from './zipStream';

/*
 * Tax documents: receipts, statements and certificates, kept on the server's disk, one encrypted file each.
 * The file is encrypted with the server secret, bound to its owner and id (crypto.ts), and never served inline.
 * There is no OCR and nothing is sent anywhere. Back the folder up with the rest of the config volume.
 */

const MB = 1024 * 1024;
export const MAX_FILE_BYTES = Math.max(1, Number(process.env.TAX_DOC_MAX_MB) || 10) * MB;
export const MAX_USER_BYTES = Math.max(10, Number(process.env.TAX_DOC_USER_MAX_MB) || 500) * MB;
export const MAX_DOCS_PER_USER = 1000;
const MAX_CSV_BYTES = 5 * MB;

export const docsRoot = () => path.resolve(process.env.TAX_DOCS_DIR || path.join(process.cwd(), 'config', 'tax-docs'));
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const fileFor = (userId: number, id: string) => path.join(docsRoot(), String(userId), `${id}.bin`);
const contextFor = (userId: number, id: string) => `${userId}:${id}`;

/** What a file really is, from its first bytes. The type the browser claims is never trusted on its own. */
export const sniffType = (data: Buffer): string | null => {
    if (data.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
    if (data.length > 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
    if (data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
    if (data.length > 12 && data.subarray(0, 4).toString('latin1') === 'RIFF' && data.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
    // Plain text and CSV: no NUL bytes in the first 8 KB.
    if (data.length > 0 && !data.subarray(0, 8192).includes(0)) return 'text/plain';
    return null;
};

export const EXTENSION: Record<string, string> = { 'application/pdf': '.pdf', 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'text/plain': '.txt' };

/** Why an upload is refused, or null. `used` and `count` are what the owner already holds. */
export const uploadProblem = (size: number, type: string | null, used: number, count: number): string | null => {
    if (size === 0) return 'The file is empty.';
    if (size > MAX_FILE_BYTES) return `The file is larger than ${Math.round(MAX_FILE_BYTES / MB)} MB.`;
    if (!type) return 'Only PDF, PNG, JPEG, WebP and plain text or CSV files are accepted.';
    if (count >= MAX_DOCS_PER_USER) return `You have reached ${MAX_DOCS_PER_USER} documents.`;
    if (used + size > MAX_USER_BYTES) return `This would go over your ${Math.round(MAX_USER_BYTES / MB)} MB of document space.`;
    return null;
};

const uploadSchema = z.object({
    year: z.number().int().min(1990).max(2100),
    label: z.string().trim().min(1).max(120),
    filename: z.string().trim().min(1).max(200),
    content: z.string().min(1),
    checklistKey: z.string().trim().max(80).optional(),
    transactionId: z.string().trim().max(100).optional(),
});

const patchSchema = z.object({
    label: z.string().trim().min(1).max(120).optional(),
    year: z.number().int().min(1990).max(2100).optional(),
    checklistKey: z.string().trim().max(80).nullable().optional(),
}).strict();

const exportSchema = z.object({
    year: z.number().int().min(1990).max(2100),
    files: z.array(z.object({ name: z.string().trim().min(1).max(100), content: z.string().max(MAX_CSV_BYTES) })).max(20),
});

const limiter = createRateLimiter({ namespace: 'tax-docs', windowMs: 60 * 60 * 1000, maxAttempts: 200, blockMs: 60 * 1000, message: 'Too many document requests. Try again later.', key: (req: any) => String(req.user?.id ?? req.ip ?? 'unknown') });

const view = (row: any) => ({
    id: row.id, year: row.tax_year, label: row.label, filename: row.filename, mime: row.mime, size: Number(row.size_bytes),
    checklistKey: row.checklist_key ?? null, transactionId: row.transaction_id ?? null, createdAt: row.created_at,
});

const router = express.Router();

router.use(limiter);

router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const year = Number(req.query.year);
        const rows = (await db.query(
            `SELECT * FROM tax_documents WHERE user_id = $1 ${Number.isInteger(year) ? 'AND tax_year = $2' : ''} ORDER BY created_at DESC`,
            Number.isInteger(year) ? [req.user!.id, year] : [req.user!.id],
        )).rows;
        const usage = (await db.query(`SELECT COALESCE(SUM(size_bytes), 0) AS used, COUNT(*) AS count FROM tax_documents WHERE user_id = $1`, [req.user!.id])).rows[0];
        res.json({ documents: rows.map(view), usage: { usedBytes: Number(usage.used), documents: Number(usage.count), maxBytes: MAX_USER_BYTES, maxFileBytes: MAX_FILE_BYTES } });
    } catch (err) {
        console.error('Listing tax documents failed:', err);
        res.status(500).json({ message: 'Could not load the documents.' });
    }
});

router.post('/', async (req: AuthRequest, res: Response) => {
    const parsed = uploadSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'The upload is not valid.' });
    const { year, label, filename, content, checklistKey, transactionId } = parsed.data;
    try {
        if (!/^[A-Za-z0-9+/]+={0,2}$/.test(content) || content.length > Math.ceil(MAX_FILE_BYTES / 3) * 4 + 8) return res.status(400).json({ message: 'The file is not valid or is too large.' });
        const data = Buffer.from(content, 'base64');
        const usage = (await db.query(`SELECT COALESCE(SUM(size_bytes), 0) AS used, COUNT(*) AS count FROM tax_documents WHERE user_id = $1`, [req.user!.id])).rows[0];
        const type = sniffType(data);
        const problem = uploadProblem(data.length, type, Number(usage.used), Number(usage.count));
        if (problem) return res.status(400).json({ message: problem });

        const id = crypto.randomUUID();
        const target = fileFor(req.user!.id, id);
        await fs.promises.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
        const partial = `${target}.part`;
        await fs.promises.writeFile(partial, encryptBuffer(data, contextFor(req.user!.id, id)), { mode: 0o600 });
        await fs.promises.rename(partial, target);
        try {
            const row = (await db.query(
                `INSERT INTO tax_documents (id, user_id, tax_year, label, filename, mime, size_bytes, checklist_key, transaction_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
                [id, req.user!.id, year, label, filename, type, data.length, checklistKey || null, transactionId || null],
            )).rows[0];
            res.status(201).json(view(row));
        } catch (err) {
            await fs.promises.rm(target, { force: true });
            throw err;
        }
    } catch (err) {
        console.error('Saving a tax document failed:', err);
        res.status(500).json({ message: 'Could not save the document. Check that the server can write to its documents folder.' });
    }
});

router.get('/:id/file', async (req: AuthRequest, res: Response) => {
    if (!idPattern.test(req.params.id)) return res.status(404).json({ message: 'Document not found.' });
    try {
        const row = (await db.query(`SELECT * FROM tax_documents WHERE id = $1 AND user_id = $2`, [req.params.id, req.user!.id])).rows[0];
        if (!row) return res.status(404).json({ message: 'Document not found.' });
        const blob = await fs.promises.readFile(fileFor(req.user!.id, row.id)).catch(() => null);
        if (!blob) return res.status(410).json({ message: 'The file is missing from the server. Restore it from your backup.' });
        const data = decryptBuffer(blob, contextFor(req.user!.id, row.id));
        if (!data) return res.status(500).json({ message: 'The file could not be decrypted. Was the server secret changed?' });
        res.setHeader('Content-Type', row.mime);
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(row.filename)}`);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', 'sandbox');
        res.setHeader('Cache-Control', 'no-store');
        res.send(data);
    } catch (err) {
        console.error('Reading a tax document failed:', err);
        res.status(500).json({ message: 'Could not read the document.' });
    }
});

router.patch('/:id', async (req: AuthRequest, res: Response) => {
    const parsed = patchSchema.safeParse(req.body);
    if (!idPattern.test(req.params.id) || !parsed.success) return res.status(400).json({ message: 'The change is not valid.' });
    try {
        const current = (await db.query(`SELECT * FROM tax_documents WHERE id = $1 AND user_id = $2`, [req.params.id, req.user!.id])).rows[0];
        if (!current) return res.status(404).json({ message: 'Document not found.' });
        const next = { ...parsed.data };
        const row = (await db.query(
            `UPDATE tax_documents SET label = $3, tax_year = $4, checklist_key = $5 WHERE id = $1 AND user_id = $2 RETURNING *`,
            [req.params.id, req.user!.id, next.label ?? current.label, next.year ?? current.tax_year, next.checklistKey === undefined ? current.checklist_key : next.checklistKey],
        )).rows[0];
        res.json(view(row));
    } catch (err) {
        console.error('Updating a tax document failed:', err);
        res.status(500).json({ message: 'Could not update the document.' });
    }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
    if (!idPattern.test(req.params.id)) return res.status(404).json({ message: 'Document not found.' });
    try {
        const row = (await db.query(`DELETE FROM tax_documents WHERE id = $1 AND user_id = $2 RETURNING id`, [req.params.id, req.user!.id])).rows[0];
        if (!row) return res.status(404).json({ message: 'Document not found.' });
        await fs.promises.rm(fileFor(req.user!.id, row.id), { force: true });
        res.status(204).end();
    } catch (err) {
        console.error('Deleting a tax document failed:', err);
        res.status(500).json({ message: 'Could not delete the document.' });
    }
});

/** One zip: the summary files the browser built, and every document for the year, decrypted. */
router.post('/export', async (req: AuthRequest, res: Response) => {
    const parsed = exportSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'The export is not valid.' });
    const { year, files } = parsed.data;
    try {
        const rows = (await db.query(`SELECT * FROM tax_documents WHERE user_id = $1 AND tax_year = $2 ORDER BY created_at`, [req.user!.id, year])).rows;
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="crystal-tax-pack-${year}.zip"`);
        res.setHeader('Cache-Control', 'no-store');
        const zip = new ZipWriter(res);
        const taken = new Set<string>();
        const missing: string[] = [];
        for (const file of files) await zip.add(zipName(file.name, taken), Buffer.from(file.content, 'utf8'));
        for (const row of rows) {
            const blob = await fs.promises.readFile(fileFor(req.user!.id, row.id)).catch(() => null);
            const data = blob ? decryptBuffer(blob, contextFor(req.user!.id, row.id)) : null;
            if (!data) { missing.push(row.filename); continue; }
            await zip.add(`documents/${zipName(`${row.label} - ${row.filename}`, taken)}`, data);
        }
        if (missing.length) await zip.add(zipName('MISSING FILES.txt', taken), Buffer.from(`These documents could not be read from the server and are not in this pack:\n\n${missing.join('\n')}\n`, 'utf8'));
        await zip.finish();
        res.end();
    } catch (err) {
        console.error('Exporting the tax pack failed:', err);
        if (!res.headersSent) res.status(500).json({ message: 'Could not build the pack.' });
        else res.destroy();
    }
});

export default router;
