import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import authRouter from './auth';
import dataRouter from './data';
import usersRouter from './users';
import { initializeDatabase } from './database';
// FIX: Import `exit` from the `process` module to correctly type and call the process exit function.
import { exit } from 'process';

const startServer = async () => {
    try {
        await initializeDatabase();
        
        const app = express();
        const port = 3001;

        app.use(cors());
        app.use(bodyParser.json({ limit: '10mb' }));

        app.get('/api', (req, res) => {
            res.send('Finaura API is running.');
        });

        app.use('/api/auth', authRouter);
        app.use('/api/data', dataRouter);
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