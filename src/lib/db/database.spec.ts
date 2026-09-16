import { describe, expect, it } from 'vitest';
import { dbKeyFor } from './database';

describe('dbKeyFor', () => {
	it('uses the legacy device key when logged out', () => {
		expect(dbKeyFor(null)).toBe('ling_db_v1');
	});

	it('namespaces the store per account id', () => {
		const a = dbKeyFor('user-1');
		const b = dbKeyFor('user-2');
		expect(a).toContain('user-1');
		expect(a).not.toBe(b);
		expect(a).not.toBe('ling_db_v1');
	});
});
