"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const auth_1 = __importDefault(require("./auth"));
const data_1 = __importDefault(require("./data"));
const users_1 = __importDefault(require("./users"));
const enableBanking_1 = __importDefault(require("./enableBanking"));
const smartFetcher_1 = __importDefault(require("./smartFetcher"));
const database_1 = require("./database");
const process_1 = require("process");
const startServer = async () => {
    try {
        await (0, database_1.initializeDatabase)();
        const app = (0, express_1.default)();
        const port = 3001;
        app.set('trust proxy', true);
        const defaultOrigins = [
            'http://localhost:5173',
            'http://127.0.0.1:5173',
            'http://localhost:3000',
            'http://127.0.0.1:3000',
        ];
        const configuredOrigins = (process.env.CORS_ORIGIN || '')
            .split(',')
            .map(origin => origin.trim())
            .filter(Boolean);
        const allowAllOrigins = configuredOrigins.length === 0;
        const allowedOrigins = new Set(configuredOrigins.length > 0 ? configuredOrigins : defaultOrigins);
        app.use((0, cors_1.default)({
            origin: (origin, callback) => {
                if (allowAllOrigins) {
                    return callback(null, true);
                }
                if (!origin || allowedOrigins.has(origin)) {
                    return callback(null, true);
                }
                return callback(new Error('Origin not allowed by CORS policy.'));
            },
            credentials: true,
        }));
        const bodyLimit = process.env.API_BODY_LIMIT || '50mb';
        app.use(express_1.default.json({ limit: bodyLimit }));
        app.use(express_1.default.urlencoded({ limit: bodyLimit, extended: true }));
        app.get('/api', (req, res) => {
            res.send('Crystal API is running.');
        });
        app.use('/api/auth', auth_1.default);
        app.use('/api/data', data_1.default);
        app.use('/api/enable-banking', enableBanking_1.default);
        app.use('/api/users', users_1.default);
        app.use('/api/smart-fetch', smartFetcher_1.default);
        app.listen(port, () => {
            console.log(`Server is running on http://localhost:${port}`);
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        (0, process_1.exit)(1);
    }
};
startServer();
