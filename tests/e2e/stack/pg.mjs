// Starts a throwaway PostgreSQL for the QA stack (data in tests/e2e/.stack/pgdata).
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
const dir = new URL('../.stack/pgdata', import.meta.url).pathname;
const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'crystal', password: 'crystal_qa_pw', port: Number(process.env.QA_PG_PORT || 54329), persistent: true });
const fresh = !existsSync(dir);
if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase('crystal');
console.log('PG READY');
const stop = async () => { await pg.stop(); process.exit(0); };
process.on('SIGTERM', stop); process.on('SIGINT', stop);
setInterval(() => {}, 1 << 30);
