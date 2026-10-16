import type { DB } from './db';
import type { SessionUser } from './auth';
import type { ExpenseInput } from './expenses';

/**
 * Snapshot budget usage before a save; the returned function lists the
 * budgets that crossed a threshold because of it. (Implemented in step 8.)
 */
export function alertsAfterSave(
	_db: DB,
	_user: SessionUser,
	_input: ExpenseInput,
	_expenseId?: number
): () => string[] {
	return () => [];
}
