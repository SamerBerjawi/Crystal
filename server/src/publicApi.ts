import express, { Response } from 'express';
import { db } from './database';
import { AuthRequest } from './middleware';
import { authenticateApiToken, SCOPES } from './apiTokens';
import { investmentsView, planningView, summaryView, transactionsView } from './apiViews';

/** The read-only API for scoped tokens. Every route is a GET over the user's own data, and nothing writes. */
const router = express.Router();

const loadData = async (userId: number) => (await db.query(`SELECT data FROM financial_data WHERE user_id = $1`, [userId])).rows?.[0]?.data ?? {};
const text = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
const int = (v: unknown) => (typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : undefined);

const route = (path: string, scope: typeof SCOPES[number], build: (data: any, req: AuthRequest) => unknown) =>
    router.get(path, ...authenticateApiToken(scope), async (req: AuthRequest, res: Response) => {
        try {
            res.set('Cache-Control', 'no-store').json(build(await loadData(req.user!.id), req));
        } catch (error) {
            console.error(`API ${path} failed`, error);
            res.status(500).json({ message: 'Unable to read that.' });
        }
    });

route('/summary', 'summary', data => summaryView(data));
route('/transactions', 'transactions', (data, req) => transactionsView(data, {
    from: text(req.query.from), to: text(req.query.to), category: text(req.query.category), accountId: text(req.query.accountId),
    type: text(req.query.type), limit: int(req.query.limit), offset: int(req.query.offset),
}));
route('/investments', 'investments', data => investmentsView(data));
route('/planning', 'planning', data => planningView(data));

export default router;
