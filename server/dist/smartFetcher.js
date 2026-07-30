"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const middleware_1 = require("./middleware");
const urlValidator_1 = require("./urlValidator");
const smartFetcherRouter = express_1.default.Router();
smartFetcherRouter.use(middleware_1.authenticateToken);
smartFetcherRouter.get('/', async (req, res) => {
    const targetUrl = req.query.url;
    const cookies = typeof req.query.cookies === 'string' ? req.query.cookies : '';
    if (!targetUrl || typeof targetUrl !== 'string') {
        return res.status(400).json({ error: 'A URL query param is required.' });
    }
    const validation = (0, urlValidator_1.isAllowedTargetUrl)(targetUrl);
    if (!validation.allowed) {
        return res.status(403).json({ error: validation.reason || 'Forbidden target domain.' });
    }
    try {
        const url = new URL(targetUrl);
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
                ...(cookies ? { Cookie: cookies } : {}),
            },
        });
        if (!response.ok) {
            return res.status(response.status).json({ error: `Failed to fetch target (${response.status})` });
        }
        const html = await response.text();
        res.type('text/html').send(html);
    }
    catch (error) {
        console.error('Smart fetch proxy failed', error);
        res.status(500).json({ error: 'Unable to fetch the requested page.' });
    }
});
exports.default = smartFetcherRouter;
