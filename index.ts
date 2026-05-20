// =============================================================================
// src/schemas/instance-1/db-orders/index.ts
// =============================================================================
// Drizzle schema definition for the db-orders database (Postgres).
//
// THIS IS THE SOURCE OF TRUTH. Never edit migration SQL files by hand —
// change this file, then run:
//   drizzle-kit generate --config=config/drizzle/instance-1.db-orders.ts
//
// Drizzle will diff this schema against the last generated snapshot and
// produce a new numbered SQL migration file automatically.
// =============================================================================

import {
  pgTable,
  bigserial,
  bigint,
  varchar,
  numeric,
  char,
  timestamp,
  integer,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ── orders ─────────────────────────────────────────────────────────────────

export const orders = pgTable(
  'orders',
  {
    id:          bigserial('id', { mode: 'number' }).primaryKey(),
    customerId:  bigint('customer_id', { mode: 'number' }).notNull(),
    status:      varchar('status', { length: 50 }).notNull().default('pending'),
    totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
    currency:    char('currency', { length: 3 }).notNull().default('USD'),
    createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_orders_customer_id').on(table.customerId),
    index('idx_orders_status').on(table.status),
    check('chk_orders_total_amount', sql`${table.totalAmount} >= 0`),
  ]
);

// ── order_items ────────────────────────────────────────────────────────────

export const orderItems = pgTable(
  'order_items',
  {
    id:        bigserial('id', { mode: 'number' }).primaryKey(),
    orderId:   bigint('order_id', { mode: 'number' }).notNull().references(() => orders.id, { onDelete: 'cascade' }),
    productId: bigint('product_id', { mode: 'number' }).notNull(),
    quantity:  integer('quantity').notNull(),
    unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_order_items_order_id').on(table.orderId),
    index('idx_order_items_product_id').on(table.productId),
    check('chk_order_items_quantity', sql`${table.quantity} > 0`),
    check('chk_order_items_unit_price', sql`${table.unitPrice} >= 0`),
  ]
);

// ── Types (inferred from schema — use in application code) ─────────────────

export type Order     = typeof orders.$inferSelect;
export type NewOrder  = typeof orders.$inferInsert;
export type OrderItem    = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
