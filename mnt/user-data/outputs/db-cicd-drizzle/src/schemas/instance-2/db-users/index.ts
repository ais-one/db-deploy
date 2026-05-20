// =============================================================================
// src/schemas/instance-2/db-users/index.ts
// =============================================================================
// Drizzle schema for the db-users database (MySQL).
// =============================================================================

import {
  mysqlTable,
  bigint,
  varchar,
  mysqlEnum,
  datetime,
  uniqueIndex,
  index,
} from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

// ── users ──────────────────────────────────────────────────────────────────

export const users = mysqlTable(
  'users',
  {
    id:          bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    email:       varchar('email', { length: 255 }).notNull(),
    displayName: varchar('display_name', { length: 100 }).notNull(),
    status:      mysqlEnum('status', ['active', 'suspended', 'deleted']).notNull().default('active'),
    createdAt:   datetime('created_at', { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt:   datetime('updated_at', { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    uniqueIndex('uk_users_email').on(table.email),
    index('idx_users_status').on(table.status),
  ]
);

// ── user_sessions ──────────────────────────────────────────────────────────

export const userSessions = mysqlTable(
  'user_sessions',
  {
    id:        bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    userId:    bigint('user_id', { mode: 'number', unsigned: true }).notNull().references(() => users.id),
    token:     varchar('token', { length: 512 }).notNull(),
    expiresAt: datetime('expires_at', { fsp: 3 }).notNull(),
    createdAt: datetime('created_at', { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    uniqueIndex('uk_sessions_token').on(table.token),
    index('idx_sessions_user_id').on(table.userId),
    index('idx_sessions_expires_at').on(table.expiresAt),
  ]
);

// ── Types ──────────────────────────────────────────────────────────────────

export type User           = typeof users.$inferSelect;
export type NewUser        = typeof users.$inferInsert;
export type UserSession    = typeof userSessions.$inferSelect;
export type NewUserSession = typeof userSessions.$inferInsert;
