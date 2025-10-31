// FIX: Consolidate express imports into a single statement to resolve type conflicts and errors related to Request and Response objects.
import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeDatabase } from './database';
import { authRouter } from './auth';
import { dataRouter } from './data';
import { usersRouter } from './users';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API routes
app.use('/api/auth', authRouter);
app.use('/api/data', dataRouter);
app.use('/api/users', usersRouter);

// FIX: Explicitly type req and res with express.Request and express.Response to resolve overload and property-not-found errors.
// FIX: Use directly imported Request and Response types.
app.get('/', (req: Request, res: Response) => {
  res.send('Finaura Backend is running!');
});

initializeDatabase().then(() => {
  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
}).catch(error => {
  console.error("Failed to connect to the database. Server is not starting.", error);
  process.exit(1);
});
