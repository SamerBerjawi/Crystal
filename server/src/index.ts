

import express, { RequestHandler } from 'express';
import cors from 'cors';
import authRouter from './auth';
import dataRouter from './data';
import usersRouter from './users';
import enableBankingRouter from './enableBanking';
import { initializeDatabase } from './database';
// FIX: Import `exit` from the `process` module to correctly type and call the process exit function.
import { exit } from 'process';

const startServer = async () => {
    try {
        await initializeDatabase();
        
        const app = express();
        const port = 3001;

        app.use(cors());
        const bodyLimit = process.env.API_BODY_LIMIT || '50mb';
        // FIX: Removed the unnecessary cast to `RequestHandler` which was causing a type conflict and preventing correct overload resolution for `app.use`.
        app.use(express.json({ limit: bodyLimit }));
        // FIX: Removed the unnecessary cast to `RequestHandler` which was causing a type conflict and preventing correct overload resolution for `app.use`.
        app.use(express.urlencoded({ limit: bodyLimit, extended: true }));

        app.get('/api', (req, res) => {
            res.send('Crystal API is running.');
        });

        app.use('/api/auth', authRouter);
        app.use('/api/data', dataRouter);
        app.use('/api/enable-banking', enableBankingRouter);
        app.use('/api/users', usersRouter);

        app.listen(port, () => {
            console.log(`Server is running on http://localhost:${port}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        exit(1);
    }
};

startServer();
