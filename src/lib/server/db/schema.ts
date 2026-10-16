import { sql } from 'drizzle-orm';
import {
	index,
	integer,
	primaryKey,
	real,
	sqliteTable,
	text,
	uniqueIndex
} from 'drizzle-orm/sqlite-core';

const createdAt = () =>
	integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch('subsec') * 1000)`);
const updatedAt = () =>
	integer('updated_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch('subsec') * 1000)`);
const userId = () =>
	integer('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' });

export const users = sqliteTable('users', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	username: text('username').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	displayName: text('display_name').notNull(),
	isAdmin: integer('is_admin', { mode: 'boolean' }).notNull().default(false),
	disabled: integer('disabled', { mode: 'boolean' }).notNull().default(false),
	monthStartDay: integer('month_start_day').notNull().default(1),
	createdAt: createdAt()
});

export const sessions = sqliteTable(
	'sessions',
	{
		id: text('id').primaryKey(),
		userId: userId(),
		expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull()
	},
	(t) => [index('sessions_user_idx').on(t.userId)]
);

export const budgets = sqliteTable(
	'budgets',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: userId(),
		name: text('name').notNull(),
		color: text('color').notNull(),
		icon: text('icon').notNull().default(''),
		alertThreshold: integer('alert_threshold').notNull().default(80),
		sortOrder: integer('sort_order').notNull().default(0),
		archived: integer('archived', { mode: 'boolean' }).notNull().default(false)
	},
	(t) => [index('budgets_user_idx').on(t.userId)]
);

export const budgetLimits = sqliteTable(
	'budget_limits',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: userId(),
		budgetId: integer('budget_id')
			.notNull()
			.references(() => budgets.id, { onDelete: 'cascade' }),
		effectiveFrom: text('effective_from').notNull(),
		amountCents: integer('amount_cents').notNull().default(0)
	},
	(t) => [uniqueIndex('budget_limits_budget_from_idx').on(t.budgetId, t.effectiveFrom)]
);

export const categories = sqliteTable(
	'categories',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: userId(),
		budgetId: integer('budget_id')
			.notNull()
			.references(() => budgets.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		icon: text('icon').notNull().default(''),
		sortOrder: integer('sort_order').notNull().default(0),
		archived: integer('archived', { mode: 'boolean' }).notNull().default(false)
	},
	(t) => [index('categories_user_idx').on(t.userId), index('categories_budget_idx').on(t.budgetId)]
);

export const places = sqliteTable(
	'places',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: userId(),
		name: text('name').notNull(),
		address: text('address').notNull().default(''),
		lat: real('lat'),
		lng: real('lng'),
		defaultCategoryId: integer('default_category_id').references(() => categories.id, {
			onDelete: 'set null'
		}),
		archived: integer('archived', { mode: 'boolean' }).notNull().default(false)
	},
	(t) => [index('places_user_idx').on(t.userId)]
);

export const recurringRules = sqliteTable(
	'recurring_rules',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: userId(),
		kind: text('kind', { enum: ['expense', 'income'] }).notNull(),
		amountCents: integer('amount_cents').notNull(),
		categoryId: integer('category_id').references(() => categories.id, { onDelete: 'cascade' }),
		placeId: integer('place_id').references(() => places.id, { onDelete: 'set null' }),
		source: text('source').notNull().default(''),
		description: text('description').notNull().default(''),
		frequency: text('frequency', { enum: ['monthly', 'weekly', 'yearly'] }).notNull(),
		dayOfMonth: integer('day_of_month').notNull().default(1),
		startDate: text('start_date').notNull(),
		endDate: text('end_date'),
		nextDueDate: text('next_due_date').notNull(),
		active: integer('active', { mode: 'boolean' }).notNull().default(true),
		createdAt: createdAt()
	},
	(t) => [index('recurring_user_idx').on(t.userId)]
);

export const expenses = sqliteTable(
	'expenses',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: userId(),
		date: text('date').notNull(),
		totalCents: integer('total_cents').notNull(),
		placeId: integer('place_id').references(() => places.id, { onDelete: 'set null' }),
		description: text('description').notNull().default(''),
		recurringRuleId: integer('recurring_rule_id').references(() => recurringRules.id, {
			onDelete: 'set null'
		}),
		occurrenceDate: text('occurrence_date'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		index('expenses_user_date_idx').on(t.userId, t.date),
		uniqueIndex('expenses_rule_occurrence_idx').on(t.recurringRuleId, t.occurrenceDate)
	]
);

export const expenseSplits = sqliteTable(
	'expense_splits',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: userId(),
		expenseId: integer('expense_id')
			.notNull()
			.references(() => expenses.id, { onDelete: 'cascade' }),
		categoryId: integer('category_id')
			.notNull()
			.references(() => categories.id, { onDelete: 'cascade' }),
		amountCents: integer('amount_cents').notNull()
	},
	(t) => [
		index('splits_expense_idx').on(t.expenseId),
		index('splits_category_idx').on(t.categoryId)
	]
);

export const tags = sqliteTable(
	'tags',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: userId(),
		name: text('name').notNull(),
		color: text('color').notNull().default('#64748b')
	},
	(t) => [uniqueIndex('tags_user_name_idx').on(t.userId, t.name)]
);

export const expenseTags = sqliteTable(
	'expense_tags',
	{
		userId: userId(),
		expenseId: integer('expense_id')
			.notNull()
			.references(() => expenses.id, { onDelete: 'cascade' }),
		tagId: integer('tag_id')
			.notNull()
			.references(() => tags.id, { onDelete: 'cascade' })
	},
	(t) => [primaryKey({ columns: [t.expenseId, t.tagId] })]
);

export const photos = sqliteTable(
	'photos',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: userId(),
		expenseId: integer('expense_id')
			.notNull()
			.references(() => expenses.id, { onDelete: 'cascade' }),
		file: text('file').notNull(),
		thumbFile: text('thumb_file').notNull(),
		mime: text('mime').notNull(),
		width: integer('width').notNull(),
		height: integer('height').notNull(),
		size: integer('size').notNull(),
		createdAt: createdAt()
	},
	(t) => [index('photos_expense_idx').on(t.expenseId)]
);

export const incomes = sqliteTable(
	'incomes',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: userId(),
		date: text('date').notNull(),
		amountCents: integer('amount_cents').notNull(),
		source: text('source').notNull().default(''),
		description: text('description').notNull().default(''),
		recurringRuleId: integer('recurring_rule_id').references(() => recurringRules.id, {
			onDelete: 'set null'
		}),
		occurrenceDate: text('occurrence_date'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		index('incomes_user_date_idx').on(t.userId, t.date),
		uniqueIndex('incomes_rule_occurrence_idx').on(t.recurringRuleId, t.occurrenceDate)
	]
);

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Place = typeof places.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type ExpenseSplit = typeof expenseSplits.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type Income = typeof incomes.$inferSelect;
export type RecurringRule = typeof recurringRules.$inferSelect;
