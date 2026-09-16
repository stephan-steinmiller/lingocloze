import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { SQL_SCHEMA } from './sql-schema';

const DB_NAME = 'ling.db';

let sqlite: SQLiteConnection | null = null;
let initPromise: Promise<boolean> | null = null;

/**
 * Initialise the native SQLite database. Only runs inside a Capacitor native
 * shell (iOS/Android) — on web the app uses the localStorage document store
 * in database.ts, so this resolves false immediately without touching
 * jeep-sqlite. (jeep-sqlite needs a <jeep-sqlite> DOM element and an
 * IndexedDB-backed web store; attempting it on every web load only produced
 * console noise, so web SQLite stays opt-in for later via registerWebSqlite.)
 */
export function initNativeDatabase(): Promise<boolean> {
	if (initPromise) return initPromise;
	initPromise = (async () => {
		try {
			if (Capacitor.getPlatform() === 'web') return false;
			if (!sqlite) sqlite = new SQLiteConnection(CapacitorSQLite);
			const conn = await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
			await conn.open();
			await conn.execute(SQL_SCHEMA);
			await sqlite.closeConnection(DB_NAME, false);
			return true;
		} catch (err) {
			console.warn('[db] native SQLite unavailable, using localStorage store:', err);
			return false;
		}
	})();
	return initPromise;
}

/**
 * Opt-in browser SQLite via the jeep-sqlite web component. Requires a
 * <jeep-sqlite> element in the DOM (see @capacitor-community/sqlite docs).
 * Not called by the app shell — kept for the future native/web migration.
 */
export async function registerWebSqlite(): Promise<void> {
	try {
		if (Capacitor.getPlatform() !== 'web') return;
		if (typeof customElements !== 'undefined' && customElements.get('jeep-sqlite')) return;
		const loader = await import('jeep-sqlite/loader');
		loader.defineCustomElements(window);
	} catch (err) {
		console.warn('[db] jeep-sqlite loader failed (localStorage fallback still works):', err);
	}
}
