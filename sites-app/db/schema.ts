import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const records = sqliteTable('records', {
  id: text('id').primaryKey(), type: text('type').notNull(), title: text('title').notNull(), body: text('body').notNull().default(''),
  place: text('place').notNull().default(''), category: text('category').notNull().default(''), photoKey: text('photo_key').notNull().default(''),
  occurredOn: text('occurred_on').notNull().default(''), openOn: text('open_on').notNull().default(''), author: text('author').notNull().default(''),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(), deletedAt: text('deleted_at'),
}, t => [index('idx_records_type_created').on(t.type,t.createdAt)]);
export const preferences = sqliteTable('preferences', {key:text('key').primaryKey(), value:text('value').notNull(),updatedAt:text('updated_at').notNull()});
export const loginAttempts = sqliteTable('login_attempts', {key:text('key').primaryKey(),failures:integer('failures').notNull().default(0),windowStart:integer('window_start').notNull(),blockedUntil:integer('blocked_until').notNull().default(0)});
