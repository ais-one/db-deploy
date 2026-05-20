// =============================================================================
// src/schemas/instance-1/db-inventory/index.ts
// =============================================================================
// Drizzle schema for the db-inventory database (Postgres).
// =============================================================================

import {
  pgTable,
  bigserial,
  bigint,
  varchar,
  integer,
  numeric,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ── products ───────────────────────────────────────────────────────────────

export const products = pgTable(
  'products',
  {
    id:          bigserial('id', { mode: 'number' }).primaryKey(),
    sku:         varchar('sku', { length: 100 }).notNull(),
    name:        varchar('name', { length: 255 }).notNull(),
    description: varchar('description', { length: 2000 }),
    unitCost:    numeric('unit_cost', { precision: 12, scale: 2 }).notNull(),
    isActive:    boolean('is_active').notNull().default(true),
    createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uk_products_sku').on(table.sku),
    index('idx_products_is_active').on(table.isActive),
    check('chk_products_unit_cost', sql`${table.unitCost} >= 0`),
  ]
);

// ── stock_levels ───────────────────────────────────────────────────────────

export const stockLevels = pgTable(
  'stock_levels',
  {
    id:          bigserial('id', { mode: 'number' }).primaryKey(),
    productId:   bigint('product_id', { mode: 'number' }).notNull().references(() => products.id),
    warehouseId: bigint('warehouse_id', { mode: 'number' }).notNull(),
    quantity:    integer('quantity').notNull().default(0),
    updatedAt:   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_stock_product_id').on(table.productId),
    index('idx_stock_warehouse_id').on(table.warehouseId),
    check('chk_stock_quantity', sql`${table.quantity} >= 0`),
  ]
);

// ── Types ──────────────────────────────────────────────────────────────────

export type Product      = typeof products.$inferSelect;
export type NewProduct   = typeof products.$inferInsert;
export type StockLevel    = typeof stockLevels.$inferSelect;
export type NewStockLevel = typeof stockLevels.$inferInsert;
