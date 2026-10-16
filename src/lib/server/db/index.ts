import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';
import { config } from '../config';

export type DB = BetterSQLite3Database<typeof schema>;

/** Opens a database file (or ':memory:') and applies all pending migrations. */
export function createDb(file: string, migrationsFolder = config.migrationsDir): DB {
	if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
	const client = new Database(file);
	client.pragma('journal_mode = WAL');
	client.pragma('foreign_keys = ON');
	client.pragma('busy_timeout = 5000');
	const db = drizzle(client, { schema });
	migrate(db, { migrationsFolder });
	return db;
}

let instance: DB | undefined;

/** The app-wide database, opened lazily on first use. */
export function getDb(): DB {
	instance ??= createDb(config.databasePath);
	return instance;
}

/** Test hook: replace the app-wide database. */
export function setDb(db: DB | undefined) {
	instance = db;
}

export { schema };
