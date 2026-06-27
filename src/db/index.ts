import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const globalForDb = globalThis as unknown as {
  conn: Pool | undefined;
};

const databaseUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/deploy';

const conn = globalForDb.conn ?? new Pool({
  connectionString: databaseUrl,
});

if (process.env.NODE_ENV !== 'production') {
  globalForDb.conn = conn;
}

export const db = drizzle(conn, { schema });
export type DbClient = typeof db;
export * from './schema';
